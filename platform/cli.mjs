#!/usr/bin/env node
/**
 * tt —— ticktoon-skill 的唯一命令入口。
 *
 * 所有命令都支持 `--json`：人类看表格，agent 看 JSON。两者必须是同一份数据的两种渲染，
 * 不允许各自算一遍——那是最容易埋下"人和 agent 看到的不是一回事"的地方。
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from './compile/schema.mjs';
import { buildProject } from './project/build.mjs';
import { newProject } from './project/new.mjs';
import { recipeRegressionInput } from './project/ref-shots.mjs';
import { createTts } from './compile/tts.mjs';
import { renderStills } from './inspect/stills.mjs';
import { probeFrame } from './inspect/probe.mjs';
import { auditRecipe } from './project/audit.mjs';
import { runFilmQuality } from './inspect/quality.mjs';
import { runBaseline } from './inspect/baseline.mjs';
import { fetchProjectAssets } from '../scripts/providers/asset-fetch.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const command = argv[0];
const rest = argv.slice(1);

const hasFlag = (name) => rest.includes(`--${name}`);
const flagValue = (name, fallback = null) => {
  const index = rest.indexOf(`--${name}`);
  return index >= 0 && rest[index + 1] && !rest[index + 1].startsWith('--') ? rest[index + 1] : fallback;
};
const positional = () => rest.filter((value, i) => !value.startsWith('--') && !(i > 0 && rest[i - 1].startsWith('--')));

const dir = path.resolve(flagValue('dir', '.'));
const json = hasFlag('json');

function ttsFromFlags() {
  const provider = flagValue('tts');
  if (!provider) return null;
  return createTts({
    provider: provider === true ? 'edge-tts' : provider,
    voice: flagValue('voice'),
    outDir: path.join(dir, 'out', 'tts'),
  });
}

function captionFromFlags() {
  const raw = flagValue('captions');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

function printReport(report) {
  const line = (label, value) => console.log(`  ${label.padEnd(14)}${value}`);
  console.log('');
  line('状态', report.ok ? (report.status === 'warning' ? '通过（有建议）' : '通过') : '失败');
  if (report.duration !== undefined) {
    line('时长', `${Number(report.duration).toFixed(2)}s`);
    line('场景 / 单元', `${report.scenes} / ${report.units}`);
    if (report.codeScenes !== undefined) line('code / params', `${report.codeScenes} / ${report.paramsScenes}`);
    if (report.captionCues) line('字幕条', report.captionCues);
  }
  if (report.timings) line('耗时', `${report.timings.totalMs}ms`);
  if (report.det) line('指纹', report.det.hash);

  const show = (items) => (items || []).filter((item) => item.level !== 'nice');
  const errors = report.errors || [];
  const warnings = show(report.warnings);
  if (errors.length) {
    console.log('\n错误：');
    for (const item of errors) console.log(`  ✗ [${item.code}] ${item.path ? item.path + ' — ' : ''}${item.msg}`);
  }
  if (warnings.length) {
    console.log('\n建议：');
    for (const item of warnings) console.log(`  · [${item.code}] ${item.path ? item.path + ' — ' : ''}${item.msg}`);
  }
  console.log('');
}

async function cmdAssetsFetch() {
  const projectDir = path.resolve(flagValue('project', dir));
  try {
    const result = await fetchProjectAssets({
      projectDir,
      provider: flagValue('provider', 'pexels'),
      orientation: flagValue('orientation', 'landscape'),
      fallback: hasFlag('strict') || hasFlag('no-fallback') ? null : flagValue('fallback', 'bundled'),
      log: json ? () => {} : (line) => console.log(line),
    });
    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('');
      console.log(`  状态    ${result.changed ? '素材引用已写回 storyboard' : '无需变更（本地引用已就绪）'}`);
      console.log(`  来源    ${result.requestedProvider || '本地缓存'}${result.provider === 'bundled' && result.requestedProvider === 'pexels' ? ' → bundled 降级' : ''}`);
      console.log(`  下载    ${result.downloads} 段；缓存命中 ${result.cacheHits} 段`);
      for (const item of result.items || []) {
        console.log(`  ${String(item.id).padEnd(12)} ${item.provider || 'pexels'}  ${item.duration ?? '-'}s  ${item.author || item.src || ''}`);
      }
      if (result.fallbackReason) console.log(`  降级原因 ${result.fallbackReason}`);
      if (result.manifestPath) console.log(`  署名清单 ${result.manifestPath}`);
      if (result.storyboardPath) console.log(`  下一步   node platform/cli.mjs build --dir ${JSON.stringify(projectDir)} --tts edge`);
      console.log('');
    }
    process.exit(0);
  } catch (error) {
    if (json) console.log(JSON.stringify({ ok: false, error: error.message }, null, 2));
    else console.error(`✗ 素材获取失败：${error.message}`);
    process.exit(1);
  }
}

async function cmdBuild() {
  const result = await buildProject({ root: ROOT, dir, tts: ttsFromFlags(), captionOverride: captionFromFlags() });
  if (json) {
    console.log(JSON.stringify(result.report, null, 2));
  } else {
    printReport(result.report);
    if (result.ok) {
      console.log(`产物：${path.join(dir, 'out', 'composition.json')}`);
      console.log(`      ${path.join(dir, 'out', 'report.json')}`);
      console.log(`      ${path.join(dir, 'out', 'subs.srt')}`);
    }
  }
  process.exit(result.ok ? 0 : 1);
}

async function cmdStills() {
  const times = positional().map(Number).filter((v) => Number.isFinite(v) && v >= 0);
  if (!times.length) {
    console.error('用法：tt stills 0.6 3.1 9.4 [--dir <工程>]');
    process.exit(1);
  }
  const result = await renderStills({ root: ROOT, dir, times, tts: ttsFromFlags(), captionOverride: captionFromFlags() });
  if (!result.ok) {
    if (json) console.log(JSON.stringify(result.report, null, 2));
    else printReport(result.report);
    process.exit(1);
  }

  // receipts 合并回 report.json：静帧的产出是"报告的一部分"，不是另一份报告
  if (result.receipts.length) {
    const reportPath = path.join(dir, 'out', 'report.json');
    const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf-8')) : { receipts: [] };
    const merged = new Map();
    const textTag = (item) => (item.kind === 'text'
      ? (item.aggregate === true || item.idx == null ? 'agg' : `i${item.idx}`)
      : '');
    for (const item of [...(report.receipts || []), ...result.receipts]) {
      merged.set(`${item.t}/${item.scene}/${item.unit}/${item.kind || 'ink'}/${textTag(item)}`, item);
    }
    report.receipts = [...merged.values()];
    const { writeFileSync } = await import('node:fs');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }

  if (json) {
    console.log(JSON.stringify({ files: result.files, receipts: result.receipts }, null, 2));
  } else {
    console.log(`\n静帧：${result.files.length} 张`);
    for (const file of result.files) console.log(`  ${file}`);
    const byT = new Map();
    for (const item of result.receipts) byT.set(item.t, (byT.get(item.t) || 0) + 1);
    for (const [t, count] of byT) console.log(`  t=${t}s：${count} 条布局凭据`);
    if (result.pageErrors.length) {
      console.log('\n页面错误：');
      for (const message of result.pageErrors) console.log(`  ✗ ${message}`);
    }
  }
  process.exit(result.pageErrors.length ? 1 : 0);
}

async function cmdProbe() {
  const rawT = flagValue('t');
  const t = Number(rawT);
  if (rawT == null || !Number.isFinite(t) || t < 0) {
    console.error('用法：tt probe --t <秒> [--dir <工程>] [--json]');
    process.exit(1);
  }
  const result = await probeFrame({
    root: ROOT, dir, t, tts: ttsFromFlags(), captionOverride: captionFromFlags(),
  });
  if (!result.ok) {
    if (json) {
      console.log(JSON.stringify({
        ok: false, error: result.error, pageErrors: result.pageErrors || [], report: result.report,
      }, null, 2));
    } else if (result.report?.errors?.length) {
      printReport(result.report);
    } else {
      console.error(`✗ ${result.error}`);
    }
    process.exit(1);
  }

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  const signed = (value) => (value >= 0 ? `+${value}` : `${value}`);
  const distText = (safe) => (safe
    ? `安全框 左${signed(safe.left)} 上${signed(safe.top)} 右${signed(safe.right)} 下${signed(safe.bottom)}`
    : '安全框 —');
  const bandText = (band) => {
    if (!band) return '字幕带 —';
    return `字幕带 ${band.overlap ? '压' : '未压'} ${band.y0}–${band.y1}（${band.source === 'caption' ? '实拍' : '估算'}，${band.placement}）`;
  };

  console.log('');
  console.log(`  t=${result.t}s   ${result.format.w}×${result.format.h}   安全边距 ${result.safe.marginX}px / ${result.safe.marginY}px   片长 ${result.duration.toFixed(2)}s`);
  for (const kind of ['ink', 'text', 'caption']) {
    const list = result.receipts.filter((item) => item.kind === kind);
    if (!list.length) continue;
    console.log(`\n  ${kind}（${list.length}）`);
    for (const item of list) {
      const label = item.kind === 'text'
        ? (item.aggregate ? ' （全部文字并集）' : ` 「${item.label || '（空）'}」`)
        : '';
      const bbox = item.ink ? `[${item.ink.join(', ')}]` : '无墨迹';
      console.log(`    [${item.kind}] [${item.scene}] ${item.source}${label}  bbox ${bbox}  ${distText(item.safe)}  ${bandText(item.captionBand)}`);
    }
  }
  console.log(`\n  覆盖 ${result.coverage.covered}/${result.coverage.declared}`);
  console.log('');
  process.exit(0);
}

function saveArtifact(name, data) {
  const outDir = path.join(dir, 'out');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, name), JSON.stringify(data, null, 2));
}

async function cmdDet() {
  const built = await buildProject({ root: ROOT, dir, tts: ttsFromFlags(), write: false });
  if (!built.ok) {
    if (json) console.log(JSON.stringify(built.report, null, 2));
    else printReport(built.report);
    process.exit(1);
  }
  const hash = built.report.det.hash;

  // --twice 只证明"编译器本身不含随机性"，所以两次都不接 TTS：TTS 的耗时与网络与确定性无关
  let twice = null;
  if (hasFlag('twice')) {
    const again = await buildProject({ root: ROOT, dir, tts: null, write: false });
    twice = again.ok && again.report.det.hash === hash;
  }

  const expected = flagValue('verify');
  const match = expected ? expected === hash : null;
  saveArtifact('det.json', { hash, scenes: built.report.det.scenes, duration: built.report.duration });

  if (json) {
    console.log(JSON.stringify({ hash, duration: built.report.duration, scenes: built.report.det.scenes, twice, expected, match }, null, 2));
  } else {
    console.log(`\n  指纹    ${hash}`);
    for (const scene of built.report.det.scenes) console.log(`          ${scene.id.padEnd(6)}${scene.hash}`);
    if (twice !== null) console.log(`  两次一致 ${twice ? '是' : '否 ← 编译器有非确定性来源'}`);
    if (expected) console.log(`  期望值  ${expected}  ${match ? '✓ 一致' : '✗ 不一致'}`);
    console.log('');
  }
  process.exit((twice === false || match === false) ? 1 : 0);
}

async function cmdQa() {
  const count = Number(flagValue('count', 24));
  const result = await runFilmQuality({
    root: ROOT,
    dir,
    tts: ttsFromFlags(),
    count,
    gridCount: 12,
    cols: Number(flagValue('cols', 4)),
    log: json ? () => {} : (line) => console.log(line),
  });
  if (!result.built.ok) {
    if (json) console.log(JSON.stringify(result.built.report, null, 2));
    else printReport(result.built.report);
    process.exit(1);
  }
  const quality = result.result;
  if (json) {
    console.log(JSON.stringify(quality, null, 2));
  } else {
    const icon = { must: '✗', should: '·', info: 'i', nice: ' ' };
    console.log(`\n  质量检查 ${quality.ok ? '通过' : '未通过'}（must ${quality.summary.must} / should ${quality.summary.should}）`);
    for (const issue of quality.issues) {
      if (issue.level === 'nice') continue;
      console.log(`  ${icon[issue.level]} [${issue.code}] ${issue.scene || ''}${issue.unit ? '.' + issue.unit : ''} t=${issue.t} — ${issue.msg}`);
    }
    if (quality.coverage) console.log(`  覆盖 ${quality.coverage.covered}/${quality.coverage.declared}`);
    if (quality.sheet) console.log(`  联系表 ${quality.sheet}（${quality.sampling.review} 格 / ${quality.sampling.cols} 列）`);
    console.log('');
  }
  process.exit(quality.ok ? 0 : 1);
}

async function cmdRecipeAudit() {
  const target = flagValue('recipe');
  const catalog = loadCatalog(ROOT);
  const ids = target ? [target] : [...catalog.recipes.keys()];
  const results = [];
  for (const id of ids) results.push(await auditRecipe({ root: ROOT, catalog, id }));
  const ok = results.every((item) => item.ok);
  if (json) {
    console.log(JSON.stringify({ ok, recipes: results }, null, 2));
  } else {
    console.log('');
    for (const result of results) {
      const tail = result.mode === 'code' ? `镜头参考 ${result.refShots}` : `单元 ${result.units}`;
      console.log(`${result.ok ? '✓' : '✗'} ${result.id}  ${result.mode}  ${result.duration}s / ${result.scenes} 场 / ${tail}`);
      for (const check of result.checks) {
        if (!check.pass) console.log(`   ✗ [${check.code}] ${check.msg}`);
      }
    }
    console.log('');
  }
  process.exit(ok ? 0 : 1);
}

async function cmdNew() {
  const target = positional()[0];
  const recipe = flagValue('recipe');
  if (!target || !recipe) {
    console.error('用法：tt new <目录> --recipe whiteboard-explainer');
    process.exit(1);
  }
  const catalog = loadCatalog(ROOT);
  try {
    const { target: file, mode } = newProject({ dir: path.resolve(target), recipe, catalog });
    console.log(`已创建 ${file}`);
    if (mode === 'code') {
      console.log('下一步：读 recipe 的 brief.md / visual.md / ref-shots/，然后在 storyboard.json 里写 scene.code');
    } else {
      console.log('下一步：改 storyboard.json 的 scene.params');
    }
    console.log(`然后 tt build --dir ${target}`);
    console.log(`出片前加旁白：tt build --dir ${target} --tts edge`);
  } catch (error) {
    console.error(`✗ ${error.message}`);
    process.exit(1);
  }
}

async function cmdLab() {
  const portFlag = flagValue('port');
  const port = portFlag == null ? 5125 : Number(portFlag);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error('✗ --port 必须是 0–65535 的整数');
    process.exit(1);
  }
  const onlyRecipe = flagValue('recipe');
  const { startLab } = await import('./lab/server.mjs');
  try {
    const info = await startLab({
      root: ROOT,
      port,
      recipe: onlyRecipe,
      log: json ? () => {} : (line) => console.log(line),
    });
    if (json) console.log(JSON.stringify({ ok: true, url: info.url, port: info.port }, null, 2));
  } catch (error) {
    console.error(`✗ ${error.message}`);
    process.exit(1);
  }
}

async function cmdPreview() {
  const result = await buildProject({ root: ROOT, dir, tts: ttsFromFlags(), captionOverride: captionFromFlags() });
  if (!result.ok) {
    printReport(result.report);
    process.exit(1);
  }
  const file = path.join(dir, 'out', 'composition.json');
  const port = flagValue('port');
  const args = [path.join(ROOT, 'scripts', 'preview.mjs'), file];
  if (port) args.push('--port', port);
  const previewStartedAt = Date.now();
  const child = spawn(process.execPath, args, { stdio: 'inherit' });
  child.on('exit', (code) => {
    // 页面「发送批注」会落盘并主动关闭预览；这里把本次预览期间产生的批次交回 Agent。
    const pending = readAnnotationBatches(projectRootOf(dir)).batches.filter((batch) => (
      !batch.acked && Date.parse(batch.createdAt) >= previewStartedAt - 5000
    ));
    if (pending.length) {
      console.log('\n[preview] 收到批注，预览已关闭：');
      cmdAnnotations();
    }
    process.exit(code ?? 0);
  });
}

/** 允许 --dir 直接指到 out/：批注始终挂在工程根。 */
function projectRootOf(target) {
  return path.basename(target) === 'out' ? path.dirname(target) : target;
}

