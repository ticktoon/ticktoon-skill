/**
 * Ticktoon 渲染驱动
 *
 * 用法: node scripts/render.mjs <composition.json> [-o out.mp4] [--quantizer 20] [--bitrate 8000000] [--codec avc1...] [--keep-preview] [--without-preview]
 *
 * 本地静态服务 + headless Chrome 调用与预览相同的 compositor.tick 导出。
 * 默认要求当前 storyboard 已完成 Preview Studio 预览；显式 --without-preview 才跳过。
 * 浏览器直接产出 moov 前置的普通 MP4，字节分片回传 Node，无 FFmpeg 后处理。
 */
import { createWriteStream, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome } from './lib/chrome-cdp.mjs';
import { createStaticServer } from './lib/serve.mjs';
import { buildAssetBasenameMap, rewriteLocalRefs } from './lib/refs.mjs';
import { stopTaskPreview } from './lib/preview-lifecycle.mjs';
import { getEngineDir } from './lib/engine-runtime.mjs';
import { assertComposition } from './lib/protocol.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(__dirname, '..');
const ENGINE_DIR = getEngineDir(SKILL_ROOT);
const ASSETS_DIR = path.join(SKILL_ROOT, 'assets');

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help')) {
  console.log('用法: node scripts/render.mjs <composition.json> [-o out.mp4] [--quantizer 20] [--bitrate 8000000] [--codec avc1...] [--keep-preview] [--without-preview]');
  console.log('默认 QP20 优先、自适应码率回退；仅传 --bitrate 时按目标码率编码。');
  process.exit(args.length === 0 ? 1 : 0);
}
const compositionFile = path.resolve(args[0]);
const outIdx = args.indexOf('-o');
const outFile = path.resolve(outIdx >= 0 ? args[outIdx + 1] : compositionFile.replace(/\.json$/i, '') + '.mp4');
const keepPreview = args.includes('--keep-preview');
const skipPreviewCheck = args.includes('--without-preview');
const readIntegerOption = (name, minimum) => {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = Number(args[index + 1]);
  if (!Number.isInteger(value) || value < minimum) throw new Error(`${name} 必须是 >= ${minimum} 的整数`);
  return value;
};
const bitrate = readIntegerOption('--bitrate', 1);
const quantizer = readIntegerOption('--quantizer', 0);
const codecIndex = args.indexOf('--codec');
const videoCodec = codecIndex >= 0 ? args[codecIndex + 1] : undefined;
if (codecIndex >= 0 && !videoCodec) throw new Error('--codec 需要完整的 codec 字符串');
const disableNativeAac = process.env.TICKTOON_DISABLE_NATIVE_AAC === '1';
const disableOpfs = process.env.TICKTOON_DISABLE_OPFS === '1';
const disableQuantizer = process.env.TICKTOON_DISABLE_QUANTIZER === '1';

