#!/usr/bin/env node
/**
 * 将旧 Python 音效目录导入 assets/sfx，并把哈希文件名改成可读的分类键。
 * 只解析 Python 文本里的对象，不执行源文件；时长以 ffprobe 实测为准。
 *
 * node scripts/tools/import-legacy-sfx.mjs [audio_effects_catalog.py] [sound_effects目录]
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CATALOG = process.argv[2] || 'D:/AI/dh_video/dh-backend/src/constants/audio_effects_catalog.py';
const SOURCE_DIR = process.argv[3] || 'D:/tos/dh/sound_effects';
const OUT_DIR = path.join(ROOT, 'assets', 'sfx');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');

// 与旧目录顺序一一对应；键即新文件名，不再保留不可读的哈希 ID。
const NAMES = [
  "music-opening-logo",
  "voice-wow",
  "cartoon-sneaky",
  null,
  "cartoon-fart-comic",
  null,
  null,
  "impact-duang",
  null,
  "foley-rub",
  "ui-beep",
  "cartoon-dizzy-short",
  "ui-notice",
  null,
  "transition-swish",
  "music-game-success",
  "transition-whoosh-short",
  "magic-fairy-transform",
  null,
  "voice-cheer",
  "cartoon-run-away-fast",
  null,
  "cartoon-slip-away",
  null,
  "transition-whoosh-long",
  "music-awkward",
  "cartoon-faint-hit",
  "impact-light",
  "voice-snore",
  "cartoon-bubble",
  null,
  null,
  "impact-thunder",
  "impact-heavy",
  "cartoon-tremble",
  null,
  "cartoon-funny-face",
  null,
  null,
  "cartoon-thinking",
  "ui-censor-beep",
  "transition-soft",
  null,
  "ui-check-in-success",
  "ui-coin",
  "voice-what-male",
  "cartoon-fart-short",
  "voice-sensual",
  "ui-like-follow",
  "voice-question",
  "transition-general",
  null,
  null,
  "magic-bling",
  "nature-water-drop",
  "cartoon-boing-launch",
  "cartoon-thinking-calculate",
  "transition-long",
  "cartoon-knockout",
  "nature-whirlwind",
  "cartoon-disappointed",
  "voice-marmot-scream",
  null,
  "ui-error",
  null,
  null,
  "music-level-success",
  null,
  null,
  "voice-whistle",
  null,
  "ui-correct-answer",
  null,
  null,
  "cartoon-boing-comic",
  "impact-punch",
  "voice-gasp",
  "voice-breath",
  "transition-breath",
  null,
  "impact-fast-collision",
  null,
  null,
  null,
  "voice-shout",
  null,
  "cartoon-dizzy-long",
  "magic-grand-entrance",
  null,
  "ui-typing",
  "transition-dizzy",
  "ui-system-warning",
  null,
  null,
  "transition-slide",
  null,
  "music-ending",
  "ui-ding-repeat",
  null,
];

const VOLUME = {
  cartoon: 0.42, transition: 0.4, impact: 0.48, ui: 0.34,
  voice: 0.45, magic: 0.36, music: 0.32, nature: 0.35, foley: 0.35,
};
const source = readFileSync(CATALOG, 'utf8');
const re = /"name":\s*"([^"]+)"[\s\S]*?"audio_path":\s*"([^"]+)"[\s\S]*?"duration":\s*([\d.]+)/g;
const rows = [];
for (let match; (match = re.exec(source));) {
  rows.push({ name: match[1].trim(), file: path.basename(match[2]) });
}
if (rows.length !== NAMES.length) {
  throw new Error(`目录条数变为 ${rows.length}，可读名称表为 ${NAMES.length}；先同步名称映射再导入`);
}
if (new Set(NAMES.filter(Boolean)).size !== NAMES.filter(Boolean).length) throw new Error('可读名称表存在重复键');

const ready = [];
const missing = [];
for (let i = 0; i < rows.length; i += 1) {
  const row = rows[i];
  const id = NAMES[i];
  if (!id) continue; // 已在精简评审中删除的变体，不重新导入。
  const src = path.join(SOURCE_DIR, row.file);
  if (!existsSync(src)) {
    missing.push(`${row.name} (${row.file})`);
    continue;
  }
  const destName = `${id}${path.extname(row.file).toLowerCase()}`;
  const dest = path.join(OUT_DIR, destName);
  if (existsSync(dest)) throw new Error(`目标已存在，拒绝覆盖：${dest}`);
  const raw = execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', src,
  ], { encoding: 'utf8' }).trim();
  const duration = Number(Number(raw).toFixed(3));
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`无法读取有效时长：${src}`);
  ready.push({ id, src, dest, destName, duration, desc: row.name });
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
for (const item of ready) {
  if (manifest[item.id]) throw new Error(`manifest 键冲突：${item.id}`);
}
for (const item of ready) copyFileSync(item.src, item.dest);
ready.sort((a, b) => a.id.localeCompare(b.id, 'en'));
for (const item of ready) {
  const category = item.id.split('-')[0];
  manifest[item.id] = {
    src: `skill:assets/sfx/${item.destName}`,
    duration: item.duration,
    volume: VOLUME[category] || 0.35,
    desc: item.desc,
  };
}
manifest.note = 'common-* 为通用界面/转场/提示音；cartoon / transition / impact / ui / voice / magic / music / nature / foley 为分类音效。recipe 通过 defaultSfx / sfxTrack 引用键。';
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`导入 ${ready.length} 个音效，全部位于 assets/sfx/`);
for (const category of Object.keys(VOLUME)) {
  console.log(`${category}: ${ready.filter((item) => item.id.startsWith(`${category}-`)).length}`);
}
console.log(`缺失 ${missing.length} 个：${missing.join(' / ') || '无'}`);
