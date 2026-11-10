/**
 * recipe v8 —— 视觉规范包的校验、注入与 forbid 检查。
 *
 * v8 配方只装"LLM 推不出来、不统一就会散、能机器验收"的视觉规范：
 *   style  跨子系统共用的机器契约：字体角色 + 颜色 token + 背景名
 *   rules  数值区间 / 维度默认值 / 禁止清单
 *   captions / audio  字幕与声音的配方级默认值
 *   verify 可执行断言（由 tt qa 跑）
 *   blocks 本视觉实际提供的 block
 *
 * style 是封闭白名单：只有 fonts / colors / backgrounds。字号、行高、版位、
 * 动效、图表参数都属于 block 本地，不能借 style 重新长成一套 theme。
 */
import { isPlainObject } from './diag.mjs';

const DIMENSION_MODES = new Set(['fixed', 'enum', 'auto', 'random']);
const NUMERIC_RULE_KEYS = new Set(['safeMargin', 'scale', 'stroke', 'forbid']);
const RULE_KEYS = new Set(['safeMargin', 'scale', 'stroke', 'pen', 'board', 'forbid']);
const NUMERIC_RULES = ['safeMargin', 'scale', 'stroke'];
const STYLE_KEYS = new Set(['fonts', 'colors', 'backgrounds']);
const COLOR_KEYS = new Set(['bg', 'ink', 'muted', 'accent', 'line']);
const FONT_ROLES = new Set(['display', 'body', 'num', 'hand', 'caption', 'brand', 'serif', 'round', 'poster', 'cutout']);
const RECIPE_KEYS = new Set(['id', 'abi', 'name', 'keywords', 'when', 'blocks', 'style', 'rules', 'captions', 'audio', 'verify', 'signature']);
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const CAPTION_STYLE_KEYS = new Set([
  'style', 'font', 'baseSize', 'lineHeight', 'top', 'at', 'band', 'size', 'color',
  'background', 'accent', 'highlight', 'palette', 'avoid', 'maxWidth', 'maxHeight',
  'align', 'seed', 'rotation', 'tracking', 'padding', 'shadow', 'stroke',
]);
const AUDIO_KEYS = new Set(['mood', 'volume', 'fadeIn', 'fadeOut', 'duck']);
const DUCK_KEYS = new Set(['level', 'edge']);

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

/** 返回 [{ code, path, msg }]；msg 里始终带 recipe id 与字段路径。 */
export function validateRecipeV8(recipe, blocks, fonts) {
  const errors = [];
  const id = recipe?.id ?? '<unknown>';
  const fail = (code, path, msg) => errors.push({ code, path, msg: `recipe ${id}: ${path} — ${msg}` });

  if (recipe?.abi !== '8') {
    fail('RECIPE_ABI_UNSUPPORTED', 'abi',
      `只支持 abi "8"；旧配方请把 theme 拆成 style / captions / audio，把 rules.caption、rules.bgm 移到对应字段（收到 ${JSON.stringify(recipe?.abi)}）`);
    return errors;
  }

  for (const key of Object.keys(recipe)) {
    if (RECIPE_KEYS.has(key)) continue;
    const hint = key === 'theme' || key === 'uses' || key === 'pacing'
      ? '（v8 已移除 theme / uses / pacing：style 直接写在 recipe 顶层）'
      : '';
    fail('RECIPE_UNKNOWN_KEY', key, `v8 配方不认识字段 "${key}"${hint}`);
  }

  validateStyle(recipe.style, fonts, fail);
  validateRules(recipe.rules, fail);
  validateCaptions(recipe.captions, recipe.style, fail);
  validateAudio(recipe.audio, fail);
  validateBlocks(recipe, blocks, fail);
  validateVerify(recipe.verify, fail);
  return errors;
}

