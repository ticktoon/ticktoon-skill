/**
 * ① schema —— 结构校验与规范化。
 *
 * 只做"能不能往下走"的判断，不碰时间、不碰画面：
 *   - 文件存在性（block / recipe / font / sfx）
 *   - 键的合法性：未知键直接报错，不静默忽略
 *   - 参数合法性：按 block.json 的 params 逐个判，缺省值在这里补齐
 *   - 结构互斥：`narration` 与 `duration` 只能有一个
 *
 * 缺省值必须在这里补齐，而不是留给 block 用 `p.x || 默认值`：
 * 补齐之后 emit 出来的参数对象就是完整的，receipts 与 report 里的字段才不会时有时无。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { Bag, isPlainObject } from './diag.mjs';
import { normalizeCaption } from './captions.mjs';
import { validateRecipeV8 } from './recipe.mjs';
import { scanSceneCode } from './code-scan.mjs';
import { PACING, estimateSpeech } from './resolve.mjs';

export const RESERVED_ELEMENT_KEYS = ['block', 'slot', 'rect', 'at', 'dur', 'sfx', 'sfxAt'];
// `code` 是 scene 的另一种内容形态：它和 elements 可以共存，二者都不改变时间链。
export const SCENE_KEYS = ['id', 'narration', 'duration', 'camera', 'elements', 'code', 'resources', 'note', 'transitionIn', 'transitionOut'];
export const TRANSITION_OUT_TYPES = ['cut', 'dip-to-color', 'wipe', 'push', 'page', 'zoom-out', 'glitch'];
export const TRANSITION_IN_TYPES = ['cut', 'fade-in', 'iris', 'zoom-punch', 'glitch-in'];
export const TRANSITION_KEYS = ['type', 'dur', 'dir', 'color', 'at'];
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
export const ROOT_KEYS = ['recipe', 'format', 'meta', 'beats', 'scenes', 'uses'];
export const SUPPORTED_FORMATS = [
  { w: 1920, h: 1080, fps: 30 },
  { w: 1080, h: 1920, fps: 30 },
];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf-8'));
}

/**
 * 载入全部静态契约。一次读盘、全程复用；`tt build` 是多 pass 的，
 * 每 pass 重读 block.json 会让 <2s 的预算白花在 IO 上。
 */
