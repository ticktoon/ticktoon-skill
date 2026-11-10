/**
 * Ticktoon 定向抽帧：默认只在用户要求 AI 检查或反馈具体问题后使用。
 *
 * 用法:
 *   node scripts/snapshot.mjs <composition.json> --shots [-o 输出目录]
 *   node scripts/snapshot.mjs <composition.json> --t 0.5,1.2,3 [-o 输出目录]
 *
 * --shots 抽每个场景的中点；复用 preview-panel 的 load/seek 协议读取 #cv。
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createStaticServer } from './lib/serve.mjs';
import { buildAssetBasenameMap, rewriteLocalRefs } from './lib/refs.mjs';
import { PROTOCOL_VERSION } from './lib/protocol.mjs';
import { chromiumArgs } from './lib/chromium-args.mjs';
import { getEngineDir } from './lib/engine-runtime.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(__dirname, '..');
const ENGINE_DIR = getEngineDir(SKILL_ROOT);
const ASSETS_DIR = path.join(SKILL_ROOT, 'assets');

const args = process.argv.slice(2);
const timeIndex = args.indexOf('--t');
const autoShots = args.includes('--shots');
if (!args.length || args.includes('--help') || (timeIndex < 0 && !autoShots)) {
  console.log('用法: node scripts/snapshot.mjs <composition.json> --shots [-o 输出目录]');
  console.log('      node scripts/snapshot.mjs <composition.json> --t 0.5,1.2,3 [-o 输出目录]');
  process.exit(args.length ? 0 : 1);
}
const compositionFile = path.resolve(args[0]);
if (!existsSync(compositionFile)) {
  console.error('✗ 找不到 composition: ' + compositionFile);
  process.exit(1);
}
const composition = JSON.parse(readFileSync(compositionFile, 'utf-8'));
if (composition.version !== PROTOCOL_VERSION || !Array.isArray(composition.scenes)) {
  throw new Error(`snapshot 只接受 Ticktoon protocol v${PROTOCOL_VERSION} composition.json（scenes[]）`);
}
const times = autoShots
  ? composition.scenes
    .map((scene) => Number(scene.start) + Number(scene.duration) / 2)
    .filter((time) => Number.isFinite(time) && time >= 0)
  : args[timeIndex + 1].split(',').map((value) => Number(value.trim())).filter((time) => Number.isFinite(time) && time >= 0);
if (!times.length) throw new Error(autoShots ? '--shots 没有找到场景' : '--t 至少给一个时间点（秒，逗号分隔）');

const outputIndex = args.indexOf('-o');
const jobDir = path.dirname(compositionFile);
const outDir = path.resolve(outputIndex >= 0 ? args[outputIndex + 1] : path.join(jobDir, 'snapshots'));
mkdirSync(outDir, { recursive: true });
const assetBasenameMap = buildAssetBasenameMap({ assetsDir: ASSETS_DIR });
const { server, port } = await createStaticServer({ ENGINE_DIR, ASSETS_DIR, JOB_DIR: jobDir });
const base = `http://127.0.0.1:${port}`;
const input = rewriteLocalRefs(structuredClone(composition), base, assetBasenameMap);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: chromiumArgs() });

try {
  const page = await browser.newPage();
  page.on('pageerror', (error) => console.error(`  [pageerror] ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') console.log(`  [page:error] ${message.text().slice(0, 300)}`);
  });
  await page.addInitScript(() => {
    window.__panelMsgs = [];
    window.addEventListener('message', (event) => {
      if (event.data?.__source === 'ticktoon-preview-panel') window.__panelMsgs.push(event.data);
    });
  });
  await page.goto(`${base}/preview-panel.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });

  const waitMessage = async (type, timeout = 60000) => {
    const started = Date.now();
    for (;;) {
      const index = await page.evaluate((wanted) => window.__panelMsgs.findIndex((message) => message.type === wanted), type);
      if (index >= 0) return page.evaluate((at) => window.__panelMsgs.splice(at, 1)[0], index);
      const error = await page.evaluate(() => window.__panelMsgs.find((message) => message.type === 'error'));
      if (error) throw new Error(`预览面板错误: ${error.message}`);
      if (Date.now() - started > timeout) throw new Error(`等面板消息 ${type} 超时`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  };
  await waitMessage('ready');
  await page.evaluate((input) => {
    window.postMessage({ __source: 'ticktoon-preview-page', type: 'load', composition: input, controls: false }, '*');
  }, input);
  const loaded = await waitMessage('loaded');
  const duration = Number(loaded.duration) || 0;
  console.log(`[snapshot] 装载完成，时长 ${duration.toFixed(2)}s`);

  for (const time of times) {
    if (duration && time > duration) {
      console.warn(`  ! t=${time}s 超出时长 ${duration.toFixed(2)}s，跳过`);
      continue;
    }
    await page.evaluate((value) => {
      window.postMessage({ __source: 'ticktoon-preview-page', type: 'seek', time: value }, '*');
    }, time);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await new Promise((resolve) => setTimeout(resolve, 120));
    const dataUrl = await page.evaluate(() => document.getElementById('cv')?.toDataURL('image/png') ?? null);
    if (!dataUrl) throw new Error('找不到画布 #cv');
    const file = path.join(outDir, `t${time.toFixed(2)}s.png`);
    writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log(`[snapshot] t=${time}s → ${file}`);
  }
} finally {
  await browser.close();
  server.close();
}
