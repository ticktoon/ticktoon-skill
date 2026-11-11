/* @ticktoon-ref-shot
{
  "title": "波形大字",
  "note": "三拍；波形与大字同屏，后半拍换橙，适合节奏点",
  "duration": 1.393,
  "tags": [
    "波形",
    "大字",
    "节奏"
  ],
  "resources": []
}
*/
// 示例 · 3 拍：波形 + 大字，后半拍换橙。
const T = api.t;
const W = api.W;
const H = api.H;
ctx.fillStyle = '#0A0A0A'; ctx.fillRect(0, 0, W, H);
const S = '#FFFFFF';
const A = '#FF4D00';
const M = '#8A8A8A';
TT.flash.wave(ctx, { rect: { x: W * 0.06, y: H * 0.58, w: W * 0.88, h: H * 0.24 }, count: 64, gap: W * 0.88 / 64, barW: 9, amplitude: H * 0.11, baseline: H * 0.7, color: S, seed: 5, t: T, speed: 1.4, mirror: true });
if (T > 0.7) TT.flash.wave(ctx, { rect: { x: W * 0.06, y: H * 0.58, w: W * 0.88, h: H * 0.24 }, count: 64, gap: W * 0.88 / 64, barW: 9, amplitude: H * 0.055, baseline: H * 0.7, color: A, seed: 5, t: T, speed: 1.8, mirror: true, alpha: 0.5 });
const size = TT.flash.fit(ctx, 'BASS', W * 0.66, { maxPx: 420, role: 'display' });
TT.flash.stagger(ctx, api, { text: 'BASS', x: W * 0.5, y: H * 0.36, size, t: T, dur: 0.22, stagger: 0.05, direction: 'up', fromScale: 1.8, ease: 'back', colors: [S, S, A, S] });
TT.flash.micro(ctx, { text: '06 / 09 — BASS', x: W * 0.04, y: H * 0.08, size: 20, color: M });
TT.flash.micro(ctx, { text: '129.2 BPM / 0.4644s', x: W * 0.96, y: H * 0.08, size: 16, color: A, align: 'right' });
TT.flash.micro(ctx, { text: 'LOW END', x: W * 0.04, y: H * 0.93, size: 16, color: S });
