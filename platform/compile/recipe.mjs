/**
 * recipe —— 一类成片的视觉规范与模板契约。
 *
 * 两种模式：
 *   code   recipe 只给 recipe.md / ref-shots / rules / captions / audio / pacing，
 *          storyboard 写 scene.code；字体由 scene.resources 的 font 条目声明。
 *   params recipe 自带 template（draw / params / resources / needs / defaultSfx /
 *          sfxTrack / inkless），storyboard 写 scene.params；字体写死在
 *          模板代码里，并在 template.resources 声明。
 *
 * recipe 不承载字体表。资源里的 font 只写 manifest 键，src 由编译期补齐。
 * rules 只校验公共字段；配方特有的扩展规则原样透传给 code 场的 RULES。
 * 颜色由 kit 自带默认值或 scene.code 直接写，背景由 scene.code / 模板自己铺满；
 * recipe 不承载用色决策。
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { isPlainObject } from './diag.mjs';

const DIMENSION_MODES = new Set(['fixed', 'enum', 'auto', 'random']);
const RECIPE_KEYS = new Set(['id', 'abi', 'name', 'keywords', 'when', 'notWhen', 'mode', 'template', 'rules', 'captions', 'audio', 'pacing']);
const PACING_KEYS = new Set(['leadIn', 'hold', 'minNarrationDuration']);
const RECIPE_MODES = new Set(['code', 'params']);
const TEMPLATE_KEYS = new Set(['draw', 'params', 'resources', 'needs', 'defaultSfx', 'sfxTrack', 'inkless']);
const NEEDS_KEYS = new Set(['image', 'video', 'three']);
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

  if (recipe?.abi !== '1') {
    fail('RECIPE_ABI_UNSUPPORTED', 'abi',
      `只支持 abi "1"（收到 ${JSON.stringify(recipe?.abi)}）`);
    return errors;
  }

  for (const key of Object.keys(recipe)) {
    if (RECIPE_KEYS.has(key)) continue;
    fail('RECIPE_UNKNOWN_KEY', key, `recipe 不认识字段 "${key}"`);
  }

  if (!RECIPE_MODES.has(recipe.mode)) {
    fail('RECIPE_MODE_INVALID', 'mode', `mode 只能是 code / params，收到 ${JSON.stringify(recipe.mode)}`);
  }

  validateWhenList(recipe.when, 'when', fail);
  validateWhenList(recipe.notWhen, 'notWhen', fail);

  validateRules(recipe.rules, fail);
  validateCaptions(recipe.captions, manifest, fail);
  validateAudio(recipe.audio, fail);
  validatePacing(recipe.pacing, fail);

  if (recipe.mode === 'params') {
    if (!recipe.template) {
      fail('RECIPE_TEMPLATE_MISSING', 'template', 'params 模式必须有 template');
    } else {
      validateTemplate(recipe.template, recipe, recipeDir, manifest, fail);
    }
  } else if (recipe.mode === 'code' && recipe.template !== undefined) {
    fail('RECIPE_TEMPLATE_UNEXPECTED', 'template', 'code 模式不允许声明 template');
  }

  return errors;
}

/** when / notWhen 是 `tt recipe list` 的选择元数据：都必须是逐条的判断条件，不能是一句长摘要。 */
function validateWhenList(value, field, fail) {
  const code = field === 'notWhen' ? 'RECIPE_NOTWHEN_INVALID' : 'RECIPE_WHEN_INVALID';
  if (!Array.isArray(value) || !value.length) {
    fail(code, field, `${field} 必须是非空字符串数组，每条写一个适用或不适用条件`);
    return;
  }
  for (const [index, item] of value.entries()) {
    if (typeof item !== 'string' || !item.trim()) {
      fail(code, `${field}[${index}]`, `${field} 的每一条都必须是非空字符串`);
    }
  }
}

