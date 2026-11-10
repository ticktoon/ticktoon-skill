/**
 * 打干净分发包：Skill + 当前 Ticktoon dist → ../ticktoon-skill-dist/。
 * 排除 node_modules/output/.git/.cc-tasks/snapshots；目标必须位于包外。
 */
import { cpSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getEngineDir } from '../lib/engine-runtime.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const dest = path.resolve(process.argv[2] || path.join(ROOT, '..', 'ticktoon-skill-dist'));
if (dest.startsWith(ROOT + path.sep) || dest === ROOT) {
  console.error('✗ 目标目录必须在 skill 目录之外（cpSync 不允许拷贝到自身子目录）');
  process.exit(1);
}
const engineDir = getEngineDir(ROOT);
if (!existsSync(path.join(engineDir, 'export-page.html'))) {
  console.error(`✗ Ticktoon 产物不完整: ${engineDir}；请先构建引擎或设置 TICKTOON_ENGINE_DIR`);
  process.exit(1);
}

const SKIP_NAMES = new Set(['node_modules', 'output', 'out', '.git', '.cc-tasks', 'dist-skill', 'ticktoon-skill-dist', 'ticktoon-dist', 'snapshots']);
const filter = (src) => !SKIP_NAMES.has(path.basename(src));
if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
cpSync(ROOT, dest, { recursive: true, filter });
cpSync(engineDir, path.join(dest, 'ticktoon-dist'), { recursive: true });

let sizeMB = '';
try {
  const out = execFileSync('du', ['-sm', dest]).toString();
  sizeMB = `${out.split(/\s/)[0]} MB`;
} catch { /* du 不可用时跳过体积报告 */ }
console.log(`[pack] 干净分发包 → ${dest}${sizeMB ? `（${sizeMB}）` : ''}`);
console.log('[pack] 已包含 Ticktoon dist；已排除 node_modules/ output/ .git/ .cc-tasks/ snapshots/');
console.log('[pack] 安装后在目标机器运行: npm install && node scripts/doctor.mjs');