function validateStyle(style, fonts, fail) {
  if (!isPlainObject(style)) {
    fail('RECIPE_STYLE_MISSING', 'style', 'v8 配方必须有 style 对象');
    return;
  }
  for (const key of Object.keys(style)) {
    if (STYLE_KEYS.has(key)) continue;
    fail('RECIPE_STYLE_UNKNOWN_KEY', `style.${key}`,
      `style 是封闭契约，只允许 fonts / colors / backgrounds；字号、版位、动效请放进 block 本地`);
  }

  const fontMap = isPlainObject(style.fonts) ? style.fonts : null;
  if (!fontMap) {
    fail('RECIPE_STYLE_FONTS_INVALID', 'style.fonts', 'style.fonts 必须是 { 角色: manifest 键 } 对象');
  } else {
    for (const role of ['display', 'body']) {
      if (!fontMap[role]) fail('RECIPE_STYLE_FONT_ROLE_MISSING', `style.fonts.${role}`, `必须声明 ${role} 字体角色`);
    }
    for (const [role, name] of Object.entries(fontMap)) {
      if (!FONT_ROLES.has(role)) {
        fail('RECIPE_STYLE_FONT_ROLE_UNKNOWN', `style.fonts.${role}`,
          `未知字体角色 "${role}"；可用：${[...FONT_ROLES].join(' / ')}`);
        continue;
      }
      if (typeof name !== 'string' || !name.trim()) {
        fail('RECIPE_STYLE_FONT_NAME_INVALID', `style.fonts.${role}`, '字体值必须是非空 manifest 键');
      } else if (!isPlainObject(fonts) || !fonts[name]) {
        fail('RECIPE_STYLE_FONT_UNKNOWN', `style.fonts.${role}`,
          `字体 "${name}" 不在 assets/fonts/manifest.json 里`);
      }
    }
  }

  const colors = style.colors;
  if (!isPlainObject(colors)) {
    fail('RECIPE_STYLE_COLORS_INVALID', 'style.colors', 'style.colors 必须是颜色 token 对象');
  } else {
    for (const key of COLOR_KEYS) {
      const value = colors[key];
      if (value === undefined) {
        fail('RECIPE_STYLE_COLOR_MISSING', `style.colors.${key}`, `缺少颜色 token "${key}"`);
      } else if (typeof value !== 'string' || !HEX_COLOR.test(value)) {
        fail('RECIPE_STYLE_COLOR_INVALID', `style.colors.${key}`,
          `颜色必须是 #rgb / #rrggbb / #rrggbbaa，收到 ${JSON.stringify(value)}`);
      }
    }
    for (const key of Object.keys(colors)) {
      if (COLOR_KEYS.has(key)) continue;
      fail('RECIPE_STYLE_COLOR_UNKNOWN', `style.colors.${key}`,
        `style.colors 只允许 ${[...COLOR_KEYS].join(' / ')}；强调色之外的本地颜色放进 block 或 captions`);
    }
  }

  if (style.backgrounds !== undefined) {
    if (!isPlainObject(style.backgrounds)) {
      fail('RECIPE_STYLE_BACKGROUNDS_INVALID', 'style.backgrounds', 'backgrounds 必须是 { 名字: 颜色 } 对象');
    } else {
      for (const [name, value] of Object.entries(style.backgrounds)) {
        if (!name.trim()) fail('RECIPE_STYLE_BACKGROUND_NAME', 'style.backgrounds', '背景名不能为空');
        if (typeof value !== 'string' || !HEX_COLOR.test(value)) {
          fail('RECIPE_STYLE_BACKGROUND_INVALID', `style.backgrounds.${name}`,
            `背景颜色必须是 #rgb / #rrggbb / #rrggbbaa，收到 ${JSON.stringify(value)}`);
        }
      }
    }
  }
}

function validateRules(rules, fail) {
  if (!isPlainObject(rules)) {
    fail('RECIPE_RULES_MISSING', 'rules', 'v8 配方必须有 rules 对象');
    return;
  }
  for (const key of Object.keys(rules)) {
    if (RULE_KEYS.has(key)) continue;
    const hint = key === 'caption' || key === 'bgm'
      ? '（字幕默认值放顶级 captions，声音默认值放顶级 audio）'
      : '';
    fail('RECIPE_RULE_KEY_UNKNOWN', `rules.${key}`, `rules 只允许 safeMargin / scale / stroke / pen / board / forbid${hint}`);
  }

  if (!isFiniteNumber(rules.safeMargin) || rules.safeMargin < 0 || rules.safeMargin > 0.5) {
    fail('RECIPE_SAFE_MARGIN_INVALID', 'rules.safeMargin',
      `safeMargin 必须是 0–0.5 的数值，收到 ${JSON.stringify(rules.safeMargin)}`);
  }

  if (rules.scale !== undefined) {
    if (!isPlainObject(rules.scale)) {
      fail('RECIPE_SCALE_INVALID', 'rules.scale', 'scale 必须是 { 档位: 倍率 } 对象');
    } else {
      const entries = Object.entries(rules.scale);
      if (!entries.length) fail('RECIPE_SCALE_INVALID', 'rules.scale', 'scale 至少要有一个档位');
      for (const [key, value] of entries) {
        if (!isFiniteNumber(value) || value < 0.4 || value > 2.0) {
          fail('RECIPE_SCALE_INVALID', `rules.scale.${key}`,
            `倍率必须在 0.4–2.0，收到 ${JSON.stringify(value)}`);
        }
      }
    }
  }

  if (rules.stroke !== undefined) {
    if (!Array.isArray(rules.stroke) || rules.stroke.length !== 2 || !rules.stroke.every(isFiniteNumber)) {
      fail('RECIPE_STROKE_INVALID', 'rules.stroke', 'stroke 必须是 [min, max] 两个数字');
    } else if (!(rules.stroke[0] < rules.stroke[1])) {
      fail('RECIPE_STROKE_INVALID', 'rules.stroke',
        `stroke 必须 min < max，收到 [${rules.stroke[0]}, ${rules.stroke[1]}]`);
    }
  }

  if (!Array.isArray(rules.forbid) || !rules.forbid.length
    || !rules.forbid.every((item) => typeof item === 'string' && item.trim())) {
    fail('RECIPE_FORBID_EMPTY', 'rules.forbid', 'forbid 必须是非空字符串数组（至少 1 条）');
  }

  for (const key of ['pen', 'board']) {
    if (rules[key] === undefined) continue;
    validateDimension(rules[key], `rules.${key}`, fail);
  }
}