/**
 * 读 <工程>/annotations：新格式是批次目录（request.json + 每条 PNG），
 * 旧版单条 *.json 也兼容。所有图片路径返回绝对路径，方便 Agent 直接 Read。
 */
function readAnnotationBatches(projectDir) {
  const annDir = path.join(projectDir, 'annotations');
  if (!existsSync(annDir)) return { annDir, batches: [] };
  const readAck = (file) => (existsSync(file) ? readFileSync(file, 'utf8').trim() || true : null);
  const normalizeItem = (item, baseDir) => ({
    t: Number(item.t) || 0,
    desc: String(item.desc ?? ''),
    strokes: item.strokes ?? [],
    clip: item.clip ?? null,
    images: Object.fromEntries(
      Object.entries(item.images ?? {}).map(([key, file]) => [key, path.join(baseDir, file)]),
    ),
  });
  const batches = [];

  for (const entry of readdirSync(annDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const batchDir = path.join(annDir, entry.name);
      const requestFile = path.join(batchDir, 'request.json');
      if (!existsSync(requestFile)) continue;
      try {
        const data = JSON.parse(readFileSync(requestFile, 'utf8'));
        const ackedAt = readAck(path.join(batchDir, '.ack'));
        batches.push({
          id: data.id || entry.name,
          createdAt: data.createdAt || '',
          composition: data.composition ? path.resolve(projectDir, data.composition) : '',
          request: requestFile,
          dir: batchDir,
          ackFile: path.join(batchDir, '.ack'),
          acked: Boolean(ackedAt),
          ackedAt: ackedAt || null,
          items: (data.items ?? []).map((item) => normalizeItem(item, batchDir)),
        });
      } catch { /* 半成品或坏 JSON 跳过 */ }
    } else if (entry.name.endsWith('.json')) {
      const file = path.join(annDir, entry.name);
      try {
        const data = JSON.parse(readFileSync(file, 'utf8'));
        if (!data || !data.id) continue;
        const ackedAt = readAck(path.join(annDir, `${data.id}.ack`));
        batches.push({
          id: data.id,
          createdAt: data.createdAt || '',
          composition: data.composition ? path.resolve(projectDir, data.composition) : '',
          request: file,
          dir: annDir,
          ackFile: path.join(annDir, `${data.id}.ack`),
          acked: Boolean(ackedAt),
          ackedAt: ackedAt || null,
          items: [normalizeItem(data, annDir)],
        });
      } catch { /* 坏 JSON 跳过 */ }
    }
  }

  batches.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { annDir, batches };
}