let composition;
let compositionSource;
try {
  compositionSource = readFileSync(compositionFile, 'utf-8');
  composition = assertComposition(JSON.parse(compositionSource));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
const { width, height } = composition;
const orientation = width >= height ? 'horizontal' : 'vertical';
const JOB_DIR = path.dirname(compositionFile);
if (!skipPreviewCheck) {
  const projectDir = path.basename(JOB_DIR) === 'out' ? path.dirname(JOB_DIR) : JOB_DIR;
  let previewed = false;
  try {
    const storyboardSha256 = createHash('sha256')
      .update(readFileSync(path.join(projectDir, 'storyboard.json')))
      .digest('hex');
    const receipt = JSON.parse(readFileSync(path.join(JOB_DIR, 'preview-receipt.json'), 'utf-8'));
    previewed = receipt.storyboardSha256 === storyboardSha256;
  } catch { /* 缺失或损坏都按未预览处理 */ }
  if (!previewed) {
    console.error('[render] 当前 storyboard 尚未完成 Preview Studio 预览，已停止导出。');
    console.error(`[render] 先运行: node platform/cli.mjs preview --dir ${JSON.stringify(projectDir)}`);
    console.error('[render] 在预览页点击「完成预览」后再导出；只有用户明确要求跳过预览时才使用 --without-preview。');
    process.exit(1);
  }
}
const assetBasenameMap = buildAssetBasenameMap({ assetsDir: ASSETS_DIR });

// 常见事故：先 `tt build`（无 TTS）再直接 render，画面和字幕都有，MP4 却只有 BGM/SFX。
// 有字幕 cue 却没有 narration 音轨，几乎都是漏了 --tts；给明确修复命令，别让人猜。
const hasNarrationAudio = composition.audio.some((event) => event.role === 'narration');
const hasCaptionCues = composition.scenes.some((scene) => Array.isArray(scene.cues) && scene.cues.length > 0);
if (hasCaptionCues && !hasNarrationAudio) {
  const projectDir = path.dirname(JOB_DIR);
  console.warn('[render] ! composition 有字幕 cue 但没有 narration 音轨：MP4 只会包含 BGM/SFX。');
  console.warn(`[render]   如果这是旁白片，先重编译：node platform/cli.mjs build --dir ${JSON.stringify(projectDir)} --tts edge`);
}

const t0 = Date.now();
const elapsed = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
await mkdir(path.dirname(outFile), { recursive: true });
const output = createWriteStream(outFile);
let outputBytes = 0;
let outputClosed = false;

const { server, port } = await createStaticServer({ ENGINE_DIR, ASSETS_DIR, JOB_DIR });
console.log(`[render] 静态服务: http://127.0.0.1:${port} (engine: ${ENGINE_DIR})`);
const engineBase = `http://127.0.0.1:${port}`;
const rewrittenComposition = {
  ...composition,
  scenes: rewriteLocalRefs(structuredClone(composition.scenes), engineBase, assetBasenameMap),
  audio: rewriteLocalRefs(structuredClone(composition.audio), engineBase, assetBasenameMap),
};
let browser = null;
let pageError = null;
let bytesWritten = Promise.resolve();
let exportFinished;
const finished = new Promise((resolve) => { exportFinished = resolve; });
let exportDiagnostics = null;

try {
  browser = await launchChrome();
  const page = browser.page;
  page.onConsole(({ type, text }) => {
    if (text.startsWith('[dh-render]')) console.log(`  ${text}  (${elapsed()})`);
    else if (type === 'error' || type === 'warning') console.log(`  [page:${type}] ${text.slice(0, 300)}`);
  });
  page.onPageError((message) => {
    pageError = new Error(message);
    console.error(`  [pageerror] ${message}`);
  });

  if (disableNativeAac) {
    await page.addInitScript(`(() => {
      const original = AudioEncoder.isConfigSupported.bind(AudioEncoder);
      AudioEncoder.isConfigSupported = async (config) => {
        if (config.codec?.startsWith('mp4a')) return { supported: false, config };
        return original(config);
      };
    })();`);
    console.log('[render] 测试模式: 禁用原生 AAC，验证 WASM AAC 回退');
  }
  if (disableOpfs) {
    await page.addInitScript(`(() => {
      if (navigator.storage) {
        Object.defineProperty(navigator.storage, 'getDirectory', {
          configurable: true,
          value: undefined,
        });
      }
    })();`);
    console.log('[render] 测试模式: 禁用 OPFS，验证内存存储回退');
  }
  if (disableQuantizer) {
    await page.addInitScript(`(() => {
      const original = VideoEncoder.isConfigSupported.bind(VideoEncoder);
      VideoEncoder.isConfigSupported = async (config) => {
        if (config.bitrateMode === 'quantizer') return { supported: false, config };
        return original(config);
      };
    })();`);
    console.log('[render] 测试模式: 禁用 QP，验证自适应码率回退');
  }

  await page.addBinding('__dhWriteChunk', (b64) => {
    const buf = Buffer.from(b64, 'base64');
    outputBytes += buf.length;
    bytesWritten = bytesWritten.then(() => new Promise((resolve) => output.write(buf, resolve)));
  });
  await page.addBinding('__dhFinish', () => exportFinished());

  console.log('[render] 加载 export-page.html ...');
  await page.navigate(`http://127.0.0.1:${port}/export-page.html`);
  await page.waitFor(`(() => {
    if (window.__COMPOSITOR_ERROR__) throw new Error('Ticktoon 导出入口加载失败: ' + window.__COMPOSITOR_ERROR__);
    return window.__COMPOSITOR_READY__ === true;
  })()`);
  console.log(`[render] Ticktoon 导出就绪 (${elapsed()})`);

  exportDiagnostics = await page.evaluate(async ({ composition, videoOptions }) => {
    const log = (message) => console.log('[dh-render] ' + message);
    if (typeof window.__ticktoonExport !== 'function') throw new Error('Ticktoon 导出入口未注册');
    const b64enc = (u8) => {
      let binary = '';
      for (let index = 0; index < u8.length; index += 32768) {
        binary += String.fromCharCode.apply(null, u8.subarray(index, index + 32768));
      }
      return btoa(binary);
    };
    log('开始导出（整段画面与预览共用 compositor.tick）...');
    let lastReported = -1;
    const drawTimes = [];
    const hasAudio = composition.audio.length > 0;
    let audioCodec = hasAudio ? 'unknown' : 'none';
    let audioEncoder = hasAudio ? 'unknown' : 'none';
    let videoEncoder = null;
    let storageBackend = 'unknown';
    let storageFallbackReason = null;
    const exportStarted = performance.now();
    const heapStartBytes = performance.memory?.usedJSHeapSize ?? null;
    let heapPeakBytes = heapStartBytes;
    const sampleHeap = () => {
      const used = performance.memory?.usedJSHeapSize;
      if (used != null) heapPeakBytes = Math.max(heapPeakBytes ?? 0, used);
    };
    const stream = await window.__ticktoonExport(composition, {
      ...videoOptions,
      onVideoEncoder(info) { videoEncoder = info; },
      onAudioCodec(codec) { audioCodec = codec; },
      onAudioEncoder(encoder) { audioEncoder = encoder; },
      onStorageBackend(backend) { storageBackend = backend; },
      onStorageFallback(reason) { storageFallbackReason = reason; },
      onFrame({ drawMs }) { drawTimes.push(drawMs); },
      onProgress(progress) {
        sampleHeap();
        const pct = Math.round(progress * 100);
        if (pct !== lastReported && pct % 5 === 0) { lastReported = pct; log(`合成进度 ${pct}%`); }
      },
    });
    const reader = stream.getReader();
    let chunks = 0, bytes = 0, maxChunkBytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value?.length) {
        // 引擎按临时 Blob 分块读取最终 MP4；回传时再切片以限制 base64 的内存峰值。
        for (let offset = 0; offset < value.length; offset += 1024 * 1024) {
          const chunk = value.subarray(offset, Math.min(offset + 1024 * 1024, value.length));
          window.__dhWriteChunk(b64enc(chunk));
          chunks++;
          bytes += chunk.length;
          maxChunkBytes = Math.max(maxChunkBytes, chunk.length);
        }
      }
    }
    log(`导出流结束: ${chunks} 块 / ${(bytes / 1048576).toFixed(1)} MB`);
    sampleHeap();
    const heapEndBytes = performance.memory?.usedJSHeapSize ?? null;
    const sortedDraw = [...drawTimes].sort((a, b) => a - b);
    const percentile = (q) => sortedDraw.length ? sortedDraw[Math.floor((sortedDraw.length - 1) * q)] : 0;
    const diagnostics = {
      frames: drawTimes.length,
      drawP50Ms: percentile(0.5),
      drawP95Ms: percentile(0.95),
      drawMaxMs: sortedDraw.at(-1) ?? 0,
      exportMs: performance.now() - exportStarted,
      heapStartBytes,
      heapEndBytes,
      heapPeakBytes,
      videoEncoder,
      audioCodec,
      audioEncoder,
      storageBackend,
      storageFallbackReason,
      streamChunks: chunks,
      streamBytes: bytes,
      maxStreamChunkBytes: maxChunkBytes,
      container: 'mp4',
      fastStart: true,
      note: 'draw=scene only; export=engine encode+mux+stream, not separate encode/mux timings',
    };
    log(`诊断: draw p50 ${diagnostics.drawP50Ms.toFixed(2)}ms / p95 ${diagnostics.drawP95Ms.toFixed(2)}ms；export ${(diagnostics.exportMs / 1000).toFixed(1)}s`);
    // 最后一个分片的 binding 调用之后才发完成哨；Node 等到它再收尾，避免漏掉尾部字节。
    window.__dhFinish('done');
    return diagnostics;
  }, {
    composition: rewrittenComposition,
    videoOptions: {
      ...(bitrate !== undefined ? { bitrate } : {}),
      ...(quantizer !== undefined ? { quantizer } : {}),
      ...(videoCodec !== undefined ? { videoCodec } : {}),
    },
  }, { timeout: 20 * 60 * 1000 });

  if (pageError) throw pageError;
  if (!exportDiagnostics) throw new Error('页面合成失败：导出没有返回诊断');

  await Promise.race([
    finished,
    new Promise((_, reject) => setTimeout(() => reject(new Error('导出分片未确认完成')), 30000)),
  ]);
  await bytesWritten;
  output.end();
  await new Promise((resolve) => output.on('finish', resolve));
  outputClosed = true;
  console.log(`[render] 普通 MP4 写盘: ${outFile} (${(outputBytes / 1048576).toFixed(1)} MB, ${elapsed()})`);
} finally {
  if (!outputClosed) output.destroy();
  await browser?.close();
  server.close();
}

