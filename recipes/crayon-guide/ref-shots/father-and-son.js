/* @ticktoon-ref-shot
{
  "title": "安德森父子",
  "note": "淡淡的数据背景、大小人物与弧形关系引线；演示人物讲故事的整幕构图",
  "duration": 7.5,
  "resources": [
    { "type": "font", "name": "ZTZiYouTi" },
    { "type": "font", "name": "sans-900" }
  ],
  "tags": ["蜡笔", "人物", "关系", "标注"]
}
*/
const T = api.t;
const TAU = Math.PI * 2;
const clamp01 = TT.clamp01;
const ease = TT.ease;
const INK = '#3a352d';
const SOFT = '#6c6255';
const RED = '#c9605b';
const BLUE = '#5f87a8';
const OCHRE = '#d9a74f';
const prog = (at, dur = 0.6) => ease.inOutCubic(clamp01((T - at) / dur));
const pop = (at, dur = 0.6) => ease.back(1.2)(clamp01((T - at) / dur));
const hash = (i, ch = 0) => {
  let x = (Math.imul(Math.round(i) + 1, 0x9e3779b1) ^ Math.imul(Math.round(ch) + 13, 0x85ebca6b)) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16; return (x >>> 0) / 4294967295;
};
const partial = (pts, p) => {
  if (p <= 0) return [];
  if (p >= 1) return pts;
  const lengths = []; let total = 0;
  for (let i = 1; i < pts.length; i += 1) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); lengths.push(l); total += l; }
  let left = total * p; const out = [pts[0]];
  for (let i = 1; i < pts.length; i += 1) {
    if (left >= lengths[i - 1]) { out.push(pts[i]); left -= lengths[i - 1]; continue; }
    const q = lengths[i - 1] ? left / lengths[i - 1] : 0;
    out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * q, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * q]); break;
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
    ctx.globalAlpha = parent * alpha * (pass ? 0.34 : 1); ctx.beginPath();
    source.forEach((p, i) => {
      const amp = wobble * (pass ? 1.6 : 1);
      const x = p[0] + (hash(seed + i, pass ? 6 : 1) - 0.5) * amp;
      const y = p[1] + (hash(seed + i, pass ? 7 : 2) - 0.5) * amp;
      if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }); ctx.stroke();
  }
  ctx.restore();
};
const ellipse = (cx, cy, rx, ry, seed, n = 64) => {
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const a = TAU * i / n; const r = 1 + (hash(seed + i, 3) - 0.5) * 0.04;
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
  for (let i = 0; i < Math.min(220, Math.floor(bbox.w * bbox.h / 800)); i += 1) {
    ctx.globalAlpha = parent * alpha * (0.08 + hash(seed + i, 11) * 0.18);
    ctx.fillRect(bbox.x + hash(seed + i, 12) * bbox.w, bbox.y + hash(seed + i, 13) * bbox.h, 1.6, 1.6);
  }
  ctx.restore();
};
const text = (value, x, y, size, color = INK, align = 'left', alpha = 1, fontKey = 'ZTZiYouTi', maxWidth) => {
  if (alpha > 0 && value) TT.text(ctx, value, x, y, size, { fontKey, color, align, alpha, maxWidth });
};
const curve = (a, c, b, n = 30) => {
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n; const u = 1 - t;
    pts.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return pts;
};
const arrow = (pts, color, seed, k) => {
  stroke(pts, color, 4.2, seed, 0.9, k, 1.4);
  if (k < 0.82) return;
  const end = pts[pts.length - 1]; const prev = pts[pts.length - 3];
  const angle = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
  const head = 21;
  stroke([[end[0] - Math.cos(angle - 0.55) * head, end[1] - Math.sin(angle - 0.55) * head], end, [end[0] - Math.cos(angle + 0.55) * head, end[1] - Math.sin(angle + 0.55) * head]], color, 4.2, seed + 1, (k - 0.82) / 0.18, 1, 1.2);
};
const person = (x, y, s, isChild, k) => {
  if (k <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(s * Math.max(0.001, k), s * Math.max(0.001, k)); ctx.globalAlpha *= Math.min(1, k);
  const skin = '#edc3a0';
  const hair = isChild ? '#b96c3f' : '#74452f';
  // 腿、裤子和鞋先画，身体覆盖接缝。
  if (isChild) {
    stroke([[-38, -108], [-42, -30]], skin, 25, 10, 0.95);
    stroke([[34, -108], [38, -30]], skin, 25, 11, 0.95);
    const shorts = (c) => { c.beginPath(); c.moveTo(-66, -160); c.lineTo(65, -160); c.lineTo(52, -82); c.lineTo(4, -82); c.lineTo(0, -118); c.lineTo(-5, -82); c.lineTo(-54, -82); c.closePath(); };
    crayonFill(shorts, { x: -70, y: -164, w: 140, h: 88 }, BLUE, 12, 0.65, 7);
    stroke([[-66, -160], [-54, -82], [-5, -82], [0, -118], [4, -82], [52, -82], [65, -160]], INK, 3.5, 13, 0.9);
    stroke([[-48, -26], [-68, -4], [-20, -3]], BLUE, 20, 14, 0.95);
    stroke([[42, -26], [22, -4], [72, -3]], BLUE, 20, 15, 0.95);
  } else {
    const pants = (c) => { c.beginPath(); c.moveTo(-72, -178); c.lineTo(72, -178); c.lineTo(55, -12); c.lineTo(5, -12); c.lineTo(0, -125); c.lineTo(-8, -12); c.lineTo(-58, -12); c.closePath(); };
    crayonFill(pants, { x: -76, y: -182, w: 152, h: 176 }, '#334653', 16, 0.68, 7);
    stroke([[-72, -178], [-58, -12], [-8, -12], [0, -125], [5, -12], [55, -12], [72, -178]], INK, 4, 17, 0.95);
    stroke([[-48, -10], [-78, 0], [-12, 0]], INK, 20, 18, 0.95);
    stroke([[44, -10], [12, 0], [82, 0]], INK, 20, 19, 0.95);
  }
  // 上衣：孩子穿 T 恤，大人是衬衫加毛背心。
  const shirt = (c) => { c.beginPath(); c.moveTo(-74, -318); c.quadraticCurveTo(0, -340, 74, -318); c.lineTo(66, isChild ? -154 : -174); c.lineTo(-66, isChild ? -154 : -174); c.closePath(); };
  crayonFill(shirt, { x: -80, y: -340, w: 160, h: 190 }, isChild ? RED : '#7fb3c1', 30, 0.62, 7);
  stroke([[-74, -318], [-66, isChild ? -154 : -174], [66, isChild ? -154 : -174], [74, -318], [-74, -318]], INK, 3.8, 31, 0.95);
  if (!isChild) {
    stroke([[-35, -326], [0, -280], [35, -326]], '#e7e0ce', 6, 32, 0.95);
    stroke([[-66, -185], [66, -185]], '#467f91', 5, 33, 0.8);
  }
  // 手臂与孩子微张开的手掌。
  const leftHand = isChild ? [-128, -182] : [-108, -154];
  const rightHand = isChild ? [128, -182] : [108, -154];
  stroke([[-64, -302], [-91, -246], leftHand], isChild ? RED : '#7fb3c1', 25, 40, 0.95);
  stroke([[64, -302], [91, -246], rightHand], isChild ? RED : '#7fb3c1', 25, 41, 0.95);
  const hand = (hx, hy, seed) => {
    const path = (c) => { c.beginPath(); c.ellipse(hx, hy, 15, 20, 0, 0, TAU); c.closePath(); };
    crayonFill(path, { x: hx - 18, y: hy - 23, w: 36, h: 46 }, skin, seed, 0.35, 7);
    stroke(ellipse(hx, hy, 15, 20, seed + 1, 32), INK, 2.6, seed + 1, 0.9);
    for (let i = -1; i <= 1; i += 1) stroke([[hx + i * 7, hy + 10], [hx + i * 10, hy + 25]], INK, 1.8, seed + 3 + i, 0.8);
  };
  hand(...leftHand, 44); hand(...rightHand, 50);
  // 脸、耳朵与头发。
  const face = (c) => { c.beginPath(); c.ellipse(0, -403, isChild ? 82 : 76, isChild ? 84 : 82, 0, 0, TAU); c.closePath(); };
  crayonFill(face, { x: -86, y: -491, w: 172, h: 176 }, skin, 60, 0.36, 8);
  stroke(ellipse(0, -403, isChild ? 82 : 76, isChild ? 84 : 82, 61), INK, 3.8, 61, 0.95);
  stroke(ellipse(-78, -402, 13, 20, 62, 32), INK, 2.5, 62, 0.9);
  stroke(ellipse(78, -402, 13, 20, 63, 32), INK, 2.5, 63, 0.9);
  const hairPath = (c) => { c.beginPath(); c.moveTo(-74, -432); c.quadraticCurveTo(-62, -500, 10, -493); c.quadraticCurveTo(78, -488, 77, -420); c.quadraticCurveTo(38, -458, 14, -447); c.quadraticCurveTo(-20, -418, -74, -432); c.closePath(); };
  crayonFill(hairPath, { x: -80, y: -500, w: 164, h: 100 }, hair, 64, 0.72, 6);
  stroke([[-74, -432], [-58, -474], [-12, -492], [38, -480], [77, -420]], INK, 3.8, 65, 0.9);
  for (let i = 0; i < 11; i += 1) stroke([[-64 + i * 13, -452 - (i % 3) * 8], [-52 + i * 11, -480 + (i % 2) * 6]], hair, 6, 80 + i, 0.75);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-26, -405, 4, 0, TAU); ctx.arc(26, -405, 4, 0, TAU); ctx.fill();
  stroke([[-8, -390], [-2, -383], [5, -390]], SOFT, 2.2, 95, 0.8);
  stroke([[-20, -367], [0, -357], [23, -370]], INK, 3, 96, 0.9);
  ctx.save(); ctx.globalAlpha *= 0.25; ctx.fillStyle = RED; ctx.beginPath(); ctx.ellipse(-48, -382, 16, 10, 0, 0, TAU); ctx.ellipse(48, -382, 16, 10, 0, 0, TAU); ctx.fill(); ctx.restore();
  ctx.restore();
};

