/* @ticktoon-ref-shot
{
  "title": "波形大字",
  "note": "三拍；波形与大字同屏，后半拍换橙，适合节奏点",
  "duration": 1.393,
  "tags": [
    "波形",
    "大字",
    "节奏"
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
// 示例 · 3 拍：波形 + 大字，后半拍换橙。
const T = api.t;
const W = api.W;
const H = api.H;
ctx.fillStyle = '#0A0A0A'; ctx.fillRect(0, 0, W, H);
const S = '#FFFFFF';
const A = '#FF4D00';
const M = '#8A8A8A';

// 64 根镜像波形条由索引、固定种子和时间决定，不保存历史状态。
const hash = (index) => {
  const value = Math.sin(index * 127.1 + 5 * 311.7 + 17.17) * 43758.5453;
  return value - Math.floor(value);
};
function drawWave(amplitude, speed, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  for (let i = 0; i < 64; i += 1) {
    const phase = i * 0.42 + T * speed * Math.PI * 2 + hash(i) * Math.PI * 2;
    const envelope = 0.35 + 0.65 * hash(i + 13);
    const height = amplitude * envelope * (0.18 + 0.82 * Math.abs(Math.sin(phase)));
    const x = W * 0.06 + i * (W * 0.88 / 64);
    ctx.fillRect(x, H * 0.7 - height, 9, height);
    ctx.fillRect(x, H * 0.7, 9, height * 0.72);
  }
  ctx.restore();
}
drawWave(H * 0.11, 1.4, S);
if (T > 0.7) drawWave(H * 0.055, 1.8, A, 0.5);

// 大字按 0.05s 间隔上移并缩回，第三字固定为橙色。
let size = 24;
for (let px = 420; px >= 24; px -= 2) {
  ctx.font = TT.font(FONTS, px, 'sans-900').css;
  if (ctx.measureText('BASS').width <= W * 0.66) {
    size = px;
    break;
  }
}
const chars = Array.from('BASS');
const colors = [S, S, A, S];
ctx.save();
ctx.font = TT.font(FONTS, size, 'sans-900').css;
const widths = chars.map((ch) => ctx.measureText(ch).width);
const total = widths.reduce((sum, width) => sum + width, 0);
let cursor = W * 0.5 - total / 2;
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
const prevTextInternal = ctx.__ttTextInternal;
ctx.__ttTextInternal = true;
chars.forEach((ch, i) => {
  const p = TT.clamp01((T - i * 0.05) / 0.22);
  if (p > 0) {
    const e = TT.ease.back(1.9)(p);
    const scale = 1.8 + (1 - 1.8) * e;
    const dy = size * 0.24 * (1 - e);
    ctx.save();
    ctx.globalAlpha *= Math.min(1, p * 2.4);
    ctx.translate(cursor + widths[i] / 2, H * 0.36 + dy);
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
ctx.font = TT.font(FONTS, size, 'sans-900').css;
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
TT.text.record(ctx, 'BASS', W * 0.5, H * 0.36);
ctx.restore();

TT.text(ctx, '06 / 09 — BASS', W * 0.04, H * 0.08, 20, {
  fontKey: 'sans-400', color: M,
});
TT.text(ctx, '129.2 BPM / 0.4644s', W * 0.96, H * 0.08, 16, {
  fontKey: 'sans-400', color: A, align: 'right',
});
TT.text(ctx, 'LOW END', W * 0.04, H * 0.93, 16, {
  fontKey: 'sans-400', color: S,
});
