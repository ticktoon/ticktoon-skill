/* @ticktoon-ref-shot
{
  "title": "代码编辑器实时预览",
  "note": "逐字输入代码，右侧公式同步运动，行号、光标和状态栏共用状态",
  "duration": 2.322,
  "bg": "#0E1014",
  "thumbTime": 1.8,
  "tags": [
    "代码",
    "打字",
    "实时预览"
  ],
  "resources": []
}
*/
// 示例 · 5 拍：代码逐字输入，公式预览同步运动。
ctx.save();
const W = api.W;
const H = api.H;
const t = api.t;
const C = {
  bg: '#0E1014', win: '#15171C', bar: '#1B1E24', side: '#12141A',
  ink: '#D7DAE0', dim: '#4D5560', active: '#CFD6E0', mute: '#7F8792',
  kd: '#C792EA', fn: '#82AAFF', num: '#F78C6C', str: '#C3E88D',
};
const CODE = [
  [['function ', C.kd], ['renderFrame', C.fn], ['(t) {', C.ink]],
  [['  const r = ', C.ink], ['110', C.num], [' + ', C.ink], ['22', C.num], [' * Math.sin(t * 2);', C.ink]],
  [['  const x = cx + r * Math.cos(t * 3);', C.ink]],
  [['  const y = cy + r * Math.sin(t * 6) * 0.55;', C.ink]],
  [['  ctx.fillStyle = ', C.ink], ['`hsl(${t * 60 % 360} 85% 62%)`', C.str], [';', C.ink]],
  [['  ctx.arc(x, y, ', C.ink], ['20', C.num], [', 0, Math.PI * 2);', C.ink]],
  [['  ctx.fill();', C.ink]],
  [['}', C.ink]],
];
const FILES = ['renderFrame.js', 'palette.js', 'index.html', 'fonts/', 'audio/', 'README.md'];
const ex = W * 0.05;
const ey = H * 0.107;
const ew = W * 0.9;
const eh = H - W * 0.1 - 20;
const barH = 56;
const sideW = Math.min(260, ew * 0.18);
const codeX = ex + sideW + 34;
const codeY = ey + 104;
const lh = 46;
const codeFont = '26px monospace';
const pvW = Math.min(440, ew * 0.27);
const pvH = pvW * 0.78;
const pvX = ex + ew - pvW - 36;
const pvY = codeY - 6;

ctx.fillStyle = C.bg;
ctx.fillRect(0, 0, W, H);

// 每帧重建字符偏移；唯一字符只测量一次，比例字体也不会错位。
ctx.save();
ctx.font = codeFont;
const widths = new Map();
const charW = (ch) => {
  if (!widths.has(ch)) widths.set(ch, ctx.measureText(ch).width);
  return widths.get(ch);
};
const rows = CODE.map((line) => {
  let x = 0;
  const row = [];
  line.forEach(([text, color]) => {
    for (const ch of text) {
      const w = charW(ch);
      row.push({ ch, color, x, w });
      x += w;
    }
  });
  return row;
});
ctx.restore();
const total = rows.reduce((n, row) => n + row.length, 0);

// 窗口外阴影只画这一次。
ctx.save();
ctx.shadowColor = 'rgba(0,0,0,0.55)';
ctx.shadowBlur = 60;
ctx.shadowOffsetY = 24;
ctx.fillStyle = C.win;
ctx.beginPath();
ctx.roundRect(ex, ey, ew, eh, 18);
ctx.fill();
ctx.restore();
ctx.shadowColor = 'transparent';
ctx.shadowBlur = 0;
ctx.shadowOffsetY = 0;
ctx.fillStyle = C.bar;
ctx.beginPath();
ctx.roundRect(ex, ey, ew, barH, [18, 18, 0, 0]);
ctx.fill();
['#FF5F57', '#FEBC2E', '#28C840'].forEach((color, i) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(ex + 28 + i * 24, ey + 28, 8, 0, Math.PI * 2);
  ctx.fill();
});
ctx.fillStyle = '#9AA2AD';
ctx.font = '20px monospace';
ctx.textAlign = 'left';
ctx.textBaseline = 'middle';
ctx.fillText('renderFrame.js — flash-cut', ex + 108, ey + 28);

