/**
 * recipe 镜头参考（ref-shots）的发现、校验与回归合成。
 *
 * 每个 ref-shot 是一个独立 `.js` 文件：文件头用一个 JSON 注释块声明元数据，
 * 注释块之后就是可以直接放进 `scene.code` 的代码。CI 与 code lab 读同一份
 * 文件，不需要额外的 manifest，也不依赖文件名里的序号。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const HEADER_RE = /^﻿?\s*\/\*\s*@ticktoon-ref-shot\s*([\s\S]*?)\*\//;
const META_KEYS = [
  'title', 'note', 'duration', 'resources', 'bg', 'thumbTime', 'tags', 'component', 'orientation', 'sfx',
];
const RESOURCE_KEYS = ['type', 'name', 'src', 'start'];
const ORIENTATIONS = ['landscape', 'portrait'];

function fail(code, msg, file = null) {
  return { code, msg, file };
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateResources(raw, errors, file) {
  if (!Array.isArray(raw)) {
    errors.push(fail('REF_SHOT_RESOURCES_INVALID', 'resources 必须是数组', file));
    return [];
  }
  const out = [];
  raw.forEach((res, index) => {
    const at = `resources[${index}]`;
    if (!isPlainObject(res)) {
      errors.push(fail('REF_SHOT_RESOURCES_INVALID', `${at} 必须是对象`, file));
      return;
    }
    for (const key of Object.keys(res)) {
      if (!RESOURCE_KEYS.includes(key)) {
        errors.push(fail('REF_SHOT_RESOURCES_INVALID', `${at} 不认识键 "${key}"`, file));
      }
    }
    if (!['image', 'video', 'font'].includes(res.type)) {
      errors.push(fail('REF_SHOT_RESOURCES_INVALID', `${at}.type 只能是 image / video / font`, file));
    }
    if (typeof res.name !== 'string' || !res.name.trim()) {
      errors.push(fail('REF_SHOT_RESOURCES_INVALID', `${at}.name 必须是非空字符串`, file));
    }
    if (res.type === 'font') {
      if (res.src !== undefined) {
        errors.push(fail('REF_SHOT_RESOURCES_INVALID',
          `${at} 是 font，只写 manifest 键做 name；src 由编译期补齐`, file));
      }
    } else if (typeof res.src !== 'string' || !res.src.trim()) {
      errors.push(fail('REF_SHOT_RESOURCES_INVALID', `${at}.src 必须是非空字符串`, file));
    }
    out.push(res);
  });
  return out;
}

/**
 * @param {string} source ref-shot 文件全文
 * @param {string} file 文件名，仅用于错误定位
 */
export function parseRefShot(source, file = '<ref-shot>') {
  const errors = [];
  const match = HEADER_RE.exec(source);
  if (!match) {
    return {
      meta: null,
      code: '',
      errors: [fail('REF_SHOT_HEADER_MISSING',
        '缺少文件头：/* @ticktoon-ref-shot { ... } */', file)],
    };
  }

  let meta;
  try {
    meta = JSON.parse(match[1]);
  } catch (error) {
    return {
      meta: null,
      code: '',
      errors: [fail('REF_SHOT_META_INVALID', `文件头不是合法 JSON：${error.message}`, file)],
    };
  }
  if (!isPlainObject(meta)) {
    return {
      meta: null,
      code: '',
      errors: [fail('REF_SHOT_META_INVALID', '文件头必须是 JSON 对象', file)],
    };
  }

  for (const key of Object.keys(meta)) {
    if (!META_KEYS.includes(key)) {
      errors.push(fail('REF_SHOT_UNKNOWN_FIELD', `文件头不认识字段 "${key}"`, file));
    }
  }
  if (typeof meta.title !== 'string' || !meta.title.trim()) {
    errors.push(fail('REF_SHOT_META_INVALID', 'title 必须是非空字符串', file));
  }
  if (!Number.isFinite(meta.duration) || meta.duration <= 0) {
    errors.push(fail('REF_SHOT_META_INVALID', 'duration 必须是大于 0 的秒数', file));
  }
  if (meta.note !== undefined && typeof meta.note !== 'string') {
    errors.push(fail('REF_SHOT_META_INVALID', 'note 必须是字符串', file));
  }
  if (meta.bg !== undefined && typeof meta.bg !== 'string') {
    errors.push(fail('REF_SHOT_META_INVALID', 'bg 必须是颜色字符串', file));
  }
  if (meta.thumbTime !== undefined
    && (!Number.isFinite(meta.thumbTime) || meta.thumbTime < 0
      || (Number.isFinite(meta.duration) && meta.thumbTime > meta.duration))) {
    errors.push(fail('REF_SHOT_META_INVALID', 'thumbTime 必须在 0 到 duration 之间', file));
  }
  if (meta.tags !== undefined
    && (!Array.isArray(meta.tags) || !meta.tags.every((tag) => typeof tag === 'string'))) {
    errors.push(fail('REF_SHOT_META_INVALID', 'tags 必须是字符串数组', file));
  }
  if (meta.sfx !== undefined && !Array.isArray(meta.sfx)) {
    errors.push(fail('REF_SHOT_META_INVALID', 'sfx 必须是 [{ name, at, volume? }] 数组', file));
  }
  if (meta.component !== undefined && typeof meta.component !== 'string') {
    errors.push(fail('REF_SHOT_META_INVALID', 'component 必须是字符串', file));
  }
  if (meta.orientation !== undefined && !ORIENTATIONS.includes(meta.orientation)) {
    errors.push(fail('REF_SHOT_META_INVALID', `orientation 只能是 ${ORIENTATIONS.join(' / ')}`, file));
  }
  if (meta.resources === undefined) {
    errors.push(fail('REF_SHOT_META_INVALID', 'resources 必填；没有资源写 []', file));
  }

  const resources = meta.resources === undefined
    ? []
    : validateResources(meta.resources, errors, file);
  const code = source.slice(match[0].length).replace(/^\r?\n/, '');
  if (!code.trim()) {
    errors.push(fail('REF_SHOT_CODE_EMPTY', '文件头之后必须有 scene.code 内容', file));
  }

  return {
    meta: { ...meta, resources },
    code,
    errors,
  };
}

