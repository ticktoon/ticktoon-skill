/* @ticktoon-ref-shot
{
  "title": "跨镜色块",
  "note": "单拍；跨场延续色块，用 GO! 做刺点",
  "duration": 0.464,
  "tags": [
    "色块",
    "刺点",
    "跨镜"
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
// 示例 · 1 拍：跨镜色块 + GO! 刺点。
const T = api.t;
const W = api.W;
const H = api.H;
ctx.fillStyle = '#12305C'; ctx.fillRect(0, 0, W, H);
const S = '#FFFFFF';
const A = '#FF4D00';
const M = '#8A8A8A';

// 橙色圆从跨镜锚点扩到整屏，保留原来的 outCubic 节奏。
const wipe = TT.ease.outCubic(TT.clamp01(T / 0.22));
const ox = W * 0.5;
const oy = H * 0.55;
const maxR = Math.hypot(Math.max(ox, W - ox), Math.max(oy, H - oy));
ctx.fillStyle = A;
ctx.beginPath();
ctx.arc(ox, oy, maxR * wipe, 0, Math.PI * 2);
ctx.fill();

// 从 520px 向下量测，逐字缩放弹入。
let size = 24;
for (let px = 520; px >= 24; px -= 2) {
  ctx.font = TT.font(FONTS, px, 'sans-900').css;
  if (ctx.measureText('GO!').width <= W * 0.52) {
    size = px;
    break;
  }
}
const chars = Array.from('GO!');
ctx.save();
ctx.font = TT.font(FONTS, size, 'sans-900').css;
const widths = chars.map((ch) => ctx.measureText(ch).width);
const total = widths.reduce((sum, width) => sum + width, 0);
let cursor = W * 0.5 - total / 2;
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillStyle = S;
const prevTextInternal = ctx.__ttTextInternal;
ctx.__ttTextInternal = true;
chars.forEach((ch, i) => {
  const p = TT.clamp01((T - i * 0.02) / 0.14);
  if (p > 0) {
    const e = TT.ease.back(1.9)(p);
    const scale = 2.6 + (1 - 2.6) * e;
    ctx.save();
    ctx.globalAlpha *= Math.min(1, p * 2.4);
    ctx.translate(cursor + widths[i] / 2, H * 0.5);
    ctx.scale(scale, scale);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  }
  cursor += widths[i];
});
ctx.__ttTextInternal = prevTextInternal;
ctx.restore();
ctx.save();
ctx.font = TT.font(FONTS, size, 'sans-900').css;
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
TT.text.record(ctx, 'GO!', W * 0.5, H * 0.5);
ctx.restore();

TT.text(ctx, '07 / 09 — STINGER', W * 0.04, H * 0.08, 18, {
  fontKey: 'sans-400', color: S,
});

// 四角取景框与 REC 同为 0.8 透明度。
const vx = W * 0.025;
const vy = H * 0.025;
const vw = W * 0.95;
const vh = H * 0.95;
ctx.save();
ctx.globalAlpha *= 0.8;
ctx.strokeStyle = S;
ctx.lineWidth = 2;
[
  [vx, vy, 1, 1],
  [vx + vw, vy, -1, 1],
  [vx, vy + vh, 1, -1],
  [vx + vw, vy + vh, -1, -1],
].forEach(([x, y, dx, dy]) => {
  ctx.beginPath();
  ctx.moveTo(x + dx * 30, y);
  ctx.lineTo(x, y);
  ctx.lineTo(x, y + dy * 30);
  ctx.stroke();
});
const recX = vx + vw - 26;
const recY = vy + 26;
ctx.fillStyle = A;
ctx.beginPath();
ctx.arc(recX, recY, 5, 0, Math.PI * 2);
ctx.fill();
TT.text(ctx, 'REC', recX - 12, recY, 14, {
  fontKey: 'sans-400', color: S, align: 'right', baseline: 'middle',
});
ctx.restore();

TT.text(ctx, 'HALF BEAT / 0.2322s', W * 0.04, H * 0.94, 16, {
  fontKey: 'sans-400', color: M,
});
