/**
 * 抽帧采样：一次浏览器会话，渲染 N 帧，带回三样东西。
 *
 *   receipts   每个单元在那一帧的**真实墨迹框**（逻辑像素）
 *   luminance  那一帧的平均亮度（判空帧用）
 *   grid       把 N 帧拼成一张联系表（contact sheet），人一眼看全片
 *
 * 为什么不是循环调用 stills：每次都要起浏览器、起静态服务、重新 prepare，
 * 9 帧就是 9 次冷启动。同一会话里 capture 之间只差一次重绘，成本是毫秒级；
 * capture 还会 await 视频 settle，比固定睡 140ms 更稳。
 *
 * 采样点优先保证**每场至少一帧**：均匀按时间取会在长场上浪费、在短场上漏掉。
 * 场内的采样位置固定在 55%，避开入场动画与退场淡出——那是画面最不能代表这一场的时候。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildProject } from '../project/build.mjs';
import { createStaticServer } from '../../scripts/lib/serve.mjs';
import { buildAssetBasenameMap, rewriteLocalRefs } from '../../scripts/lib/refs.mjs';
import { getEngineDir } from '../../scripts/lib/engine-runtime.mjs';
import { openPreviewSession } from './preview-session.mjs';
import { mergeFrameReceipts } from './receipts.mjs';

const SAMPLE_AT = 0.55;

/** 每场至少一帧；名额有富余时优先补给更长的场。 */
export function sampleTimes(planned, count) {
  const scenes = planned?.scenes || [];
  if (!scenes.length) return [];
  const picks = [];
  const quota = new Map();
  for (const scene of scenes) quota.set(scene.id, count >= scenes.length ? 1 : 0);

  if (count < scenes.length) {
    const stride = scenes.length / count;
    for (let i = 0; i < count; i += 1) {
      const scene = scenes[Math.min(scenes.length - 1, Math.round(i * stride))];
      quota.set(scene.id, 1);
    }
  }

  let spare = count - [...quota.values()].reduce((a, b) => a + b, 0);
  while (spare > 0) {
    const target = [...scenes].sort((a, b) => b.duration / (quota.get(b.id) + 1) - a.duration / (quota.get(a.id) + 1))[0];
    quota.set(target.id, quota.get(target.id) + 1);
    spare -= 1;
  }

  for (const scene of scenes) {
    const n = quota.get(scene.id) || 0;
    for (let i = 0; i < n; i += 1) {
      // 多帧同一场时沿场均匀铺开，仍然避开首尾 15%
      const frac = n === 1 ? SAMPLE_AT : 0.18 + (0.64 * (i + 0.5)) / n;
      const at = Math.min(scene.duration - 0.05, Math.max(0.03, scene.duration * frac));
      picks.push({ sceneId: scene.id, time: Number((scene.start + at).toFixed(3)) });
    }
  }
  return picks.sort((a, b) => a.time - b.time);
}

/** 内容单元：code 场（内容全在 code 里）或带 template 单元的 params 场。 */
export function isContentScene(scene) {
  if (typeof scene?.code === 'string' && scene.code.trim()) return true;
  return scene?.unit != null;
}

/**
 * 审片采样点：12 格联系表用。首场开场 6% + 末场收尾 94%，其余从时间维采样点里
 * 均匀挑选，避免为了拼图再渲染一整套独立帧。
 *
 * 均匀采样为了避开入场/退场固定在 18%–82%，但联系表需要看到片子的头尾。
 * 这里只选视觉证据，不做评分；不足 count 时再从候选里顺次补足。
 */
export function reviewSampleTimes(planned, count = 12, base = null) {
  const scenes = planned?.scenes || [];
  if (!scenes.length || count <= 0) return [];
  const content = scenes.filter((scene) => isContentScene(scene));
  const first = content[0] || scenes[0];
  const last = content[content.length - 1] || scenes[scenes.length - 1];
  const at = (scene, frac) => Number(Math.min(
    scene.start + scene.duration - 0.05,
    Math.max(scene.start + 0.03, scene.start + scene.duration * frac),
  ).toFixed(3));

  const picks = [];
  const add = (sceneId, time) => {
    if (picks.length >= count) return;
    if (picks.some((pick) => Math.abs(pick.time - time) < 0.05)) return;
    picks.push({ sceneId, time });
  };
  add(`${first.id}:hook`, at(first, 0.06));
  add(`${last.id}:ending`, at(last, 0.94));

  const candidates = Array.isArray(base) && base.length
    ? base
    : sampleTimes(planned, Math.max(count, 1));
  const need = count - picks.length;
  if (need > 0 && candidates.length) {
    const stride = candidates.length / need;
    for (let i = 0; i < need; i += 1) {
      const pick = candidates[Math.min(candidates.length - 1, Math.floor((i + 0.5) * stride))];
      add(pick.sceneId, pick.time);
    }
  }
  for (const pick of candidates) {
    if (picks.length >= count) break;
    add(pick.sceneId, pick.time);
  }
  return picks.sort((a, b) => a.time - b.time);
}