/** 读取 recipe 的 ref-shots/。目录不存在、为空、文件格式错误都返回错误，不抛异常。 */
export function readRecipeRefShots(recipeDir) {
  const refShotsDir = path.join(recipeDir, 'ref-shots');
  const errors = [];
  if (!existsSync(refShotsDir)) {
    return {
      dir: refShotsDir,
      refShots: [],
      errors: [fail('REF_SHOTS_MISSING', 'code recipe 必须有 ref-shots/ 目录', 'ref-shots/')],
    };
  }
  const files = readdirSync(refShotsDir)
    .filter((name) => name.endsWith('.js'))
    .sort();
  if (!files.length) {
    return {
      dir: refShotsDir,
      refShots: [],
      errors: [fail('REF_SHOTS_EMPTY', 'ref-shots/ 里至少要有 1 个 .js 镜头参考', 'ref-shots/')],
    };
  }

  const refShots = [];
  for (const name of files) {
    const source = readFileSync(path.join(refShotsDir, name), 'utf-8');
    const parsed = parseRefShot(source, name);
    errors.push(...parsed.errors);
    if (parsed.meta) {
      refShots.push({ file: name, ...parsed, dir: refShotsDir });
    }
  }
  return { dir: refShotsDir, refShots, errors };
}

function formatFor(orientation) {
  return orientation === 'portrait'
    ? { w: 1080, h: 1920, fps: 30 }
    : { w: 1920, h: 1080, fps: 30 };
}

function formatOf(refShots, errors) {
  const orientations = new Set(refShots
    .map((refShot) => refShot.meta.orientation)
    .filter(Boolean));
  if (orientations.size > 1) {
    errors.push(fail('REF_SHOT_ORIENTATION_MIXED',
      '同一 recipe 的镜头参考不能混用 landscape / portrait', 'ref-shots/'));
  }
  return formatFor(orientations.has('portrait') ? 'portrait' : 'landscape');
}

/**
 * 把单个镜头参考包成一场 storyboard。CI 合成与 code lab 共用这一处，
 * 避免 lab 自己拼一套字段、和真实编译链漂移。
 */
export function refShotStoryboard({ recipe, refShot, code, duration, orientation } = {}) {
  const meta = refShot?.meta || {};
  const o = orientation || meta.orientation || 'landscape';
  return {
    recipe: recipe.id,
    format: formatFor(o),
    meta: { title: meta.title || path.basename(refShot?.file || 'ref-shot', '.js') },
    scenes: [{
      id: path.basename(refShot?.file || 'ref-shot', '.js'),
      duration: Number.isFinite(Number(duration)) ? Number(duration) : meta.duration,
      code: typeof code === 'string' ? code : refShot?.code || '',
      resources: Array.isArray(meta.resources) ? meta.resources : [],
      sfx: Array.isArray(meta.sfx) ? meta.sfx : [],
      note: meta.title,
    }],
  };
}

/** 把独立镜头参考合成为一部只用于 CI / lab 的回归片；每场正好对应一个 ref-shot 文件。 */
export function refShotsStoryboard({ recipe, refShots, errors = [] }) {
  const format = formatOf(refShots, errors);
  return {
    recipe: recipe.id,
    format,
    meta: { title: `${recipe.name || recipe.id} · ref-shots` },
    scenes: refShots.map((refShot) => ({
      id: path.basename(refShot.file, '.js'),
      duration: refShot.meta.duration,
      code: refShot.code,
      resources: refShot.meta.resources,
      sfx: Array.isArray(refShot.meta.sfx) ? refShot.meta.sfx : [],
      note: refShot.meta.title,
    })),
  };
}

/**
 * 返回一条 recipe 的回归输入。
 *
 * - params：直接编译 `skeleton.storyboard.json`。
 * - code：把 `ref-shots/` 合成临时 storyboard，写到 `output/ci/<id>/` 再编译。
 */
export function recipeRegressionInput({ root, recipe, write = true }) {
  const errors = [];
  const skeleton = path.join(recipe.dir, 'skeleton.storyboard.json');
  if (!existsSync(skeleton)) {
    errors.push(fail('SKELETON_MISSING', '缺少 skeleton.storyboard.json', 'skeleton.storyboard.json'));
  }

  if (recipe.mode !== 'code') {
    return { kind: 'params', file: skeleton, errors, refShots: [] };
  }

  const doc = path.join(recipe.dir, 'recipe.md');
  if (!existsSync(doc)) {
    errors.push(fail('RECIPE_DOC_MISSING', 'recipe 必须有 recipe.md（创作纲要 + 画法规范）', 'recipe.md'));
  }

  const { refShots, errors: refShotErrors } = readRecipeRefShots(recipe.dir);
  errors.push(...refShotErrors);
  if (errors.length) return { kind: 'code', file: null, errors, refShots };

  const storyboard = refShotsStoryboard({ recipe, refShots, errors });
  if (errors.length) return { kind: 'code', file: null, errors, refShots };

  const dir = path.join(root, 'output', 'ci', recipe.id.replaceAll('/', '-'));
  const file = path.join(dir, 'ref-shots.storyboard.json');
  if (write) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, JSON.stringify(storyboard, null, 2) + '\n');
  }
  return { kind: 'code', file, errors, refShots, storyboard };
}
