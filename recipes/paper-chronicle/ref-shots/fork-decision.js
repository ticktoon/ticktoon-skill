/* @ticktoon-ref-shot
{
  "title": "抉择 · 岔路与后果",
  "note": "在纸面上推演两条岔路：选中一条后另一条压暗，印章沿选中的路移动",
  "duration": 9.2,
  "resources": [
    { "type": "font", "name": "sans-900" },
    { "type": "font", "name": "sans-400" },
    { "type": "image", "name": "gate", "src": "skill:recipes/paper-chronicle/icons/assets/gate.svg" },
    { "type": "image", "name": "flame", "src": "skill:recipes/paper-chronicle/icons/assets/flame.svg" }
  ],
  "sfx": [
    { "type": "drum", "at": 0.5, "gain": 0.4 },
    { "type": "whoosh", "at": 1.3, "gain": 0.35 },
    { "type": "wood", "at": 4.9 }
  ],
  "tags": ["纸上剧场", "抉择", "岔路", "推演"]
}
*/
const T = api.t;
const C = TT.chronicle;
const CUES = api.cues.length ? api.cues : [
  { text: '继续押送，刑徒可能一路逃光；到了骊山，也难以交差。', start: 0.8, end: 4.4 },
  { text: '他停下脚步：放走众人，也把后果接到自己身上。', start: 4.7, end: 8.6 },
];
const at = (i, dt = 0) => (CUES[i]?.start ?? 0) + dt;
TT.board.stage(ctx, { W, H }, { seed: 3, variant: 0, screen: 'white' });
const B = C.fork(ctx, {
  t: T, at: 0.3, x: 170, y: 130, w: 1580, h: 690,
  title: '丰西泽之夜 · 纸上推演',
  from: [0.06, 0.68], fork: [0.42, 0.55], hubLabel: '丰西泽',
  selected: T >= CUES[1].start + 0.2 ? 1 : -1,
  branches: [
    {
      label: '继续押送骊山', note: '到骊山也难交差', icon: api.img('gate'),
      to: [0.86, 0.24], at: at(0, 0.3), bend: -0.18,
    },
    {
      label: '就地放徒', note: '众人自由 · 刘邦担罪', icon: api.img('flame'), color: 'red',
      to: [0.86, 0.78], at: at(0, 0.75), bend: 0.18,
    },
  ],
});
if (B) {
  const chosen = B.branches[1];
  const walk = C.seg(T, CUES[1].start + 0.3, CUES[1].start + 1.7, C.E.sine);
  const pos = walk > 0 ? C.pointOnPath(chosen.points, 0.12 + walk * 0.43) : B.fork;
  C.seal(ctx, {
    t: T, at: at(0, 0.15), x: pos.x, y: pos.y - 6,
    text: '刘', radius: 44, fontSize: 38, active: T >= CUES[1].start,
  });
  if (T >= CUES[1].start + 0.55) {
    C.seal(ctx, {
      t: T, at: CUES[1].start + 0.55, x: B.fork.x, y: B.fork.y + 4,
      text: '决', shape: 'square', radius: 30, fontSize: 30, color: '#7A1E14',
    });
  }
}
C.systemCaption(ctx, CUES.find((c) => T >= c.start && T < c.end), { t: T, W, H });
TT.board.stageFrame(ctx, { W, H });
