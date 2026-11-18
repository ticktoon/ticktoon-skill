/* @ticktoon-ref-shot
{
  "title": "四格斜墙",
  "note": "四块素材斜切并置，图本身当主角，四拍",
  "duration": 1.858,
  "tags": [
    "拼贴",
    "素材",
    "斜切"
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
    },
    {
      "type": "video",
      "name": "office",
      "src": "skill:assets/demo/office.mp4"
    },
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
// 示例 · 4 拍：四格斜墙，图本身当主角。
const T = api.t;
const W = api.W;
const H = api.H;
ctx.fillStyle = '#0A0A0A'; ctx.fillRect(0, 0, W, H);
const S = '#FFFFFF';
const A = '#FF4D00';
const L = '#12305C';
const M = '#8A8A8A';
TT.flash.micro(ctx, { text: '04 / 09 — WALL', x: W * 0.04, y: H * 0.08, size: 20, color: M });
TT.flash.panels(ctx, api, { rect: { x: W * 0.06, y: H * 0.14, w: W * 0.88, h: H * 0.7 }, cols: 4, gap: 20, radius: 20, slant: -0.055, t: T, dur: 0.4, stagger: 0.08, from: 'bottom', offset: 44, fromScale: 0.9, border: false, cells: [{ video: 'city', label: 'CITY / 01', labelColor: S, tint: A, tintAlpha: 0.16 }, { video: 'nature', label: 'NATURE / 02', labelColor: S }, { video: 'tech', label: 'TECH / 03', labelColor: S, tint: L, tintAlpha: 0.22 }, { video: 'office', label: 'OFFICE / 04', labelColor: S }] });
TT.flash.micro(ctx, { text: 'FOUR CITIES / ONE BEAT', x: W * 0.04, y: H * 0.93, size: 18, color: S });
TT.flash.micro(ctx, { text: '4 BEATS / 1.86s', x: W * 0.96, y: H * 0.93, size: 16, color: A, align: 'right' });
