/* @ticktoon-ref-shot
{
  "title": "拉伸字与速度线",
  "note": "两拍；字被横向拉开，速度线推方向，末尾切故障",
  "duration": 0.929,
  "tags": [
    "速度线",
    "拉伸",
    "故障"
  ],
  "resources": []
}
*/
// 示例 · 2 拍：拉伸字 + 速度线，末尾切一刀故障。
const T = api.t;
const W = api.W;
const H = api.H;
ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
const B = '#0A0A0A';
const A = '#FF4D00';
const L = '#12305C';
const M = '#8A8A8A';
TT.flash.pattern(ctx, { kind: 'stripes', rect: { x: 0, y: H * 0.62, w: W, h: H * 0.12 }, colorA: L, colorB: '#FFFFFF', gap: 34, width: 8, alpha: 0.14 });
const size = TT.flash.fit(ctx, 'NOISE', W * 0.76, { maxPx: 360, role: 'display' });
TT.flash.stretch(ctx, api, { text: 'NOISE', x: W * 0.5, y: H * 0.46, size, t: T, dur: 0.3, skew: -0.18, scaleY: 0.74, offset: -220, color: B, speed: 1, lineColor: A, lineCount: 18, seed: 7 });
TT.flash.micro(ctx, { text: '05 / 09 — CUT', x: W * 0.04, y: H * 0.08, size: 20, color: M });
TT.flash.micro(ctx, { text: 'NOISE = SIGNAL', x: W * 0.96, y: H * 0.08, size: 16, color: L, align: 'right' });
TT.flash.micro(ctx, { text: 'GLITCH / 02 FRAMES', x: W * 0.04, y: H * 0.93, size: 18, color: M, bar: { x: W * 0.04, y: H * 0.945, w: W * 0.34, h: 5, value: 0.66, color: A } });
const gl = T - 0.58;
if (gl >= 0 && gl < 0.16) TT.flash.glitch(ctx, api, { W, H, count: 9, shift: 34, seed: 11, color: A, colorAlpha: 0.08 });
