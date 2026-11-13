/**
 * ① schema —— 结构校验与规范化。
 *
 * 只做"能不能往下走"的判断，不碰时间、不碰画面：
 *   - recipe 契约（含 template 的 8 字段）
 *   - 键的合法性：未知键直接报错，不静默忽略
 *   - scene.params 按 recipe.template.params 逐个判，缺省值在这里补齐
 *   - 结构互斥：`narration` 与 `duration` 只能有一个
 *
 * params 的缺省值必须在这里补齐，而不是留给模板用 `p.x || 默认值`：
 * 补齐之后 emit 出来的参数对象就是完整的，receipts 与 report 里的字段才不会时有时无。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { Bag, isPlainObject } from './diag.mjs';
import { normalizeCaption } from './captions.mjs';
import { validateRecipe } from './recipe.mjs';
import { scanSceneCode } from './code-scan.mjs';
import { normalizeTransitionPreset } from './transitions.mjs';

// code 与 params 是两种内容形态，由 recipe.mode 决定，同一场不能同时出现。
export const SCENE_KEYS = ['id', 'narration', 'duration', 'camera', 'code', 'params', 'resources', 'note', 'transition'];
export const ROOT_KEYS = ['recipe', 'format', 'meta', 'scenes', 'uses'];
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
 * 每 pass 重读 recipe 会让 <2s 的预算白花在 IO 上。
 */
export function loadCatalog(root) {
  const platform = path.join(root, 'platform');
  const captions = new Map();
  const recipes = new Map();
  const fontManifestPath = path.join(root, 'assets', 'fonts', 'manifest.json');
  const fonts = existsSync(fontManifestPath) ? readJson(fontManifestPath) : {};

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
      doc: existsSync(path.join(dir, 'recipe.md')) ? readFileSync(path.join(dir, 'recipe.md'), 'utf-8') : '',
    };
    // 读入时校验视觉规范；错误挂在条目上，选中该 recipe 时才升级为 build error。
    // 校验只看 recipe.json 本身，dir / doc / drawSource 是载入期附带的运行上下文。
    entry.recipeErrors = validateRecipe(recipe, fonts, dir);
    if (recipe.mode === 'params' && typeof recipe.template?.draw === 'string') {
      const drawPath = path.join(dir, recipe.template.draw);
      entry.template = {
        ...recipe.template,
        drawSource: existsSync(drawPath) ? readFileSync(drawPath, 'utf-8') : '',
      };
    }
    recipes.set(recipe.id || rel, entry);
  }

  const sfxManifestPath = path.join(root, 'assets', 'sfx', 'manifest.json');
  const bgmManifestPath = path.join(root, 'assets', 'bgm', 'manifest.json');

  return {
    root,
    platform,
    captions,
    captionKit,
    recipes,
    fonts,
    sfx: existsSync(sfxManifestPath) ? readJson(sfxManifestPath) : {},
    bgm: existsSync(bgmManifestPath) ? readJson(bgmManifestPath) : {},
  };
}

/**
 * scene.resources：与引擎 ClipResource 同形。
 * image / video 由 api.img / api.video 查询；font 只写 manifest 键，src 由编译期补齐，
 * 引擎按 name 注册 FontFace，族名就是 manifest 键。
 */
