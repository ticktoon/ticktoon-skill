/**
 * 字幕 kit 合集：同一句旁白、同一画幅，只切换字幕样式。
 * 产物写入 output/caption-kit/project/out/composition.json，渲染仍走 scripts/render.mjs。
 *
 * 这不是正式 recipe 的 build 路径：它把 7 个单场工程合并成一条对照片，
 * 每个单场用 captionOverride 固定一种字幕样式。画面本身是一段普通 scene.code，
 * 对照片只看字幕版式，不带 qa 硬门禁。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProject } from '../../platform/project/build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'output/caption-kit');
const PROJECT = path.join(OUT, 'project');
const STYLES = path.join(OUT, 'styles');
const NARRATION = '字幕跟着声音，逐字亮起来。';
const SPEECH_SECONDS = 1.6;

const demos = [
  { label: 'plain', note: '无底色 · 全部文字一次出现', options: { style: 'plain', at: { x: 0.5, y: 0.36 }, size: 1.18, band: false } },
  { label: 'perchar', note: '文本宽度背衬 · 未读字弱化，已读字点亮', options: { style: 'perchar', at: 'center', size: 1.1 } },
  { label: 'karaoke', note: '当前字高亮 · 逐字跳色', options: { style: 'karaoke', at: 'bottom', size: 1.1, highlight: '#FFD166' } },
  { label: 'collage', note: '独立色块 · 错位 · 逐字弹出', options: { style: 'collage', at: { x: 0.61, y: 0.44 }, size: 1.3, maxWidth: 0.45 } },
  { label: 'vertical', note: '竖排 · 从上到下逐字出现', options: { style: 'vertical', at: { x: 0.78, y: 0.47 }, size: 1.05, maxHeight: 0.55, color: '#35413E' } },
  { label: 'tornpaper', note: '手撕纸 · 左上斜色块 · 江城圆体', options: { style: 'tornpaper', at: 'bottom', size: 1.1 } },
];

const fakeTts = { synthesize: async () => ({ duration: SPEECH_SECONDS, words: null, src: null }) };
const base = { version: '1.0', width: 1920, height: 1080, fps: 30, duration: 0, scenes: [], audio: [] };
let offset = 0;
let bgm = null;

for (let index = 0; index < demos.length; index += 1) {
  const demo = demos[index];
  const dir = path.join(STYLES, demo.label);
  mkdirSync(dir, { recursive: true });
  const storyboard = {
    recipe: 'whiteboard-explainer',
    format: { w: 1920, h: 1080, fps: 30 },
    meta: { title: `字幕 kit · ${demo.label}`, styleLab: 'caption-kit' },
    scenes: [{
      id: `caption-${demo.label}`,
      narration: NARRATION,
      code: [
        "ctx.fillStyle = '#F3EFE6'; ctx.fillRect(0, 0, W, H);",
        `TT.text(ctx, ${JSON.stringify(`字幕样式 · ${demo.label}`)}, W * 0.5, H * 0.24, 64, { fontKey: 'sans-900', color: '#2B2A25', align: 'center', maxWidth: W * 0.8 });`,
        `TT.text(ctx, ${JSON.stringify(demo.note)}, W * 0.5, H * 0.32, 34, { fontKey: 'sans-400', color: '#6B6458', align: 'center', maxWidth: W * 0.72 });`,
      ].join('\n'),
      resources: [
        { type: 'font', name: 'sans-900' },
        { type: 'font', name: 'sans-400' },
      ],
    }],
  };
  writeFileSync(path.join(dir, 'storyboard.json'), `${JSON.stringify(storyboard, null, 2)}\n`);

  const built = await buildProject({
    root: ROOT,
    dir: PROJECT,
    file: path.join(dir, 'storyboard.json'),
    write: false,
    captionOverride: demo.options,
    tts: fakeTts,
  });
  if (!built.ok) throw new Error(`${demo.label} 编译失败：${JSON.stringify(built.report.errors)}`);

  const scene = structuredClone(built.composition.scenes[0]);
  scene.id = `caption-${demo.label}`;
  scene.start = offset;
  for (const cue of scene.cues) {
    cue.start = 0.16;
    cue.end = Number((scene.duration - 0.2).toFixed(3));
    const span = cue.end - cue.start;
    const lead = 0.12;
    const step = Math.min(0.18, (span - lead - 0.28) / Math.max(1, cue.chars.length - 1));
    cue.chars.forEach((ch, i) => {
      ch.start = Number((cue.start + lead + i * step).toFixed(3));
      ch.end = Number(Math.min(cue.end - 0.06, ch.start + Math.min(0.26, step * 1.4)).toFixed(3));
    });
  }
  if (!bgm) bgm = (built.composition.audio || []).find((event) => event.role === 'bgm') || null;
  base.scenes.push(scene);
  offset = Number((offset + scene.duration).toFixed(3));
}

base.duration = offset;
if (bgm) {
  base.audio = [{
    ...bgm,
    id: 'caption-bgm',
    at: 0,
    duration: offset,
    fadeIn: Math.min(1.2, offset / 4),
    fadeOut: Math.min(1.2, offset / 4),
  }];
}
mkdirSync(path.join(PROJECT, 'out'), { recursive: true });
writeFileSync(path.join(PROJECT, 'out/composition.json'), `${JSON.stringify(base, null, 2)}\n`);
writeFileSync(path.join(PROJECT, 'out/demo.json'), `${JSON.stringify({ duration: offset, narration: NARRATION, demos }, null, 2)}\n`);
console.log(`字幕 kit 合集：${base.scenes.length} 种 / ${offset.toFixed(2)}s`);
console.log(path.join(PROJECT, 'out/composition.json'));