function validateRules(rules, fail) {
  if (!isPlainObject(rules)) {
    fail('RECIPE_RULES_MISSING', 'rules', 'recipe 必须有 rules 对象');
    return;
  }
  // 除下列公共规则外，recipe 可以自由扩展局部规则；编译器原样注入 RULES，
  // 不理解也不校验其语义。只拦截两个常见的顶层字段误放。
  for (const key of ['caption', 'bgm']) {
    if (rules[key] !== undefined) {
      fail('RECIPE_RULE_KEY_MISPLACED', `rules.${key}`,
        '字幕默认值放顶级 captions，声音默认值放顶级 audio');
    }
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

function validateCaptions(captions, manifest, fail) {
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
  if (captions.font !== undefined && typeof captions.font !== 'string') {
    fail('RECIPE_CAPTION_FONT_TYPE', 'captions.font', 'captions.font 必须是 manifest 字体键字符串');
  } else if (typeof captions.font === 'string' && (!isPlainObject(manifest) || !manifest[captions.font])) {
    fail('RECIPE_CAPTION_FONT_UNKNOWN', 'captions.font',
      `字体 "${captions.font}" 不在 assets/fonts/manifest.json 里；captions.font 直接写 manifest 键`);
  }
}

function validatePacing(pacing, fail) {
  if (pacing === undefined) return;
  if (!isPlainObject(pacing)) {
    fail('RECIPE_PACING_INVALID', 'pacing', 'pacing 必须是 { leadIn, hold, minNarrationDuration } 对象');
    return;
  }
  for (const key of Object.keys(pacing)) {
    if (!PACING_KEYS.has(key)) fail('RECIPE_PACING_KEY_UNKNOWN', `pacing.${key}`, `未知节拍字段 "${key}"`);
  }
  for (const key of PACING_KEYS) {
    if (pacing[key] !== undefined && !(isFiniteNumber(pacing[key]) && pacing[key] >= 0)) {
      fail('RECIPE_PACING_NUMBER_INVALID', `pacing.${key}`, `${key} 必须是非负秒数`);
    }
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

function validateTemplate(template, recipe, recipeDir, manifest, fail) {
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
    fail('TEMPLATE_NEEDS_MISSING', 'template.needs', 'needs 必须是 { image, video, three } 对象');
  } else {
    for (const key of Object.keys(template.needs)) {
      if (!NEEDS_KEYS.has(key)) {
        fail('TEMPLATE_NEEDS_KEY_UNKNOWN', `template.needs.${key}`,
          `needs 只允许 image / video / three；字体写 template.resources`);
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
      fail('TEMPLATE_RESOURCES_TYPE', 'template.resources',
        'resources 必须是 {type,name} 数组；font 只写 manifest 键，image/video 另带 src');
    } else {
      for (const [index, res] of template.resources.entries()) {
        const at = `template.resources[${index}]`;
        if (!isPlainObject(res) || !RESOURCE_TYPES.has(res.type)
          || typeof res.name !== 'string' || !res.name.trim()) {
          fail('TEMPLATE_RESOURCE_INVALID', at,
            '资源必须是 {type: image|video|font, name: 非空字符串}');
          continue;
        }
        if (res.type === 'font') {
          if (res.src !== undefined) {
            fail('TEMPLATE_FONT_SRC', at,
              'font 资源只写 manifest 键做 name，不要写 src；src 由编译期按 manifest 补齐');
          }
          if (!isPlainObject(manifest) || !isPlainObject(manifest[res.name])) {
            fail('TEMPLATE_FONT_UNKNOWN', `${at}.name`,
              `字体 "${res.name}" 不是 assets/fonts/manifest.json 的键；src 由编译期补齐`);
          }
        } else if (typeof res.src !== 'string' || !res.src.trim()) {
          fail('TEMPLATE_RESOURCE_SRC', `${at}.src`, 'image / video 资源必须有非空 src');
        }
      }
    }
  }

  if (template.defaultSfx !== undefined
    && (typeof template.defaultSfx !== 'string' || !template.defaultSfx.trim())) {
    fail('TEMPLATE_DEFAULT_SFX', 'template.defaultSfx', 'defaultSfx 必须是非空音效名');
  }

  if (template.sfxTrack !== undefined) validateSfxTrack(template.sfxTrack, fail);


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
