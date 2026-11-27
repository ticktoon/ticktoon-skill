/* @ticktoon-ref-shot
{
  "title": "问题钩子 · 为什么放走刑徒",
  "note": "片头直接提出核心问题，副标题只交代地点；不用长片名消耗叙事时间",
  "duration": 5.6,
  "resources": [
    { "type": "font", "name": "sans-900" },
    { "type": "font", "name": "sans-400" }
  ],
  "sfx": [
    { "type": "gong", "at": 0.35, "gain": 0.55 },
    { "type": "wood", "at": 1.2 }
  ],
  "tags": ["纸上剧场", "问题钩子", "片头"]
}
*/
const T = api.t;
const C = TT.chronicle;
const CUES = api.cues.length ? api.cues : [
  { text: '他奉命押送刑徒，为什么却在半路放走了所有人？', start: 0.8, end: 5.0 },
];
const at = (i, dt = 0) => (CUES[i]?.start ?? 0) + dt;
TT.board.stage(ctx, { W, H }, { seed: 3, variant: 0, screen: 'white' });
TT.text(ctx, '秦末 · 丰西泽', W * 0.5, H * 0.18, 42,
  { fontKey: 'sans-900', color: '#7A1E14', align: 'center', baseline: 'middle' });
C.title(ctx, { t: T, text: '为什么放走刑徒？', at: 0.25, until: api.d, x: W * 0.48, y: H * 0.40, size: 112 });
TT.text(ctx, '一个选择，如何改变刘邦的命运', W * 0.48, H * 0.55, 38,
  { fontKey: 'sans-400', color: '#5B4030', align: 'center', baseline: 'middle' });
C.seal(ctx, {
  t: T, at: at(0, -0.45), x: W * 0.80, y: H * 0.38,
  text: '刘', sub: '沛县亭长 · 刘邦', color: 'red', shape: 'square', radius: 74, fontSize: 56, subSize: 27,
});
C.systemCaption(ctx, CUES.find((c) => T >= c.start && T < c.end), { t: T, W, H });
TT.board.stageFrame(ctx, { W, H });