/**
 * 预览批注的读回端：页面「发送批注」把整批写到 <工程>/annotations/<batch>/，
 * 这里默认给出最新未处理批次（每条含图片绝对路径），--ack 标记整批已处理。
 */
function cmdAnnotations() {
  const projectDir = projectRootOf(dir);
  const { annDir, batches } = readAnnotationBatches(projectDir);
  const all = hasFlag('all');
  const ack = hasFlag('ack');
  const ackId = flagValue('ack');

  if (!existsSync(annDir)) {
    if (json) console.log(JSON.stringify({ batches: [] }, null, 2));
    else console.log(`没有批注：${annDir} 不存在。先在 tt preview 里标注并发送。`);
    return;
  }

  if (ack) {
    const target = ackId ? batches.find((batch) => batch.id === ackId) : batches.find((batch) => !batch.acked);
    if (!target) {
      console.error(`✗ 没有可标记的批注批次${ackId ? `：${ackId}` : '（全部已处理）'}`);
      process.exit(1);
    }
    const ackedAt = new Date().toISOString();
    writeFileSync(target.ackFile, ackedAt);
    if (json) console.log(JSON.stringify({ acked: target.id, ackedAt }, null, 2));
    else console.log(`已标记已处理：${target.id}`);
    return;
  }

  const selected = all ? batches : batches.filter((batch) => !batch.acked).slice(0, 1);
  if (!selected.length) {
    if (json) console.log(JSON.stringify({ batches: [] }, null, 2));
    else console.log('没有未处理的批注。用 --all 查看历史批次。');
    return;
  }
  if (json) {
    console.log(JSON.stringify({ batches: selected }, null, 2));
    return;
  }
  for (const batch of selected) {
    console.log('');
    console.log(`批注批次 ${batch.id}${batch.acked ? '（已处理）' : ''}  ${batch.createdAt}  共 ${batch.items.length} 条`);
    console.log(`  composition  ${batch.composition || '-'}`);
    for (const [index, item] of batch.items.entries()) {
      console.log(`  ${index + 1}. t=${item.t.toFixed(3)}s${item.clip?.id ? `  场景 ${item.clip.id}` : ''}`);
      if (item.desc) console.log(`     描述    ${item.desc}`);
      console.log(`     批注图  ${item.images.annotatedFrame || '-'}`);
      if (item.images.frame) console.log(`     原始帧  ${item.images.frame}`);
      if (item.images.ink) console.log(`     笔迹    ${item.images.ink}`);
    }
    console.log(`  request  ${batch.request}`);
    console.log(`  处理完执行：tt annotations --ack ${batch.id}`);
  }
  console.log('');
}

