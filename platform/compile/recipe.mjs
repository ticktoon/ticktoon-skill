/**
 * recipe —— 一类成片的视觉规范与模板契约。
 *
 * 两种模式：
 *   code   recipe 只给 visual.md / ref-shots / rules / fonts / captions / audio，
 *          storyboard 写 scene.code。
 *   params recipe 自带 template（draw / params / resources / needs / defaultSfx /
 *          sfxTrack / motion / inkless），storyboard 写 scene.params。
 *
 * fonts 直接写在 recipe 顶层，没有 style 包装。颜色由 kit 自带默认值或
 * scene.code 直接写，背景由 scene.code / 模板自己铺满；recipe 不承载用色决策。
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { isPlainObject } from './diag.mjs';

const DIMENSION_MODES = new Set(['fixed', 'enum', 'auto', 'random']);
const RULE_KEYS = new Set(['safeMargin', 'scale', 'stroke', 'pen', 'board', 'forbid']);
const FONT_ROLES = new Set(['display', 'body', 'num', 'hand', 'caption', 'brand', 'serif', 'round', 'poster', 'cutout']);
const RECIPE_KEYS = new Set(['id', 'abi', 'name', 'keywords', 'when', 'mode', 'template', 'fonts', 'rules', 'captions', 'audio']);
const RECIPE_MODES = new Set(['code', 'params']);
const TEMPLATE_KEYS = new Set(['draw', 'params', 'resources', 'needs', 'defaultSfx', 'sfxTrack', 'motion', 'inkless']);
const NEEDS_KEYS = new Set(['font', 'image', 'video', 'three']);
const CAPTION_STYLE_KEYS = new Set([
  'style', 'font', 'baseSize', 'lineHeight', 'top', 'at', 'band', 'size', 'color',
  'background', 'accent', 'highlight', 'palette', 'avoid', 'maxWidth', 'maxHeight',
  'align', 'seed', 'rotation', 'tracking', 'padding', 'shadow', 'stroke',
]);
const AUDIO_KEYS = new Set(['mood', 'volume', 'fadeIn', 'fadeOut', 'duck']);
const DUCK_KEYS = new Set(['level', 'edge']);
const RESOURCE_TYPES = new Set(['image', 'video', 'font']);
const SFX_TRACK_KEYS = new Set(['type', 'textParam', 'cps', 'cpsParam', 'start', 'lineGap', 'every', 'linePrefix', 'sfx', 'loop']);
const SFX_LOOP_KEYS = new Set(['sfx', 'fadeOut']);

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

/** 返回 [{ code, path, msg }]；msg 里始终带 recipe id 与字段路径。 */
export function validateRecipe(recipe, manifest, recipeDir) {
  const errors = [];
  const id = recipe?.id ?? '<unknown>';
  const fail = (code, at, msg) => errors.push({ code, path: at, msg: `recipe ${id}: ${at} — ${msg}` });

  if (recipe?.abi !== '9') {
    fail('RECIPE_ABI_UNSUPPORTED', 'abi',
      `只支持 abi "9"（收到 ${JSON.stringify(recipe?.abi)}）；旧配方请迁移为 mode + template`);
    return errors;
  }

  for (const key of Object.keys(recipe)) {
    if (RECIPE_KEYS.has(key)) continue;
    fail('RECIPE_UNKNOWN_KEY', key, `recipe 不认识字段 "${key}"`);
  }

  if (!RECIPE_MODES.has(recipe.mode)) {
    fail('RECIPE_MODE_INVALID', 'mode', `mode 只能是 code / params，收到 ${JSON.stringify(recipe.mode)}`);
  }

  validateFonts(recipe.fonts, manifest, fail);
  validateRules(recipe.rules, fail);
  validateCaptions(recipe.captions, recipe.fonts, fail);
  validateAudio(recipe.audio, fail);

  if (recipe.mode === 'params') {
    if (!recipe.template) {
      fail('RECIPE_TEMPLATE_MISSING', 'template', 'params 模式必须有 template');
    } else {
      validateTemplate(recipe.template, recipe, recipeDir, fail);
    }
  } else if (recipe.mode === 'code' && recipe.template !== undefined) {
    fail('RECIPE_TEMPLATE_UNEXPECTED', 'template', 'code 模式不允许声明 template');
  }

  return errors;
}