ctx.save(); ctx.globalAlpha = TT.env.fade(T, api.d, 0.4, 0.35);
TT.board.crayon(ctx, api, { seed: 39 });

// 上一幕的数据只作淡化语境，不与父子争夺视觉焦点。
ctx.save(); ctx.globalAlpha *= 0.18;
text('普通人 + AI', 220, 150, 34, SOFT, 'left', 1, 'sans-900');
text('顶尖人才 + AI', 180, 268, 34, SOFT, 'left', 1, 'sans-900');
const shortBar = (c) => { c.beginPath(); c.rect(650, 112, 230, 52); c.closePath(); };
const longBar = (c) => { c.beginPath(); c.rect(650, 230, 1030, 58); c.closePath(); };
crayonFill(shortBar, { x: 650, y: 112, w: 230, h: 52 }, BLUE, 200, 0.55, 10);
crayonFill(longBar, { x: 650, y: 230, w: 1030, h: 58 }, RED, 201, 0.55, 10);
text('×2', 920, 153, 38, BLUE, 'left', 1, 'sans-900');
text('一千倍', 1380, 205, 76, RED, 'center', 1, 'sans-900');
ctx.restore();

const fatherK = pop(0.55, 0.7);
const sonK = pop(1.25, 0.65);
person(770, 850, 1.04, false, fatherK);
person(1260, 850, 0.70, true, sonK);
stroke([[180, 858], [580, 854], [1100, 858], [1700, 854]], SOFT, 4.5, 300, 0.85, prog(0.4, 0.9));

const fatherLabel = prog(1.25, 0.5);
text('马克·安德森', 100, 408, 58, INK, 'left', fatherLabel, 'sans-900');
text('硅谷教父', 285, 465, 32, SOFT, 'left', prog(1.5, 0.4));
arrow(curve([520, 392], [660, 375], [714, 463]), SOFT, 320, prog(1.55, 0.7));
const sonLabel = prog(2.0, 0.5);
text('他的儿子', 1440, 594, 52, RED, 'left', sonLabel, 'sans-900');
text('今年 10 岁', 1440, 650, 32, SOFT, 'left', prog(2.25, 0.4));
arrow(curve([1430, 568], [1340, 542], [1295, 628]), RED, 340, prog(2.3, 0.65));
ctx.restore();
