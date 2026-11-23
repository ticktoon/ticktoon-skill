/**
 * Kit 实验台的独立编译：不读 recipe，也不走 storyboard。
 *
 * 页面给一段 scene.code、旁白与字幕参数；这里把平台 kit 源码、字幕核心、
 * 由代码声明推导出的 FONTS / 固定 RULES 和用户代码拼成 composition，再交给同一个
 * preview-panel 播放。普通模式为单场；转场模式把前后两个逻辑场展开为 A' + T + B'
 * 双帧视觉节点。没有 recipe 契约、模板或 TTS 请求。
 */
import { buildCues } from '../compile/plan.mjs';
import { estimateSpeech, PACING } from '../compile/resolve.mjs';
import { normalizeCaption } from '../compile/captions.mjs';
import { normalizeTransitionPreset, TRANSITION_PRESETS } from '../compile/transitions.mjs';
import { createVisualScenes } from '../compile/transition-scenes.mjs';

const W_LANDSCAPE = 1920;
const H_LANDSCAPE = 1080;
const W_PORTRAIT = 1080;
const H_PORTRAIT = 1920;
const FPS = 30;
const SEED = 24680;
const LEAD_IN = PACING.leadIn;
const HOLD = PACING.hold;
const round3 = (value) => Math.round(value * 1000) / 1000;

/**
 * 实验台的字体策略与生产同一套：scene.code 里写的 manifest 键就是本场字体资源。
 * 这里扫描代码里出现的字体键，加上 sans-400 / sans-900 兜底和字幕字体，
 * 只为这些键出资源，避免把整个字体库都塞进一次预览。字体库本身向作者开放：
 * assets/fonts/manifest.json 的每个键都可以直接写。
 */
const LAB_BASE_FONTS = ['sans-400', 'sans-900'];

/** 实验台固定视觉规范；和 code recipe 的 RULES 是同一个形状。 */
export const KIT_RULES = {
  safeMargin: 0.06,
  scale: { title: 1, label: 0.8, note: 0.6 },
  stroke: [3, 6],
};

function orientationFormat(orientation) {
  return orientation === 'portrait'
    ? { w: W_PORTRAIT, h: H_PORTRAIT }
    : { w: W_LANDSCAPE, h: H_LANDSCAPE };
}

function makeBag() {
  const errors = [];
  const warnings = [];
  return {
    errors,
    warnings,
    error(code, path, msg) {
      errors.push({ code, path: path || '', msg });
    },
    warn(level, code, path, msg) {
      warnings.push({ level, code, path: path || '', msg });
    },
  };
}

function fontResources(catalog, code, captionFontName) {
  const names = new Set(LAB_BASE_FONTS);
  const source = String(code || '');
  for (const name of Object.keys(catalog.fonts || {})) {
    if (!catalog.fonts[name]?.src) continue;
    const quoted = new RegExp(`['"\`]${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`);
    if (quoted.test(source)) names.add(name);
  }
  if (captionFontName) names.add(captionFontName);
  const resources = [];
  for (const name of names) {
    const entry = catalog.fonts?.[name];
    if (!entry?.src) continue;
    resources.push({ type: 'font', name, src: entry.src });
  }
  return resources;
}

/**
 * @param {{
 *   code: string, nextCode?: string|null, duration: number, orientation: 'landscape'|'portrait',
 *   transition?: string|null,
 *   narration?: string, speech?: number|null, captions?: object|string|null,
 *   catalog: object, kits: Array<{id:string, code:string, provides:string[], requires:string[]}>,
 * }} input
 */