function normalizeSceneResources(raw, bag, at, catalog) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    bag.error('SCENE_RESOURCES_TYPE', `${at}.resources`, 'resources 必须是 {type, name, src} 数组');
    return [];
  }
  const out = [];
  const seen = new Set();
  raw.forEach((res, ri) => {
    const where = `${at}.resources[${ri}]`;
    if (!isPlainObject(res)) {
      bag.error('SCENE_RESOURCE_TYPE', where, '资源必须是对象 {type, name, src}');
      return;
    }
    for (const key of Object.keys(res)) {
      if (!['type', 'name', 'src', 'start'].includes(key)) {
        bag.error('SCENE_RESOURCE_UNKNOWN_KEY', `${where}.${key}`,
          `资源不认识键 "${key}"，可用：type / name / src / start`);
      }
    }
    if (!['image', 'video', 'font'].includes(res.type)) {
      bag.error('SCENE_RESOURCE_TYPE', `${where}.type`,
        `资源 type 只能是 image / video / font，收到 ${JSON.stringify(res.type)}`);
      return;
    }
    if (typeof res.name !== 'string' || !res.name.trim()) {
      bag.error('SCENE_RESOURCE_NAME', `${where}.name`, '资源必须有非空字符串 name');
      return;
    }
    const name = res.name.trim();
    if (res.type === 'font') {
      if (res.src !== undefined) {
        bag.error('SCENE_RESOURCE_SRC', where,
          'font 资源只写 manifest 键做 name，不要写 src；src 由编译期按 manifest 补齐');
        return;
      }
      const font = isPlainObject(catalog?.fonts) ? catalog.fonts[name] : null;
      if (!isPlainObject(font) || !font.src) {
        const hint = Object.entries(catalog?.fonts || {})
          .find(([, entry]) => isPlainObject(entry) && entry.family === name);
        bag.error('SCENE_FONT_UNKNOWN', `${where}.name`,
          `字体 "${name}" 不是 assets/fonts/manifest.json 的键${hint ? `；是否想写 "${hint[0]}"？` : `；可用：${Object.keys(catalog?.fonts || {}).filter((key) => isPlainObject(catalog.fonts[key])).join(' / ')}`}`);
        return;
      }
      const key = `${res.type}:${name}`;
      if (seen.has(key)) {
        bag.error('SCENE_RESOURCE_DUPLICATE', where, `${res.type} 资源名重复：${name}`);
        return;
      }
      seen.add(key);
      const rel = font.src.replace(/^skill:/, '');
      if (!existsSync(path.join(catalog.root, rel))) {
        bag.warn('should', 'FONT_FILE_MISSING', `${where}.name`,
          `字体 ${name} 指向的 ${font.src} 不存在，画面会回落到系统字体`);
      }
      // font 的 src 一律以 manifest 为准，不信任手写路径。
      out.push({ type: 'font', name, src: font.src });
      return;
    }
    if (typeof res.src !== 'string' || !res.src.trim()) {
      bag.error('SCENE_RESOURCE_SRC', `${where}.src`, '资源必须有非空字符串 src');
      return;
    }
    if (res.start !== undefined) {
      if (res.type !== 'video') {
        bag.error('SCENE_RESOURCE_START', `${where}.start`, '只有 video 资源可以写 start');
      } else if (!(Number(res.start) >= 0)) {
        bag.error('SCENE_RESOURCE_START', `${where}.start`,
          `start 必须是非负秒数，收到 ${JSON.stringify(res.start)}`);
      }
    }
    const key = `${res.type}:${name}`;
    if (seen.has(key)) {
      bag.error('SCENE_RESOURCE_DUPLICATE', where, `${res.type} 资源名重复：${name}`);
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

function checkParams(values, spec, recipeId, bag, at) {
  const params = {};
  const known = new Set(Object.keys(spec));

  for (const key of Object.keys(values)) {
    if (!known.has(key)) {
      bag.error('PARAM_UNKNOWN', `${at}.${key}`,
        `${recipeId} 不认识参数 "${key}"，可用参数：${Object.keys(spec).join(' / ') || '（无）'}`);
    }
  }

  for (const [key, rule] of Object.entries(spec)) {
    const raw = values[key];
    const missing = raw === undefined || raw === null || raw === '';

    if (missing) {
      if (rule.required) {
        bag.error('PARAM_REQUIRED', `${at}.${key}`, `${recipeId} 需要参数 "${key}"`);
        continue;
      }
      if (rule.default !== undefined) params[key] = rule.default;
      continue;
    }

    switch (rule.type) {
      case 'number': {
        const n = Number(raw);
        if (!Number.isFinite(n)) {
          bag.error('PARAM_TYPE', `${at}.${key}`, `"${key}" 必须是数字，收到 ${JSON.stringify(raw)}`);
          continue;
        }
        params[key] = n;
        break;
      }
      case 'boolean': {
        if (typeof raw !== 'boolean') {
          bag.error('PARAM_TYPE', `${at}.${key}`, `"${key}" 必须是 true/false`);
          continue;
        }
        params[key] = raw;
        break;
      }
      case 'array': {
        // 字符串数组：要点列表、引语行。JSON 里直接写数组，schema 在这里拦形状。
        if (!Array.isArray(raw) || !raw.every((item) => typeof item === 'string')) {
          bag.error('PARAM_TYPE', `${at}.${key}`, `"${key}" 必须是字符串数组`);
          continue;
        }
        if (rule.maxItems && raw.length > rule.maxItems) {
          bag.error('PARAM_MAXITEMS', `${at}.${key}`,
            `${recipeId} 的 "${key}" 上限 ${rule.maxItems} 项，收到 ${raw.length} 项`);
        }
        const limit = rule.maxChars || 24;
        for (const item of raw) {
          if ([...item].length > limit) {
            bag.error('PARAM_MAXCHARS', `${at}.${key}`,
              `"${key}" 每项上限 ${limit} 字，收到 "${[...item].length > 30 ? item.slice(0, 30) + '…' : item}"`);
          }
        }
        params[key] = raw;
        break;
      }
      case 'objects': {
        // 结构化对象数组：模板里的姿态槽 / 图标槽。
        // fields 描述每个键的 enum / type / default，编译期填默认值并拦未知枚举，
        // 让模板不必写死题材，也不用到处做运行期兜底。
        if (!Array.isArray(raw) || !raw.every(isPlainObject)) {
          bag.error('PARAM_TYPE', `${at}.${key}`, `"${key}" 必须是对象数组`);
          continue;
        }
        if (rule.maxItems && raw.length > rule.maxItems) {
          bag.error('PARAM_MAXITEMS', `${at}.${key}`,
            `${recipeId} 的 "${key}" 上限 ${rule.maxItems} 项，收到 ${raw.length} 项`);
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
              bag.error('PARAM_TYPE', `${at}.${key}[${i}].${fk}`,
                `"${fk}" 只能是 ${fr.enum.join(' / ')}，收到 "${value}"`);
              if (fr.default !== undefined) out[fk] = fr.default;
              continue;
            }
            if (fr.type === 'number') {
              const n = Number(value);
              if (!Number.isFinite(n)) {
                bag.error('PARAM_TYPE', `${at}.${key}[${i}].${fk}`, `"${fk}" 必须是数字`);
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
          bag.error('PARAM_TYPE', `${at}.${key}`,
            `"${key}" 必须是 [{ label, value }] 数组，如 [{"label":"火灾","value":200}]`);
          continue;
        }
        if (rule.minItems && raw.length < rule.minItems) {
          bag.error('PARAM_MINITEMS', `${at}.${key}`,
            `${recipeId} 的 "${key}" 至少需要 ${rule.minItems} 行，收到 ${raw.length} 行`);
        }
        if (rule.maxItems && raw.length > rule.maxItems) {
          bag.error('PARAM_MAXITEMS', `${at}.${key}`,
            `${recipeId} 的 "${key}" 上限 ${rule.maxItems} 行，收到 ${raw.length} 行（图表超过 6 行就该换 stat）`);
        }
        for (const item of raw) {
          if ([...item.label].length > 12) {
            bag.error('PARAM_MAXCHARS', `${at}.${key}`, `"${key}" 的 label 上限 12 字`);
          }
        }
        params[key] = raw.map((item) => ({ label: item.label, value: Number(item.value) }));
        break;
      }
      case 'string': {
        if (typeof raw !== 'string') {
          bag.error('PARAM_TYPE', `${at}.${key}`, `"${key}" 必须是字符串`);
          continue;
        }
        params[key] = raw;
        if (rule.maxChars && [...raw].length > rule.maxChars) {
          bag.error('PARAM_MAXCHARS', `${at}.${key}`,
            `${recipeId} 的 "${key}" 上限 ${rule.maxChars} 字，收到 ${[...raw].length} 字（放不下就是放不下，不是警告）`);
        }
        // 多行字符串的可见行数限制。空行是段落间距，不计入行数。
        if (rule.minLines || rule.maxLines) {
          const lineCount = raw.split('\n').filter((line) => line.trim()).length;
          if (rule.minLines && lineCount < rule.minLines) {
            bag.error('PARAM_MINLINES', `${at}.${key}`,
              `${recipeId} 的 "${key}" 至少 ${rule.minLines} 个可见行（空行不计），收到 ${lineCount} 行`);
          }
          if (rule.maxLines && lineCount > rule.maxLines) {
            bag.error('PARAM_MAXLINES', `${at}.${key}`,
              `${recipeId} 的 "${key}" 上限 ${rule.maxLines} 个可见行（空行不计），收到 ${lineCount} 行`);
          }
        }
        break;
      }
      default: {
        // enum 型（无 type 字段，只有 enum）
        if (Array.isArray(rule.enum)) {
          if (!rule.enum.includes(raw)) {
            bag.error('PARAM_ENUM', `${at}.${key}`,
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
 * @returns {{ storyboard, bag, recipe, caption }}
 *   storyboard 是规范化结果：缺省值补齐、`dur` 留空等 plan 填。
 */
export function normalizeStoryboard(input, catalog, captionOverride = null) {
  const bag = new Bag();
  const out = { recipe: null, format: null, meta: {}, scenes: [] };

  if (!isPlainObject(input)) {
    bag.error('ROOT_TYPE', '', 'storyboard 必须是一个对象');
    return { storyboard: out, bag, recipe: null, caption: null };
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
  if (recipe) {
    out.recipe = recipe.id;
    // loadCatalog 的结构错误在这里变成 build 的硬失败。
    for (const error of recipe.recipeErrors || []) bag.error(error.code, error.path, error.msg);
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
              ? 'storyboard 不再支持 uses.theme：字体写在 scene.resources / template.resources，字幕用 uses.captions 或 CLI --captions'
              : 'storyboard 的 uses 只支持 captions');
        }
      }
      if (input.uses.captions !== undefined) storyboardCaption = input.uses.captions;
    }
  }

  const captionInput = captionOverride ?? storyboardCaption ?? recipe?.captions;
  const caption = normalizeCaption(captionInput, catalog, bag, { margin: recipe?.rules?.safeMargin });

  // --- format ---
  const fmt = Object.assign({ w: 1920, h: 1080, fps: 30 }, input.format || {});
  const supported = SUPPORTED_FORMATS.some((s) => s.w === fmt.w && s.h === fmt.h && s.fps === fmt.fps);
  if (!supported) {
    bag.error('FORMAT_UNSUPPORTED', 'format',
      `P0 只支持 1920×1080@30 与 1080×1920@30，收到 ${fmt.w}×${fmt.h}@${fmt.fps}`);
  }
  out.format = fmt;

  // --- meta ---
  if (input.meta !== undefined) {
    if (!isPlainObject(input.meta)) bag.error('META_TYPE', 'meta', 'meta 必须是对象');
    else out.meta = input.meta;
  }
  // --- scenes ---
  if (!Array.isArray(input.scenes) || !input.scenes.length) {
    bag.error('SCENES_EMPTY', 'scenes', 'scenes 必须是非空数组');
    return { storyboard: out, bag, recipe, caption };
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

    const recipeId = recipe?.id || input.recipe || '<recipe>';
    const mode = recipe?.mode || null;
    let code = null;
    let params = null;
    let sceneResources = [];

    if (raw.code !== undefined && raw.params !== undefined) {
      bag.error('SCENE_CONTENT_CONFLICT', at,
        '同一场不能同时写 code 与 params；由 recipe.mode 决定唯一内容形态');
    }

    if (mode === 'code' || (!mode && raw.code !== undefined)) {
      if (raw.params !== undefined) {
        bag.error('SCENE_PARAMS_IN_CODE_MODE', `${at}.params`,
          `recipe ${recipeId} 是 code 模式：内容写在 scene.code，scene.params 不收`);
      }
      code = normalizeSceneCode(raw.code, bag, at);
      if (raw.code === undefined) {
        bag.error('SCENE_CODE_REQUIRED', `${at}.code`, `recipe ${recipeId} 是 code 模式：每场必须写 code`);
      }
      sceneResources = normalizeSceneResources(raw.resources, bag, at, catalog);
      if (code !== null) {
        const scan = scanSceneCode(code, { sceneId: id || at, resources: sceneResources });
        for (const error of scan.errors) bag.error(error.code, `${at}.code`, error.msg);
        for (const warning of scan.warnings) bag.warn(warning.level || 'should', warning.code, `${at}.code`, warning.msg);
      }
    } else if (mode === 'params' || (!mode && raw.params !== undefined)) {
      if (raw.code !== undefined) {
        bag.error('SCENE_CODE_IN_PARAMS_MODE', `${at}.code`,
          `recipe ${recipeId} 是 params 模式：内容写在 scene.params，scene.code 不收`);
      }
      if (raw.resources !== undefined) {
        bag.error('SCENE_RESOURCES_IN_PARAMS_MODE', `${at}.resources`,
          `recipe ${recipeId} 的资源声明在 recipe.template.resources，scene.resources 只属于 code 模式`);
      }
      if (!isPlainObject(raw.params)) {
        bag.error('SCENE_PARAMS_REQUIRED', `${at}.params`, `recipe ${recipeId} 是 params 模式：每场必须写 params 对象`);
      } else {
        params = checkParams(raw.params, recipe?.template?.params || {}, recipeId, bag, `${at}.params`);
      }
    } else {
      bag.error('SCENE_CONTENT_MISSING', at, '每场必须写 code 或 params，内容形态由 recipe.mode 决定');
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

    const transition = normalizeTransitionPreset(raw.transition, bag, `${at}.transition`);

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

    out.scenes.push({
      id,
      narration: hasNarration ? String(raw.narration) : null,
      duration: hasDuration ? Number(raw.duration) : null,
      camera,
      code,
      params,
      resources: sceneResources,
      note: raw.note || null,
      transition,
    });
  });

  return { storyboard: out, bag, recipe, caption };
}