/**
 * 全量回归：CI 的唯一入口。退出码非 0 就是挂了，别让人读日志找结论。
 *
 *   默认     recipe audit（含编译）+ 每个 recipe det 两次一致
 *   --deep   再用 tt qa 的统一管线跑每条 recipe（must=0 + 12 格联系表），浏览器串行，慢但全
 */
async function cmdCi() {
  const deep = hasFlag('deep');
  if (hasFlag('baseline')) {
    const result = await runBaseline({ root: ROOT, write: hasFlag('write') });
    process.exit(result.ok ? 0 : 1);
  }
  const count = Number(flagValue('count', 24));
  const catalog = loadCatalog(ROOT);
  const started = Date.now();
  const rows = [];
  let failed = 0;

  for (const id of catalog.recipes.keys()) {
    const row = { id, ok: true, checks: [] };
    const add = (name, ok, detail) => {
      row.checks.push({ name, ok, detail });
      if (!ok) row.ok = false;
    };
    const audit = await auditRecipe({ root: ROOT, catalog, id });
    const auditTail = audit.mode === 'code' ? `镜头参考 ${audit.refShots}` : `单元 ${audit.units}`;
    add('audit', audit.ok, `${audit.mode} / ${audit.duration}s / ${audit.scenes} 场 / ${auditTail}`);

    if (audit.ok) {
      const input = recipeRegressionInput({ root: ROOT, recipe: catalog.recipes.get(id) });
      const first = await buildProject({ root: ROOT, dir: ROOT, file: input.file, write: false, tts: null });
      const second = await buildProject({ root: ROOT, dir: ROOT, file: input.file, write: false, tts: null });
      const stable = first.ok && second.ok && first.report.det.hash === second.report.det.hash;
      add('det', stable, stable ? first.report.det.hash : '两次编译指纹不一致');
    }

    if (deep && audit.ok) {
      const input = recipeRegressionInput({ root: ROOT, recipe: catalog.recipes.get(id) });
      const tmp = path.join(ROOT, 'output', 'ci', id.replaceAll('/', '-'));
      mkdirSync(tmp, { recursive: true });
      const quality = await runFilmQuality({
        root: ROOT,
        dir: tmp,
        file: input.file,
        tts: null,
        count,
        gridCount: 12,
        cols: 4,
        log: () => {},
      });
      if (quality.built.ok) {
        const summary = quality.result.summary;
        add('qa', quality.result.ok,
          `must ${summary.must} / should ${summary.should}`);
      } else {
        add('qa', false, '编译失败');
      }
    }

    if (!row.ok) failed += 1;
    rows.push(row);
    if (!json) {
      const mark = row.ok ? '✓' : '✗';
      const detail = row.checks.map((check) => `${check.name} ${check.ok ? '' : '✗ '}${check.detail}`).join('  ');
      console.log(`${mark} ${id.padEnd(24)}${detail}`);
    }
  }

  const totalMs = Date.now() - started;
  const summary = {
    ok: failed === 0,
    recipes: rows.length,
    failed,
    deep,
    totalMs,
  };
  if (json) {
    console.log(JSON.stringify({ ...summary, rows }, null, 2));
  } else {
    console.log('');
    console.log(`  recipe  ${rows.length} 个，失败 ${failed}`);
    console.log(`  耗时    ${(totalMs / 1000).toFixed(1)}s${deep ? '（deep）' : ''}`);
    console.log(failed === 0 ? '\n  CI 通过\n' : '\n  CI 未通过\n');
  }
  await import('node:fs').then((fs) => fs.rmSync(path.join(ROOT, 'output', 'ci'), { recursive: true, force: true }));
  process.exit(failed === 0 ? 0 : 1);
}

