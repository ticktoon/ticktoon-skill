/* @ticktoon-ref-shot
{
  "title": "双向图片跑马灯",
  "note": "上下两排图片与文字反向循环，中间主图承接视觉焦点",
  "duration": 1.858,
  "bg": "#0A0A0A",
  "thumbTime": 1.2,
  "tags": [
    "跑马灯",
    "双向",
    "图片墙"
  ],
  "resources": [
    {
      "type": "image",
      "name": "city",
      "src": "skill:assets/image/pexels-zland.jpg"
    },
    {
      "type": "image",
      "name": "office",
      "src": "skill:assets/image/pexels-eyupcancaglar.jpg"
    },
    {
      "type": "image",
      "name": "tech",
      "src": "skill:assets/image/pexels-jakubzerdzicki.jpg"
    },
    {
      "type": "image",
      "name": "mid",
      "src": "skill:assets/image/pexels-veronika-souvorova.jpg"
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
// 示例 · 4 拍：上下两排反向流动，中间主图保持清楚。
// 可替换：上下内容、图片、文字、配色和卡片尺寸。
// 本镜头的识别结构：上下反向循环 + 中央主图。
// 修改 wall 的运动计算时，必须保持两排方向相反。
const T = api.t;
const W = api.W;
const H = api.H;
ctx.fillStyle = '#0A0A0A';
ctx.fillRect(0, 0, W, H);

const topItems = [
  { text: '5G', bg: '#B42318', fg: '#FFFFFF' },
  { image: 'city' },
  { text: '2026', bg: '#E7E2D8', fg: '#12233F' },
  { image: 'office' },
  { text: '向前', bg: '#12233F', fg: '#FFFFFF' },
  { image: 'tech' },
];
const bottomItems = [
  { image: 'tech' },
  { text: 'NEW', bg: '#12233F', fg: '#FFFFFF' },
  { image: 'office' },
  { text: '轻盈', bg: '#B42318', fg: '#FFFFFF' },
  { image: 'city' },
  { text: '出发', bg: '#E7E2D8', fg: '#12233F' },
];

const cw = 360;
const gap = 12;
const h = H * 0.32;
const unit = cw + gap;
const midTop = H * 0.05 + h;
const midBot = H * 0.63;
const midH = midBot - midTop;

function cover(img, x, y, w, h) {
  if (!img) return;
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

const midImg = api.img('mid');
if (midImg) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, midTop, W, midH);
  ctx.clip();
  cover(midImg, 0, midTop, W, midH);
  ctx.restore();
}

function wall(y, direction, items, phase = 0) {
  const loop = items.length * unit;
  const shift = ((T * 520 * direction + phase) % loop + loop) % loop;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, y, W, h);
  ctx.clip();
  for (let k = -1; k <= 0; k += 1) {
    for (let i = 0; i < items.length; i += 1) {
      const x = k * loop + i * unit + shift;
      const item = items[i];
      if (x > W || x + cw < 0) continue;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, cw, h);
      ctx.clip();
      const img = item.image ? api.img(item.image) : null;
      if (img) {
        cover(img, x, y, cw, h);
      } else {
        ctx.fillStyle = item.bg;
        ctx.fillRect(x, y, cw, h);
        ctx.fillStyle = item.fg;
        ctx.font = TT.font(FONTS, 96, 'sans-900').css;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.text, x + cw / 2, y + h / 2);
      }
      ctx.restore();
    }
  }
  ctx.restore();
}

wall(H * 0.05, 1, topItems);
wall(H * 0.63, -1, bottomItems, unit * 0.55);