function validateDimension(spec, path, fail) {
  if (!isPlainObject(spec)) {
    fail('RECIPE_RULE_ITEM_INVALID', path, '维度项必须是 { mode, ... } 对象');
    return;
  }
  if (!DIMENSION_MODES.has(spec.mode)) {
    fail('RECIPE_MODE_INVALID', `${path}.mode`,
      `mode 必须是 fixed / enum / auto / random，收到 ${JSON.stringify(spec.mode)}`);
    return;
  }
  if (spec.mode === 'enum') {
    if (!Array.isArray(spec.choices) || !spec.choices.length) {
      fail('RECIPE_ENUM_CHOICES_EMPTY', `${path}.choices`, 'enum 必须有非空 choices');
    } else if (!spec.choices.includes(spec.default)) {
      fail('RECIPE_ENUM_DEFAULT_INVALID', `${path}.default`,
        `default ${JSON.stringify(spec.default)} 不在 choices ${JSON.stringify(spec.choices)} 里`);
    }
  } else if (spec.mode === 'fixed') {
    if (spec.value === undefined) fail('RECIPE_FIXED_VALUE_MISSING', `${path}.value`, 'fixed 必须有 value');
  } else if (spec.mode === 'auto') {
    if (typeof spec.from !== 'string' || !spec.from.trim()) {
      fail('RECIPE_AUTO_FROM_MISSING', `${path}.from`, 'auto 必须有非空 from');
    }
  } else if (spec.mode === 'random') {
    if (!Array.isArray(spec.choices) || !spec.choices.length) {
      fail('RECIPE_RANDOM_CHOICES_EMPTY', `${path}.choices`, 'random 必须有非空 choices');
    }
  }
}

function validateCaptions(captions, style, fail) {
  if (captions === undefined) return;
  if (!isPlainObject(captions)) {
    fail('RECIPE_CAPTIONS_INVALID', 'captions', 'captions 必须是 { style, ... } 对象');
    return;
  }
  for (const key of Object.keys(captions)) {
    if (!CAPTION_STYLE_KEYS.has(key)) {
      fail('RECIPE_CAPTION_KEY_UNKNOWN', `captions.${key}`, `未知字幕配方字段 "${key}"`);
    }
  }
  if (typeof captions.style !== 'string' || !captions.style.trim()) {
    fail('RECIPE_CAPTION_STYLE_MISSING', 'captions.style', 'captions 必须有 style；关闭字幕写 "none"');
  }
  for (const key of ['baseSize', 'lineHeight', 'top', 'size', 'maxWidth', 'maxHeight', 'rotation', 'tracking']) {
    if (captions[key] !== undefined && !(isFiniteNumber(captions[key]) && captions[key] > 0)) {
      fail('RECIPE_CAPTION_NUMBER_INVALID', `captions.${key}`, `${key} 必须是正数，收到 ${JSON.stringify(captions[key])}`);
    }
  }
  if (captions.baseSize !== undefined && !(captions.baseSize >= 12 && captions.baseSize <= 240)) {
    fail('RECIPE_CAPTION_BASE_SIZE_RANGE', 'captions.baseSize', 'baseSize 必须在 12–240 逻辑像素');
  }
  if (captions.lineHeight !== undefined && !(captions.lineHeight >= 0.8 && captions.lineHeight <= 2.5)) {
    fail('RECIPE_CAPTION_LINE_HEIGHT_RANGE', 'captions.lineHeight', 'lineHeight 必须在 0.8–2.5 倍字号');
  }
  if (captions.top !== undefined && !(captions.top >= 0 && captions.top <= 1)) {
    fail('RECIPE_CAPTION_TOP_RANGE', 'captions.top', 'top 必须是 0–1 的画面高度比例');
  }
  if (captions.style === 'none') return;
  if (typeof captions.font === 'string' && isPlainObject(style?.fonts) && !style.fonts[captions.font]) {
    fail('RECIPE_CAPTION_FONT_UNKNOWN', 'captions.font',
      `字幕字体角色 "${captions.font}" 不在 style.fonts 里；字幕不能绕过 style 自带字体`);
  }
  if (captions.font !== undefined && typeof captions.font !== 'string') {
    fail('RECIPE_CAPTION_FONT_TYPE', 'captions.font', 'captions.font 必须是字体角色字符串');
  }
}