/**
 * @returns {{ ok, report, files, receipts, luminance, grid, coverage, pageErrors }}
 */
export async function sampleFilm({
  root, dir, planned, composition, report, times,
  tts = null, grid = null, saveFrames = false, log = () => {}, file = null,
}) {
  const engineDir = getEngineDir(root);
  const assetsDir = path.join(root, 'assets');
  const assetBasenameMap = buildAssetBasenameMap({ assetsDir });
  const { server, port } = await createStaticServer({ ENGINE_DIR: engineDir, ASSETS_DIR: assetsDir, JOB_DIR: path.join(dir, 'out') });
  const base = `http://127.0.0.1:${port}`;
  const payload = rewriteLocalRefs(structuredClone(composition), base, assetBasenameMap);

  const outDir = path.join(dir, 'review');
  mkdirSync(outDir, { recursive: true });

  const files = [];
  const receipts = [];
  const luminance = [];
  const pageErrors = [];
  const gridPickTimes = Array.isArray(grid?.picks) ? grid.picks.map(Number) : null;
  const isGridPick = (time) => !gridPickTimes
    || gridPickTimes.some((pick) => Math.abs(pick - time) < 1e-6);
  let gridFile = null;
  let session = null;

  try {
    session = await openPreviewSession({
      base,
      composition: payload,
      onPageError: (message) => pageErrors.push(message),
    });
    const duration = session.duration;

    if (grid) await session.initSheet(grid);

    for (const time of times) {
      if (duration && time > duration) {
        log(`  ! t=${time}s 超出片长 ${duration.toFixed(2)}s，跳过`);
        continue;
      }
      await session.resetReceipts();
      const shot = await session.captureAt(time, { sheet: Boolean(grid) && isGridPick(time) });
      luminance.push({ t: time, mean: shot.mean });

      if (saveFrames) {
        const dataUrl = await session.frameDataUrl();
        if (dataUrl) {
          const file = path.join(outDir, `t${time.toFixed(2)}s.png`);
          writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
          files.push(file);
        }
      }

      const frame = await session.receipts();
      const entries = mergeFrameReceipts(frame, time);
      receipts.push(...entries);
      log(`  t=${time}s → ${entries.length} 条凭据，亮度 ${shot.mean.toFixed(1)}`);
    }

    if (grid) {
      const dataUrl = await session.sheetDataUrl();
      if (!dataUrl) throw new Error('联系表生成失败：页内没有 __sheet');
      gridFile = path.join(outDir, grid.file || 'sheet.png');
      writeFileSync(gridFile, Buffer.from(dataUrl.split(',')[1], 'base64'));
      files.push(gridFile);
    }
  } finally {
    await session?.close();
    server.close();
  }

  return {
    ok: true,
    report,
    planned,
    composition,
    files,
    grid: gridFile,
    receipts,
    luminance,
    coverage: coverageOf(planned, receipts),
    pageErrors,
  };
}

/** 覆盖率的口径是"声明过的单元"而不是"能画的单元"：没出现就是没出现，不给面子。 */
export function coverageOf(planned, receipts) {
  const declared = [];
  for (const scene of planned?.scenes || []) {
    if (scene.unit) declared.push({ scene: scene.id, unit: scene.unit.id });
  }
  const seen = new Set(receipts.map((item) => `${item.scene}/${item.unit}`));
  const missing = declared.filter((item) => !seen.has(`${item.scene}/${item.unit}`));
  return {
    declared: declared.length,
    covered: declared.length - missing.length,
    ratio: declared.length ? Number(((declared.length - missing.length) / declared.length).toFixed(3)) : 1,
    missing,
  };
}
