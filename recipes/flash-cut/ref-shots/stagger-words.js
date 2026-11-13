/* @ticktoon-ref-shot
{
  "title": "逐字砸入",
  "note": "大字占满画面，四拍逐字砸入；适合口号或结论",
  "duration": 1.858,
  "tags": [
    "大字",
    "逐字",
    "硬切"
  ],
  "resources": [
    {
      "type": "font",
      "name": "sans-900"
    },
    {
      "type": "font",
      "name": "sans-400"
    }
  ]
}
*/
// 示例 · 4 拍：逐字砸入，字占画面。
const T = api.t;
const W = api.W;
const H = api.H;
ctx.fillStyle = '#0A0A0A'; ctx.fillRect(0, 0, W, H);
const S = '#FFFFFF';
const A = '#FF4D00';
const L = '#12305C';
const M = '#8A8A8A';
const B = '#0A0A0A';
TT.flash.pattern(ctx, { kind: 'halftone', rect: { x: W * 0.62, y: 0, w: W * 0.38, h: H }, colorA: A, colorB: B, dotGap: 20, dot: 7, alpha: 0.16, seed: 1 });
const size = TT.flash.fit(ctx, '万物皆动', W * 0.88, { maxPx: 380, fontKey: 'sans-900' });
TT.flash.stagger(ctx, api, { text: '万物皆动', x: W * 0.5, y: H * 0.5, size, t: T, dur: 0.34, stagger: 0.09, direction: 'scale', fromScale: 2.1, ease: 'back', colors: [S, S, A, S] });
TT.flash.micro(ctx, { text: '01 / 09', x: W * 0.04, y: H * 0.08, size: 22, color: M });
TT.flash.micro(ctx, { text: 'EVERY = 1 FOOTNOTE = 1/5', x: W * 0.96, y: H * 0.08, size: 18, color: M, align: 'right' });
TT.flash.micro(ctx, { text: '129.2 BPM', x: W * 0.04, y: H * 0.94, size: 18, color: L, bar: { x: W * 0.04, y: H * 0.955, w: W * 0.18, h: 4, value: 0.2, color: A } });
TT.flash.viewfinder(ctx, { rect: { x: W * 0.025, y: H * 0.025, w: W * 0.95, h: H * 0.95 }, color: M, length: 26, width: 1, alpha: 0.7 });