export function loadCatalog(root) {
  const platform = path.join(root, 'platform');
  const blocks = new Map();
  const captions = new Map();
  const recipes = new Map();
  const fontManifestPath = path.join(root, 'assets', 'fonts', 'manifest.json');
  const fonts = existsSync(fontManifestPath) ? readJson(fontManifestPath) : {};

  for (const file of walk(path.join(platform, 'blocks'))) {
    if (path.basename(file) !== 'block.json') continue;
    const dir = path.dirname(file);
    const meta = readJson(file);
    const drawPath = path.join(dir, 'draw.js');
    if (!existsSync(drawPath)) throw new Error(`block ${meta.id} 缺少 draw.js: ${dir}`);
    const draw = readFileSync(drawPath, 'utf-8');
    const demoPath = path.join(dir, 'demo.json');
    blocks.set(meta.id, {
      ...meta,
      dir,
      draw,
      demo: existsSync(demoPath) ? readJson(demoPath) : null,
      // 词法级事实，供 ⑥ check 对账：block 有没有注册 setup、有没有用字体
      hasSetup: /\bSETUP\[/.test(draw),
      usesFont: /\bfont\s*\(/.test(draw),
    });
  }

  // captions/core.js 不是样式；只有 captions/styles/*.js 会注册成用户可选 id。
  const captionsDir = path.join(platform, 'kit', 'captions');
  const captionKit = readFileSync(path.join(captionsDir, 'core.js'), 'utf-8');
  for (const file of walk(path.join(captionsDir, 'styles'))) {
    if (!file.endsWith('.js')) continue;
    captions.set(path.basename(file, '.js'), readFileSync(file, 'utf-8'));
  }

  const recipesDir = path.join(root, 'recipes');
  for (const file of walk(recipesDir)) {
    if (path.basename(file) !== 'recipe.json') continue;
    const dir = path.dirname(file);
    const recipe = readJson(file);
    const rel = path.relative(recipesDir, dir).split(path.sep).join('/');
    const entry = {
      ...recipe,
      dir,
      brief: existsSync(path.join(dir, 'brief.md')) ? readFileSync(path.join(dir, 'brief.md'), 'utf-8') : '',
    };
    // 读入时校验视觉规范；错误挂在条目上，选中该 recipe 时才升级为 build error。
    // 校验只看 recipe.json 本身，dir / brief 是载入期附带的运行上下文。
    entry.v8Errors = validateRecipeV8(recipe, blocks, fonts);
    recipes.set(recipe.id || rel, entry);
  }

  const sfxManifestPath = path.join(root, 'assets', 'sfx', 'manifest.json');
  const bgmManifestPath = path.join(root, 'assets', 'bgm', 'manifest.json');

  return {
    root,
    platform,
    blocks,
    captions,
    captionKit,
    recipes,
    fonts,
    sfx: existsSync(sfxManifestPath) ? readJson(sfxManifestPath) : {},
    bgm: existsSync(bgmManifestPath) ? readJson(bgmManifestPath) : {},
  };
}

/** scene.resources：与引擎 ClipResource 同形，供 code 里的 api.img/api.video 使用。 */
function normalizeSceneResources(raw, bag, at) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    bag.error('SCENE_RESOURCES_TYPE', `${at}.resources`, 'resources 必须是 {type, name, src} 数组');
    return [];
  }
  const out = [];
  const seen = new Set();
  raw.forEach((res, ri) => {
    const path = `${at}.resources[${ri}]`;
    if (!isPlainObject(res)) {
      bag.error('SCENE_RESOURCE_TYPE', path, '资源必须是对象 {type, name, src}');
      return;
    }
    for (const key of Object.keys(res)) {
      if (!['type', 'name', 'src', 'start'].includes(key)) {
        bag.error('SCENE_RESOURCE_UNKNOWN_KEY', `${path}.${key}`,
          `资源不认识键 "${key}"，可用：type / name / src / start`);
      }
    }
    if (!['image', 'video', 'font'].includes(res.type)) {
      bag.error('SCENE_RESOURCE_TYPE', `${path}.type`,
        `资源 type 只能是 image / video / font，收到 ${JSON.stringify(res.type)}`);
      return;
    }
    if (typeof res.name !== 'string' || !res.name.trim()) {
      bag.error('SCENE_RESOURCE_NAME', `${path}.name`, '资源必须有非空字符串 name');
      return;
    }
    if (typeof res.src !== 'string' || !res.src.trim()) {
      bag.error('SCENE_RESOURCE_SRC', `${path}.src`, '资源必须有非空字符串 src');
      return;
    }
    if (res.start !== undefined) {
      if (res.type !== 'video') {
        bag.error('SCENE_RESOURCE_START', `${path}.start`, '只有 video 资源可以写 start');
      } else if (!(Number(res.start) >= 0)) {
        bag.error('SCENE_RESOURCE_START', `${path}.start`,
          `start 必须是非负秒数，收到 ${JSON.stringify(res.start)}`);
      }
    }
    const name = res.name.trim();
    const key = `${res.type}:${name}`;
    if (seen.has(key)) {
      bag.error('SCENE_RESOURCE_DUPLICATE', path, `${res.type} 资源名重复：${name}`);
      return;
    }
    seen.add(key);
    const entry = { type: res.type, name, src: res.src };
    if (res.type === 'video' && res.start !== undefined) entry.start = Number(res.start);
    out.push(entry);
  });
  return out;
}

/** code 允许写字符串或字符串数组；数组按换行拼，方便在 JSON 里写多行。 */
function normalizeSceneCode(raw, bag, at) {
  if (raw === undefined) return null;
  let text;
  if (typeof raw === 'string') {
    text = raw;
  } else if (Array.isArray(raw) && raw.every((line) => typeof line === 'string')) {
    text = raw.join('\n');
  } else {
    bag.error('SCENE_CODE_TYPE', `${at}.code`, 'code 必须是字符串，或字符串数组');
    return null;
  }
  text = text.replace(/\r\n/g, '\n');
  if (!text.trim()) {
    bag.error('SCENE_CODE_EMPTY', `${at}.code`, 'code 不能是空串或全空白');
    return null;
  }
  if (text.length > 20000) {
    bag.error('SCENE_CODE_TOO_LONG', `${at}.code`,
      `code 上限 20000 字符，收到 ${text.length}；把公共部分抽成 lib 或在 storyboard 里拆成多场`);
    return null;
  }
  return text;
}

