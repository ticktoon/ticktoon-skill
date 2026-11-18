/* @ticktoon-ref-shot
{
  "title": "逐字砸入",
  "note": "大字占满画面，四拍逐字砸入；适合口号或结论",
  "duration": 1.858,
  "tags": [
    "大字",
    "逐字",
    "硬切"
  ],
  "resources": [
    {
      "type": "font",
      "name": "sans-400"
    },
    {
      "type": "font",
      "name": "DouYinMeiHaoTi"
    }
  ]
}
*/
// 示例 · 4 拍：逐字砸入，字占画面。
const T = api.t;
const W = api.W;
const H = api.H;
ctx.fillStyle = '#0A0A0A'; ctx.fillRect(0, 0, W, H);
const S = '#FFFFFF';
const A = '#FF4D00';
const L = '#12305C';
const M = '#8A8A8A';
const B = '#0A0A0A';

// 固定种子的右侧半调点阵；每帧结果一致，不使用随机数。
const hash = (index) => {
  const value = Math.sin(index * 127.1 + 311.7 + 17.17) * 43758.5453;
  return value - Math.floor(value);
};
const dotX = W * 0.62;
const dotW = W * 0.38;
const cols = Math.ceil(dotW / 20);
const rows = Math.ceil(H / 20);
ctx.save();
ctx.globalAlpha *= 0.16;
ctx.fillStyle = B;
ctx.fillRect(dotX, 0, dotW, H);
ctx.fillStyle = A;
for (let row = 0; row < rows; row += 1) {
  for (let col = 0; col < cols; col += 1) {
    const radius = 7 * (0.18 + 0.82 * hash(row * cols + col));
    ctx.beginPath();
    ctx.arc(dotX + (col + 0.5) * 20, (row + 0.5) * 20, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
ctx.restore();

// 量测整行后按实际字宽排布，第三字保持橙色。
let size = 24;
for (let px = 380; px >= 24; px -= 2) {
  ctx.font = TT.font(FONTS, px, 'DouYinMeiHaoTi').css;
  if (ctx.measureText('万物皆动').width <= W * 0.88) {
    size = px;
    break;
  }
}
const chars = Array.from('万物皆动');
const colors = [S, S, A, S];
ctx.save();
ctx.font = TT.font(FONTS, size, 'DouYinMeiHaoTi').css;
const widths = chars.map((ch) => ctx.measureText(ch).width);
const total = widths.reduce((sum, width) => sum + width, 0);
let cursor = W * 0.5 - total / 2;
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
const prevTextInternal = ctx.__ttTextInternal;
ctx.__ttTextInternal = true;
chars.forEach((ch, i) => {
  const p = TT.clamp01((T - i * 0.09) / 0.34);
  if (p > 0) {
    const e = TT.ease.back(1.9)(p);
    const scale = 2.1 + (1 - 2.1) * e;
    ctx.save();
    ctx.globalAlpha *= Math.min(1, p * 2.4);
    ctx.translate(cursor + widths[i] / 2, H * 0.5);
    ctx.scale(scale, scale);
    ctx.fillStyle = colors[i];
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  }
  cursor += widths[i];
});
ctx.__ttTextInternal = prevTextInternal;
ctx.restore();
ctx.save();
ctx.font = TT.font(FONTS, size, 'DouYinMeiHaoTi').css;
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
TT.text.record(ctx, '万物皆动', W * 0.5, H * 0.5);
ctx.restore();

TT.text(ctx, '01 / 09', W * 0.04, H * 0.08, 22, {
  fontKey: 'sans-400', color: M,
});
TT.text(ctx, 'EVERY = 1 FOOTNOTE = 1/5', W * 0.96, H * 0.08, 18, {
  fontKey: 'sans-400', color: M, align: 'right',
});
TT.text(ctx, '129.2 BPM', W * 0.04, H * 0.94, 18, {
  fontKey: 'sans-400', color: L,
});
const barX = W * 0.04;
const barY = H * 0.955;
const barW = W * 0.18;
ctx.save();
ctx.globalAlpha *= 0.28;
ctx.fillStyle = L;
ctx.fillRect(barX, barY, barW, 4);
ctx.restore();
ctx.fillStyle = A;
ctx.fillRect(barX, barY, barW * 0.2, 4);

const vx = W * 0.025;
const vy = H * 0.025;
const vw = W * 0.95;
const vh = H * 0.95;
ctx.save();
ctx.globalAlpha *= 0.7;
ctx.strokeStyle = M;
ctx.lineWidth = 1;
[
  [vx, vy, 1, 1],
  [vx + vw, vy, -1, 1],
  [vx, vy + vh, 1, -1],
  [vx + vw, vy + vh, -1, -1],
].forEach(([x, y, dx, dy]) => {
  ctx.beginPath();
  ctx.moveTo(x + dx * 26, y);
  ctx.lineTo(x, y);
  ctx.lineTo(x, y + dy * 26);
  ctx.stroke();
});
ctx.restore();