function validateFonts(fontMap, manifest, fail) {
  if (!isPlainObject(fontMap)) {
    fail('RECIPE_FONTS_MISSING', 'fonts', 'recipe 必须有顶层 fonts 对象（角色 → manifest 键）');
    return;
  }
  for (const role of ['display', 'body']) {
    if (!fontMap[role]) fail('RECIPE_FONTS_ROLE_MISSING', `fonts.${role}`, `必须声明 ${role} 字体角色`);
  }
  for (const [role, name] of Object.entries(fontMap)) {
    if (!FONT_ROLES.has(role)) {
      fail('RECIPE_FONTS_ROLE_UNKNOWN', `fonts.${role}`,
        `未知字体角色 "${role}"；可用：${[...FONT_ROLES].join(' / ')}`);
      continue;
    }
    if (typeof name !== 'string' || !name.trim()) {
      fail('RECIPE_FONTS_NAME_INVALID', `fonts.${role}`, '字体值必须是非空 manifest 键');
    } else if (!isPlainObject(manifest) || !manifest[name]) {
      fail('RECIPE_FONTS_UNKNOWN', `fonts.${role}`,
        `字体 "${name}" 不在 assets/fonts/manifest.json 里`);
    }
  }
}

function validateRules(rules, fail) {
  if (!isPlainObject(rules)) {
    fail('RECIPE_RULES_MISSING', 'rules', 'recipe 必须有 rules 对象');
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

function validateDimension(spec, at, fail) {
  if (!isPlainObject(spec)) {
    fail('RECIPE_RULE_ITEM_INVALID', at, '维度项必须是 { mode, ... } 对象');
    return;
  }
  if (!DIMENSION_MODES.has(spec.mode)) {
    fail('RECIPE_MODE_INVALID', `${at}.mode`,
      `mode 必须是 fixed / enum / auto / random，收到 ${JSON.stringify(spec.mode)}`);
    return;
  }
  if (spec.mode === 'enum') {
    if (!Array.isArray(spec.choices) || !spec.choices.length) {
      fail('RECIPE_ENUM_CHOICES_EMPTY', `${at}.choices`, 'enum 必须有非空 choices');
    } else if (!spec.choices.includes(spec.default)) {
      fail('RECIPE_ENUM_DEFAULT_INVALID', `${at}.default`,
        `default ${JSON.stringify(spec.default)} 不在 choices ${JSON.stringify(spec.choices)} 里`);
    }
  } else if (spec.mode === 'fixed') {
    if (spec.value === undefined) fail('RECIPE_FIXED_VALUE_MISSING', `${at}.value`, 'fixed 必须有 value');
  } else if (spec.mode === 'auto') {
    if (typeof spec.from !== 'string' || !spec.from.trim()) {
      fail('RECIPE_AUTO_FROM_MISSING', `${at}.from`, 'auto 必须有非空 from');
    }
  } else if (spec.mode === 'random') {
    if (!Array.isArray(spec.choices) || !spec.choices.length) {
      fail('RECIPE_RANDOM_CHOICES_EMPTY', `${at}.choices`, 'random 必须有非空 choices');
    }
  }
}

function validateCaptions(captions, fontMap, fail) {
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
  if (typeof captions.font === 'string' && isPlainObject(fontMap) && !fontMap[captions.font]) {
    fail('RECIPE_CAPTION_FONT_UNKNOWN', 'captions.font',
      `字幕字体角色 "${captions.font}" 不在 recipe 顶层 fonts 里；字幕不能绕过 recipe 自带字体`);
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
        if (!DUCK_KEYS.has(key)) fail('RECIPE_AUDIO_DUCK_KEY_UNKNOWN', `audio.duck.${key}`, 'duck 只允许 level / edge');
      }
      for (const key of ['level', 'edge']) {
        if (audio.duck[key] !== undefined && !(isFiniteNumber(audio.duck[key]) && audio.duck[key] >= 0)) {
          fail('RECIPE_AUDIO_DUCK_INVALID', `audio.duck.${key}`, `${key} 必须是非负数`);
        }
      }
    }
  }
}

