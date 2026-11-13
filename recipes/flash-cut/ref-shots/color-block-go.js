/* @ticktoon-ref-shot
{
  "title": "跨镜色块",
  "note": "单拍；跨场延续色块，用 GO! 做刺点",
  "duration": 0.464,
  "tags": [
    "色块",
    "刺点",
    "跨镜"
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
// 示例 · 1 拍：跨镜色块 + GO! 刺点。
const T = api.t;
const W = api.W;
const H = api.H;
ctx.fillStyle = '#12305C'; ctx.fillRect(0, 0, W, H);
const S = '#FFFFFF';
const A = '#FF4D00';
const B = '#0A0A0A';
const M = '#8A8A8A';
TT.flash.carry(ctx, { mode: 'out', color: A, progress: TT.clamp01(T / 0.22), origin: [0.5, 0.55], shape: 'circle' });
const size = TT.flash.fit(ctx, 'GO!', W * 0.52, { maxPx: 520, fontKey: 'sans-900' });
TT.flash.stagger(ctx, api, { text: 'GO!', x: W * 0.5, y: H * 0.5, size, t: T, dur: 0.14, stagger: 0.02, direction: 'scale', fromScale: 2.6, ease: 'back', color: S });
TT.flash.micro(ctx, { text: '07 / 09 — STINGER', x: W * 0.04, y: H * 0.08, size: 18, color: S });
TT.flash.viewfinder(ctx, { rect: { x: W * 0.025, y: H * 0.025, w: W * 0.95, h: H * 0.95 }, color: S, length: 30, width: 2, rec: true, recColor: A, alpha: 0.8 });
TT.flash.micro(ctx, { text: 'HALF BEAT / 0.2322s', x: W * 0.04, y: H * 0.94, size: 16, color: M });
