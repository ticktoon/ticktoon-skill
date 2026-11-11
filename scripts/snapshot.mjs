/**
 * Ticktoon 定向抽帧：默认只在用户要求 AI 检查或反馈具体问题后使用。
 *
 * 用法:
 *   node scripts/snapshot.mjs <composition.json> --shots [-o 输出目录]
 *   node scripts/snapshot.mjs <composition.json> --t 0.5,1.2,3 [-o 输出目录]
 *
 * --shots 抽每个场景的中点；复用 preview-panel 的 capture 协议读取 #cv。
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStaticServer } from './lib/serve.mjs';
import { buildAssetBasenameMap, rewriteLocalRefs } from './lib/refs.mjs';
import { PROTOCOL_VERSION } from './lib/protocol.mjs';
import { getEngineDir } from './lib/engine-runtime.mjs';
import { openPreviewSession } from '../platform/inspect/preview-session.mjs';

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
let session = null;

try {
  session = await openPreviewSession({
    base,
    composition: input,
    onPageError: (message) => console.error(`  [pageerror] ${message}`),
  });
  const duration = session.duration;
  console.log(`[snapshot] 装载完成，时长 ${duration.toFixed(2)}s`);

  for (const time of times) {
    if (duration && time > duration) {
      console.warn(`  ! t=${time}s 超出时长 ${duration.toFixed(2)}s，跳过`);
      continue;
    }
    const shot = await session.captureAt(time, { image: true });
    const file = path.join(outDir, `t${time.toFixed(2)}s.png`);
    writeFileSync(file, Buffer.from(shot.image.split(',')[1], 'base64'));
    console.log(`[snapshot] t=${time}s → ${file}`);
  }
} finally {
  await session?.close();
  server.close();
}
