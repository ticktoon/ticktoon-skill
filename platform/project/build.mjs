/**
 * 工程构建：①schema → ②resolve → ③plan → ④emit → ⑤assemble → ⑥check。
 *
 * 每步都可能报错，但只有 schema 的错误会让流程停下——因为后面的步骤都建立在
 * "结构合法"这个前提上。其余步骤尽量跑完，一次把问题全给出来。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadCatalog, normalizeStoryboard } from '../compile/schema.mjs';
import { resolveStoryboard } from '../compile/resolve.mjs';
import { planStoryboard } from '../compile/plan.mjs';
import { emitScene } from '../compile/emit.mjs';
import { assemble, buildSrt } from '../compile/assemble.mjs';
import { check } from '../compile/check.mjs';
import { detHash, sceneHashes } from '../compile/det.mjs';
import { Bag } from '../compile/diag.mjs';

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

function summarize({ planned, emitted, resolved, composition }) {
  let elements = 0;
  let cues = 0;
  for (const scene of planned.scenes) {
    elements += scene.elements.length;
    cues += scene.cues.length;
  }
  return {
    duration: composition.duration,
    scenes: planned.scenes.length,
    elements,
    captionCues: cues,
    codeScenes: planned.scenes.filter((scene) => scene.code).length,
    cachedCanvases: 0,
    estimatedNarration: resolved.scenes.filter((s) => s.estimated).length,
  };
}

/**
 * @param {{ root: string, dir: string, tts?: object|null, write?: boolean, captionOverride?: string|object|null }} options
 */
export async function buildProject({ root, dir, file = null, tts = null, write = true, receipts = false, captionOverride = null }) {
  const started = Date.now();
  // file 覆盖：audit 直接编译 recipe 的 demo.storyboard.json，不复制临时文件
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
  const { storyboard, bag: schemaBag, recipe, style, caption } = normalized;
  bag.errors.push(...schemaBag.errors);
  bag.warnings.push(...schemaBag.warnings);

  if (!bag.ok || !style) {
    return finish({ ok: false, bag, outDir, write, report: { ok: false, status: 'failed', errors: bag.errors, warnings: bag.warnings } });
  }

  const resolved = await resolveStoryboard({ storyboard, style, recipe, catalog, tts });
  bag.warnings.push(...resolved.warnings);

  const planned = planStoryboard({
    storyboard,
    resolved,
    format: storyboard.format,
    bag,
    captionPx: caption?.metrics?.baseSize ?? 46,
  });

  const { kitIndex, kitDir } = readKitIndex(root);
  const emitted = planned.scenes.map((scene) => emitScene({
    scene,
    style,
    format: storyboard.format,
    catalog,
    kitIndex,
    kitDir,
    caption,
    receipts,
    rules: recipe?.rules || null,
  }));

  check({ scenes: planned.scenes, style, format: storyboard.format, bag, catalog, caption, recipe });

  const { composition, events } = assemble({
    scenes: emitted.map((scene, i) => ({
      ...scene,
      start: planned.scenes[i].start,
      speechStart: planned.scenes[i].speechStart,
    })),
    resolved,
    format: storyboard.format,
    bag,
  });

  // 把视觉规范随产物透传（引擎只读已知字段），供 tt qa 执行 verify / forbid。
  if (recipe?.abi === '8') {
    composition._recipe = {
      id: recipe.id,
      abi: recipe.abi,
      blocks: recipe.blocks,
      rules: recipe.rules,
      verify: recipe.verify,
    };
  }

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
    timings: { totalMs: Date.now() - started },
    warnings: bag.warnings,
    errors: bag.errors,
    receipts: [],
  };

  const context = { style, recipe, storyboard, caption, captionName: caption?.name || null, catalog };
  if (!bag.ok) return { ...finish({ ok: false, bag, outDir, write, report, composition, events, planned }), ...context };
  return { ...finish({ ok: true, bag, outDir, write, report, composition, events, planned }), ...context };
}

function finish({ ok, bag, outDir, write, report, composition, events, planned }) {
  if (write) {
    mkdirSync(outDir, { recursive: true });
    if (composition) writeFileSync(path.join(outDir, 'composition.json'), JSON.stringify(composition, null, 2));
    if (events) writeFileSync(path.join(outDir, 'events.json'), JSON.stringify(events, null, 2));
    if (composition) writeFileSync(path.join(outDir, 'subs.srt'), buildSrt(composition.scenes));
    writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  }
  return { ok, bag, report, composition, events, planned, outDir };
}
