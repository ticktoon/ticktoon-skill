/**
 * 打干净分发包：Skill + package.json/package-lock.json → ../ticktoon-skill-dist/。
 * 引擎由 npm ticktoon@1.0.4 提供，不再复制 dist 或 node_modules。
 */
import { cpSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const dest = path.resolve(process.argv[2] || path.join(ROOT, '..', 'ticktoon-skill-dist'));
if (dest.startsWith(ROOT + path.sep) || dest === ROOT) {
  console.error('✗ 目标目录必须在 skill 目录之外（cpSync 不允许拷贝到自身子目录）');
  process.exit(1);
}

const SKIP_NAMES = new Set([
  'node_modules', 'output', 'out', '.git', '.cc-tasks', '.claude', '.github', '.npmrc',
  'dist-skill', 'ticktoon-skill-dist', 'ticktoon-dist', 'snapshots', 'showcase',
]);
const filter = (src) => !SKIP_NAMES.has(path.basename(src)) && !src.endsWith('.tgz');
if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
cpSync(ROOT, dest, { recursive: true, filter });

let sizeMB = '';
try {
  const out = execFileSync('du', ['-sm', dest]).toString();
  sizeMB = `${out.split(/\s/)[0]} MB`;
} catch { /* du 不可用时跳过体积报告 */ }
console.log(`[pack] 干净分发包 → ${dest}${sizeMB ? `（${sizeMB}）` : ''}`);
console.log('[pack] 引擎通过 package-lock.json 固定为 ticktoon@1.0.4；未复制 dist 或 node_modules');
console.log('[pack] 安装后在目标机器运行: node scripts/doctor.mjs --install（缺包时安装全部 dependencies）');