// 文件树。
ctx.fillStyle = C.side;
ctx.fillRect(ex, ey + barH, sideW, eh - barH);
ctx.font = '20px monospace';
FILES.forEach((file, i) => {
  const y = ey + barH + 32 + i * 40;
  if (i === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(ex, y - 17, sideW, 34);
  }
  ctx.fillStyle = i === 0 ? '#E8EBF0' : '#767D89';
  ctx.fillText(file, ex + 24, y);
});

// 时间 → 整数字符预算；行号、光标和 Ln/Col 共用同一状态。
const p = TT.clamp01((t - 0.25) / 2);
const typed = Math.floor(p * total);
let budget = typed;
let curLine = -1;
let curCol = 0;
let caretX = codeX;
ctx.font = codeFont;
ctx.textAlign = 'left';
ctx.textBaseline = 'middle';
rows.forEach((row, li) => {
  const y = codeY + li * lh;
  const isCurrent = typed > 0 && budget > 0 && budget <= row.length;
  const shown = Math.max(0, Math.min(row.length, budget));
  if (isCurrent) {
    curLine = li;
    curCol = shown;
    const last = row[Math.max(0, shown - 1)];
    caretX = codeX + (last ? last.x + last.w : 0);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(codeX - 62, y - 22, pvX - codeX - 24, 36);
  }
  ctx.fillStyle = isCurrent ? C.active : C.dim;
  ctx.fillText(String(li + 1), codeX - 52, y);
  for (let i = 0; i < shown; i += 1) {
    const g = row[i];
    ctx.fillStyle = g.color;
    ctx.fillText(g.ch, codeX + g.x, y);
  }
  budget -= row.length;
});
if (curLine >= 0 && Math.floor(t * 4) % 2 === 0) {
  ctx.fillStyle = C.ink;
  ctx.fillRect(caretX + 2, codeY + curLine * lh - 16, 3, 30);
}

// 实时预览：公式与上方 CODE 一致，拖尾用回采样，不存历史帧。
ctx.fillStyle = '#0B0D12';
ctx.beginPath();
ctx.roundRect(pvX, pvY, pvW, pvH, 14);
ctx.fill();
ctx.save();
ctx.beginPath();
ctx.roundRect(pvX, pvY, pvW, pvH, 14);
ctx.clip();
ctx.strokeStyle = 'rgba(255,255,255,0.04)';
ctx.lineWidth = 1;
for (let x = pvX; x < pvX + pvW; x += 40) {
  ctx.beginPath();
  ctx.moveTo(x, pvY);
  ctx.lineTo(x, pvY + pvH);
  ctx.stroke();
}
for (let y = pvY; y < pvY + pvH; y += 40) {
  ctx.beginPath();
  ctx.moveTo(pvX, y);
  ctx.lineTo(pvX + pvW, y);
  ctx.stroke();
}
const cx = pvX + pvW / 2;
const cy = pvY + pvH / 2 + 10;
for (let i = 18; i > 0; i -= 1) {
  const tt = t - i * 0.022;
  const r = 110 + 22 * Math.sin(tt * 2);
  const x = cx + r * Math.cos(tt * 3);
  const y = cy + r * Math.sin(tt * 6) * 0.55;
  ctx.fillStyle = `hsla(${(tt * 60) % 360} 85% 62% / ${0.34 * (1 - i / 18) * p})`;
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, Math.PI * 2);
  ctx.fill();
}
const r = 110 + 22 * Math.sin(t * 2);
const x = cx + r * Math.cos(t * 3);
const y = cy + r * Math.sin(t * 6) * 0.55;
ctx.fillStyle = `hsl(${(t * 60) % 360} 85% 62%)`;
ctx.beginPath();
ctx.arc(x, y, 20 * p, 0, Math.PI * 2);
ctx.fill();
ctx.restore();
ctx.fillStyle = 'rgba(215,218,224,0.65)';
ctx.font = '20px monospace';
ctx.textAlign = 'left';
ctx.fillText('PREVIEW', pvX + 22, pvY + 30);

// 状态栏。
ctx.fillStyle = 'rgba(20,22,28,0.92)';
ctx.fillRect(ex, ey + eh - 44, ew, 44);
ctx.fillStyle = C.mute;
ctx.font = '20px monospace';
ctx.fillText(`JS  UTF-8  Ln ${curLine + 1}, Col ${curCol}  spaces: 2  ${api.d.toFixed(1)}s`, ex + 22, ey + eh - 22);
ctx.textAlign = 'right';
ctx.fillText(p < 1 ? 'TYPING…' : 'READY', ex + ew - 22, ey + eh - 22);

ctx.restore();