function checkParams(element, meta, bag, at) {
  const spec = meta.params || {};
  const params = {};
  const known = new Set(Object.keys(spec));

  for (const key of Object.keys(element)) {
    if (RESERVED_ELEMENT_KEYS.includes(key)) continue;
    if (!known.has(key)) {
      bag.error('BLOCK_PARAM_UNKNOWN', `${at}.${key}`,
        `${meta.id} 不认识参数 "${key}"，可用参数：${Object.keys(spec).join(' / ') || '（无）'}`);
    }
  }

  for (const [key, rule] of Object.entries(spec)) {
    const raw = element[key];
    const missing = raw === undefined || raw === null || raw === '';

    if (missing) {
      if (rule.required) {
        bag.error('BLOCK_PARAM_REQUIRED', `${at}.${key}`, `${meta.id} 需要参数 "${key}"`);
        continue;
      }
      if (rule.default !== undefined) params[key] = rule.default;
      continue;
    }

    switch (rule.type) {
      case 'number': {
        const n = Number(raw);
        if (!Number.isFinite(n)) {
          bag.error('BLOCK_PARAM_TYPE', `${at}.${key}`, `"${key}" 必须是数字，收到 ${JSON.stringify(raw)}`);
          continue;
        }
        params[key] = n;
        break;
      }
      case 'boolean': {
        if (typeof raw !== 'boolean') {
          bag.error('BLOCK_PARAM_TYPE', `${at}.${key}`, `"${key}" 必须是 true/false`);
          continue;
        }
        params[key] = raw;
        break;
      }
      case 'array': {
        // 字符串数组：要点列表、引语行。JSON 里直接写数组，schema 在这里拦形状。
        if (!Array.isArray(raw) || !raw.every((item) => typeof item === 'string')) {
          bag.error('BLOCK_PARAM_TYPE', `${at}.${key}`, `"${key}" 必须是字符串数组`);
          continue;
        }
        if (rule.maxItems && raw.length > rule.maxItems) {
          bag.error('BLOCK_PARAM_MAXITEMS', `${at}.${key}`,
            `${meta.id} 的 "${key}" 上限 ${rule.maxItems} 项，收到 ${raw.length} 项`);
        }
        const limit = rule.maxChars || 24;
        for (const item of raw) {
          if ([...item].length > limit) {
            bag.error('BLOCK_PARAM_MAXCHARS', `${at}.${key}`,
              `"${key}" 每项上限 ${limit} 字，收到 "${[...item].length > 30 ? item.slice(0, 30) + '…' : item}"`);
          }
        }
        params[key] = raw;
        break;
      }
      case 'objects': {
        // 结构化对象数组：版式型 block 的姿态槽 / 图标槽。
        // fields 描述每个键的 enum / type / default，编译期填默认值并拦未知枚举，
        // 让 block 不再需要写死题材，也不用到处做运行期兜底。
        if (!Array.isArray(raw) || !raw.every(isPlainObject)) {
          bag.error('BLOCK_PARAM_TYPE', `${at}.${key}`, `"${key}" 必须是对象数组`);
          continue;
        }
        if (rule.maxItems && raw.length > rule.maxItems) {
          bag.error('BLOCK_PARAM_MAXITEMS', `${at}.${key}`,
            `${meta.id} 的 "${key}" 上限 ${rule.maxItems} 项，收到 ${raw.length} 项`);
        }
        const fields = rule.fields || {};
        params[key] = raw.map((item, i) => {
          const out = {};
          for (const [fk, fr] of Object.entries(fields)) {
            const value = item[fk];
            if (value === undefined || value === null || value === '') {
              if (fr.default !== undefined) out[fk] = fr.default;
              continue;
            }
            if (Array.isArray(fr.enum) && !fr.enum.includes(value)) {
              bag.error('BLOCK_PARAM_TYPE', `${at}.${key}[${i}].${fk}`,
                `"${fk}" 只能是 ${fr.enum.join(' / ')}，收到 "${value}"`);
              if (fr.default !== undefined) out[fk] = fr.default;
              continue;
            }
            if (fr.type === 'number') {
              const n = Number(value);
              if (!Number.isFinite(n)) {
                bag.error('BLOCK_PARAM_TYPE', `${at}.${key}[${i}].${fk}`, `"${fk}" 必须是数字`);
                continue;
              }
              out[fk] = n;
              continue;
            }
            out[fk] = value;
          }
          return out;
        });
        break;
      }
      case 'rows': {
        // 图表行：{ label, value }。label 上限 12 字，value 必须是有限数字。
        const ok = Array.isArray(raw) && raw.length > 0
          && raw.every((item) => isPlainObject(item) && typeof item.label === 'string' && Number.isFinite(Number(item.value)));
        if (!ok) {
          bag.error('BLOCK_PARAM_TYPE', `${at}.${key}`,
            `"${key}" 必须是 [{ label, value }] 数组，如 [{"label":"火灾","value":200}]`);
          continue;
        }
        if (rule.minItems && raw.length < rule.minItems) {
          bag.error('BLOCK_PARAM_MINITEMS', `${at}.${key}`,
            `${meta.id} 的 "${key}" 至少需要 ${rule.minItems} 行，收到 ${raw.length} 行`);
        }
        if (rule.maxItems && raw.length > rule.maxItems) {
          bag.error('BLOCK_PARAM_MAXITEMS', `${at}.${key}`,
            `${meta.id} 的 "${key}" 上限 ${rule.maxItems} 行，收到 ${raw.length} 行（图表超过 6 行就该换 stat）`);
        }
        for (const item of raw) {
          if ([...item.label].length > 12) {
            bag.error('BLOCK_PARAM_MAXCHARS', `${at}.${key}`, `"${key}" 的 label 上限 12 字`);
          }
        }
        params[key] = raw.map((item) => ({ label: item.label, value: Number(item.value) }));
        break;
      }
      case 'string': {
        if (typeof raw !== 'string') {
          bag.error('BLOCK_PARAM_TYPE', `${at}.${key}`, `"${key}" 必须是字符串`);
          continue;
        }
        params[key] = raw;
        if (rule.maxChars && [...raw].length > rule.maxChars) {
          bag.error('BLOCK_PARAM_MAXCHARS', `${at}.${key}`,
            `${meta.id} 的 "${key}" 上限 ${rule.maxChars} 字，收到 ${[...raw].length} 字（放不下就是放不下，不是警告）`);
        }
        // 多行字符串的可见行数限制。空行是段落间距，不计入行数。
        if (rule.minLines || rule.maxLines) {
          const lineCount = raw.split('\n').filter((line) => line.trim()).length;
          if (rule.minLines && lineCount < rule.minLines) {
            bag.error('BLOCK_PARAM_MINLINES', `${at}.${key}`,
              `${meta.id} 的 "${key}" 至少 ${rule.minLines} 个可见行（空行不计），收到 ${lineCount} 行`);
          }
          if (rule.maxLines && lineCount > rule.maxLines) {
            bag.error('BLOCK_PARAM_MAXLINES', `${at}.${key}`,
              `${meta.id} 的 "${key}" 上限 ${rule.maxLines} 个可见行（空行不计），收到 ${lineCount} 行`);
          }
        }
        break;
      }
      default: {
        // enum 型（无 type 字段，只有 enum）
        if (Array.isArray(rule.enum)) {
          if (!rule.enum.includes(raw)) {
            bag.error('BLOCK_PARAM_ENUM', `${at}.${key}`,
              `"${key}" 只能是 ${rule.enum.join(' / ')}，收到 ${JSON.stringify(raw)}`);
            continue;
          }
          params[key] = raw;
        } else {
          params[key] = raw;
        }
      }
    }
  }

  return params;
}

