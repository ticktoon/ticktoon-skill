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

function roundedPath(x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function cover(source, x, y, w, h) {
  if (!source) return;
  const sw = source.videoWidth || source.naturalWidth || source.width || 0;
  const sh = source.videoHeight || source.naturalHeight || source.height || 0;
  if (sw <= 0 || sh <= 0) return;
  const scale = Math.max(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(source, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

TT.text(ctx, '08 / 09 — FOUR CARDS', W * 0.04, H * 0.08, 20, {
  color: M, align: 'left', baseline: 'alphabetic', fontKey: 'sans-400',
});

const box = { x: W * 0.06, y: H * 0.13, w: W * 0.88, h: H * 0.74 };
const proportions = [
  [0.00, 0.000, 0.44, 1.000],
  [0.46, 0.000, 0.25, 0.478],
  [0.73, 0.000, 0.27, 0.478],
  [0.46, 0.522, 0.54, 0.478],
];
const cells = [
  { source: api.video('city'), label: 'CITY / 01', labelColor: S },
  { color: S, text: 'RUN', textColor: B, textSize: 132, label: 'MOVE / 02', labelColor: B },
  { color: L, text: '01', textColor: S, textSize: 100 },
  { color: A, text: 'GO', textColor: S, textSize: 136, label: 'MOVE / 04', labelColor: S },
];

for (let i = 0; i < cells.length; i += 1) {
  const p = TT.clamp01((T - i * 0.08) / 0.38);
  if (p <= 0) continue;
  const e = TT.ease.outCubic(p);
  const scale = 0.9 + 0.1 * e;
  const [px, py, pw, ph] = proportions[i];
  const x = box.x + px * box.w;
  const y = box.y + py * box.h;
  const w = pw * box.w;
  const h = ph * box.h;
  const cell = cells[i];

  ctx.save();
  ctx.globalAlpha *= Math.min(1, p * 3.4);
  ctx.translate(x + w / 2, y + h / 2 + 36 * (1 - e));
  ctx.scale(scale, scale);
  ctx.translate(-(x + w / 2), -(y + h / 2));
  ctx.beginPath();
  roundedPath(x, y, w, h, 22);
  ctx.clip();
  ctx.fillStyle = cell.color || A;
  ctx.fillRect(x, y, w, h);
  cover(cell.source, x, y, w, h);
  if (cell.text) {
    TT.text(ctx, cell.text, x + w / 2, y + h / 2, cell.textSize, {
      color: cell.textColor, align: 'center', baseline: 'middle', fontKey: 'sans-900',
    });
  }
  if (cell.label) {
    const labelSize = Math.max(9, Math.min(h * 0.08, 28));
    TT.text(ctx, cell.label, x + 14, y + 14 + labelSize * 0.8, labelSize, {
      color: cell.labelColor, align: 'left', baseline: 'alphabetic', fontKey: 'sans-400',
    });
  }
  ctx.restore();
}

// 固定取景框不参与卡片入场，四角与中心十字始终保持清晰。
const vx = W * 0.025;
const vy = H * 0.025;
const vw = W * 0.95;
const vh = H * 0.95;
ctx.save();
ctx.globalAlpha *= 0.6;
ctx.strokeStyle = M;
ctx.lineWidth = 1;
const corners = [
  [vx, vy, 1, 1],
  [vx + vw, vy, -1, 1],
  [vx, vy + vh, 1, -1],
  [vx + vw, vy + vh, -1, -1],
];
for (const [x, y, dx, dy] of corners) {
  ctx.beginPath();
  ctx.moveTo(x + dx * 22, y);
  ctx.lineTo(x, y);
  ctx.lineTo(x, y + dy * 22);
  ctx.stroke();
}
const cx = vx + vw / 2;
const cy = vy + vh / 2;
ctx.beginPath();
ctx.moveTo(cx - 18, cy);
ctx.lineTo(cx + 18, cy);
ctx.moveTo(cx, cy - 18);
ctx.lineTo(cx, cy + 18);
ctx.stroke();
ctx.restore();

TT.text(ctx, 'FOUR CARDS / ONE GRID', W * 0.04, H * 0.93, 16, {
  color: S, align: 'left', baseline: 'alphabetic', fontKey: 'sans-400',
});
TT.text(ctx, 'NO SAME SIZE TWICE', W * 0.96, H * 0.93, 14, {
  color: M, align: 'right', baseline: 'alphabetic', fontKey: 'sans-400',
});
