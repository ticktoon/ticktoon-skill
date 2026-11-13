/* @ticktoon-ref-shot
{
  "title": "安全感托住目标",
  "note": "孩子、三层蜡笔塔、顶部星形与右侧说明框；演示抽象关系的分层图解",
  "duration": 8,
  "resources": [
    { "type": "font", "name": "ZTZiYouTi" },
    { "type": "font", "name": "sans-900" }
  ],
  "tags": ["蜡笔", "分层", "人物", "文化"]
}
*/
const T = api.t;
const TAU = Math.PI * 2;
const clamp01 = TT.clamp01;
const ease = TT.ease;
const INK = '#3a352d';
const SOFT = '#6c6255';
const RED = '#c9605b';
const PURPLE = '#8f7bc2';
const GREEN = '#7fae8c';
const BLUE = '#5f87a8';
const OCHRE = '#d9a74f';
const prog = (at, dur = 0.6) => ease.inOutCubic(clamp01((T - at) / dur));
const pop = (at, dur = 0.55) => ease.back(1.25)(clamp01((T - at) / dur));
const hash = (i, ch = 0) => {
  let x = (Math.imul(Math.round(i) + 1, 0x9e3779b1) ^ Math.imul(Math.round(ch) + 13, 0x85ebca6b)) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16; return (x >>> 0) / 4294967295;
};
const partial = (pts, p) => {
  if (p <= 0) return [];
  if (p >= 1) return pts;
  let total = 0;
  const lengths = [];
  for (let i = 1; i < pts.length; i += 1) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); lengths.push(l); total += l; }
  let left = total * p;
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i += 1) {
    if (left >= lengths[i - 1]) { out.push(pts[i]); left -= lengths[i - 1]; continue; }
    const q = lengths[i - 1] ? left / lengths[i - 1] : 0;
    out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * q, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * q]);
    break;
  }
  return out;
};
const stroke = (pts, color, width, seed, alpha = 1, progress = 1, wobble = 1.2) => {
  const source = partial(pts, progress);
  if (source.length < 2 || alpha <= 0) return;
  ctx.save(); ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const parent = ctx.globalAlpha;
  for (let pass = 0; pass < 2; pass += 1) {
    ctx.lineWidth = pass ? Math.max(0.8, width * 0.52) : width;
    ctx.globalAlpha = parent * alpha * (pass ? 0.34 : 1); ctx.beginPath();
    source.forEach((p, i) => {
      const amp = wobble * (pass ? 1.6 : 1);
      const x = p[0] + (hash(seed + i, pass ? 6 : 1) - 0.5) * amp;
      const y = p[1] + (hash(seed + i, pass ? 7 : 2) - 0.5) * amp;
      if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  ctx.restore();
};
const ellipse = (cx, cy, rx, ry, seed, n = 56) => {
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const a = TAU * i / n; const r = 1 + (hash(seed + i, 3) - 0.5) * 0.045;
    pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
  }
  return pts;
};
const crayonFill = (pathFn, bbox, color, seed, alpha = 0.5, gap = 8) => {
  if (bbox.w <= 0 || bbox.h <= 0) return;
  ctx.save(); ctx.beginPath(); pathFn(ctx); ctx.clip();
  const parent = ctx.globalAlpha; ctx.fillStyle = color; ctx.globalAlpha = parent * alpha * 0.12; ctx.fillRect(bbox.x, bbox.y, bbox.w, bbox.h);
  const diag = Math.hypot(bbox.w, bbox.h); const count = Math.ceil(diag / gap);
  const cx = bbox.x + bbox.w / 2; const cy = bbox.y + bbox.h / 2;
  ctx.strokeStyle = color; ctx.lineCap = 'round';
  for (let i = -count; i <= count; i += 1) {
    const off = i * gap + (hash(seed + i, 8) - 0.5) * gap * 0.5;
    const px = cx + off * 0.86; const py = cy - off * 0.5;
    ctx.globalAlpha = parent * alpha * (0.35 + hash(seed + i, 9) * 0.42); ctx.lineWidth = 1.4 + hash(seed + i, 10) * 1.7;
    ctx.beginPath(); ctx.moveTo(px - diag * 0.26, py - diag * 0.45); ctx.lineTo(px + diag * 0.26, py + diag * 0.45); ctx.stroke();
  }
  for (let i = 0; i < Math.min(180, Math.floor(bbox.w * bbox.h / 850)); i += 1) {
    ctx.globalAlpha = parent * alpha * (0.08 + hash(seed + i, 11) * 0.18);
    ctx.fillRect(bbox.x + hash(seed + i, 12) * bbox.w, bbox.y + hash(seed + i, 13) * bbox.h, 1.5, 1.5);
  }
  ctx.restore();
};
const text = (value, x, y, size, color = INK, align = 'left', alpha = 1, fontKey = 'ZTZiYouTi', maxWidth) => {
  if (alpha > 0 && value) TT.text(ctx, value, x, y, size, { fontKey, color, align, alpha, maxWidth });
};
const sketchBox = (x, y, w, h, seed, k) => {
  stroke([[x, y], [x + w * 0.4, y - 3], [x + w, y + 2]], INK, 2.6, seed, 0.9, k);
  stroke([[x + w, y], [x + w + 3, y + h * 0.45], [x + w - 1, y + h]], INK, 2.6, seed + 1, 0.9, k);
  stroke([[x + w, y + h], [x + w * 0.5, y + h + 2], [x, y + h]], INK, 2.6, seed + 2, 0.9, k);
  stroke([[x, y + h], [x - 2, y + h * 0.55], [x, y]], INK, 2.6, seed + 3, 0.9, k);
};
const badge = () => {
  const k = prog(0.1, 0.7);
  stroke(ellipse(132, 92, 62, 54, 40), RED, 3.8, 40, 0.85, k);
  text('20%', 132, 91, 40, RED, 'center', prog(0.5, 0.4), 'sans-900');
  text('法则', 132, 119, 19, INK, 'center', prog(0.68, 0.4));
};
const child = (x, y, body, hair, seed, arm, k) => {
  if (k <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(0.92 * Math.max(0.001, k), 0.92 * Math.max(0.001, k)); ctx.globalAlpha *= Math.min(1, k);
  stroke([[-22, -52], [-27, -3], [-40, 0]], BLUE, 9, seed, 0.9);
  stroke([[20, -52], [25, -3], [39, 0]], GREEN, 9, seed + 1, 0.9);
  const torso = (c) => { c.beginPath(); c.moveTo(-42, -130); c.lineTo(42, -130); c.lineTo(34, -48); c.lineTo(-34, -48); c.closePath(); };
  crayonFill(torso, { x: -46, y: -134, w: 92, h: 92 }, body, seed + 2, 0.62, 7);
  stroke([[-42, -130], [-34, -48], [34, -48], [42, -130], [-42, -130]], INK, 3, seed + 3, 0.9);
  const lh = arm === 1 ? [-70, -204] : [-62, -60];
  const rh = arm === 2 ? [70, -204] : [62, -60];
  stroke([[-34, -116], [-56, -88], lh], body, 11, seed + 4, 0.9);
  stroke([[34, -116], [56, -88], rh], body, 11, seed + 5, 0.9);
  const face = (c) => { c.beginPath(); c.ellipse(0, -180, 43, 46, 0, 0, TAU); c.closePath(); };
  crayonFill(face, { x: -46, y: -230, w: 92, h: 100 }, '#edc7a5', seed + 6, 0.34, 9);
  stroke(ellipse(0, -180, 43, 46, seed + 7), INK, 3, seed + 7, 0.9);
  ctx.save(); ctx.globalAlpha *= 0.78; ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(0, -192, 42, Math.PI, TAU); ctx.lineTo(36, -181); ctx.quadraticCurveTo(0, -210, -37, -177); ctx.closePath(); ctx.fill(); ctx.restore();
  for (let i = 0; i < 7; i += 1) stroke([[-35 + i * 11, -202 + (i % 2) * 4], [-28 + i * 9, -216 + (i % 3) * 3]], hair, 5, seed + 20 + i, 0.75);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-13, -179, 2.7, 0, TAU); ctx.arc(13, -179, 2.7, 0, TAU); ctx.fill();
  stroke([[-11, -160], [0, -153], [12, -160]], INK, 2.2, seed + 30, 0.9);
  ctx.restore();
};
const towerLayer = (yBottom, yTop, wBottom, wTop, color, seed, k) => {
  if (k <= 0) return;
  const y = yBottom - (yBottom - yTop) * k;
  const p = (yBottom - y) / (yBottom - yTop);
  const w = wBottom + (wTop - wBottom) * p;
  const path = (c) => { c.beginPath(); c.moveTo(900 - wBottom / 2, yBottom); c.lineTo(900 - w / 2, y); c.lineTo(900 + w / 2, y); c.lineTo(900 + wBottom / 2, yBottom); c.closePath(); };
  if (color) crayonFill(path, { x: 900 - wBottom / 2, y, w: wBottom, h: yBottom - y }, color, seed, 0.55, 8);
  stroke([[900 - wBottom / 2, yBottom], [900 - w / 2, y], [900 + w / 2, y], [900 + wBottom / 2, yBottom]], OCHRE, 4, seed + 1, 0.95, k);
  const levels = Math.max(1, Math.floor((yBottom - y) / 70));
  for (let i = 0; i < levels; i += 1) {
    const y0 = yBottom - (yBottom - y) * i / levels;
    const y1 = yBottom - (yBottom - y) * (i + 1) / levels;
    stroke([[900 - wBottom * 0.42, y0], [900 + w * 0.42, y1]], OCHRE, 3, seed + 10 + i * 2, 0.85, prog(1.1 + i * 0.08, 0.5));
    stroke([[900 + wBottom * 0.42, y0], [900 - w * 0.42, y1]], OCHRE, 3, seed + 11 + i * 2, 0.85, prog(1.2 + i * 0.08, 0.5));
  }
};

ctx.save(); ctx.globalAlpha = TT.env.fade(T, api.d, 0.4, 0.35);
TT.board.crayon(ctx, api, { seed: 26 });
badge();
child(250, 830, RED, '#5b3628', 100, 1, pop(0.45, 0.55));
child(390, 830, GREEN, '#b58a45', 150, 0, pop(0.62, 0.55));
child(530, 830, OCHRE, '#3e2b24', 200, 2, pop(0.79, 0.55));
stroke([[100, 836], [370, 832], [690, 836], [1080, 832]], SOFT, 4.2, 240, 0.85, prog(0.35, 0.8));

// 塔从安全感开始，逐层向上生长；顶层保留纸色，只画桁架。
towerLayer(830, 635, 230, 190, GREEN, 300, prog(1.0, 0.85));
towerLayer(635, 425, 190, 140, PURPLE, 350, prog(1.75, 0.85));
towerLayer(425, 220, 140, 74, null, 400, prog(2.5, 0.85));
text('安全感', 650, 738, 42, GREEN, 'center', prog(1.45, 0.4), 'sans-900');
stroke([[720, 728], [765, 724], [793, 729]], SOFT, 2, 450, 0.7, prog(1.55, 0.4));
text('一起示弱', 610, 535, 40, PURPLE, 'center', prog(2.2, 0.4), 'sans-900');
stroke([[700, 524], [762, 520], [824, 525]], SOFT, 2, 451, 0.7, prog(2.3, 0.4));
text('目标', 690, 218, 40, INK, 'center', prog(3.0, 0.4), 'sans-900');
stroke([[752, 209], [802, 205], [846, 210]], SOFT, 2, 452, 0.7, prog(3.1, 0.4));

// 星形也用斜纹填充，不变成平滑矢量图标。
const starK = pop(3.15, 0.55);
ctx.save(); ctx.translate(900, 150); ctx.scale(Math.max(0.001, starK), Math.max(0.001, starK)); ctx.globalAlpha *= Math.min(1, starK);
const starPath = (c) => {
  c.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + i * Math.PI / 5; const r = i % 2 ? 32 : 72;
    const x = Math.cos(a) * r; const y = Math.sin(a) * r;
    if (!i) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.closePath();
};
crayonFill(starPath, { x: -76, y: -76, w: 152, h: 152 }, '#e9c65c', 500, 0.5, 7);
const starPts = [];
for (let i = 0; i <= 10; i += 1) { const a = -Math.PI / 2 + i * Math.PI / 5; const r = i % 2 ? 32 : 72; starPts.push([Math.cos(a) * r, Math.sin(a) * r]); }
stroke(starPts, OCHRE, 3.4, 501, 0.9);
ctx.restore();

// 右侧说明框保留纸色，只用一条红色手绘强调线。
const boxK = prog(3.45, 0.75);
sketchBox(1240, 205, 510, 390, 550, boxK);
stroke([[1266, 230], [1264, 400], [1268, 568]], RED, 6, 554, 0.65, prog(3.65, 0.65));
const lines = ['文化归根结底是', '一组鲜活的人际关系：', '确立安全感，', '共同展现脆弱，', '并向着那个目标笃定迈进。'];
lines.forEach((value, i) => text(value, 1300, 278 + i * 63, i === 4 ? 31 : 34, INK, 'left', prog(3.8 + i * 0.28, 0.4), 'ZTZiYouTi', 420));
ctx.restore();
