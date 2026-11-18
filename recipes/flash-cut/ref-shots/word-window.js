/* @ticktoon-ref-shot
{
  "title": "字是窗口",
  "note": "以字为遮罩露出图片，三拍；图片降低对比度并缓慢放大",
  "duration": 1.393,
  "tags": [
    "图片",
    "遮罩",
    "窗口"
  ],
  "resources": [
    {
      "type": "image",
      "name": "bg",
      "src": "skill:assets/image/pexels-jakubzerdzicki.jpg"
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
// 示例 · 3 拍：字是窗口，图片降低对比度并缓慢放大。
const T = api.t;
const W = api.W;
const H = api.H;
const S = '#FFFFFF';
const A = '#FF4D00';
const M = '#8A8A8A';
const img = api.img('bg');
ctx.fillStyle = '#0A0A0A';
ctx.fillRect(0, 0, W, H);
const fg = S;
if (img) {
  // 离屏图片层：cover 填满后缓慢放大，降低对比度但保留原图色调。
  const OW = 1200;
  const OH = 420;
  const off = api.canvas(OW, OH);
  const o = off.ctx;
  const zoom = 1 + 0.1 * (api.t / api.d);
  const scale = Math.max(OW / img.naturalWidth, OH / img.naturalHeight) * zoom;
  o.filter = 'contrast(0.75) brightness(1.02)';
  o.drawImage(
    img,
    (OW - img.naturalWidth * scale) / 2,
    (OH - img.naturalHeight * scale) / 2,
    img.naturalWidth * scale,
    img.naturalHeight * scale,
  );
  o.filter = 'none';

  // 独立字形 mask：一次 destination-in，让图片只留在字口里。
  const mask = api.canvas(OW, OH);
  const m = mask.ctx;
  m.font = TT.font(FONTS, 320, 'sans-900').css;
  m.textAlign = 'center';
  m.textBaseline = 'middle';
  m.lineWidth = 20;
  m.lineJoin = 'round';
  m.miterLimit = 2;
  m.fillText('MOVE', OW / 2, OH / 2);
  m.strokeText('MOVE', OW / 2, OH / 2);

  o.globalCompositeOperation = 'destination-in';
  o.drawImage(mask.canvas, 0, 0);
  o.globalCompositeOperation = 'source-over';
  ctx.drawImage(off.canvas, (W - OW) / 2, (H - OH) / 2);
}
TT.flash.micro(ctx, { text: '02 / 09 — EVERY', x: W * 0.04, y: H * 0.165, size: 18, color: fg });
TT.flash.micro(ctx, { text: 'BRAND FILM / 4:5', x: W * 0.96, y: H * 0.165, size: 16, color: fg, align: 'right' });
TT.flash.micro(ctx, { text: 'EVERY = 1 FOOTNOTE = 1/5', x: W * 0.04, y: H * 0.835, size: 16, color: fg });
TT.flash.micro(ctx, { text: 'MOVE / 02', x: W * 0.96, y: H * 0.835, size: 16, color: fg, align: 'right' });
