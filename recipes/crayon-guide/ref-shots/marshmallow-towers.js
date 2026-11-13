/* @ticktoon-ref-shot
{
  "title": "棉花糖塔对比",
  "note": "材料小图、人物组与不同高度的蜡笔桁架塔；演示数量比较构图",
  "duration": 9,
  "resources": [
    { "type": "font", "name": "ZTZiYouTi" },
    { "type": "font", "name": "sans-900" }
  ],
  "tags": ["蜡笔", "人物", "对比", "实验"]
}
*/
const T = api.t;
const TAU = Math.PI * 2;
const clamp01 = TT.clamp01;
const ease = TT.ease;
const INK = '#3a352d';
const SOFT = '#6c6255';
const RED = '#c9605b';
const ORANGE = '#d97a52';
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
  const lengths = [];
  let total = 0;
  for (let i = 1; i < pts.length; i += 1) {
    const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    lengths.push(len); total += len;
  }
  let target = total * p;
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i += 1) {
    const len = lengths[i - 1];
    if (target >= len) { out.push(pts[i]); target -= len; continue; }
    const q = len ? target / len : 0;
    out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * q, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * q]);
    break;
  }
  return out;
};
const stroke = (pts, color, width, seed, alpha = 1, progress = 1, wobble = 1.25) => {
  const source = partial(pts, progress);
  if (source.length < 2 || alpha <= 0) return;
  ctx.save(); ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const parent = ctx.globalAlpha;
  for (let pass = 0; pass < 2; pass += 1) {
    ctx.lineWidth = pass ? Math.max(0.8, width * 0.52) : width;
    ctx.globalAlpha = parent * alpha * (pass ? 0.34 : 1);
    ctx.beginPath();
    source.forEach((p, i) => {
      const amp = wobble * (pass ? 1.6 : 1);
      const x = p[0] + (hash(seed + i, pass ? 6 : 1) - 0.5) * amp;
      const y = p[1] + (hash(seed + i, pass ? 7 : 2) - 0.5) * amp;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  ctx.restore();
};
const ellipse = (cx, cy, rx, ry, seed, n = 56) => {
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const a = TAU * i / n;
    const r = 1 + (hash(seed + i, 3) - 0.5) * 0.045;
    pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
  }
  return pts;
};
const crayonFill = (pathFn, bbox, color, seed, alpha = 0.5, gap = 8) => {
  if (bbox.w <= 0 || bbox.h <= 0) return;
  ctx.save(); ctx.beginPath(); pathFn(ctx); ctx.clip();
  const parent = ctx.globalAlpha;
  ctx.fillStyle = color; ctx.globalAlpha = parent * alpha * 0.12; ctx.fillRect(bbox.x, bbox.y, bbox.w, bbox.h);
  const diag = Math.hypot(bbox.w, bbox.h);
  const count = Math.ceil(diag / gap);
  const cx = bbox.x + bbox.w / 2;
  const cy = bbox.y + bbox.h / 2;
  ctx.strokeStyle = color; ctx.lineCap = 'round';
  for (let i = -count; i <= count; i += 1) {
    const off = i * gap + (hash(seed + i, 8) - 0.5) * gap * 0.5;
    const px = cx + off * 0.86;
    const py = cy - off * 0.5;
    ctx.globalAlpha = parent * alpha * (0.35 + hash(seed + i, 9) * 0.42);
    ctx.lineWidth = 1.4 + hash(seed + i, 10) * 1.7;
    ctx.beginPath(); ctx.moveTo(px - diag * 0.26, py - diag * 0.45); ctx.lineTo(px + diag * 0.26, py + diag * 0.45); ctx.stroke();
  }
  for (let i = 0; i < Math.min(180, Math.floor(bbox.w * bbox.h / 850)); i += 1) {
    ctx.globalAlpha = parent * alpha * (0.08 + hash(seed + i, 11) * 0.18);
    ctx.fillRect(bbox.x + hash(seed + i, 12) * bbox.w, bbox.y + hash(seed + i, 13) * bbox.h, 1.5, 1.5);
  }
  ctx.restore();
};
const text = (value, x, y, size, color = INK, align = 'left', alpha = 1, fontKey = 'ZTZiYouTi', maxWidth) => {
  if (alpha <= 0 || !value) return;
  TT.text(ctx, value, x, y, size, { fontKey, color, align, alpha, maxWidth });
};
const sketchBox = (x, y, w, h, seed, k, color = INK) => {
  stroke([[x, y], [x + w * 0.35, y - 2], [x + w, y + 1]], color, 2.4, seed, 0.9, k);
  stroke([[x + w, y], [x + w + 2, y + h * 0.5], [x + w, y + h]], color, 2.4, seed + 1, 0.9, k);
  stroke([[x + w, y + h], [x + w * 0.55, y + h + 2], [x, y + h]], color, 2.4, seed + 2, 0.9, k);
  stroke([[x, y + h], [x - 2, y + h * 0.45], [x, y]], color, 2.4, seed + 3, 0.9, k);
};
const badge = () => {
  const k = prog(0.1, 0.75);
  stroke(ellipse(132, 92, 62, 54, 40), RED, 3.8, 40, 0.85, k);
  stroke(ellipse(135, 94, 56, 49, 41), RED, 1.5, 41, 0.45, k);
  text('20%', 132, 91, 40, RED, 'center', prog(0.55, 0.4), 'sans-900');
  text('法则', 132, 119, 19, INK, 'center', prog(0.72, 0.4));
};
const person = (x, y, s, body, hair, seed, child, armUp, k) => {
  if (k <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(s * Math.max(0.001, k), s * Math.max(0.001, k)); ctx.globalAlpha *= Math.min(1, k);
  const skin = '#edc7a5';
  stroke([[-24, -54], [-28, -4], [-42, 0]], INK, 8, seed, 0.95);
  stroke([[22, -54], [28, -4], [42, 0]], INK, 8, seed + 1, 0.95);
  const torso = (c) => { c.beginPath(); c.moveTo(-44, -128); c.quadraticCurveTo(0, -144, 44, -128); c.lineTo(34, -48); c.lineTo(-34, -48); c.closePath(); };
  crayonFill(torso, { x: -48, y: -142, w: 96, h: 100 }, body, seed + 2, 0.62, 7);
  stroke([[-44, -128], [-34, -48], [34, -48], [44, -128], [-44, -128]], INK, 3, seed + 3, 0.9);
  const leftHand = armUp ? [-72, -190] : [-62, -58];
  const rightHand = armUp === 2 ? [72, -194] : [62, -58];
  stroke([[-36, -116], [-58, -92], leftHand], body, 11, seed + 4, 0.9);
  stroke([[36, -116], [58, -92], rightHand], body, 11, seed + 5, 0.9);
  stroke(ellipse(leftHand[0], leftHand[1], 8, 9, seed + 6, 24), INK, 2.2, seed + 6, 0.8);
  stroke(ellipse(rightHand[0], rightHand[1], 8, 9, seed + 7, 24), INK, 2.2, seed + 7, 0.8);
  const face = (c) => { c.beginPath(); c.ellipse(0, -176, child ? 43 : 39, child ? 45 : 43, 0, 0, TAU); c.closePath(); };
  crayonFill(face, { x: -46, y: -224, w: 92, h: 96 }, skin, seed + 8, 0.34, 9);
  stroke(ellipse(0, -176, child ? 43 : 39, child ? 45 : 43, seed + 9), INK, 3, seed + 9, 0.95);
  ctx.save(); ctx.globalAlpha *= 0.75; ctx.fillStyle = hair;
  ctx.beginPath(); ctx.arc(0, -187, child ? 42 : 38, Math.PI, TAU); ctx.lineTo(35, -178); ctx.quadraticCurveTo(0, -206, -37, -176); ctx.closePath(); ctx.fill(); ctx.restore();
  for (let i = 0; i < 7; i += 1) stroke([[-34 + i * 11, -199 + (i % 2) * 5], [-26 + i * 9, -213 + (i % 3) * 3]], hair, 5, seed + 20 + i, 0.75);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-13, -177, 2.7, 0, TAU); ctx.arc(13, -177, 2.7, 0, TAU); ctx.fill();
  stroke([[-10, -158], [0, -153], [11, -159]], INK, 2.2, seed + 30, 0.9);
  ctx.restore();
};
const marshmallow = (x, y, s, seed, k) => {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha *= k;
  const body = (c) => { c.beginPath(); c.moveTo(-26, -20); c.lineTo(-26, 20); c.quadraticCurveTo(0, 36, 26, 20); c.lineTo(26, -20); c.closePath(); };
  crayonFill(body, { x: -30, y: -26, w: 60, h: 62 }, '#d58f9b', seed, 0.5, 6);
  stroke([[-26, -20], [-26, 20], [0, 29], [26, 20], [26, -20]], '#9f6570', 2.4, seed + 1, 0.9, k);
  stroke(ellipse(0, -20, 26, 11, seed + 2, 36), '#9f6570', 2.4, seed + 2, 0.9, k);
  ctx.restore();
};
const tower = (cx, base, w, h, color, seed, k) => {
  const visible = h * k;
  const top = base - visible;
  const path = (c) => { c.beginPath(); c.moveTo(cx - w / 2, base); c.lineTo(cx - w * 0.38, top); c.lineTo(cx + w * 0.38, top); c.lineTo(cx + w / 2, base); c.closePath(); };
  crayonFill(path, { x: cx - w / 2, y: top, w, h: visible }, color, seed, 0.52, 8);
  stroke([[cx - w / 2, base], [cx - w * 0.38, top], [cx + w * 0.38, top], [cx + w / 2, base]], color, 3.8, seed + 1, 0.95, k);
  const levels = Math.max(1, Math.floor(visible / 74));
  for (let i = 0; i < levels; i += 1) {
    const y0 = base - visible * i / levels;
    const y1 = base - visible * (i + 1) / levels;
    stroke([[cx - w * 0.43, y0], [cx + w * 0.40, y1]], '#f2d0a2', 3, seed + 10 + i * 2, 0.8, prog(1.6 + i * 0.05, 0.5));
    stroke([[cx + w * 0.43, y0], [cx - w * 0.40, y1]], '#f2d0a2', 3, seed + 11 + i * 2, 0.8, prog(1.7 + i * 0.05, 0.5));
  }
  return top;
};

ctx.save(); ctx.globalAlpha = TT.env.fade(T, api.d, 0.4, 0.35);
TT.board.crayon(ctx, api, { seed: 14 });
badge();

// 三样材料只是本场上方的叙事物件，不是固定材料槽。
const materialK = prog(0.7, 0.6);
for (let i = 0; i < 9; i += 1) stroke([[704 + i * 8, 58 + (i % 2) * 4], [710 + i * 7, 152]], OCHRE, 3.4, 100 + i, 0.75, materialK);
stroke([[700, 103], [780, 105]], RED, 5, 120, 0.65, materialK);
text('20 根意大利面', 742, 190, 24, INK, 'center', prog(1.0, 0.4));
stroke(ellipse(936, 100, 46, 42, 140), PURPLE, 12, 140, 0.55, materialK);
stroke(ellipse(936, 100, 24, 21, 141), SOFT, 3, 141, 0.8, materialK);
stroke([[965, 130], [1000, 166]], PURPLE, 12, 142, 0.55, materialK);
text('1 码胶带', 954, 190, 24, INK, 'center', prog(1.1, 0.4));
marshmallow(1168, 105, 1.35, 150, materialK);
text('1 颗棉花糖', 1168, 190, 24, INK, 'center', prog(1.2, 0.4));
text('平均塔高（英寸）', 110, 306, 34, SOFT, 'left', prog(1.25, 0.5));

const groups = [
  { name: 'MBA 学生', value: '7', h: 145, color: BLUE, cx: 350 },
  { name: '律师', value: '14', h: 235, color: PURPLE, cx: 760 },
  { name: 'CEO', value: '21', h: 345, color: BLUE, cx: 1160 },
  { name: '幼儿园小朋友', value: '28', h: 475, color: GREEN, cx: 1570 },
];
const base = 830;
groups.forEach((g, i) => {
  const at = 1.55 + i * 0.72;
  const k = prog(at, 0.85);
  const peopleX = g.cx - 92;
  const kid = i === 3;
  const colors = kid ? [RED, GREEN, OCHRE] : [BLUE, '#c4778c', OCHRE];
  for (let p = 0; p < 3; p += 1) {
    person(peopleX - 64 + p * 62, base, kid ? 0.69 : 0.66, colors[p], p === 1 ? '#3c2a22' : '#594033', 300 + i * 70 + p * 20, kid, kid && p !== 1 ? (p === 0 ? 1 : 2) : 0, pop(at + p * 0.08, 0.55));
  }
  const top = tower(g.cx + 100, base, 100, g.h, g.color, 600 + i * 60, k);
  marshmallow(g.cx + 100, top - 17, 0.67, 650 + i * 50, prog(at + 0.65, 0.35));
  text(g.value, g.cx + 100, top - 58, 48, g.color, 'center', prog(at + 0.55, 0.4), 'sans-900');
  const boxW = kid ? 250 : 205;
  sketchBox(peopleX - boxW / 2, 500, boxW, 56, 700 + i * 10, prog(at + 0.45, 0.45));
  text(g.name, peopleX, 538, kid ? 30 : 32, INK, 'center', prog(at + 0.68, 0.4), 'ZTZiYouTi', boxW - 20);
});

stroke([[70, base + 4], [620, base + 1], [1260, base + 5], [1840, base + 2]], INK, 4.4, 900, 0.9, prog(1.25, 0.8));
text('彼得·斯基尔曼的棉花糖实验（示例构图）', 1780, 878, 21, SOFT, 'right', prog(4.8, 0.5));
// 问号是最后一个强调，不占用底部字幕带。
const qk = pop(4.9, 0.55);
text('?', 1500, 290, 112 * Math.max(0.001, qk), RED, 'center', Math.min(1, qk), 'sans-900');
ctx.restore();
