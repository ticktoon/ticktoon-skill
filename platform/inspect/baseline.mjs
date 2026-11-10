/**
 * `tt ci --baseline`：配方 demo 的编译指纹与构建状态基线。
 *
 * 只证明“同一条 recipe demo 在两次运行之间是否保持同一份编译产物”，
 * 不做像素采样、不存审美分数。指纹变化不是自动失败的理由，而是人审后
 * `--write` 刷新基线的提示；构建失败才是硬失败。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadCatalog } from '../compile/schema.mjs';
import { buildProject } from '../project/build.mjs';

export async function runBaseline({ root, write = false, log = console.log }) {
  // 枚举直接扫 recipes/ 目录，和 tt recipe list / audit 同源；新增 recipe 无需再改任何索引。
  const catalog = loadCatalog(root);
  const outFile = path.join(root, 'output', 'baseline.json');
  const previous = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf-8')) : null;
  const rows = [];

  for (const id of [...catalog.recipes.keys()].sort()) {
    const demo = path.join(catalog.recipes.get(id).dir, 'demo.storyboard.json');
    const built = await buildProject({
      root, dir: root, file: demo, write: false, tts: null,
    });
    rows.push({
      id,
      hash: built.ok ? built.report.det.hash : '',
      status: built.ok ? 'ok' : 'failed',
    });
  }

  const current = { generatedAt: new Date().toISOString().slice(0, 10), recipes: rows };
  const oldById = new Map((previous?.recipes || []).map((row) => [row.id, row]));
  const regressions = [];
  for (const row of rows) {
    const old = oldById.get(row.id);
    if (row.status !== 'ok') {
      regressions.push(`${row.id}: 构建失败`);
      continue;
    }
    if (!old) continue;
    if (old.hash && row.hash && old.hash !== row.hash) {
      regressions.push(`${row.id}: 编译指纹变化 ${old.hash.slice(0, 8)} → ${row.hash.slice(0, 8)}（人审后 --write）`);
    }
  }
  if (!previous || write) {
    mkdirSync(path.dirname(outFile), { recursive: true });
    writeFileSync(outFile, JSON.stringify(current, null, 2));
  }

  log(`\n  基线   ${previous ? (write ? '已刷新' : '已比对') : '首次生成'} → ${path.relative(root, outFile)}`);
  for (const row of rows) {
    log(`  ${row.id.padEnd(24)} ${row.hash.slice(0, 12).padEnd(12)}  ${row.status}`);
  }
  if (regressions.length) for (const line of regressions) log(`  ${write ? '·' : '✗'} ${line}`);
  else if (previous) log('  ✓ 无回归（指纹一致，构建状态正常）');
  log('');
  const builtOk = rows.every((row) => row.status === 'ok');
  return {
    ok: builtOk && (write || regressions.length === 0),
    rows,
    regressions,
    created: !previous,
    path: outFile,
  };
}
