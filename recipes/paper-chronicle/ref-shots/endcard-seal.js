/* @ticktoon-ref-shot
{
  "title": "结尾 · 大字与印章",
  "note": "短结尾：收束判断、出处与印章，不延长无效停留",
  "duration": 5.2,
  "resources": [
    { "type": "font", "name": "sans-900" },
    { "type": "font", "name": "sans-400" }
  ],
  "sfx": [
    { "type": "gong", "at": 0.7 },
    { "type": "wood", "at": 2.3 }
  ],
  "tags": ["纸上剧场", "结尾", "印章"]
}
*/
const T = api.t;
const C = TT.chronicle;
TT.board.stage(ctx, { W, H }, { seed: 3, variant: 0, screen: 'white' });
C.endcard(ctx, {
  t: T, at: 0.2,
  title: '一剑斩开四百年',
  sub: '刘邦斩白蛇 · 纸上说史',
  seal: '汉',
});
TT.board.stageFrame(ctx, { W, H });
