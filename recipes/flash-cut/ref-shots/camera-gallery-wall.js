/* @ticktoon-ref-shot
{
  "title": "作品墙镜头巡览",
  "note": "六张作品卡按关键帧推近与拉远，背景纸张网格保持固定",
  "duration": 2.322,
  "bg": "#F4F2EC",
  "thumbTime": 1.6,
  "tags": [
    "作品墙",
    "镜头",
    "推近"
  ],
  "resources": [
    {
      "type": "image",
      "name": "product",
      "src": "skill:assets/image/pexels-jakubzerdzicki.jpg"
    },
    {
      "type": "image",
      "name": "city",
      "src": "skill:assets/image/pexels-zland.jpg"
    },
    {
      "type": "image",
      "name": "nature",
      "src": "skill:assets/image/pexels-veronika-souvorova.jpg"
    },
    {
      "type": "font",
      "name": "sans-900"
    }
  ]
}
*/
// 示例 · 5 拍：固定作品墙做镜头巡览，背景网格不随镜头移动。
const T = api.t;
const W = api.W;
const H = api.H;
const q = TT.clamp01(T / api.d);
const lerp = (a, b, k) => a + (b - a) * k;
const fontPx = (px) => TT.font(FONTS, px, 'sans-900').css;
const frames = [
  { t: 0, x: 0, y: 0, z: 1.35 },
  { t: 0.14, x: 0, y: 0, z: 1.5 },
  { t: 0.38, x: 2, y: 0, z: 1.5 },
  { t: 0.48, x: 2, y: 0, z: 1.5 },
  { t: 0.72, x: 0, y: 1, z: 1.5 },
  { t: 0.82, x: 0, y: 1, z: 1.5 },
  { t: 1, x: 0, y: 1, z: 1 },
];
let k = 0;
for (let i = 0; i < frames.length - 2; i += 1) {
  if (q > frames[i + 1].t) k = i + 1;
}
const a = frames[k];
const b = frames[k + 1];
const u = TT.clamp01((q - a.t) / (b.t - a.t));
const p = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
const gx = lerp(a.x, b.x, p);
const gy = lerp(a.y, b.y, p);
const zoom = lerp(a.z, b.z, p);

// 固定的纸张网格背景；镜头只移动作品墙，不移动背景。
ctx.fillStyle = '#F4F2EC';
ctx.fillRect(0, 0, W, H);
ctx.strokeStyle = 'rgba(18,35,63,0.045)';
ctx.lineWidth = 1;
for (let x = 0; x <= W; x += 80) {
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, H);
  ctx.stroke();
}
for (let y = 0; y <= H; y += 80) {
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(W, y);
  ctx.stroke();
}

const mx = W * 0.06;
const my = H * 0.2;
const gapX = W * 0.024;
const gapY = H * 0.04;
const cw = (W - mx * 2 - gapX * 2) / 3;
const ch = cw * 0.56;
const fx = mx + gx * (cw + gapX) + cw / 2;
const fy = my + gy * (ch + gapY) + ch / 2;
const settle = TT.clamp01((1.5 - zoom) / 0.5);
const camX = lerp(fx, W / 2, settle);
const camY = lerp(fy, H / 2, settle);

function panel(x, y, w, h, r = 18) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
function cover(img, x, y, w, h, zoom = 1) {
  if (!img) return;
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

ctx.save();
ctx.translate(W / 2, H / 2);
ctx.scale(zoom, zoom);
ctx.translate(-camX, -camY);

// 页面标题也是作品墙的一部分，会随镜头一起移动。
ctx.fillStyle = '#17130F';
ctx.font = '24px monospace';
ctx.textAlign = 'left';
ctx.textBaseline = 'middle';
ctx.fillText('anything you can describe', mx, 48);
ctx.font = fontPx(62);
const heading = 'Brand films.';
const hw = ctx.measureText(heading).width + 42;
ctx.fillStyle = '#0A0A0A';
panel(mx, 76, hw, 86, 12);
ctx.fill();
ctx.fillStyle = '#F7F3EB';
ctx.fillText(heading, mx + 21, 120);

const colors = ['#FF4D00', '#0A0A0A', '#EEEAE2', '#F5B79F', '#151515', '#D8DFE5'];
for (let i = 0; i < 6; i += 1) {
  const x = mx + (i % 3) * (cw + gapX);
  const y = my + Math.floor(i / 3) * (ch + gapY);

  // 卡片底色只画一次柔和阴影，内容层必须关闭阴影，避免重影。
  ctx.save();
  ctx.shadowColor = 'rgba(23,32,51,0.15)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = colors[i];
  panel(x, y, cw, ch);
  ctx.fill();
  ctx.restore();
  ctx.save();
  panel(x, y, cw, ch);
  ctx.clip();

  if (i === 0) {
    const img = api.img('product');
    if (img) cover(img, x, y, cw, ch, 1.04);
    ctx.fillStyle = 'rgba(255,77,0,0.22)';
    ctx.fillRect(x, y, cw, ch);
    ctx.fillStyle = '#F7F3EB';
    ctx.font = fontPx(ch * 0.25);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NEW', x + cw / 2, y + ch * 0.52);
  } else if (i === 1) {
    ctx.fillStyle = '#F7F3EB';
    ctx.font = fontPx(ch * 0.25);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FAST', x + cw / 2, y + ch * 0.52);
  } else if (i === 2) {
    ctx.fillStyle = '#0A0A0A';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = fontPx(62);
    ctx.fillText('+48%', x + 32, y + 58);
    const vals = [0.28, 0.46, 0.4, 0.65, 0.58, 1];
    const bw = (cw - 64 - 60) / 6;
    const base = y + ch - 66;
    vals.forEach((v, j) => {
      ctx.fillStyle = j === 5 ? '#FF4D00' : '#0A0A0A';
      panel(x + 32 + j * (bw + 12), base - 150 * v, bw, 150 * v, 5);
      ctx.fill();
    });
  } else if (i === 3) {
    ctx.fillStyle = '#0A0A0A';
    ctx.beginPath();
    ctx.arc(x + cw * 0.27, y + ch * 0.43, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + cw * 0.73, y + ch * 0.43, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FF4D00';
    ctx.beginPath();
    ctx.arc(x + cw * 0.5, y + ch * 0.61, 20, 0, Math.PI * 2);
    ctx.fill();
  } else if (i === 4) {
    const img = api.img('city');
    if (img) cover(img, x, y, cw, ch, 1.04);
    ctx.fillStyle = 'rgba(10,10,10,0.28)';
    ctx.fillRect(x, y, cw, ch);
    ctx.fillStyle = '#F7F3EB';
    ctx.font = fontPx(ch * 0.25);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('after dark', x + cw / 2, y + ch * 0.52);
  } else {
    const img = api.img('nature');
    if (img) cover(img, x, y, cw, ch, 1.04);
    ctx.fillStyle = 'rgba(10,10,10,0.12)';
    ctx.fillRect(x, y, cw, ch);
    ctx.fillStyle = '#F7F3EB';
    ctx.font = fontPx(ch * 0.25);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N O R T H', x + cw / 2, y + ch * 0.52);
  }
  ctx.restore();
}
ctx.restore();