/**
 * @returns {{ storyboard, bag, recipe, fonts, caption }}
 *   storyboard 是规范化结果：缺省值补齐、`dur` 留空等 plan 填。
 */
/**
 * scene.transitionIn / transitionOut 的规范化。
 *
 * schema 阶段还不知道 TTS 的真实时长，旁白场只能用 estimateSpeech + pacing 估；
 * 这和 plan 里旁白场的算法一致，但 TTS 接通后可能有几十毫秒误差。因此 `dur` 的
 * 40% 上限在旁白场是**估算校验**，不是最终渲染时长的硬保证；换 TTS 后重跑 build 会再校一次。
 */
function normalizeTransition(raw, direction, bag, at, sceneDuration, estimated = false) {
  if (raw === undefined || raw === null) return null;
  if (!isPlainObject(raw)) {
    bag.error('TRANSITION_TYPE', at, `${at} 必须是对象 {type, dur, dir, color, at}`);
    return null;
  }
  for (const key of Object.keys(raw)) {
    if (!TRANSITION_KEYS.includes(key)) {
      bag.error('TRANSITION_UNKNOWN_KEY', `${at}.${key}`,
        `过渡不认识键 "${key}"，可用：${TRANSITION_KEYS.join(' / ')}`);
    }
  }
  if (typeof raw.type !== 'string' || !raw.type.trim()) {
    bag.error('TRANSITION_TYPE', `${at}.type`, `${at}.type 必须是非空字符串；cut 也要显式写 type`);
    return null;
  }
  const type = raw.type.trim();
  const allowed = direction === 'in' ? TRANSITION_IN_TYPES : TRANSITION_OUT_TYPES;
  if (!allowed.includes(type)) {
    bag.error('TRANSITION_UNKNOWN', `${at}.type`,
      `${direction === 'in' ? 'transitionIn' : 'transitionOut'} 不支持 "${type}"，可用：${allowed.join(' / ')}`);
    return null;
  }
  if (type === 'cut') {
    // cut 是严格 no-op：其余字段不参与任何绘制，也不制造告警。
    return { type: 'cut', dur: 0, dir: null, color: null, at: null };
  }

  const dur = raw.dur === undefined || raw.dur === null ? 0.3 : Number(raw.dur);
  if (!Number.isFinite(dur) || !(dur > 0)) {
    bag.error('TRANSITION_DUR_INVALID', `${at}.dur`, `dur 必须是正数，收到 ${JSON.stringify(raw.dur)}`);
    return null;
  }
  if (sceneDuration > 0) {
    const limit = sceneDuration * 0.4;
    if (dur > limit + 1e-9) {
      bag.error('TRANSITION_TOO_LONG', `${at}.dur`,
        `dur=${dur}s 超过场景时长的 40%（上限 ${limit.toFixed(3)}s，场景 ${sceneDuration.toFixed(3)}s${estimated ? '，按旁白估算' : ''}）；` +
        '过渡太长会和内容抢时间，把 dur 收到上限内或删掉过渡');
    }
  }

  const dirMap = { l: 'l', r: 'r', u: 'u', d: 'd', left: 'l', right: 'r', up: 'u', down: 'd' };
  let dir = 'l';
  if (raw.dir !== undefined) {
    const normalized = typeof raw.dir === 'string' ? dirMap[raw.dir.toLowerCase()] : null;
    if (normalized) dir = normalized;
    else {
      bag.warn('should', 'TRANSITION_DIR_UNKNOWN', `${at}.dir`,
        `dir 只能是 l / r / u / d（也接受 left / right / up / down），收到 ${JSON.stringify(raw.dir)}；已回落到 l`);
    }
  }

  let color = '#000000';
  if (raw.color !== undefined && raw.color !== null) {
    if (typeof raw.color === 'string' && HEX_COLOR.test(raw.color)) {
      color = raw.color;
    } else {
      bag.warn('should', 'TRANSITION_COLOR_UNKNOWN', `${at}.color`,
        `color 只能是 #rgb/#rrggbb/#rrggbbaa，收到 ${JSON.stringify(raw.color)}；已回落到 #000000`);
    }
  }

  let atPoint = [0.5, 0.5];
  if (raw.at !== undefined) {
    const ok = Array.isArray(raw.at) && raw.at.length === 2
      && raw.at.every((v) => Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 1);
    if (ok) atPoint = raw.at.map(Number);
    else {
      bag.error('TRANSITION_AT_INVALID', `${at}.at`,
        'at 必须是归一化的 [x, y]（两项都在 0–1）；iris 用它定位圆心');
    }
  }

  return { type, dur, dir, color, at: atPoint };
}

