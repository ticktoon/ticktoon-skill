/* @ticktoon-ref-shot
{
  "title": "不等格拼贴",
  "note": "三拍；图、色块、短词按不等格混排，适合信息密集的快切",
  "duration": 1.393,
  "tags": [
    "拼贴",
    "网格",
    "素材"
  ],
  "resources": [
    {
      "type": "video",
      "name": "city",
      "src": "skill:assets/demo/city.mp4"
    },
    {
      "type": "video",
      "name": "nature",
      "src": "skill:assets/demo/nature.mp4"
    },
    {
      "type": "video",
      "name": "tech",
      "src": "skill:assets/demo/tech.mp4"
    }
  ]
}
*/
// 示例 · 3 拍：不等格拼贴，图 / 色块 / 短词混排。
const T = api.t;
const W = api.W;
const H = api.H;
ctx.fillStyle = '#0A0A0A'; ctx.fillRect(0, 0, W, H);
const S = '#FFFFFF';
const A = '#FF4D00';
const L = '#12305C';
const B = '#0A0A0A';
const M = '#8A8A8A';
TT.flash.micro(ctx, { text: '08 / 09 — FOUR CARDS', x: W * 0.04, y: H * 0.08, size: 20, color: M });
TT.flash.panels(ctx, api, { layout: 'quad', rect: { x: W * 0.06, y: H * 0.13, w: W * 0.88, h: H * 0.74 }, radius: 22, t: T, dur: 0.38, stagger: 0.08, from: 'bottom', offset: 36, fromScale: 0.9, border: false, cells: [
  { video: 'city', label: 'CITY / 01', labelColor: S },
  { color: S, text: 'RUN', textColor: B, textSize: 132, role: 'display', label: 'MOVE / 02', labelColor: B },
  { color: L, text: '01', textColor: S, textSize: 100, role: 'num' },
  { color: A, text: 'GO', textColor: S, textSize: 136, role: 'display', label: 'MOVE / 04', labelColor: S }
] });
TT.flash.viewfinder(ctx, { rect: { x: W * 0.025, y: H * 0.025, w: W * 0.95, h: H * 0.95 }, color: M, length: 22, width: 1, crosshair: true, alpha: 0.6 });
TT.flash.micro(ctx, { text: 'FOUR CARDS / ONE GRID', x: W * 0.04, y: H * 0.93, size: 16, color: S });
TT.flash.micro(ctx, { text: 'NO SAME SIZE TWICE', x: W * 0.96, y: H * 0.93, size: 14, color: M, align: 'right' });
