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
  "resources": [
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
// 示例 · 4 拍：故障收尾，字最大、信息最少。
const T = api.t;
const W = api.W;
const H = api.H;
ctx.fillStyle = '#0A0A0A'; ctx.fillRect(0, 0, W, H);
const S = '#FFFFFF';
const A = '#FF4D00';
const L = '#12305C';
const M = '#8A8A8A';
// 固定哈希让半调颗粒与故障切片逐帧可复现。
const hash = (index, seed = 0) => {
  const value = Math.sin(index * 127.1 + seed * 311.7 + 17.17) * 43758.5453;
  return value - Math.floor(value);
};

// 下半屏橙色半调，黑点尺寸沿用原构图的随机分布。
const dotY = H * 0.66;
const dotH = H * 0.34;
const dotGap = 22;
const cols = Math.ceil(W / dotGap);
const rows = Math.ceil(dotH / dotGap);
ctx.save();
ctx.globalAlpha = 0.12;
ctx.fillStyle = '#0A0A0A';
ctx.fillRect(0, dotY, W, dotH);
ctx.fillStyle = A;
for (let row = 0; row < rows; row += 1) {
  for (let col = 0; col < cols; col += 1) {
    const radius = 7 * (0.18 + 0.82 * hash(row * cols + col, 9));
    ctx.beginPath();
    ctx.arc((col + 0.5) * dotGap, dotY + (row + 0.5) * dotGap, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
ctx.restore();

// 从最大字号向下测量，保持 DO IT. 占据原有意图宽度。
const title = 'DO IT.';
let size = 24;
for (let px = 360; px >= 24; px -= 2) {
  ctx.font = TT.font(FONTS, px, 'sans-900').css;
  if (ctx.measureText(title).width <= W * 0.8) {
    size = px;
    break;
  }
}
const font = TT.font(FONTS, size, 'sans-900');
const chars = Array.from(title);
ctx.font = font.css;
const widths = chars.map((ch) => ctx.measureText(ch).width);
const total = widths.reduce((sum, width) => sum + width, 0);
const pad = Math.max(12, size * 0.18);
const typeW = Math.ceil(total + pad * 2);
const typeH = Math.ceil(font.ascent + font.descent + pad * 2);
const anchorX = typeW / 2;
const anchorY = typeH / 2;

// 单字独立上色；描边只加粗字口，维持原故障大字的重量。
const type = api.canvas(typeW, typeH);
const typeCtx = type.ctx;
typeCtx.font = font.css;
typeCtx.textAlign = 'center';
typeCtx.textBaseline = 'middle';
typeCtx.lineWidth = size * 0.03;
typeCtx.lineJoin = 'round';
typeCtx.miterLimit = 2;
let cursor = pad;
for (let i = 0; i < chars.length; i += 1) {
  const color = i === 3 ? A : S;
  const x = cursor + widths[i] / 2;
  typeCtx.fillStyle = color;
  typeCtx.strokeStyle = color;
  typeCtx.fillText(chars[i], x, anchorY);
  typeCtx.strokeText(chars[i], x, anchorY);
  cursor += widths[i];
}

// 两段时间窗口内切成十二条并横向错位，窗口外恢复干净字面。
const q = TT.clamp01(T / api.d);
let burst = 0;
for (const [at, width] of [[0.28, 0.09], [0.66, 0.07]]) {
  burst = Math.max(burst, 1 - Math.abs(q - at) / width);
}
burst = TT.clamp01(burst);
if (burst > 0) {
  const snap = api.canvas(typeW, typeH);
  snap.ctx.drawImage(type.canvas, 0, 0, typeW, typeH);
  const px = snap.canvas.width / typeW;
  const py = snap.canvas.height / typeH;
  typeCtx.clearRect(0, 0, typeW, typeH);
  for (let i = 0; i < 12; i += 1) {
    const sy = (i / 12) * typeH;
    const sh = Math.max(1, typeH / 12 * (0.4 + hash(i, 9) * 0.8));
    const dx = (hash(i + 5, 9) - 0.5) * size * 0.28 * burst;
    typeCtx.drawImage(snap.canvas, 0, sy * py, typeW * px, sh * py, dx, sy, typeW, sh);
  }
}
ctx.drawImage(type.canvas, W * 0.5 - anchorX, H * 0.5 - anchorY, typeW, typeH);

// 四角取景框与满格收尾进度条。
const frameX = W * 0.025;
const frameY = H * 0.025;
const frameW = W * 0.95;
const frameH = H * 0.95;
ctx.save();
ctx.globalAlpha = 0.7;
ctx.strokeStyle = M;
ctx.lineWidth = 1;
for (const [x, y, dx, dy] of [
  [frameX, frameY, 1, 1],
  [frameX + frameW, frameY, -1, 1],
  [frameX, frameY + frameH, 1, -1],
  [frameX + frameW, frameY + frameH, -1, -1],
]) {
  ctx.beginPath();
  ctx.moveTo(x + dx * 28, y);
  ctx.lineTo(x, y);
  ctx.lineTo(x, y + dy * 28);
  ctx.stroke();
}
ctx.fillStyle = M;
ctx.globalAlpha = 0.7 * 0.28;
ctx.fillRect(W * 0.04, H * 0.93, W * 0.92, 4);
ctx.globalAlpha = 0.7;
ctx.fillStyle = A;
ctx.fillRect(W * 0.04, H * 0.93, W * 0.92, 4);
TT.text(ctx, '09 / 09 — END', W * 0.04, H * 0.08, 20, {
  color: S, align: 'left', baseline: 'middle', fontKey: 'sans-400',
});
TT.text(ctx, 'EVERY = 1 FOOTNOTE = 1/5', W * 0.96, H * 0.08, 16, {
  color: M, align: 'right', baseline: 'middle', fontKey: 'sans-400',
});
ctx.restore();
TT.text(ctx, 'DONE / 09', W * 0.04, H * 0.955, 16, {
  color: M, align: 'left', baseline: 'alphabetic', fontKey: 'sans-400',
});
