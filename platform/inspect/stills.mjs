/**
 * L2 静帧：渲染指定时刻，并（可选）带回布局凭据。
 *
 * 走 preview-panel 的 load/seek 协议，和用户看到的完全是同一条链路——
 * 如果这里能出图而 panel 里不行，那一定是环境差异而不是渲染差异，排查范围立刻缩小。
 *
 * receipts 的采集：emit 时注入的 `globalThis.__ttReceipt` 每帧被调用一次，
 * 这里在 seek 前清空、seek 后读走。静帧只有一帧，所以拿到的是**该时刻真实绘制过**的元素，
 * 不是"这一场里声明过的元素"。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildProject } from '../project/build.mjs';
import { createStaticServer } from '../../scripts/lib/serve.mjs';
import { buildAssetBasenameMap, rewriteLocalRefs } from '../../scripts/lib/refs.mjs';
import { getEngineDir } from '../../scripts/lib/engine-runtime.mjs';
import { chromiumArgs } from '../../scripts/lib/chromium-args.mjs';

export async function renderStills({ root, dir, file = null, times, outDir, tts = null, captionOverride = null, log = console.log }) {
  const engineDir = getEngineDir(root);
  const assetsDir = path.join(root, 'assets');

  const built = await buildProject({ root, dir, file, tts, captionOverride, write: false, receipts: true });
  if (!built.ok) {
    return { ok: false, report: built.report, files: [] };
  }

  const targetDir = outDir || path.join(dir, 'review', 'stills');
  mkdirSync(targetDir, { recursive: true });

  const assetBasenameMap = buildAssetBasenameMap({ assetsDir });
  const { server, port } = await createStaticServer({ ENGINE_DIR: engineDir, ASSETS_DIR: assetsDir, JOB_DIR: path.join(dir, 'out') });
  const base = `http://127.0.0.1:${port}`;
  const composition = rewriteLocalRefs(structuredClone(built.composition), base, assetBasenameMap);

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: chromiumArgs() });
  const files = [];
  const receipts = [];
  const pageErrors = [];

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
      // emit 注入的钩子只做一件事：把元素真实矩形记下来
      globalThis.__ttReceipt = (payload) => {
        window.__ttReceipts.push(payload);
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
    }, composition);
    const loaded = await waitMessage('loaded');
    const duration = Number(loaded.duration) || 0;

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
      const fail = await page.evaluate(() => {
        const index = window.__panelMsgs.findIndex((m) => m.type === 'error');
        return index >= 0 ? window.__panelMsgs.splice(index, 1)[0].message : null;
      });
      if (fail) throw new Error(`t=${time}s 场景渲染失败：${fail}`);

      const dataUrl = await page.evaluate(() => document.getElementById('cv')?.toDataURL('image/png') ?? null);
      if (!dataUrl) throw new Error('找不到画布 #cv（面板可能没有进入预览模式）');
      const file = path.join(targetDir, `t${time.toFixed(2)}s.png`);
      writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
      files.push(file);

      const frame = await page.evaluate(() => window.__ttReceipts);
      // 同一元素可能有 ink / text / caption 多条凭据，去重键必须带上 kind。
      // 文字逐条回执按 idx 配对（同一帧重绘的绘制顺序稳定）；并集凭据单独占槽。
      const textTag = (item) => (item.kind === 'text'
        ? (item.aggregate === true || item.idx == null ? 'agg' : `i${item.idx}`)
        : '');
      const merged = new Map();
      for (const item of frame) merged.set(`${item.scene}/${item.el}/${item.kind || 'ink'}/${textTag(item)}`, item);
      const entries = [...merged.values()].map((item) => ({
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
      }));
      receipts.push(...entries);
      log(`  t=${time}s → ${path.basename(file)}（${entries.length} 条凭据）`);
    }
  } finally {
    await browser.close();
    server.close();
  }

  return { ok: true, report: built.report, composition: built.composition, files, receipts, pageErrors };
}
