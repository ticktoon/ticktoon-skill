/* @ticktoon-ref-shot
{
  "title": "结尾 · 一剑斩开四百年",
  "note": "纯幕布结尾卡：大字、红色副签与印章；保留固定舞台框",
  "duration": 6,
  "resources": [
    { "type": "font", "name": "sans-900" },
    { "type": "font", "name": "sans-400" }
  ],
  "tags": ["皮影", "结尾卡", "印章", "空幕"]
}
*/
const T = api.t;
const S = TT.shadow;
TT.board.stage(ctx, { W, H }, { seed: 3, variant: 0, screen: 'white' });
const L = S.light(ctx, W, H, { t: T, base: 1, variant: 0 });
S.endcard(ctx, { t: T, at: 0.4, title: '刘邦斩白蛇', sub: '一剑斩开四百年汉室江山', seal: '斩蛇' });
S.dim(ctx, W, H, L.dark);
TT.board.stageFrame(ctx, { W, H });
