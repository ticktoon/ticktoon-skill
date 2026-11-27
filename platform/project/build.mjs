/**
 * 工程构建：①schema → ②resolve → ③plan → ④emit → ⑤check → ⑥assemble。
 *
 * 每步都可能报错，但只有 schema 的错误会让流程停下——因为后面的步骤都建立在
 * "结构合法"这个前提上。其余步骤尽量跑完，一次把问题全给出来。
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadCatalog, normalizeStoryboard } from '../compile/schema.mjs';
import { resolveStoryboard } from '../compile/resolve.mjs';
import { planStoryboard } from '../compile/plan.mjs';
import { emitScene } from '../compile/emit.mjs';
import { assemble, buildSrt } from '../compile/assemble.mjs';
import { check } from '../compile/check.mjs';
import { detHash, sceneHashes } from '../compile/det.mjs';
import { Bag } from '../compile/diag.mjs';
import { createVisualScenes } from '../compile/transition-scenes.mjs';
import { generateProjectAudio } from '../audio/index.mjs';

function readKitIndex(root) {
  const kitDir = path.join(root, 'platform', 'kit');
  const index = JSON.parse(readFileSync(path.join(kitDir, 'index.json'), 'utf-8'));
  return { kitIndex: index, kitDir };
}

/** 用引擎自己的校验器再跑一遍：协议漂移必须在这里暴露，而不是在导出时才炸。 */
async function validateWithEngine(root, composition) {
  try {
    const { getEngineDir } = await import('../../scripts/lib/engine-runtime.mjs');
    const engineDir = getEngineDir(root);
    const mod = await import(`file://${path.join(engineDir, 'runtime', 'validate.js').replace(/\\/g, '/')}`);
    mod.validateComposition(composition);
    return { checked: true, error: null };
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') return { checked: false, error: null };
    return { checked: true, error: error?.message || String(error) };
  }
}

function summarize({ planned, resolved, composition }) {
  let units = 0;
  let cues = 0;
  for (const scene of planned.scenes) {
    if (scene.unit) units += 1;
    cues += scene.cues.length;
  }
  return {
    duration: composition.duration,
    scenes: planned.scenes.length,
    paramsScenes: planned.scenes.filter((scene) => scene.params !== null).length,
    units,
    captionCues: cues,
    codeScenes: planned.scenes.filter((scene) => scene.code !== null).length,
    estimatedNarration: resolved.scenes.filter((s) => s.estimated).length,
  };
}

/**
 * @param {{ root: string, dir: string, tts?: object|null, write?: boolean, audioDir?: string, captionOverride?: string|object|null }} options
 */
