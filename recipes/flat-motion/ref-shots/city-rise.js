/* @ticktoon-ref-shot
{
  "title": "城市弹性生长",
  "note": "圆点落地变成太阳，建筑与树木按节拍从地面弹起",
  "duration": 7.2,
  "bg": "#2B2BFF",
  "thumbTime": 5.8,
  "tags": ["城市", "回弹", "生长", "挤压拉伸"],
  "resources": []
}
*/
const T = api.t;
const C = {
  U: '#2B2BFF', UL: '#4D4DFF', UT: '#3B3BFF', CO: '#FF5A4E', COD: '#E0433A',
  SU: '#FFC62B', SUD: '#F0A91A', MI: '#2EE6A8', MID: '#1FC28C',
  CR: '#FFF6E9', CRD: '#F1E3CC', INK: '#151433', INKW: '#2A2962',
};
const p = (at, dur) => TT.clamp01((T - at) / dur);
const lerp = (a, b, k) => a + (b - a) * k;
const pop = (at, dur = 0.5) => Math.max(0, TT.ease.back(1.70158)(p(at, dur)));
const circle = (x, y, r, color) => {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); ctx.fill();
};
const rr = (x, y, w, h, r, color) => {
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
};
const GY = 830;

ctx.fillStyle = C.U;
ctx.fillRect(0, 0, W, H);

