/* @ticktoon-ref-shot
{
  "title": "桃园结义 · 三印同誓",
  "note": "人物不需要立绘：三枚印章聚合，讲话者高亮并进入角色对白条",
  "duration": 9.5,
  "resources": [
    { "type": "font", "name": "sans-900" },
    { "type": "font", "name": "sans-400" },
    { "type": "image", "name": "swords", "src": "skill:recipes/paper-chronicle/icons/assets/swords.svg" }
  ],
  "sfx": [
    { "type": "gong", "at": 0.25 },
    { "type": "drum", "at": 2.0, "gain": 0.6 },
    { "type": "wood", "at": 4.6 }
  ],
  "tags": ["纸上剧场", "桃园结义", "印章", "角色对白"]
}
*/
const T = api.t;
const C = TT.chronicle;
const CUES = api.cues.length ? api.cues : [
  { text: '东汉末年，刘备、关羽、张飞在桃园结为兄弟。', start: 0.8, end: 4.2 },
  { text: '不求同年同月同日生，但愿同年同月同日死。', start: 4.6, end: 8.9 },
];
const at = (i, dt = 0) => (CUES[i]?.start ?? 0) + dt;
TT.board.stage(ctx, { W, H }, { seed: 3, variant: 0, screen: 'white' });
TT.text(ctx, '东汉 · 桃园', W * 0.5, H * 0.17, 48, { fontKey: 'sans-900', color: '#7A1E14', align: 'center', baseline: 'middle' });
const gather = C.seg(T, at(0, 0.5), at(0, 2.1), C.E.sine);
const center = { x: W * 0.5, y: H * 0.46 };
ctx.save(); ctx.globalAlpha = 0.28 + gather * 0.45; ctx.strokeStyle = '#B78635'; ctx.lineWidth = 3; ctx.setLineDash([8, 10]);
for (const x of [W * 0.28, W * 0.5, W * 0.72]) { ctx.beginPath(); ctx.moveTo(x, center.y + 145); ctx.lineTo(center.x, center.y + 70); ctx.stroke(); }
ctx.restore();
C.icon(ctx, api.img('swords'), { t: T, at: at(0, 1.3), x: center.x, y: H * 0.66, size: 170, alpha: 0.12 });
C.title(ctx, { t: T, text: '义', at: at(0, 1.3), until: api.d, x: center.x, y: H * 0.66, size: 104 });
const people = [
  { who: '关羽', text: '关', color: 'green', from: W * 0.20, to: W * 0.36, seedAt: 1.0 },
  { who: '刘备', text: '刘', color: 'red', from: W * 0.50, to: W * 0.50, seedAt: 0.7 },
  { who: '张飞', text: '张', color: 'black', from: W * 0.80, to: W * 0.64, seedAt: 1.3 },
];
for (const p of people) {
  const x = p.from + (p.to - p.from) * gather;
  C.seal(ctx, { t: T, at: at(0, p.seedAt - 0.7), x, y: center.y - 40, text: p.text, sub: p.who, color: p.color, radius: 72, active: p.who === '刘备' && T >= CUES[1].start });
}
const cueIndex = CUES.findIndex((c) => T >= c.start && T < c.end);
const cue = CUES[cueIndex];
if (cueIndex === 1) C.dialogueCaption(ctx, cue, '刘备', { t: T, W, H });
else C.systemCaption(ctx, cue, { t: T, W, H });
TT.board.stageFrame(ctx, { W, H });
