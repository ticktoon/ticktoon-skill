/* @ticktoon-ref-shot
{
  "title": "从秦末到汉兴 · 年表与势力",
  "note": "节点、图标和势力高亮都跟随信息节拍；第二句补充意义而不是重复画面",
  "duration": 8.8,
  "resources": [
    { "type": "font", "name": "sans-900" },
    { "type": "font", "name": "sans-400" },
    { "type": "image", "name": "banner", "src": "skill:recipes/paper-chronicle/icons/assets/banner.svg" },
    { "type": "image", "name": "castle", "src": "skill:recipes/paper-chronicle/icons/assets/castle.svg" },
    { "type": "image", "name": "swords", "src": "skill:recipes/paper-chronicle/icons/assets/swords.svg" },
    { "type": "image", "name": "seal-icon", "src": "skill:recipes/paper-chronicle/icons/assets/seal.svg" }
  ],
  "sfx": [
    { "type": "drum", "at": 0.4, "gain": 0.45 },
    { "type": "wood", "at": 1.3 },
    { "type": "gong", "at": 4.1, "gain": 0.45 }
  ],
  "tags": ["纸上剧场", "年表", "势力", "图标", "系统旁白"]
}
*/
const T = api.t;
const C = TT.chronicle;
const CUES = api.cues.length ? api.cues : [
  { text: '从沛县起兵，到入关灭秦，再到建立汉朝，关键节点依次展开。', start: 0.8, end: 5.2 },
  { text: '七年间，亭长、起义者和开国皇帝三种身份连在一起。', start: 5.5, end: 8.2 },
];
const at = (i, dt = 0) => (CUES[i]?.start ?? 0) + dt;
TT.board.stage(ctx, { W, H }, { seed: 3, variant: 0, screen: 'white' });
C.title(ctx, { t: T, text: '从秦末到汉兴', at: 0.25, until: api.d, x: W * 0.5, y: H * 0.15, size: 68 });
const active = T < at(0, 1.4) ? '秦' : T < at(0, 2.6) ? '楚' : '汉';
for (const [i, item] of [['秦', 'black'], ['楚', 'green'], ['汉', 'red']].entries()) {
  C.seal(ctx, { t: T, at: 0.45 + i * 0.2, x: W * (0.35 + i * 0.15), y: H * 0.28, text: item[0], color: item[1], radius: 44, fontSize: 36, active: active === item[0] });
}
C.timeline(ctx, {
  t: T, at: 0.35, x: 240, y: H * 0.53, w: 1440,
  events: [
    { year: '前209', label: '沛县起兵', at: at(0, 0.25), icon: api.img('banner') },
    { year: '前207', label: '入关灭秦', at: at(0, 1.15), icon: api.img('castle') },
    { year: '前206', label: '楚汉相争', at: at(0, 2.05), icon: api.img('swords') },
    { year: '前202', label: '建立汉朝', at: at(0, 3.0), icon: api.img('seal-icon'), active: true },
  ],
});
C.systemCaption(ctx, CUES.find((c) => T >= c.start && T < c.end), { t: T, W, H });
TT.board.stageFrame(ctx, { W, H });