// 同底色装饰先给一个视觉锚点，不能等到建筑出现前都是空画面。
const skyMarks = [
  { x: 330, y: 260, r: 82, at: 0.15 },
  { x: 1570, y: 430, r: 54, at: 0.35 },
  { x: 620, y: 600, r: 42, at: 0.55 },
];
for (const mark of skyMarks) {
  const s = pop(mark.at, 0.5);
  ctx.save(); ctx.translate(mark.x, mark.y); ctx.rotate(0.08 * Math.sin(T + mark.x));
  ctx.strokeStyle = C.UT; ctx.lineWidth = 24;
  ctx.beginPath(); ctx.arc(0, 0, mark.r * s, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}

// 地面从中间向两边展开，所有建筑共享这一条 baseline。
const groundP = TT.ease.outCubic(p(0.1, 0.55));
ctx.fillStyle = C.CR;
ctx.fillRect(W / 2 - W * groundP / 2, GY, W * groundP, H - GY);
ctx.fillStyle = C.CRD;
ctx.fillRect(W / 2 - W * groundP / 2, 885, W * groundP, 38);

// 远景低对比，从中心向两侧生长。
const far = [90, 260, 455, 650, 825, 1090, 1270, 1480, 1690, 1870];
for (let i = 0; i < far.length; i += 1) {
  const h = 150 + (i * 73 % 190);
  const w = 94 + (i * 31 % 60);
  const at = 0.8 + Math.abs(far[i] - 960) / 960 * 0.45;
  const sy = Math.max(0.001, pop(at, 0.55));
  ctx.save(); ctx.translate(far[i], GY); ctx.scale(1, sy);
  ctx.fillStyle = C.UL; ctx.fillRect(-w / 2, -h, w, h); ctx.restore();
}

// 太阳由同一个珊瑚圆点飞来；最后尺寸和颜色都保留，形成连续变形。
const launch = p(1.02, 0.72);
let dotX = 960;
let dotY = GY - 74;
let dotR = 74;
if (T < 0.8) dotY = lerp(-110, GY - 74, TT.ease.outQuart(p(0, 0.8)));
if (T > 0.8 && T < 1.02) {
  const q = Math.sin(Math.PI * p(0.8, 0.22));
  ctx.save(); ctx.translate(dotX, GY); ctx.scale(1 + 0.25 * q, 1 - 0.28 * q);
  circle(0, -74, dotR, C.CO); ctx.restore();
  dotR = 0;
}
if (T >= 1.02) {
  const q = TT.ease.outQuart(launch);
  dotX = (1 - q) ** 2 * 960 + 2 * (1 - q) * q * 1080 + q * q * 1300;
  dotY = (1 - q) ** 2 * (GY - 74) + 2 * (1 - q) * q * 60 + q * q * 230;
  dotR = lerp(74, 124, q);
}
if (dotR > 0) circle(dotX, dotY, dotR, C.CO);
if (T >= 1.74) {
  for (let i = 0; i < 12; i += 1) {
    const a = i / 12 * Math.PI * 2 + T * 0.08;
    const s = TT.ease.back(1.7)(p(1.74 + i * 0.025, 0.35));
    ctx.strokeStyle = C.CO; ctx.lineWidth = 12; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(1300 + Math.cos(a) * 154, 230 + Math.sin(a) * 154);
    ctx.lineTo(1300 + Math.cos(a) * (154 + 42 * s), 230 + Math.sin(a) * (154 + 42 * s));
    ctx.stroke();
  }
}

const cloud = (x, y, scale, at, from) => {
  const k = TT.ease.outQuart(p(at, 0.8));
  const xx = lerp(from, x, k);
  ctx.save(); ctx.translate(xx, y); ctx.scale(scale, scale);
  rr(-100, -26, 200, 56, 28, C.CR);
  circle(-28, -30, 43, C.CR); circle(42, -18, 31, C.CR); ctx.restore();
};
cloud(370, 190, 0.9, 1.25, -250);
cloud(1610, 390, 0.72, 1.45, 2180);

const buildings = [
  { x: 160, w: 150, h: 245, c: C.MI, d: C.MID, cols: 2, rows: 3 },
  { x: 350, w: 180, h: 390, c: C.CR, d: C.CRD, cols: 3, rows: 5 },
  { x: 560, w: 145, h: 300, c: C.CO, d: C.COD, cols: 2, rows: 4 },
  { x: 750, w: 155, h: 460, c: C.SU, d: C.SUD, cols: 3, rows: 6 },
  { x: 960, w: 190, h: 525, c: C.INK, d: C.INKW, cols: 2, rows: 7 },
  { x: 1170, w: 155, h: 350, c: C.MI, d: C.MID, cols: 2, rows: 5 },
  { x: 1370, w: 180, h: 275, c: C.SU, d: C.SUD, cols: 3, rows: 4 },
  { x: 1585, w: 155, h: 420, c: C.CR, d: C.CRD, cols: 2, rows: 6 },
  { x: 1780, w: 170, h: 225, c: C.CO, d: C.COD, cols: 3, rows: 3 },
];
for (let i = 0; i < buildings.length; i += 1) {
  const b = buildings[i];
  const at = 1.55 + i * 0.12;
  const sy = Math.max(0.001, pop(at, 0.55));
  const sx = 1 + (1 - sy) * 0.2;
  ctx.save(); ctx.translate(b.x, GY); ctx.scale(sx, sy);
  ctx.fillStyle = b.c; ctx.fillRect(-b.w / 2, -b.h, b.w, b.h);
  ctx.fillStyle = b.d; ctx.fillRect(b.w / 2 - b.w * 0.14, -b.h, b.w * 0.14, b.h);
  rr(-b.w / 2 - 5, -b.h - 12, b.w + 10, 16, 6, b.d);
  if (i === 4) {
    rr(-55, -b.h - 70, 110, 48, 10, C.CR);
    circle(-30, -b.h - 46, 10, C.CO);
    rr(-10, -b.h - 54, 48, 8, 4, C.INK);
  }
  const light = p(2.55 + i * 0.055, 0.35);
  for (let row = 0; row < b.rows; row += 1) {
    for (let col = 0; col < b.cols; col += 1) {
      const wx = -b.w * 0.32 + col * (b.w * 0.54 / Math.max(1, b.cols - 1));
      const wy = -b.h + 48 + row * 52;
      const color = (row + col + i) % 3 === 0 && light > 0 ? C.SU : b.d;
      circle(wx, wy, 12 * (color === C.SU ? pop(2.55 + i * 0.055, 0.35) : 1), color);
    }
  }
  ctx.restore();
}

const trees = [70, 270, 470, 660, 1080, 1270, 1490, 1870];
for (let i = 0; i < trees.length; i += 1) {
  const s = Math.max(0.001, pop(2.7 + i * 0.08, 0.45));
  ctx.save(); ctx.translate(trees[i], GY); ctx.scale(1 + (1 - s) * 0.18, s);
  ctx.fillStyle = C.INK; ctx.fillRect(-4, -70, 8, 70);
  rr(-27, -145, 54, 110, 27, C.MI);
  ctx.fillStyle = C.MID; ctx.fillRect(0, -118, 27, 83); ctx.restore();
}

// 最后只保留一个横向动作；收场前驶离，避免末帧仍在引入新元素。
const busP = p(4.05, 2.05);
if (busP > 0 && busP < 1) {
  const bx = lerp(-180, 2110, busP * busP * (3 - 2 * busP));
  ctx.save(); ctx.translate(bx, 900);
  rr(-105, -80, 210, 66, 24, C.CO);
  ctx.fillStyle = C.COD; ctx.fillRect(-105, -35, 210, 21);
  for (const x of [-78, -32, 14]) rr(x, -66, 34, 25, 7, C.CR);
  circle(-62, 0, 18, C.INK); circle(64, 0, 18, C.INK);
  circle(-62, 0, 7, C.CR); circle(64, 0, 7, C.CR); ctx.restore();
}
