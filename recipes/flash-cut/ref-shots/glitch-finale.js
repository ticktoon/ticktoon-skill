/* @ticktoon-ref-shot
{
  "title": "故障收尾",
  "note": "四拍；字号最大、信息最少，用故障收束全片",
  "duration": 1.858,
  "tags": [
    "故障",
    "收尾",
    "大字"
  ],
  "resources": []
}
*/
// 示例 · 4 拍：故障收尾，字最大、信息最少。
const T = api.t;
const W = api.W;
const H = api.H;
ctx.fillStyle = '#0A0A0A'; ctx.fillRect(0, 0, W, H);
const S = '#FFFFFF';
const A = '#FF4D00';
const L = '#12305C';
const M = '#8A8A8A';
TT.flash.pattern(ctx, { kind: 'halftone', rect: { x: 0, y: H * 0.66, w: W, h: H * 0.34 }, colorA: A, colorB: '#0A0A0A', dotGap: 22, dot: 7, alpha: 0.12, seed: 9 });
const size = TT.flash.fit(ctx, 'DO IT.', W * 0.8, { maxPx: 360, role: 'display' });
TT.flash.glitchType(ctx, api, { text: 'DO IT.', x: W * 0.5, y: H * 0.5, size, t: T, dur: api.d, color: S, jumpColor: A, jumpRate: 4, count: 12, seed: 9, burstAt: [[0.28, 0.09], [0.66, 0.07]] });
TT.flash.viewfinder(ctx, { rect: { x: W * 0.025, y: H * 0.025, w: W * 0.95, h: H * 0.95 }, color: M, length: 28, width: 1, crosshair: false, alpha: 0.7, labels: [{ text: '09 / 09 — END', x: W * 0.04, y: H * 0.08, size: 20, color: S }, { text: 'EVERY = 1 FOOTNOTE = 1/5', x: W * 0.96, y: H * 0.08, size: 16, color: M, align: 'right' }], progress: { value: 1, color: A, track: M, rect: { x: W * 0.04, y: H * 0.93, w: W * 0.92, h: 4 } } });
TT.flash.micro(ctx, { text: 'DONE / 09', x: W * 0.04, y: H * 0.955, size: 16, color: M });
