/**
 * Ticktoon Skill 环境自检
 *
 * 用法: node scripts/doctor.mjs [--json]
 * 检查 Node / Ticktoon 产物 / Playwright + Chrome + WebGL2。
 * Provider 状态仅作能力报告，不影响退出码。普通 MP4 直出，无 FFmpeg 检查。
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { credentialSource, hasCredential, hasVolcTts } from './config.mjs';
import { bundledTopics } from './providers/assets.mjs';
import { chromiumArgs } from './lib/chromium-args.mjs';
import { getEngineDir } from './lib/engine-runtime.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ENGINE_DIR = getEngineDir(ROOT);
const asJson = process.argv.includes('--json');
const results = [];
const check = (name, ok, detail, fix) => {
  results.push({ name, ok, detail, fix: ok ? undefined : fix });
  if (!asJson) console.log(`${ok ? '✅' : '❌'} ${name}${detail ? `: ${detail}` : ''}${ok || !fix ? '' : `\n   Fix: ${fix}`}`);
};

const nodeMajor = +process.versions.node.split('.')[0];
check('node', nodeMajor >= 18, process.version, '安装 Node >= 18（建议 22 LTS）');

const entryHtml = path.join(ENGINE_DIR, 'export-page.html');
let engineDetail = ENGINE_DIR;
if (existsSync(entryHtml)) {
  try {
    const version = readFileSync(path.join(ENGINE_DIR, 'ENGINE_VERSION.txt'), 'utf-8').trim().split('\n')[0];
    engineDetail += ` · ${version}`;
  } catch {}
}
check('engine', existsSync(entryHtml), engineDetail, '先构建相邻 ticktoon 仓 dist/，或设置 TICKTOON_ENGINE_DIR');

let chromeOk = false, chromeDetail = '';
let webglOk = false, webglDetail = '未执行（Chrome 启动失败）';
let browser;
try {
  const { chromium } = await import('playwright');
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: chromiumArgs() });
  chromeDetail = browser.version();
  chromeOk = true;
  const page = await browser.newPage();
  const result = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 16;
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
    if (!gl) return { ok: false, detail: 'WebGL2 context 创建失败' };
    gl.clearColor(1, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const pixel = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    const ok = pixel[0] === 255 && pixel[1] === 0 && pixel[2] === 0 && pixel[3] === 255;
    return { ok, detail: ok ? 'WebGL2 + 16×16 测试帧正常' : `测试帧像素异常: ${[...pixel].join(',')}` };
  });
  webglOk = result.ok;
  webglDetail = result.detail;
} catch (error) {
  const detail = String(error?.message || error).split('\n')[0].slice(0, 160);
  if (chromeOk) webglDetail = detail;
  else chromeDetail = detail;
} finally {
  await browser?.close();
}
check('chrome', chromeOk, chromeDetail, 'npm install（PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1）；并确认本机已安装 Chrome');
check('webgl', webglOk, webglDetail, '确认 Chrome 支持 WebGL2；无 GPU 服务器可设置 DH_VIDEO_WEBGL=swiftshader 后重试');

const bundled = bundledTopics();
const reports = [
  ['tts:edge-tts', true, '默认，零密钥（字幕由 WordBoundary 直接产出）'],
  ['tts:volc-tts', hasVolcTts(), hasVolcTts() ? `已配置（${credentialSource('VOLC_TTS_APP_ID')}）` : '未配置 VOLC_TTS_APP_ID/VOLC_TTS_ACCESS_TOKEN → node scripts/auth.mjs set'],
  ['assets:pexels', hasCredential('PEXELS_API_KEY'), hasCredential('PEXELS_API_KEY') ? '已配置' : '未配置 PEXELS_API_KEY（pexels.com/api 免费申请）'],
  ['assets:bundled', bundled.length > 0, bundled.length ? `内置演示素材 ${bundled.length} 段：${bundled.map((item) => item.topic).join('/')}` : 'assets/catalog.json 缺失'],
];
if (!asJson) {
  console.log('\nProvider 状态:');
  for (const [name, ok, detail] of reports) console.log(`  ${ok ? '✅' : '⬜'} ${name} — ${detail}`);
}
results.push({ name: 'providers', ok: true, warnOnly: true, providers: Object.fromEntries(reports.map(([name, ok, detail]) => [name, { available: ok, detail }])) });

const failed = results.filter((result) => !result.ok && !result.warnOnly);
if (asJson) console.log(JSON.stringify({ ok: failed.length === 0, results }, null, 2));
else console.log(failed.length === 0 ? '\n环境就绪（零密钥可跑默认链路）。' : `\n${failed.length} 项未通过。`);
process.exit(failed.length === 0 ? 0 : 1);
