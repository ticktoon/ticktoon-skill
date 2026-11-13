/* @ticktoon-ref-shot
{
  "title": "字是窗口",
  "note": "以字为遮罩露出实拍，三拍；画面里始终有真实素材",
  "duration": 1.393,
  "tags": [
    "实拍",
    "遮罩",
    "窗口"
  ],
  "resources": [
    {
      "type": "video",
      "name": "tech",
      "src": "skill:assets/demo/tech.mp4"
    },
    {
      "type": "video",
      "name": "nature",
      "src": "skill:assets/demo/nature.mp4"
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
// 示例 · 3 拍：字是窗口，里面是实拍。
const T = api.t;
const W = api.W;
const H = api.H;
const S = '#FFFFFF';
const B = '#0A0A0A';
const A = '#FF4D00';
const M = '#8A8A8A';
const frame = api.video('tech');
const bg = TT.flash.contrastColor(api, frame, { light: '#F2F0E8', dark: B });
ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
const fg = bg === B ? S : B;
const size = TT.flash.fit(ctx, 'MOVE', W * 0.82, { maxPx: 540, fontKey: 'sans-900' });
TT.flash.mask(ctx, api, { text: 'MOVE', x: W * 0.5, y: H * 0.5, size, fill: 'image', image: frame, fit: 'cover', focus: [0.52, 0.38], zoom: 1.12, t: T, dur: 0.28, reveal: TT.clamp01((T - 0.04) / 0.3), revealDir: 'l' });
TT.flash.micro(ctx, { text: '02 / 09 — EVERY', x: W * 0.04, y: H * 0.165, size: 18, color: fg });
TT.flash.micro(ctx, { text: 'BRAND FILM / 4:5', x: W * 0.96, y: H * 0.165, size: 16, color: fg, align: 'right' });
TT.flash.micro(ctx, { text: 'EVERY = 1 FOOTNOTE = 1/5', x: W * 0.04, y: H * 0.835, size: 16, color: fg });
TT.flash.micro(ctx, { text: 'MOVE / 02', x: W * 0.96, y: H * 0.835, size: 16, color: fg, align: 'right' });