export function normalizeStoryboard(input, catalog, captionOverride = null) {
  const bag = new Bag();
  const out = { recipe: null, format: null, meta: {}, beats: {}, scenes: [] };

  if (!isPlainObject(input)) {
    bag.error('ROOT_TYPE', '', 'storyboard 必须是一个对象');
    return { storyboard: out, bag, recipe: null, fonts: null, caption: null };
  }

  for (const key of Object.keys(input)) {
    if (!ROOT_KEYS.includes(key)) {
      bag.error('ROOT_UNKNOWN_KEY', key, `storyboard 不认识顶层键 "${key}"，可用：${ROOT_KEYS.join(' / ')}`);
    }
  }

  // --- recipe ---
  const recipe = catalog.recipes.get(input.recipe);
  if (!input.recipe) {
    bag.error('RECIPE_MISSING', 'recipe', `缺少 recipe；可用：${[...catalog.recipes.keys()].join(' / ')}`);
  } else if (!recipe) {
    bag.error('RECIPE_UNKNOWN', 'recipe', `未注册的 recipe "${input.recipe}"；可用：${[...catalog.recipes.keys()].join(' / ')}`);
  }
  const fonts = recipe?.fonts || null;
  if (recipe) {
    out.recipe = recipe.id;
    // loadCatalog 的结构错误在这里变成 build 的硬失败。
    for (const error of recipe.v8Errors || []) bag.error(error.code, error.path, error.msg);
  }

  // 工程级覆盖：storyboard 顶层 `uses` 只放行字幕选择，用来让同一条 recipe
  // 在不同成片里换字幕样式，不改 recipe 的默认契约。theme 已移除，显式报迁移错误。
  let storyboardCaption = null;
  if (input.uses !== undefined) {
    if (!isPlainObject(input.uses)) {
      bag.error('USES_TYPE', 'uses', 'uses 必须是对象');
    } else {
      for (const key of Object.keys(input.uses)) {
        if (key !== 'captions') {
          bag.error('USES_UNKNOWN_KEY', `uses.${key}`,
            key === 'theme'
              ? 'storyboard 不再支持 uses.theme：字体契约在 recipe.fonts 里，字幕用 uses.captions 或 CLI --captions'
              : 'storyboard 的 uses 只支持 captions');
        }
      }
      if (input.uses.captions !== undefined) storyboardCaption = input.uses.captions;
    }
  }

  const captionInput = captionOverride ?? storyboardCaption ?? recipe?.captions;
  const caption = fonts
    ? normalizeCaption(captionInput, catalog, fonts, bag, { margin: recipe?.rules?.safeMargin })
    : null;

  // --- format ---
  const fmt = Object.assign({ w: 1920, h: 1080, fps: 30 }, input.format || {});
  const supported = SUPPORTED_FORMATS.some((s) => s.w === fmt.w && s.h === fmt.h && s.fps === fmt.fps);
  if (!supported) {
    bag.error('FORMAT_UNSUPPORTED', 'format',
      `P0 只支持 1920×1080@30 与 1080×1920@30，收到 ${fmt.w}×${fmt.h}@${fmt.fps}`);
  }
  out.format = fmt;

  // --- meta / beats ---
  if (input.meta !== undefined) {
    if (!isPlainObject(input.meta)) bag.error('META_TYPE', 'meta', 'meta 必须是对象');
    else out.meta = input.meta;
  }
  if (input.beats !== undefined) {
    if (!isPlainObject(input.beats)) bag.error('BEATS_TYPE', 'beats', 'beats 必须是 { 名称: 秒 } 的对象');
    else {
      for (const [name, value] of Object.entries(input.beats)) {
        if (!Number.isFinite(Number(value))) {
          bag.error('BEAT_TYPE', `beats.${name}`, `beat "${name}" 必须是秒数，收到 ${JSON.stringify(value)}`);
        } else {
          out.beats[name] = Number(value);
        }
      }
    }
  }

  // --- scenes ---
  if (!Array.isArray(input.scenes) || !input.scenes.length) {
    bag.error('SCENES_EMPTY', 'scenes', 'scenes 必须是非空数组');
    return { storyboard: out, bag, recipe, fonts, caption };
  }

  const seen = new Set();
  input.scenes.forEach((raw, si) => {
    const at = `scenes[${si}]`;
    if (!isPlainObject(raw)) {
      bag.error('SCENE_TYPE', at, '场景必须是对象');
      return;
    }
    for (const key of Object.keys(raw)) {
      if (!SCENE_KEYS.includes(key)) {
        bag.error('SCENE_UNKNOWN_KEY', `${at}.${key}`,
          `场景不认识键 "${key}"，可用：${SCENE_KEYS.join(' / ')}`);
      }
    }
    const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : null;
    if (!id) bag.error('SCENE_ID_MISSING', `${at}.id`, '场景必须有 id');
    else if (seen.has(id)) bag.error('SCENE_ID_DUPLICATE', `${at}.id`, `场景 id 重复：${id}`);
    else seen.add(id);

    const code = normalizeSceneCode(raw.code, bag, at);
    const sceneResources = normalizeSceneResources(raw.resources, bag, at);
    if (code !== null) {
      const scan = scanSceneCode(code, { sceneId: id || at, resources: sceneResources });
      for (const error of scan.errors) bag.error(error.code, `${at}.code`, error.msg);
      for (const warning of scan.warnings) bag.warn(warning.level || 'should', warning.code, `${at}.code`, warning.msg);
    }

    const hasNarration = typeof raw.narration === 'string' && raw.narration.trim() !== '';
    const hasDuration = raw.duration !== undefined && raw.duration !== null;

    if (hasNarration && hasDuration) {
      bag.error('SCENE_DURATION_CONFLICT', `${at}`,
        `有 narration 就不许写 duration：两个权威必然错位（改旁白时 duration 不会跟着变）。删掉 duration`);
    }
    if (!hasNarration && !hasDuration) {
      bag.error('SCENE_NO_DURATION', `${at}`,
        `既没有 narration 也没有 duration。静默场必须写 duration，旁白场必须写 narration`);
    }
    if (hasDuration && !(Number(raw.duration) > 0)) {
      bag.error('SCENE_DURATION_INVALID', `${at}.duration`, `duration 必须是正数，收到 ${JSON.stringify(raw.duration)}`);
    }

    // 过渡时长的 40% 上限需要一个场景时长；旁白场在这里只能估（TTS 在 resolve 才接入）。
    const estimatedDuration = hasDuration && Number(raw.duration) > 0
      ? Number(raw.duration)
      : hasNarration
        ? Number(((recipe?.pacing?.leadIn ?? PACING.leadIn)
          + estimateSpeech(raw.narration)
          + (recipe?.pacing?.hold ?? PACING.hold)).toFixed(3))
        : 0;
    const transitionIn = normalizeTransition(raw.transitionIn, 'in', bag,
      `${at}.transitionIn`, estimatedDuration, !hasDuration && hasNarration);
    const transitionOut = normalizeTransition(raw.transitionOut, 'out', bag,
      `${at}.transitionOut`, estimatedDuration, !hasDuration && hasNarration);

    let camera = null;
    if (raw.camera !== undefined) {
      if (!isPlainObject(raw.camera)) bag.error('SCENE_CAMERA_TYPE', `${at}.camera`, 'camera 必须是 { from, to }');
      else {
        const from = raw.camera.from === undefined ? 1 : Number(raw.camera.from);
        const to = raw.camera.to === undefined ? from : Number(raw.camera.to);
        if (!(from > 0) || !(to > 0)) {
          bag.error('SCENE_CAMERA_RANGE', `${at}.camera`, 'camera.from / to 必须 > 0');
        } else if (Math.abs(to / from - 1) > 0.6) {
          bag.warn('should', 'CAMERA_STRONG', `${at}.camera`,
            `缩放幅度 ${(Math.abs(to / from - 1) * 100).toFixed(0)}%，超过 60% 会让画面明显晃动`);
          camera = { from, to };
        } else {
          camera = { from, to };
        }
      }
    }

    const elements = [];
    if (!Array.isArray(raw.elements) || !raw.elements.length) {
      if (!code) {
        bag.warn('should', 'SCENE_EMPTY', at, '没有 elements 的场景是一帧纯背景；除非刻意为空，否则至少放一个元素');
      }
    } else {
      raw.elements.forEach((el, ei) => {
        const ep = `${at}.elements[${ei}]`;
        if (!isPlainObject(el)) {
          bag.error('ELEMENT_TYPE', ep, 'element 必须是对象');
          return;
        }
        if (typeof el.block !== 'string') {
          bag.error('ELEMENT_BLOCK_MISSING', `${ep}.block`, 'element 必须有 block');
          return;
        }
        const meta = catalog.blocks.get(el.block);
        if (!meta) {
          bag.error('BLOCK_UNKNOWN', `${ep}.block`,
            `未注册的 block "${el.block}"；可用：${[...catalog.blocks.keys()].join(' / ')}`);
          return;
        }

        const slot = el.slot || meta.defaultSlot;
        if (!slot) {
          bag.error('ELEMENT_SLOT_MISSING', `${ep}.slot`, `${meta.id} 需要 slot`);
        } else if (!meta.layout?.[slot]) {
          bag.error('SLOT_UNKNOWN', `${ep}.slot`,
            `${meta.id} 没有版位 "${slot}"，可用：${Object.keys(meta.layout || {}).join(' / ')}`);
        } else if (Array.isArray(meta.slots) && meta.slots.length && !meta.slots.includes(slot)) {
          bag.warn('should', 'SLOT_OFF_LABEL', `${ep}.slot`,
            `${meta.id} 推荐版位是 ${meta.slots.join(' / ')}，这里用了 ${slot}（可以，但要确认构图）`);
        }

        let rect = null;
        if (el.rect !== undefined) {
          const ok = Array.isArray(el.rect) && el.rect.length === 4 && el.rect.every((v) => Number.isFinite(Number(v)));
          if (!ok) bag.error('ELEMENT_RECT_INVALID', `${ep}.rect`, 'rect 必须是 [x, y, w, h]（归一化 0–1）');
          else rect = el.rect.map(Number);
        }

        if (el.at !== undefined && typeof el.at !== 'number' && typeof el.at !== 'string') {
          bag.error('ELEMENT_AT_TYPE', `${ep}.at`, 'at 必须是秒数或 beats 名称');
        }
        if (el.dur !== undefined && !(Number(el.dur) > 0)) {
          bag.error('ELEMENT_DUR_INVALID', `${ep}.dur`, `dur 必须是正数，收到 ${JSON.stringify(el.dur)}`);
        }

        const params = checkParams(el, meta, bag, ep);

        elements.push({
          id: `el${ei}`,
          block: meta.id,
          slot,
          rect,
          at: el.at === undefined ? 0 : el.at,
          dur: el.dur === undefined ? null : Number(el.dur),
          sfx: el.sfx || null,
          sfxAt: el.sfxAt === undefined ? null : Number(el.sfxAt),
          params,
          meta,
          // 记住作者显式给了哪些参数，resolve 注入 recipe 默认值时要让 element 优先。
          ...(recipe?.abi === '8'
            ? { given: Object.keys(el).filter((key) => !RESERVED_ELEMENT_KEYS.includes(key)) }
            : {}),
        });
      });
    }

    out.scenes.push({
      id,
      narration: hasNarration ? String(raw.narration) : null,
      duration: hasDuration ? Number(raw.duration) : null,
      camera,
      elements,
      code,
      resources: sceneResources,
      note: raw.note || null,
      transitionIn,
      transitionOut,
    });
  });

  return { storyboard: out, bag, recipe, fonts, caption };
}
