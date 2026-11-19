/**
 * Ticktoon Skill 环境自检
 *
 * 用法: node scripts/doctor.mjs [--json] [--install]
 * 检查 Node / Ticktoon 产物 / npm 依赖 / Chrome + WebGL2；--install 仅在缺包时安装依赖。
 * Provider 状态仅作能力报告，不影响退出码。普通 MP4 直出，无 FFmpeg 检查。
 */
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { credentialSource, hasCredential, hasVolcTts } from './config.mjs';
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

// npm 依赖先单独检查：缺 ws 时 CDP 驱动不可用，不要把依赖缺失伪装成 Chrome 故障。
const runtimeDeps = [
  ['ws', 'Chrome CDP 驱动 / edge-tts 旁白'],
  ['msedge-tts', 'edge-tts 旁白'],
];
const require = createRequire(import.meta.url);
const unresolvedDeps = runtimeDeps.map(([name]) => name).filter((name) => {
  try {
    require.resolve(name);
    return false;
  } catch {
    return true;
  }
});
let installAttempted = false;
let installError = '';
if (process.argv.includes('--install') && unresolvedDeps.length > 0) {
  installAttempted = true;
  if (!asJson) console.log(`[doctor] 安装缺少的依赖: ${unresolvedDeps.join(' / ')}`);
  const installCommand = `${process.platform === 'win32' ? 'npm.cmd' : 'npm'} install --no-audit --no-fund --prefer-offline`;
  const result = spawnSync(installCommand, {
    cwd: ROOT,
    stdio: asJson ? 'pipe' : 'inherit',
    encoding: 'utf8',
    shell: true,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    installError = result.error
      ? `npm 启动失败：${result.error.message}`
      : `npm install 失败（退出码 ${result.status ?? '未知'}）`;
    if (asJson) {
      if (result.stdout) process.stderr.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
    }
  }
}
// 安装后再真实 import 一次，避免只存在目录但包已损坏时误报通过。
const missingDeps = [];
for (const [name] of runtimeDeps) {
  try {
    await import(name);
  } catch {
    missingDeps.push(name);
  }
}
const depsOk = missingDeps.length === 0;
const depsDetail = depsOk
  ? `ws / msedge-tts ${installAttempted ? '已自动安装并验证' : '已安装'}`
  : `缺少 ${missingDeps.join(' / ')}${installError ? `；${installError}` : ''}`;
check(
  'deps',
  depsOk,
  depsDetail,
  `cd "${ROOT}" && npm install（安装 ws / msedge-tts；Chrome 直接使用本机安装，不下载浏览器）`,
);

const hasDriver = !missingDeps.includes('ws');
let chromeOk = false, chromeDetail = '';
let webglOk = false, webglDetail = '未执行（Chrome 启动失败）';
if (hasDriver) {
  let session = null;
  try {
    const { launchChrome } = await import('./lib/chrome-cdp.mjs');
    session = await launchChrome();
    const product = await session.version();
    const major = Number((product.match(/Chrome\/(\d+)/) || [])[1] || 0);
    chromeDetail = `${product}${major && major < 120 ? '（需要 >=120）' : ''}`;
    chromeOk = major >= 120;
    if (chromeOk) {
      const result = await session.page.evaluate(() => {
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
    }
  } catch (error) {
    const detail = String(error?.message || error).split('\n')[0].slice(0, 160);
    if (chromeOk) webglDetail = detail;
    else chromeDetail = detail;
  } finally {
    await session?.close();
  }
  check('chrome', chromeOk, chromeDetail, '确认本机已安装 Chrome >= 120，或设置 TICKTOON_CHROME_PATH 指向 Chrome');
  check('webgl', webglOk, webglDetail, '确认 Chrome 支持 WebGL2；无 GPU 服务器可设置 DH_VIDEO_WEBGL=swiftshader 后重试');
} else {
  results.push({ name: 'chrome', ok: false, warnOnly: true, detail: '跳过：ws 未安装' });
  results.push({ name: 'webgl', ok: false, warnOnly: true, detail: '跳过：ws 未安装' });
  if (!asJson) {
    console.log('⬜ chrome: 跳过（ws 未安装，先 npm install）');
    console.log('⬜ webgl: 跳过（ws 未安装，先 npm install）');
  }
}

const edgeTtsMissing = ['msedge-tts', 'ws'].filter((name) => missingDeps.includes(name));
const reports = [
  ['tts:edge-tts', edgeTtsMissing.length === 0, edgeTtsMissing.length === 0 ? '无火山凭证时的默认降级（字幕由 WordBoundary 直接产出）' : `缺少 ${edgeTtsMissing.join(' / ')} → 先在 SKILL 目录 npm install`],
  ['tts:volc-tts', hasVolcTts(), hasVolcTts() ? `已配置（${credentialSource('VOLC_TTS_APP_ID')}）` : '未配置 VOLC_TTS_APP_ID/VOLC_TTS_ACCESS_TOKEN → node scripts/auth.mjs set'],
  ['assets:pexels', hasCredential('PEXELS_API_KEY'), hasCredential('PEXELS_API_KEY') ? '已配置' : '未配置 PEXELS_API_KEY（pexels.com/api 免费申请）'],
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
