/**
 * 抽帧采样：一次浏览器会话，渲染 N 帧，带回三样东西。
 *
 *   receipts   每个元素在那一帧的**真实墨迹框**（逻辑像素）
 *   luminance  那一帧的平均亮度（判空帧用）
 *   grid       把 N 帧拼成一张联系表（contact sheet），人一眼看全片
 *
 * 为什么不是循环调用 stills：每次都要起浏览器、起静态服务、重新 prepare，
 * 9 帧就是 9 次冷启动。同一会话里 seek 之间只差一次重绘，成本是毫秒级。
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
import { chromiumArgs } from '../../scripts/lib/chromium-args.mjs';

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

const fullBleed = (el) => {
  const rect = el?.rect;
  if (!Array.isArray(rect) || rect.length < 4) return false;
  return Number(rect[2]) >= 0.9 && Number(rect[3]) >= 0.9;
};

/** 内容单元：code 场（内容全在 code 里）或单个满幅 scene.* 块（如 scene.crayon）。 */
export function isContentScene(scene) {
  if (typeof scene?.code === 'string' && scene.code.trim() && (scene.elements || []).length === 0) return true;
  const elements = scene?.elements || [];
  return elements.length === 1 && String(elements[0].block || '').startsWith('scene.') && fullBleed(elements[0]);
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

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: chromiumArgs() });
  const files = [];
  const receipts = [];
  const luminance = [];
  const pageErrors = [];
  const gridPickTimes = Array.isArray(grid?.picks) ? grid.picks.map(Number) : null;
  const isGridPick = (time) => !gridPickTimes
    || gridPickTimes.some((pick) => Math.abs(pick - time) < 1e-6);
  let gridFile = null;

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') pageErrors.push(message.text().slice(0, 300));
    });
    await page.addInitScript(() => {
      window.__panelMsgs = [];
      window.__ttReceipts = [];
      window.addEventListener('message', (event) => {
        if (event.data?.__source === 'ticktoon-preview-panel') window.__panelMsgs.push(event.data);
      });
      globalThis.__ttReceipt = (payloadIn) => {
        window.__ttReceipts.push(payloadIn);
      };
    });

    await page.goto(`${base}/preview-panel.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const waitMessage = async (type, timeout = 60000) => {
      const started = Date.now();
      for (;;) {
        const index = await page.evaluate((wanted) => window.__panelMsgs.findIndex((m) => m.type === wanted), type);
        if (index >= 0) return page.evaluate((at) => window.__panelMsgs.splice(at, 1)[0], index);
        const error = await page.evaluate(() => window.__panelMsgs.find((m) => m.type === 'error'));
        if (error) throw new Error(`预览面板错误：${error.message}`);
        if (Date.now() - started > timeout) throw new Error(`等面板消息 ${type} 超时`);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    };

    await waitMessage('ready');
    await page.evaluate((input) => {
      window.postMessage({ __source: 'ticktoon-preview-page', type: 'load', composition: input, controls: false }, '*');
    }, payload);
    const loaded = await waitMessage('loaded');
    const duration = Number(loaded.duration) || 0;

    if (grid) {
      await page.evaluate((spec) => {
        const cv = document.getElementById('cv');
        const k = spec.cellWidth / cv.width;
        const cellH = Math.round(cv.height * k);
        const sheet = document.createElement('canvas');
        sheet.width = spec.cols * spec.cellWidth + (spec.cols + 1) * spec.gap;
        sheet.height = Math.ceil(spec.count / spec.cols) * (cellH + spec.labelH) + spec.gap;
        window.__sheet = { canvas: sheet, ctx: sheet.getContext('2d'), k, cellH, spec, drawn: 0 };
        const ctx = sheet.getContext('2d');
        ctx.fillStyle = '#0b0d11';
        ctx.fillRect(0, 0, sheet.width, sheet.height);
      }, grid);
    }

    for (const time of times) {
      if (duration && time > duration) {
        log(`  ! t=${time}s 超出片长 ${duration.toFixed(2)}s，跳过`);
        continue;
      }
      await page.evaluate(() => { window.__ttReceipts = []; });
      await page.evaluate((value) => {
        window.postMessage({ __source: 'ticktoon-preview-page', type: 'seek', time: value }, '*');
      }, time);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      await new Promise((resolve) => setTimeout(resolve, 140));

      // seek 失败不会抛到这里——面板把错误画进了浮层。这里主动捞，否则"图没加载"
      // 只表现为一张黑帧，排查成本极高。
      const fail = await page.evaluate(() => {
        const index = window.__panelMsgs.findIndex((m) => m.type === 'error');
        return index >= 0 ? window.__panelMsgs.splice(index, 1)[0].message : null;
      });
      if (fail) throw new Error(`t=${time}s 场景渲染失败：${fail}`);

      const stat = await page.evaluate(() => {
        const cv = document.getElementById('cv');
        if (!cv) return null;
        const probe = document.createElement('canvas');
        probe.width = 32;
        probe.height = 18;
        const ctx = probe.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(cv, 0, 0, 32, 18);
        const data = ctx.getImageData(0, 0, 32, 18).data;
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) {
          sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        }
        return { mean: sum / (data.length / 4), width: cv.width, height: cv.height };
      });
      if (!stat) throw new Error('找不到画布 #cv（面板可能没有进入预览模式）');
      luminance.push({ t: time, mean: Number(stat.mean.toFixed(2)) });

      if (grid && isGridPick(time)) {
        await page.evaluate(() => {
          const s = window.__sheet;
          const cv = document.getElementById('cv');
          const index = s.drawn;
          const col = index % s.spec.cols;
          const row = Math.floor(index / s.spec.cols);
          const x = s.spec.gap + col * (s.spec.cellWidth + s.spec.gap);
          const y = s.spec.gap + row * (s.cellH + s.spec.labelH + s.spec.gap);
          s.ctx.drawImage(cv, x, y, s.spec.cellWidth, s.cellH);
          s.ctx.fillStyle = '#8a94a6';
          s.ctx.font = '600 13px ui-monospace, Menlo, monospace';
          s.ctx.fillText(s.spec.labels[index] || '', x + 4, y + s.cellH + 14);
          s.drawn += 1;
        });
      }

      if (saveFrames) {
        const dataUrl = await page.evaluate(() => document.getElementById('cv')?.toDataURL('image/png') ?? null);
        if (dataUrl) {
          const file = path.join(outDir, `t${time.toFixed(2)}s.png`);
          writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
          files.push(file);
        }
      }

      const frame = await page.evaluate(() => window.__ttReceipts);
      // 同一元素可能有 ink / text / caption 多条凭据，去重键必须带上 kind。
      // 文字另有逐条回执：同一帧重绘会得到完全相同的绘制顺序，因此用 idx 配对；
      // 并集凭据（aggregate）单独占一个槽位。label 只用于报告，不参与去重。
      const textTag = (item) => (item.kind === 'text'
        ? (item.aggregate === true || item.idx == null ? 'agg' : `i${item.idx}`)
        : '');
      const merged = new Map();
      for (const item of frame) merged.set(`${item.scene}/${item.el}/${item.kind || 'ink'}/${textTag(item)}`, item);
      for (const item of merged.values()) {
        receipts.push({
          t: time,
          scene: item.scene,
          element: item.el,
          block: item.block,
          kind: item.kind || 'ink',
          rect: item.rect ? [item.rect.x, item.rect.y, item.rect.w, item.rect.h].map((v) => Math.round(v)) : null,
          ink: item.ink ? [item.ink.x, item.ink.y, item.ink.w, item.ink.h].map((v) => Math.round(v)) : null,
          ...(item.kind === 'text'
            ? { idx: item.idx ?? null, label: item.label ?? null, aggregate: item.aggregate === true }
            : {}),
        });
      }
      log(`  t=${time}s → ${merged.size} 条凭据，亮度 ${stat.mean.toFixed(1)}`);
    }

    if (grid) {
      const dataUrl = await page.evaluate(() => window.__sheet.canvas.toDataURL('image/png'));
      gridFile = path.join(outDir, grid.file || 'sheet.png');
      writeFileSync(gridFile, Buffer.from(dataUrl.split(',')[1], 'base64'));
      files.push(gridFile);
    }
  } finally {
    await browser.close();
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

/** 覆盖率的口径是"声明过的元素"而不是"能画的元素"：没出现就是没出现，不给面子。 */
export function coverageOf(planned, receipts) {
  const declared = [];
  for (const scene of planned?.scenes || []) {
    for (const el of scene.elements) declared.push({ scene: scene.id, element: el.id, block: el.block });
  }
  const seen = new Set(receipts.map((item) => `${item.scene}/${item.element}`));
  const missing = declared.filter((item) => !seen.has(`${item.scene}/${item.element}`));
  return {
    declared: declared.length,
    covered: declared.length - missing.length,
    ratio: declared.length ? Number(((declared.length - missing.length) / declared.length).toFixed(3)) : 1,
    missing,
  };
}
