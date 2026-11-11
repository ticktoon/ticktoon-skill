/* @ticktoon-ref-shot
{
  "title": "数字刺点",
  "note": "单拍，用数字做视觉重音；适合数据或倒计时",
  "duration": 0.464,
  "tags": [
    "数字",
    "单拍",
    "重音"
  ],
  "resources": []
}
*/
// 示例 · 1 拍：数字刺点。
const T = api.t;
const W = api.W;
const H = api.H;
ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
const B = '#0A0A0A';
const L = '#12305C';
const A = '#FF4D00';
const M = '#8A8A8A';
TT.flash.pattern(ctx, { kind: 'grid', rect: { x: 0, y: 0, w: W, h: H }, colorA: L, colorB: '#FFFFFF', cell: 96, alpha: 0.08 });
const size = TT.flash.fit(ctx, '09', W * 0.62, { maxPx: 760, role: 'display' });
TT.flash.stagger(ctx, api, { text: '09', x: W * 0.5, y: H * 0.48, size, t: T, dur: 0.16, stagger: 0.03, direction: 'scale', fromScale: 2.4, ease: 'back', color: B, colors: [B, A] });
TT.flash.micro(ctx, { text: '03 / 09 — SLAM', x: W * 0.04, y: H * 0.08, size: 20, color: M });
TT.flash.micro(ctx, { text: '02 / 03', x: W * 0.96, y: H * 0.08, size: 18, color: L, align: 'right' });
TT.flash.micro(ctx, { text: 'HIT / 0.46s', x: W * 0.04, y: H * 0.93, size: 18, color: M, bar: { x: W * 0.04, y: H * 0.945, w: W * 0.34, h: 5, value: 0.5, color: A } });