export function buildKitComposition({
  code,
  nextCode = null,
  transition = null,
  duration,
  orientation = 'landscape',
  narration = '',
  speech = null,
  captions = null,
  catalog,
  kits,
}) {
  const errors = [];
  const format = orientationFormat(orientation);
  const hasNarration = typeof narration === 'string' && narration.trim().length > 0;
  const narrationText = hasNarration ? narration : '';
  const speechDur = hasNarration
    ? (Number.isFinite(speech) && speech > 0 ? speech : estimateSpeech(narrationText))
    : 0;
  const sceneDuration = hasNarration
    ? round3(LEAD_IN + speechDur + HOLD)
    : round3(Number(duration));
  if (!(sceneDuration > 0)) {
    errors.push({ code: 'LAB_DURATION_INVALID', path: '', msg: '时长必须大于 0' });
  }

  const bag = makeBag();
  const hasNext = nextCode !== null && nextCode !== undefined;
  let transitionName = null;
  if (hasNext) {
    if (typeof nextCode !== 'string' || !nextCode.trim()) {
      bag.error('LAB_NEXT_CODE_INVALID', 'nextCode', 'nextCode 必须是非空代码字符串');
    }
    transitionName = normalizeTransitionPreset(transition, bag, 'transition');
    if (!transitionName) {
      bag.error('LAB_TRANSITION_REQUIRED', 'transition', '转场预览必须选择一个固定预设');
    } else if (sceneDuration <= TRANSITION_PRESETS[transitionName].dur / 2) {
      bag.error('TRANSITION_SCENE_TOO_SHORT', 'duration', '单场时长必须大于转场时长的一半');
    }
  } else if (transition != null) {
    bag.error('LAB_NEXT_CODE_REQUIRED', 'nextCode', '使用转场时必须提供第二场 nextCode');
  }
  const caption = captions == null || captions === ''
    ? null
    : normalizeCaption(captions, catalog, bag, { margin: KIT_RULES.safeMargin });
  if (bag.errors.length) {
    return { ok: false, errors: bag.errors, warnings: bag.warnings, composition: null, report: null };
  }

  const cues = hasNarration
    ? buildCues(narrationText, speechDur, {
      captionPx: caption?.metrics?.baseSize ?? 46,
      width: format.w,
      speechStart: LEAD_IN,
    })
    : [];

  function makeSceneCode(source) {
    const lines = [];
    lines.push('/* Ticktoon kit lab — 固定 KIT 上下文，由实验台现场拼装 */');
    lines.push('const TT = {};');
    for (const kit of kits) {
      for (const data of kit.payload || []) lines.push(data.trim());
      lines.push(`/* kit:${kit.id} */`);
      lines.push(kit.code.trim());
    }
    if (caption?.code && cues.length) {
      lines.push('const CAPTIONS = {};');
      lines.push(`const CAPTION_OPTIONS = ${JSON.stringify(caption.options || {})};`);
      lines.push(`/* caption:${caption.name} */`);
      lines.push(caption.code.trim());
    }
    const fonts = {};
    for (const res of fontResources(catalog, source, caption?.fontName)) fonts[res.name] = res.name;
    lines.push(`const FONTS = ${JSON.stringify(fonts)};`);
    lines.push(`const RULES = ${JSON.stringify(KIT_RULES)};`);
    lines.push('');
    lines.push('return (ctx, api) => {');
    lines.push('  const T = api.t;');
    lines.push('  const W = api.W;');
    lines.push('  const H = api.H;');
    lines.push('  ctx.save();');
    lines.push('  if (TT.pen && TT.pen.resetBBox) TT.pen.resetBBox();');
    lines.push('  if (TT.text && TT.text.resetBBox) TT.text.resetBBox();');
    lines.push('  try {');
    for (const line of source.split(/\r?\n/)) lines.push(`    ${line}`);
    lines.push('  } finally {');
    lines.push('    ctx.restore();');
    lines.push('  }');
    if (caption?.code && cues.length) {
      lines.push('  // 字幕是完整场景画面的一部分，转场不单独处理');
      lines.push(`  CAPTIONS[${JSON.stringify(caption.name)}]({`);
      lines.push('    ctx, W, H, fonts: FONTS,');
      lines.push(`    metrics: ${JSON.stringify(caption.metrics)},`);
      lines.push('    sceneT: T, cues: api.cues, options: CAPTION_OPTIONS,');
      lines.push('  });');
    }
    lines.push('};');
    return lines.join('\n');
  }

  const sceneCode = makeSceneCode(code);
  const nextSceneCode = hasNext ? makeSceneCode(nextCode) : null;
  for (const [path, source] of [['scene.code', sceneCode], ['nextCode', nextSceneCode]]) {
    if (source === null) continue;
    try {
      new Function(source);
    } catch (error) {
      return {
        ok: false,
        errors: [{ code: 'LAB_CODE_SYNTAX', path, msg: error?.message || String(error) }],
        warnings: bag.warnings,
        composition: null,
        report: null,
      };
    }
  }

  const logicalScenes = [{
    id: 'kit-playground',
    start: 0,
    duration: sceneDuration,
    width: format.w,
    height: format.h,
    background: '#000000',
    seed: SEED,
    code: sceneCode,
    cues,
    resources: fontResources(catalog, code, caption?.fontName),
    needs: [],
    meta: { index: 0, sfx: null },
  }];
  if (hasNext) {
    logicalScenes.push({
      id: 'kit-playground-next',
      start: sceneDuration,
      duration: sceneDuration,
      width: format.w,
      height: format.h,
      background: '#000000',
      seed: SEED + 1,
      code: nextSceneCode,
      cues,
      resources: fontResources(catalog, nextCode, caption?.fontName),
      needs: [],
      meta: { index: 1, sfx: null },
    });
  }
  const plannedScenes = logicalScenes.map((scene, index) => ({
    id: scene.id,
    index,
    start: scene.start,
    duration: scene.duration,
    cues: scene.cues,
    transition: index === 0 && hasNext ? transitionName : null,
  }));
  const visual = createVisualScenes({
    plannedScenes,
    emittedScenes: logicalScenes,
    format,
    transitionKitCode: kits.find((kit) => kit.id === 'transition')?.code || '',
    bag,
  });
  if (bag.errors.length) {
    return { ok: false, errors: bag.errors, warnings: bag.warnings, composition: null, report: null };
  }
  const scenes = visual.scenes;
  const totalDuration = round3(sceneDuration * logicalScenes.length);
  const composition = {
    version: '1.0',
    width: format.w,
    height: format.h,
    fps: FPS,
    duration: totalDuration,
    scenes,
    audio: [],
  };

  return {
    ok: true,
    composition,
    warnings: bag.warnings,
    report: {
      duration: totalDuration,
      scenes: scenes.length,
      det: '',
      warnings: bag.warnings,
    },
  };
}