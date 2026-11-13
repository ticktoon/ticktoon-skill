/* @ticktoon-ref-shot
{
  "title": "两种提问",
  "note": "左右分区、两组坐姿人物、对话气泡与情绪射线；演示对照叙事",
  "duration": 8,
  "resources": [
    { "type": "font", "name": "ZTZiYouTi" },
    { "type": "font", "name": "sans-900" }
  ],
  "tags": ["蜡笔", "对话", "对照", "情绪"]
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
const pop = (at, dur = 0.55) => ease.back(1.2)(clamp01((T - at) / dur));
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
    }); ctx.stroke();
  }
  ctx.restore();
};
const ellipse = (cx, cy, rx, ry, seed, n = 64) => {
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
  for (let i = 0; i < Math.min(160, Math.floor(bbox.w * bbox.h / 850)); i += 1) {
    ctx.globalAlpha = parent * alpha * (0.08 + hash(seed + i, 11) * 0.18);
    ctx.fillRect(bbox.x + hash(seed + i, 12) * bbox.w, bbox.y + hash(seed + i, 13) * bbox.h, 1.5, 1.5);
  }
  ctx.restore();
};
const text = (value, x, y, size, color = INK, align = 'left', alpha = 1, fontKey = 'ZTZiYouTi', maxWidth) => {
  if (alpha > 0 && value) TT.text(ctx, value, x, y, size, { fontKey, color, align, alpha, maxWidth });
};
const badge = () => {
  const k = prog(0.1, 0.7);
  stroke(ellipse(105, 80, 52, 46, 30), RED, 3.4, 30, 0.8, k);
  text('20%', 105, 80, 32, RED, 'center', prog(0.48, 0.35), 'sans-900');
  text('法则', 105, 103, 16, INK, 'center', prog(0.62, 0.35));
};
const bubble = (cx, cy, rx, ry, question, tailX, seed, at) => {
  const k = prog(at, 0.8);
  stroke(ellipse(cx, cy, rx, ry, seed), PURPLE, 3.3, seed, 0.85, k);
  stroke(ellipse(cx + 3, cy - 2, rx - 7, ry - 5, seed + 1), PURPLE, 1.4, seed + 1, 0.42, k);
  stroke([[tailX - 34, cy + ry - 3], [tailX - 26, cy + ry + 42], [tailX, cy + ry + 95]], PURPLE, 2.8, seed + 2, 0.8, prog(at + 0.45, 0.55));
  stroke([[tailX + 34, cy + ry - 3], [tailX + 25, cy + ry + 44], [tailX, cy + ry + 95]], PURPLE, 2.8, seed + 3, 0.8, prog(at + 0.5, 0.55));
  text(question, cx, cy + 12, 36, INK, 'center', prog(at + 0.5, 0.45), 'ZTZiYouTi', rx * 1.75);
};
const seated = (x, y, flip, body, pants, hair, seed, engaged, k) => {
  if (k <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(flip * Math.max(0.001, k), Math.max(0.001, k)); ctx.globalAlpha *= Math.min(1, k);
  // 椅子保持静止，只有人的身体前倾。
  stroke([[-58, -232], [-58, 0]], '#76543a', 8, seed, 0.9);
  stroke([[-60, -102], [62, -102]], '#76543a', 9, seed + 1, 0.9);
  stroke([[-48, -98], [-52, 0]], '#76543a', 7, seed + 2, 0.9);
  stroke([[50, -98], [58, 0]], '#76543a', 7, seed + 3, 0.9);
  // 大腿、膝盖与小腿形成清楚的坐姿。
  stroke([[0, -112], [72, -88], [70, -30], [62, -2]], pants, 28, seed + 4, 0.95);
  stroke([[58, -4], [92, -2]], INK, 13, seed + 5, 0.95);
  ctx.save(); ctx.translate(0, -112); ctx.rotate(engaged ? 0.11 + Math.sin(T * 1.6 + seed) * 0.012 : Math.sin(T * 1.2 + seed) * 0.006); ctx.translate(0, 112);
  const torso = (c) => { c.beginPath(); c.moveTo(-42, -238); c.quadraticCurveTo(0, -260, 44, -230); c.lineTo(34, -112); c.lineTo(-32, -112); c.closePath(); };
  crayonFill(torso, { x: -48, y: -258, w: 100, h: 152 }, body, seed + 6, 0.62, 7);
  stroke([[-42, -238], [-32, -112], [34, -112], [44, -230], [-42, -238]], INK, 3.2, seed + 7, 0.9);
  // 第二组伸手并身体前倾，第一组只把手放在膝上。
  const elbow = engaged ? [58, -188] : [42, -160];
  const hand = engaged ? [104, -166] : [62, -104];
  stroke([[28, -218], elbow, hand], body, 14, seed + 8, 0.95);
  const skin = '#edc7a5';
  const handPath = (c) => { c.beginPath(); c.ellipse(hand[0], hand[1], 11, 9, 0, 0, TAU); c.closePath(); };
  crayonFill(handPath, { x: hand[0] - 13, y: hand[1] - 12, w: 26, h: 24 }, skin, seed + 9, 0.36, 6);
  stroke(ellipse(hand[0], hand[1], 11, 9, seed + 10, 28), INK, 2, seed + 10, 0.85);
  // 侧脸朝局部 +x，外层 flip 让两人面对面。
  const face = (c) => { c.beginPath(); c.ellipse(0, -310, 43, 50, 0, 0, TAU); c.closePath(); };
  crayonFill(face, { x: -48, y: -365, w: 100, h: 110 }, skin, seed + 11, 0.35, 8);
  stroke(ellipse(0, -310, 43, 50, seed + 12), INK, 3.2, seed + 12, 0.95);
  stroke([[36, -319], [55, -307], [38, -300]], INK, 2.6, seed + 13, 0.9);
  const hairPath = (c) => { c.beginPath(); c.moveTo(-42, -323); c.quadraticCurveTo(-38, -380, 18, -366); c.quadraticCurveTo(52, -354, 39, -318); c.quadraticCurveTo(5, -346, -42, -323); c.closePath(); };
  crayonFill(hairPath, { x: -48, y: -374, w: 104, h: 70 }, hair, seed + 14, 0.72, 6);
  for (let i = 0; i < 7; i += 1) stroke([[-34 + i * 11, -340 - (i % 2) * 8], [-28 + i * 10, -360 + (i % 3) * 4]], hair, 5, seed + 20 + i, 0.75);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(23, -313, 3, 0, TAU); ctx.fill();
  stroke([[24, -287], [34, -281], [43, -289]], INK, engaged ? 3 : 2, seed + 30, 0.9);
  ctx.restore();
  ctx.restore();
};

ctx.save(); ctx.globalAlpha = TT.env.fade(T, api.d, 0.4, 0.35);
TT.board.crayon(ctx, api, { seed: 52 });
badge();
stroke([[960, 118], [956, 360], [963, 610], [958, 850]], SOFT, 3, 60, 0.7, prog(0.25, 0.9));
bubble(430, 170, 260, 64, '最喜欢的歌手？', 430, 100, 0.55);
bubble(1390, 170, 292, 64, '你上次哭是什么时候？', 1390, 140, 0.9);

// 左组端正、手放膝上；右组前倾并伸手。
seated(320, 820, 1, OCHRE, '#81543b', '#332820', 220, false, pop(1.15, 0.6));
seated(580, 820, -1, BLUE, '#3c4c59', '#6a4935', 270, false, pop(1.35, 0.6));
seated(1280, 820, 1, OCHRE, RED, '#332820', 320, true, pop(1.65, 0.6));
seated(1540, 820, -1, BLUE, '#3c4c59', '#6a4935', 370, true, pop(1.85, 0.6));

// 情绪射线只在第二组出现，颜色轻、间距固定。
const rayK = prog(2.7, 0.8);
const rays = [
  [[1120, 500], [1080, 470]], [[1150, 442], [1122, 398]], [[1200, 405], [1188, 354]],
  [[1580, 405], [1600, 354]], [[1640, 442], [1675, 400]], [[1680, 510], [1724, 486]],
  [[1120, 590], [1068, 584]], [[1690, 590], [1742, 584]],
];
rays.forEach((pts, i) => stroke(pts, [PURPLE, OCHRE, RED][i % 3], 5, 450 + i, 0.65, rayK));
text('两分钟实验（示例构图）', 1760, 875, 21, SOFT, 'right', prog(3.25, 0.45));
ctx.restore();