const storageSummary = `${exportDiagnostics?.storageBackend ?? 'unknown'}${exportDiagnostics?.storageFallbackReason ? ` (${exportDiagnostics.storageFallbackReason})` : ''}`;
const video = exportDiagnostics?.videoEncoder;
const videoSummary = video
  ? `${video.codec} / ${video.rateControl === 'quantizer' ? `QP${video.quantizer}` : `${((video.bitrate ?? 0) / 1e6).toFixed(2)} Mbps`}`
  : 'unknown';
console.log(`[render] 普通 MP4 直出（${videoSummary}；${exportDiagnostics?.audioCodec ?? 'unknown'} / ${exportDiagnostics?.audioEncoder ?? 'unknown'}；${storageSummary} / faststart，无外部 FFmpeg）`);
const sizeMB = (statSync(outFile).size / 1048576).toFixed(1);
console.log(`[render] ✅ 完成: ${outFile} (${sizeMB} MB)，总耗时 ${elapsed()}`);
await writeFile(outFile + '.meta.json', JSON.stringify({
  orientation, width, height, outFile, sizeMB: +sizeMB, elapsed: elapsed(), provider: 'ticktoon',
  engine: readFileSync(path.join(ENGINE_DIR, 'ENGINE_VERSION.txt'), 'utf-8').trim(),
  diagnostics: exportDiagnostics,
}, null, 2));

if (!keepPreview) {
  const preview = await stopTaskPreview(compositionFile);
  if (preview.status === 'stopped') console.log(`[render] 已关闭本任务预览服务（端口 ${preview.port}）`);
  else if (preview.status === 'error') console.warn(`[render] 预览服务自动关闭失败，可稍后手动关闭：${preview.error}`);
}