export async function buildProject({ root, dir, file = null, tts = null, write = true, audioDir = null, receipts = false, captionOverride = null }) {
  const started = Date.now();
  // file 覆盖：audit / ci 直接编译 recipe 的骨架或示例合成片，不要求它是工程 storyboard.json
  const storyboardPath = file || path.join(dir, 'storyboard.json');
  const outDir = path.join(dir, 'out');
  const bag = new Bag();

  if (!existsSync(storyboardPath)) {
    bag.error('PROJECT_NO_STORYBOARD', '', `找不到 ${storyboardPath}；先跑 tt new <dir> --recipe <id>`);
    return { ok: false, bag, report: { ok: false, status: 'failed', errors: bag.errors, warnings: [] } };
  }

  let raw;
  try {
    raw = JSON.parse(readFileSync(storyboardPath, 'utf-8'));
  } catch (error) {
    bag.error('PROJECT_BAD_JSON', 'storyboard.json', `JSON 解析失败：${error.message}`);
    return { ok: false, bag, report: { ok: false, status: 'failed', errors: bag.errors, warnings: [] } };
  }

  const catalog = loadCatalog(root);
  const normalized = normalizeStoryboard(raw, catalog, captionOverride);
  const { storyboard, bag: schemaBag, recipe, caption } = normalized;
  bag.errors.push(...schemaBag.errors);
  bag.warnings.push(...schemaBag.warnings);

  if (!bag.ok) {
    return finish({ ok: false, bag, outDir, write, report: { ok: false, status: 'failed', errors: bag.errors, warnings: bag.warnings } });
  }

  const resolved = await resolveStoryboard({ storyboard, recipe, catalog, tts });
  bag.warnings.push(...resolved.warnings);

  const planned = planStoryboard({
    storyboard,
    resolved,
    format: storyboard.format,
    bag,
    captionPx: caption?.metrics?.baseSize ?? 46,
  });

  const { kitIndex, kitDir } = readKitIndex(root);
  const film = {
    duration: planned.duration,
    chapters: planned.scenes.map((scene, index) => ({
      text: String(scene.params?.kicker || scene.note || scene.id || `第 ${index + 1} 章`),
      start: scene.start,
    })),
  };
  const emitted = planned.scenes.map((scene) => emitScene({
    scene,
    recipe,
    format: storyboard.format,
    catalog,
    kitIndex,
    kitDir,
    caption,
    film,
    receipts,
    rules: recipe?.rules || null,
  }));

  check({ scenes: planned.scenes, bag, recipe, catalog });

  // 声音始终绑定原始逻辑场；视觉场可以插入转场、裁掉首尾，但不能改变音频时钟。
  const audioScenes = emitted.map((scene, i) => ({
    ...scene,
    start: planned.scenes[i].start,
    speechStart: planned.scenes[i].speechStart,
  }));
  const visual = createVisualScenes({
    plannedScenes: planned.scenes,
    emittedScenes: audioScenes,
    format: storyboard.format,
    transitionKitCode: readFileSync(path.join(kitDir, kitIndex.transition.file), 'utf-8'),
    bag,
  });
  let generatedAudio = null;
  try {
    generatedAudio = await generateProjectAudio({
      recipe, planned, emitted, resolved,
      audioDir: audioDir || (write ? path.join(outDir, 'audio') : path.join(root, 'output', 'audio')),
    });
    for (const msg of generatedAudio?.info?.warnings || []) {
      bag.warn('nice', 'AUDIO_MIX', 'audio', msg);
    }
  } catch (error) {
    bag.error('AUDIO_GENERATE_FAILED', 'audio', `生成音频失败：${error.message}`);
  }
  const { composition, events } = assemble({
    scenes: visual.scenes,
    audioScenes,
    resolved,
    generatedAudio,
    format: storyboard.format,
    bag,
  });

  const engineCheck = await validateWithEngine(root, composition);
  if (engineCheck.error) {
    bag.error('ENGINE_VALIDATE', 'composition',
      `引擎校验未通过：${engineCheck.error}（编译器认为合法，说明两边的协议已经漂移）`);
  }

  const stats = summarize({ planned, emitted, resolved, composition });
  const report = {
    ok: bag.ok,
    status: bag.ok ? (bag.warnings.some((w) => w.level === 'should') ? 'warning' : 'ok') : 'failed',
    ...stats,
    // 指纹进 report：每次 build 都是一次回归比对，不用另外跑一遍
    det: { hash: detHash(composition), scenes: sceneHashes(composition) },
    engineChecked: engineCheck.checked,
    audio: generatedAudio?.info || null,
    timings: { totalMs: Date.now() - started },
    warnings: bag.warnings,
    errors: bag.errors,
    receipts: [],
  };

  const context = { recipe, storyboard, caption, captionName: caption?.name || null, catalog };
  if (!bag.ok) return { ...finish({ ok: false, bag, outDir, write, report, composition, events, planned }), ...context };
  return { ...finish({ ok: true, bag, outDir, write, report, composition, events, planned }), ...context };
}

function finish({ ok, bag, outDir, write, report, composition, events, planned }) {
  if (write) {
    mkdirSync(outDir, { recursive: true });
    if (composition) writeFileSync(path.join(outDir, 'composition.json'), JSON.stringify(composition, null, 2));
    if (events) writeFileSync(path.join(outDir, 'events.json'), JSON.stringify(events, null, 2));
    if (composition) {
      const scenes = planned?.scenes || composition.scenes;
      const hasCaptions = scenes.some((scene) => Array.isArray(scene.cues) && scene.cues.length > 0);
      const srtFile = path.join(outDir, 'subs.srt');
      if (hasCaptions) writeFileSync(srtFile, buildSrt(scenes));
      else rmSync(srtFile, { force: true });
    }
    writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  }
  return { ok, bag, report, composition, events, planned, outDir };
}
