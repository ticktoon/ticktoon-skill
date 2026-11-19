/**
 * bar-race —— 竖屏竞速排行榜。
 * params 只提供标题、来源、年份、榜单项与可选品牌；排序、颜色、插值和镜头全部固定。
 */
const { font, clamp01, ease } = TT;

const C = {
  bg: '#0E1014', ink: '#F4F6FA', muted: '#A4ABB7', faint: '#697586',
  blue: '#1976ED', blueFade: 'rgba(25,117,237,0.28)', blueBar1: '#D2E3F4', blueBar2: '#1976ED',
};
const PALETTE = [
  '#67D5BE', '#F39ABB', '#82D9F2', '#B6A5F5', '#7BD6C2', '#B9E866',
  '#FFD07A', '#B9A7F7', '#7EDBB3', '#F59AA5', '#F5B679', '#83D4C4',
  '#F59A91', '#B2A0F2', '#FFD07A', '#B7A3F2', '#FFCF7D', '#82B9F2',
];
const lerp = (a, b, k) => a + (b - a) * k;
const hash = (n) => {
  let h = Math.imul((n | 0) ^ 0x9E3779B9, 0x85EBCA6B);
  h ^= h >>> 13;
  h = Math.imul(h, 0x27D4EB2F);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const roundRect = (ctx, x, y, w, h, r) => {
  const radius = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.arcTo(x + w - radius, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
};
const skewX = (ctx, cx, cy, deg) => {
  const k = Math.tan(-deg * Math.PI / 180);
  ctx.translate(cx, cy);
  ctx.transform(1, 0, k, 1, 0, 0);
  ctx.translate(-cx, -cy);
};
const textWidth = (ctx, text) => ctx.measureText(text).width;
const fitFont = (ctx, text, key, desired, maxWidth, fonts, min = 16) => {
  let size = Math.max(min, Math.round(desired));
  for (let i = 0; i < 24; i += 1) {
    const f = font(fonts, size, key);
    ctx.font = f.css;
    if (textWidth(ctx, text) <= maxWidth) return f;
    const next = Math.max(min, Math.floor(size * Math.min(0.94, maxWidth / Math.max(1, textWidth(ctx, text)))));
    if (next === size) return f;
    size = next;
  }
  return font(fonts, min, key);
};
const fmt = (value) => {
  const n = Math.max(0, Number(value) || 0);
  return `${n.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1').replace(/\B(?=(\d{3})+(?!\d))/g, ',')}亿`;
};
const fmtAxis = (value) => `${Math.round(value).toLocaleString('en-US')}亿`;

function paintBackground(ctx, W, H, t, a) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.25, H * 0.1, 0, W * 0.25, H * 0.1, W * 0.9);
  glow.addColorStop(0, 'rgba(53,68,88,0.28)');
  glow.addColorStop(1, 'rgba(14,16,20,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 320; i += 1) {
    const x = hash(i * 13 + 2) * W;
    const y = hash(i * 17 + 7) * H;
    const r = 0.5 + hash(i * 19 + 3) * 2.2;
    ctx.fillStyle = `rgba(197,205,214,${0.012 + hash(i * 23) * 0.024})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function paintBanner(ctx, title, t, fonts, W, H) {
  const f = fitFont(ctx, title, 'sans-900', 66, W * 0.78, fonts, 28);
  const textH = f.size;
  const textW = textWidth(ctx, title);
  const cx = W / 2;
  const cy = H * 0.135;
  const barPadX = 28;
  const barPadY = 18;
  const left = cx - textW / 2 - barPadX;
  const right = cx + textW / 2 + textW * 0.3;
  const top = cy - textH / 2 - barPadY;
  const bottom = cy + textH / 2 + barPadY;
  const enter = ease.outCubic(clamp01(t / 0.6));
  ctx.save();
  ctx.globalAlpha *= enter;
  ctx.translate(-60 * (1 - enter), 0);
  ctx.translate(cx, cy);
  ctx.scale(0.7 + 0.3 * enter, 0.9 + 0.1 * enter);
  ctx.translate(-cx, -cy);

  // 倾斜菱形主条与左侧独立斜条保留明确间距，不添加额外装饰。
  ctx.save();
  skewX(ctx, (left + right) / 2, (top + bottom) / 2, 12);
  const grad = ctx.createLinearGradient(left, 0, right, 0);
  grad.addColorStop(0, C.blue);
  grad.addColorStop(0.85, C.blueFade);
  grad.addColorStop(1, 'rgba(25,117,237,0)');
  ctx.fillStyle = grad;
  roundRect(ctx, left, top, right - left, bottom - top, 2);
  ctx.fill();
  ctx.restore();

  const accentW = 10;
  const accentX = left - 18;
  ctx.save();
  skewX(ctx, accentX + accentW / 2, (top + bottom) / 2, 12);
  const ag = ctx.createLinearGradient(0, top, 0, bottom);
  ag.addColorStop(0, C.blueBar1);
  ag.addColorStop(1, C.blueBar2);
  ctx.fillStyle = ag;
  roundRect(ctx, accentX, top, accentW, bottom - top, 2);
  ctx.fill();
  ctx.restore();

  ctx.font = f.css;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.ink;
  let x = cx - textW / 2;
  const chars = [...title];
  const stagger = Math.min(0.035, 0.32 / Math.max(1, chars.length - 1));
  for (let i = 0; i < chars.length; i += 1) {
    const p = ease.outCubic(clamp01((t - 0.12 - i * stagger) / 0.32));
    if (p <= 0) continue;
    const w = textWidth(ctx, chars[i]);
    ctx.save();
    ctx.globalAlpha *= p;
    ctx.fillText(chars[i], x + 120 * (1 - p), cy + (f.ascent - f.descent) / 2);
    ctx.restore();
    x += w;
  }
  ctx.restore();
}

function paintBars(ctx, p, g, fonts, W, H) {
  const items = Array.isArray(p.items) ? p.items : [];
  if (!items.length) return;
  const t = g.t;
  const duration = Math.max(0.1, g.dur - 1.4);
  const q = ease.inOutCubic(clamp01((t - 0.6) / duration));
  const maxValue = Math.max(1, ...items.map((item) => Math.abs(Number(item.end) || 0)));
  const valueAt = (item, time) => {
    const k = ease.inOutCubic(clamp01((time - 0.6) / duration));
    return lerp(Number(item.start) || 0, Number(item.end) || 0, k);
  };
  const rankAt = (time) => {
    const order = items.map((item, index) => ({ index, value: valueAt(item, time) }))
      .sort((a, b) => b.value - a.value || a.index - b.index);
    const ranks = new Map();
    order.forEach((entry, rank) => ranks.set(entry.index, rank));
    return ranks;
  };
  const step = 0.38;
  const start = Math.max(0, Math.floor(t / step) * step);
  const end = Math.min(g.dur, start + step);
  const fromRanks = rankAt(start);
  const toRanks = rankAt(end);
  const moveP = ease.outCubic(clamp01((t - start) / step));
  const rowH = Math.min(100, H * 0.50 / items.length);
  const top = H * 0.25;
  const labelSize = Math.min(30, rowH * 0.32);
  const valueSize = Math.min(24, rowH * 0.28);

  // 名称列和数值列按整组最长文本预留，避免换数时挤压条形或越出右边界。
  ctx.save();
  ctx.font = font(fonts, labelSize, 'sans-400').css;
  const labelW = Math.min(180, Math.max(64, ...items.map((item) => textWidth(ctx, String(item.label)))));
  ctx.font = font(fonts, valueSize, 'sans-400').css;
  const valueW = Math.max(72, ...items.map((item) => textWidth(ctx, fmt(item.end))));
  ctx.restore();
  const x = 42 + labelW + 18;
  const maxBar = Math.max(120, W - x - valueW - 54);
  const axisRight = x + maxBar;

  ctx.save();
  ctx.textBaseline = 'middle';
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const rank = lerp(fromRanks.get(i), toRanks.get(i), moveP);
    const y = top + rank * rowH + rowH / 2;
    const color = PALETTE[i % PALETTE.length];
    const value = valueAt(item, t);
    const width = Math.max(2, Math.min(maxBar, value / maxValue * maxBar));
    const gradient = ctx.createLinearGradient(x, 0, x + width, 0);
    gradient.addColorStop(0, `${color}66`);
    gradient.addColorStop(1, color);
    ctx.fillStyle = gradient;
    roundRect(ctx, x, y - rowH * 0.27, width, rowH * 0.54, 4);
    ctx.fill();

    ctx.font = fitFont(ctx, String(item.label), 'sans-400', labelSize, labelW, fonts, 12).css;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.fillText(String(item.label), 42, y + 1);
    ctx.font = font(fonts, valueSize, 'sans-400').css;
    ctx.fillText(fmt(value), x + width + 14, y + 1);
  }
  ctx.restore();

  // 底部横轴与均分刻度。
  const axisY = H * 0.79;
  ctx.save();
  ctx.strokeStyle = 'rgba(190,200,214,0.34)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, axisY);
  ctx.lineTo(axisRight, axisY);
  ctx.stroke();
  ctx.font = font(fonts, 24, 'sans-400').css;
  ctx.fillStyle = C.faint;
  ctx.textAlign = 'center';
  for (let i = 0; i <= 4; i += 1) {
    const tx = x + (axisRight - x) * i / 4;
    ctx.fillText(fmtAxis(maxValue * i / 4), tx, axisY + 46);
  }
  ctx.restore();

  // 大年份、倒影和品牌都在右下固定区，不参与条形排序。
  const year = Math.round(lerp(Number(p.startYear), Number(p.endYear), q));
  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.ink;
  ctx.font = fitFont(ctx, String(year), 'sans-900', 174, W * 0.52, fonts, 64).css;
  ctx.fillText(String(year), W - 60, H * 0.865);
  ctx.globalAlpha = 0.22;
  ctx.translate(W - 60, H * 0.925);
  ctx.scale(1, -1);
  ctx.fillText(String(year), 0, 0);
  ctx.restore();
  if (p.brand) {
    ctx.save();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.muted;
    ctx.font = fitFont(ctx, String(p.brand), 'sans-400', 54, W * 0.6, fonts, 24).css;
    ctx.fillText(String(p.brand), W - 62, H * 0.965);
    ctx.restore();
  }
}

function draw(g, p) {
  const { ctx, W, H, fonts } = g;
  const t = g.t;
  ctx.save();
  paintBackground(ctx, W, H, t, g.a);
  ctx.globalAlpha = g.a;
  paintBanner(ctx, String(p.title || '竞速排行榜'), t, fonts, W, H);
  ctx.font = fitFont(ctx, String(p.source || ''), 'sans-400', 28, W * 0.84, fonts, 18).css;
  ctx.fillStyle = C.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(p.source || ''), W / 2, H * 0.205);
  paintBars(ctx, p, g, fonts, W, H);
  ctx.restore();
}
