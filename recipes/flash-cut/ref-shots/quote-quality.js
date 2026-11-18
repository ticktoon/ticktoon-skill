/* @ticktoon-ref-shot
{
  "title": "品质双引号",
  "note": "中央图片带轻微推近，双向文字与固定双引号水印",
  "duration": 1.858,
  "bg": "#F1EEE7",
  "thumbTime": 1.2,
  "tags": [
    "双引号",
    "品质",
    "图片带"
  ],
  "resources": [
    {
      "type": "image",
      "name": "city",
      "src": "skill:assets/image/pexels-zland.jpg"
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
// 示例 · 4 拍：中央图片带轻推近，双向文字与双引号水印。
const T = api.t;
const W = api.W;
const H = api.H;
const q = TT.clamp01(T / api.d);
const lerp = (a, b, k) => a + (b - a) * k;
const y = H * 0.29;
const bh = H * 0.42;
ctx.fillStyle = '#F1EEE7';
ctx.fillRect(0, 0, W, H);

function cover(img, x, y, w, h, zoom = 1) {
  if (!img) return;
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

// 中间图片带保持稳定，只用轻微推近避免完全静止。
const img = api.img('city');
ctx.save();
ctx.beginPath();
ctx.rect(0, y, W, bh);
ctx.clip();
if (img) cover(img, 0, y, W, bh, 1 + q * 0.04);
ctx.restore();

// 上层向右，下层向左；位移克制，保证首尾都能读全。
ctx.save();
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillStyle = '#B42318';
ctx.font = TT.font(FONTS, 104, 'sans-900').css;
ctx.fillText('2023 | 效率为先 品质至上', W / 2 + lerp(-70, 70, q), H * 0.14);
ctx.fillStyle = '#D4D2CC';
ctx.font = TT.font(FONTS, 154, 'sans-900').css;
ctx.fillText('HIGH QUALITY', W / 2 + lerp(100, -100, q), H * 0.84);
ctx.restore();

// 固定双引号水印：大圆角外框 + 右侧方形缺口，左上小、右下大。
function quotePath(c, x, y, w) {
  const h = 2.45 * w;
  const R = 0.60 * w;
  const r = 0.08 * w;
  const nx = x + 0.57 * w;
  const nT = y + 0.47 * w;
  const nd = y + 0.67 * w;
  const nB = y + 1.05 * w;
  c.moveTo(x, y + R);
  c.arc(x + R, y + R, R, Math.PI, 1.5 * Math.PI);
  c.lineTo(x + w - r, y);
  c.arc(x + w - r, y + r, r, 1.5 * Math.PI, 2 * Math.PI);
  c.lineTo(x + w, nT);
  c.lineTo(nx, nd);
  c.lineTo(nx, nB);
  c.lineTo(x + w, nB);
  c.lineTo(x + w, y + h - r);
  c.arc(x + w - r, y + h - r, r, 0, 0.5 * Math.PI);
  c.lineTo(x + r, y + h);
  c.arc(x + r, y + h - r, r, 0.5 * Math.PI, Math.PI);
  c.closePath();
}
function quotePair(w) {
  ctx.beginPath();
  quotePath(ctx, 0, 0, w);
  quotePath(ctx, 1.28 * w, 0, w);
  ctx.lineWidth = w * 0.07;
  ctx.stroke();
}
ctx.save();
ctx.strokeStyle = 'rgba(255,255,255,0.72)';
ctx.lineJoin = 'miter';
ctx.miterLimit = 8;
ctx.save();
ctx.translate(88, 78);
quotePair(36);
ctx.restore();
ctx.save();
ctx.translate(W - 88, H - 78);
ctx.rotate(Math.PI);
quotePair(76);
ctx.restore();
ctx.restore();