function validateAudio(audio, fail) {
  if (audio === undefined) return;
  if (!isPlainObject(audio)) {
    fail('RECIPE_AUDIO_INVALID', 'audio', 'audio 必须是 { mood, volume, fadeIn, fadeOut, duck } 对象');
    return;
  }
  for (const key of Object.keys(audio)) {
    if (!AUDIO_KEYS.has(key)) fail('RECIPE_AUDIO_KEY_UNKNOWN', `audio.${key}`, `未知声音配方字段 "${key}"`);
  }
  if (audio.mood !== undefined && (typeof audio.mood !== 'string' || !audio.mood.trim())) {
    fail('RECIPE_AUDIO_MOOD_INVALID', 'audio.mood', 'mood 必须是非空字符串');
  }
  for (const key of ['volume', 'fadeIn', 'fadeOut']) {
    if (audio[key] !== undefined && !(isFiniteNumber(audio[key]) && audio[key] >= 0)) {
      fail('RECIPE_AUDIO_NUMBER_INVALID', `audio.${key}`, `${key} 必须是非负数，收到 ${JSON.stringify(audio[key])}`);
    }
  }
  if (audio.volume !== undefined && audio.volume > 1) {
    fail('RECIPE_AUDIO_VOLUME_RANGE', 'audio.volume', 'volume 必须在 0–1');
  }
  if (audio.duck !== undefined) {
    if (!isPlainObject(audio.duck)) {
      fail('RECIPE_AUDIO_DUCK_INVALID', 'audio.duck', 'duck 必须是 { level, edge } 对象');
    } else {
      for (const key of Object.keys(audio.duck)) {
        if (!DUCK_KEYS.has(key)) fail('RECIPE_AUDIO_DUCK_KEY_UNKNOWN', `audio.duck.${key}`, `duck 只允许 level / edge`);
      }
      for (const key of ['level', 'edge']) {
        if (audio.duck[key] !== undefined && !(isFiniteNumber(audio.duck[key]) && audio.duck[key] >= 0)) {
          fail('RECIPE_AUDIO_DUCK_INVALID', `audio.duck.${key}`, `${key} 必须是非负数`);
        }
      }
    }
  }
}

function validateBlocks(recipe, blocks, fail) {
  if (!Array.isArray(recipe.blocks) || !recipe.blocks.length
    || !recipe.blocks.every((item) => typeof item === 'string' && item.trim())) {
    fail('RECIPE_BLOCKS_MISSING', 'blocks', 'blocks 必须是非空字符串数组');
    return;
  }
  const requiredRoles = new Set();
  recipe.blocks.forEach((blockId, index) => {
    // `scene.code` 是内容载体标记：本视觉一块 block 都不用，内容全在 storyboard 的 scene.code 里。
    if (blockId === 'scene.code') return;
    if (!blocks.has(blockId)) {
      fail('RECIPE_BLOCK_UNKNOWN', `blocks[${index}]`,
        `未注册的 block "${blockId}"；可用：${[...blocks.keys()].join(' / ')}`);
      return;
    }
    for (const role of blocks.get(blockId).needs?.font || []) requiredRoles.add(role);
  });
  for (const role of requiredRoles) {
    if (!recipe.style?.fonts?.[role]) {
      fail('RECIPE_BLOCK_FONT_ROLE_MISSING', `style.fonts.${role}`,
        `block 需要字体角色 "${role}"，但 style.fonts 没有声明`);
    }
  }
}