function validateTemplate(template, recipe, recipeDir, fail) {
  if (!isPlainObject(template)) {
    fail('RECIPE_TEMPLATE_TYPE', 'template', 'template 必须是对象');
    return;
  }
  for (const key of Object.keys(template)) {
    if (!TEMPLATE_KEYS.has(key)) {
      fail('RECIPE_TEMPLATE_KEY_UNKNOWN', `template.${key}`,
        `template 不认识字段 "${key}"；可用：${[...TEMPLATE_KEYS].join(' / ')}`);
    }
  }

  if (typeof template.draw !== 'string' || !template.draw.trim()) {
    fail('TEMPLATE_DRAW_MISSING', 'template.draw', 'draw 必须是 recipe 目录内相对 .js 路径');
  } else {
    const rel = template.draw.trim();
    const bad = path.isAbsolute(rel) || rel.split(/[\\/]/).includes('..') || !rel.endsWith('.js');
    const abs = path.join(recipeDir, rel);
    if (bad) {
      fail('TEMPLATE_DRAW_PATH', 'template.draw',
        `draw 只允许 recipe 目录内的相对 .js 路径，收到 ${JSON.stringify(rel)}`);
    } else if (!existsSync(abs)) {
      fail('TEMPLATE_DRAW_NOT_FOUND', 'template.draw', `找不到模板文件 ${rel}`);
    } else {
      const source = readFileSync(abs, 'utf-8');
      if (/^\s*(?:export|import)\b/m.test(source)) {
        fail('TEMPLATE_MODULE_SYNTAX', 'template.draw', '模板不是模块，不允许 export / import');
      }
      if (!/\bfunction\s+draw\s*\(/.test(source)) {
        fail('TEMPLATE_DRAW_FUNCTION', 'template.draw', '模板必须定义顶层 function draw(g, p)');
      }
    }
  }

  if (!isPlainObject(template.params)) {
    fail('TEMPLATE_PARAMS_MISSING', 'template.params', 'params 必须是对象');
  }

  if (!isPlainObject(template.needs)) {
    fail('TEMPLATE_NEEDS_MISSING', 'template.needs', 'needs 必须是 { font, image, video, three } 对象');
  } else {
    for (const key of Object.keys(template.needs)) {
      if (!NEEDS_KEYS.has(key)) {
        fail('TEMPLATE_NEEDS_KEY_UNKNOWN', `template.needs.${key}`,
          `needs 只允许 font / image / video / three`);
      }
    }
    if (!Array.isArray(template.needs.font)
      || !template.needs.font.every((role) => typeof role === 'string' && role.trim())) {
      fail('TEMPLATE_NEEDS_FONT', 'template.needs.font', 'needs.font 必须是字体角色数组');
    } else {
      for (const role of template.needs.font) {
        if (!recipe.fonts?.[role]) {
          fail('TEMPLATE_FONT_ROLE_MISSING', `fonts.${role}`,
            `模板需要字体角色 "${role}"，但 recipe 顶层 fonts 没有声明`);
        }
      }
    }
    for (const key of ['image', 'video', 'three']) {
      if (template.needs[key] !== undefined && typeof template.needs[key] !== 'boolean') {
        fail('TEMPLATE_NEEDS_BOOL', `template.needs.${key}`, `${key} 必须是 true/false`);
      }
    }
  }

  if (template.resources !== undefined) {
    if (!Array.isArray(template.resources)) {
      fail('TEMPLATE_RESOURCES_TYPE', 'template.resources', 'resources 必须是 {type,name,src} 数组');
    } else {
      for (const [index, res] of template.resources.entries()) {
        const at = `template.resources[${index}]`;
        if (!isPlainObject(res) || !RESOURCE_TYPES.has(res.type)
          || typeof res.name !== 'string' || !res.name.trim()
          || typeof res.src !== 'string' || !res.src.trim()) {
          fail('TEMPLATE_RESOURCE_INVALID', at,
            '资源必须是 {type: image|video|font, name: 非空字符串, src: 非空字符串}');
        }
      }
    }
  }

  if (template.defaultSfx !== undefined
    && (typeof template.defaultSfx !== 'string' || !template.defaultSfx.trim())) {
    fail('TEMPLATE_DEFAULT_SFX', 'template.defaultSfx', 'defaultSfx 必须是非空音效名');
  }

  if (template.sfxTrack !== undefined) validateSfxTrack(template.sfxTrack, fail);

  if (template.motion !== undefined) {
    if (!isPlainObject(template.motion)) {
      fail('TEMPLATE_MOTION_TYPE', 'template.motion', 'motion 必须是 { enter, exitRatio } 对象');
    } else {
      for (const key of Object.keys(template.motion)) {
        if (key !== 'enter' && key !== 'exitRatio') {
          fail('TEMPLATE_MOTION_KEY_UNKNOWN', `template.motion.${key}`, 'motion 只允许 enter / exitRatio');
        }
      }
      if (template.motion.enter !== undefined && !(isFiniteNumber(template.motion.enter) && template.motion.enter >= 0)) {
        fail('TEMPLATE_MOTION_ENTER', 'template.motion.enter', 'enter 必须是 ≥0 的秒数');
      }
      if (template.motion.exitRatio !== undefined
        && !(isFiniteNumber(template.motion.exitRatio) && template.motion.exitRatio >= 0 && template.motion.exitRatio <= 1)) {
        fail('TEMPLATE_MOTION_EXIT', 'template.motion.exitRatio', 'exitRatio 必须在 0–1');
      }
    }
  }

  if (template.inkless !== undefined && typeof template.inkless !== 'boolean') {
    fail('TEMPLATE_INKLESS_TYPE', 'template.inkless', 'inkless 必须是 true/false');
  }
}

function validateSfxTrack(track, fail) {
  if (!isPlainObject(track)) {
    fail('TEMPLATE_SFX_TRACK_TYPE', 'template.sfxTrack', 'sfxTrack 必须是对象');
    return;
  }
  for (const key of Object.keys(track)) {
    if (!SFX_TRACK_KEYS.has(key)) {
      fail('TEMPLATE_SFX_TRACK_KEY_UNKNOWN', `template.sfxTrack.${key}`,
        `sfxTrack 不认识字段 "${key}"`);
    }
  }
  if (track.type !== 'typing') {
    fail('TEMPLATE_SFX_TRACK_TYPE_NAME', 'template.sfxTrack.type', 'sfxTrack.type 目前只支持 typing');
  }
  for (const key of ['start', 'lineGap', 'cps']) {
    if (track[key] !== undefined && !(isFiniteNumber(Number(track[key])) && Number(track[key]) >= 0)) {
      fail('TEMPLATE_SFX_TRACK_NUMBER', `template.sfxTrack.${key}`, `${key} 必须是非负数`);
    }
  }
  if (track.loop !== undefined) {
    if (!isPlainObject(track.loop) || typeof track.loop.sfx !== 'string' || !track.loop.sfx.trim()) {
      fail('TEMPLATE_SFX_LOOP', 'template.sfxTrack.loop', 'loop 必须是 { sfx, fadeOut } 对象');
    } else {
      for (const key of Object.keys(track.loop)) {
        if (!SFX_LOOP_KEYS.has(key)) {
          fail('TEMPLATE_SFX_LOOP_KEY_UNKNOWN', `template.sfxTrack.loop.${key}`, 'loop 只允许 sfx / fadeOut');
        }
      }
      if (track.loop.fadeOut !== undefined && !(isFiniteNumber(track.loop.fadeOut) && track.loop.fadeOut >= 0)) {
        fail('TEMPLATE_SFX_LOOP_FADE', 'template.sfxTrack.loop.fadeOut', 'fadeOut 必须是非负数');
      }
    }
  }
}