function cmdPack() {
  // 打包逻辑独立成脚本（npm run pack 同款），这里只是给它一个 tt 入口
  const target = positional()[1];
  const args = [path.join(ROOT, 'scripts', 'tools', 'pack-skill.mjs')];
  if (target) args.push(target);
  const child = spawn(process.execPath, args, { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code ?? 0));
}

function cmdRecipeList() {
  const catalog = loadCatalog(ROOT);
  // 货架清单的唯一来源：recipes/ 目录扫描。SKILL.md 不复制这份表，新增 recipe 无需改文档。
  const rows = [...catalog.recipes.values()].map((recipe) => ({
    id: recipe.id,
    name: recipe.name,
    keywords: recipe.keywords || [],
    when: recipe.when,
  }));
  if (json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  for (const row of rows) {
    const head = `${row.id.padEnd(20)} ${(row.name || '').padEnd(10)} ${row.keywords.join(' / ')}`.trimEnd();
    console.log(`${head}  ${row.when || ''}`);
  }
}

function cmdRecipeShow() {
  const id = positional()[1];
  const catalog = loadCatalog(ROOT);
  const recipe = id ? catalog.recipes.get(id) : null;
  if (!recipe) {
    console.error(`未知 recipe "${id ?? ''}"；可用：${[...catalog.recipes.keys()].join(' / ')}`);
    process.exit(1);
  }
  const { drawSource: _drawSource, ...template } = recipe.template || {};
  const view = {
    id: recipe.id,
    abi: recipe.abi || null,
    mode: recipe.mode || null,
    name: recipe.name,
    keywords: recipe.keywords || [],
    when: recipe.when,
    template: recipe.mode === 'params' ? template : null,
    fonts: recipe.fonts ?? null,
    rules: recipe.rules ?? null,
    captions: recipe.captions ?? null,
    audio: recipe.audio ?? null,
    recipeErrors: recipe.recipeErrors ?? [],
  };
  if (json) {
    console.log(JSON.stringify(view, null, 2));
    return;
  }
  const pretty = (label, value) => {
    if (!value) return;
    console.log(`\n  ${label}`);
    console.log(JSON.stringify(value, null, 2).split('\n').map((line) => `    ${line}`).join('\n'));
  };
  console.log('');
  console.log(`  ${view.id}  ${view.name || ''}`);
  console.log(`  abi     ${view.abi}`);
  console.log(`  mode    ${view.mode}`);
  console.log(`  template ${view.template?.draw || '-'}`);
  if (view.keywords.length) console.log(`  keywords ${view.keywords.join(' / ')}`);
  if (view.when) console.log(`  when    ${view.when}`);
  pretty('fonts', view.fonts);
  pretty('rules', view.rules);
  pretty('captions', view.captions);
  pretty('audio', view.audio);
  pretty('template', view.template);
  if (view.recipeErrors.length) {
    console.log('\n  recipe 校验错误');
    for (const error of view.recipeErrors) console.log(`    ✗ [${error.code}] ${error.msg}`);
  }
  console.log('');
}

function usage() {
  console.log(`tt —— Ticktoon 创作入口

  tt new <目录> --recipe <id>     建工程（从 skeleton 预填 storyboard）
  tt build [--dir <工程>] [--tts <provider>]   编译出 out/composition.json + report.json
  tt assets fetch --project <工程> [--provider pexels] [--orientation landscape|portrait]
                [--strict]                  检索、下载、署名并回写 job:media；默认失败时明确降级 bundled
  tt stills <t…> [--dir <工程>]   静帧 + 布局凭据（receipts）
  tt probe --t <秒> [--dir <工程>] 该时刻全部凭据（kind/单元/label/bbox/安全框/字幕带）
  tt qa [--count N] [--cols C]    轻量渲染校验（渲染异常/空墨迹）+ 12 格联系表，must=0
  tt det [--twice] [--verify H]   确定性指纹
  tt preview [--port N]           只读预览（复用引擎面板）；批注在页面内多帧累积，发送后落盘并关闭
  tt lab [--port N] [--recipe <id>]   code recipe 镜头参考实验室：真实编译 + 引擎预览，可改代码重跑
  tt annotations [--all] [--ack [id]]  读取批注批次：默认最新未处理批次；--ack 标记整批已处理
  tt recipe list / show <id> / audit   recipe 货架（id/名称/关键词/when）/ 单条详情（mode+fonts+rules+template）/ 全量审计（骨架 + 示例）
  tt ci [--deep] [--count N]      全量回归：audit + 逐条 det 两次；--deep 复用 tt qa 管线
  tt ci --baseline [--write]       recipe 骨架 / 示例合成片的编译指纹与构建状态基线（新 recipe 自动纳入）；--write 刷新基线
  tt pack [目标目录]              打干净分发包（Skill + 引擎 dist）

  通用参数：--json 输出机器可读结果；--dir 指定工程目录（默认当前目录）
`);
}

switch (command) {
  case 'new': await cmdNew(); break;
  case 'build': await cmdBuild(); break;
  case 'assets':
    if (rest[0] === 'fetch') await cmdAssetsFetch();
    else usage();
    break;
  case 'stills': await cmdStills(); break;
  case 'probe': await cmdProbe(); break;
  case 'qa': await cmdQa(); break;
  case 'det': await cmdDet(); break;
  case 'preview': await cmdPreview(); break;
  case 'lab': await cmdLab(); break;
  case 'annotations': cmdAnnotations(); break;
  case 'ci': await cmdCi(); break;
  case 'pack': await cmdPack(); break;
  case 'recipe':
    if (rest[0] === 'list') cmdRecipeList();
    else if (rest[0] === 'show') cmdRecipeShow();
    else if (rest[0] === 'audit') cmdRecipeAudit();
    else usage();
    break;
  default:
    usage();
    if (command) process.exit(1);
}