function validateVerify(verify, fail) {
  if (!Array.isArray(verify) || verify.length < 2) {
    fail('RECIPE_VERIFY_EMPTY', 'verify', 'verify 必须是至少 2 条的数组');
    return;
  }
  verify.forEach((item, index) => {
    const path = `verify[${index}]`;
    if (!isPlainObject(item)) {
      fail('RECIPE_VERIFY_ITEM_INVALID', path, '断言必须是 { at, assert, args } 对象');
      return;
    }
    if (!isFiniteNumber(item.at) || item.at < 0) {
      fail('RECIPE_VERIFY_AT_INVALID', `${path}.at`, `at 必须是 ≥0 的数字，收到 ${JSON.stringify(item.at)}`);
    }
    if (typeof item.assert !== 'string' || !item.assert.trim()) {
      fail('RECIPE_VERIFY_ASSERT_INVALID', `${path}.assert`, 'assert 必须是非空字符串');
    }
    if (item.args !== undefined && !isPlainObject(item.args)) {
      fail('RECIPE_VERIFY_ARGS_INVALID', `${path}.args`, 'args 必须是对象');
    }
  });
}

/** 给 recipe 声明的 block element 注入维度默认值与数值规范；返回 build 期警告。 */
export function applyRecipeRules({ recipe, storyboard }) {
  const warnings = [];
  if (recipe?.abi !== '8' || !isPlainObject(recipe.rules)) return warnings;

  const rules = recipe.rules;
  const allowed = new Set(Array.isArray(recipe.blocks) ? recipe.blocks : []);

  for (const scene of storyboard.scenes) {
    for (const el of scene.elements) {
      if (allowed.size && !allowed.has(el.block)) {
        // v8：forbid 不在装配前拦截，但要在 build 报告里点名，qa 阶段再升级为 error。
        warnings.push({
          level: 'should', code: 'RECIPE_FORBID_VIOLATION',
          path: `scenes.${scene.id}.${el.id}`,
          msg: forbidMessage(recipe, el.block),
        });
        continue;
      }

      const given = new Set(Array.isArray(el.given) ? el.given : []);
      const declared = el.meta?.params || {};

      // 维度默认值：enum 用 default，fixed 用 value；element 显式给了就以 element 为准。
      for (const [key, spec] of Object.entries(rules)) {
        if (NUMERIC_RULE_KEYS.has(key) || !isPlainObject(spec)) continue;
        if (spec.mode !== 'enum' && spec.mode !== 'fixed') continue;
        if (given.has(key) || !(key in declared)) continue;
        const value = spec.mode === 'enum' ? spec.default : spec.value;
        if (value !== undefined) el.params[key] = cloneJson(value);
      }

      // 数值规范：只对 scene.* 生效，作为同名参数的兜底；element 显式值优先级最高。
      if (el.block.startsWith('scene.')) {
        for (const key of NUMERIC_RULES) {
          if (rules[key] === undefined || given.has(key)) continue;
          el.params[key] = cloneJson(rules[key]);
        }
      }
    }
  }

  return warnings;
}

/** qa 阶段把"用了 recipe 没声明的 block"升级为 must。 */
export function recipeForbidViolations({ recipe, planned }) {
  const issues = [];
  if (recipe?.abi !== '8') return issues;
  const allowed = new Set(Array.isArray(recipe.blocks) ? recipe.blocks : []);
  if (!allowed.size) return issues;

  for (const scene of planned.scenes) {
    for (const el of scene.elements) {
      if (allowed.has(el.block)) continue;
      issues.push({
        level: 'must', code: 'RECIPE_FORBID_VIOLATION',
        scene: scene.id, element: el.id, t: 0,
        msg: forbidMessage(recipe, el.block),
      });
    }
  }
  return issues;
}

function forbidMessage(recipe, blockId) {
  const list = Array.isArray(recipe.rules?.forbid) ? recipe.rules.forbid : [];
  const wanted = blockId.startsWith('scene.')
    ? /场景|scene|叠放|两个/i
    : /混排|卡片|文字|text|chart/i;
  const rule = list.find((item) => wanted.test(item)) || list[0];
  const allowed = (recipe.blocks || []).join(' / ');
  return `recipe ${recipe.id} 只允许 ${allowed}；元素用了 ${blockId}` + (rule ? `，违反 forbid「${rule}」` : '');
}

/** 只用于冻结值，避免 recipe 的 rules 对象被 element 参数反向修改。 */
function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}
