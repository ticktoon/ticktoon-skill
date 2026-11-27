/* @ticktoon-ref-shot
{
  "title": "后果 · 有人离开，有人回来",
  "note": "纸偶走远、缩小、再折返重聚；人数变化是走出来的，不是换一张点位图",
  "duration": 10.8,
  "resources": [
    { "type": "font", "name": "sans-900" },
    { "type": "font", "name": "sans-400" },
    { "type": "image", "name": "manacles", "src": "skill:recipes/paper-chronicle/icons/assets/manacles.svg" }
  ],
  "sfx": [
    { "type": "whoosh", "at": 1.1, "gain": 0.4 },
    { "type": "step", "at": 4.6, "gain": 0.35 },
    { "type": "drum", "at": 7.5, "gain": 0.4 }
  ],
  "tags": ["纸上剧场", "纸偶", "离开", "重聚", "后果"]
}
*/
const T = api.t;
const C = TT.chronicle;
const CUES = api.cues.length ? api.cues : [
  { text: '刘邦解开绳索，众人各自散去。', start: 0.8, end: 4.2 },
  { text: '有人走远，也有人停住脚步，转身回来。', start: 4.5, end: 7.2 },
  { text: '十余壮士从此跟随他，不再只是同行的刑徒。', start: 7.5, end: 10.4 },
];
const at = (i, dt = 0) => (CUES[i]?.start ?? 0) + dt;
const mix = (a, b, k) => a + (b - a) * k;
TT.board.stage(ctx, { W, H }, { seed: 3, variant: 0, screen: 'white' });

TT.text(ctx, '放徒之后', 150, 150, 44, { fontKey: 'sans-900', color: '#7A1E14', align: 'left', baseline: 'middle' });
TT.text(ctx, '丰西泽 · 夜', 1770, 150, 30, { fontKey: 'sans-400', color: '#5B4030', align: 'right', baseline: 'middle' });
ctx.strokeStyle = 'rgba(74,45,25,.20)'; ctx.lineWidth = 2;
ctx.beginPath(); ctx.moveTo(150, 205); ctx.lineTo(1770, 205); ctx.stroke();

// 远景：月、地平线与泽畔芦苇
ctx.save();
const moonX = 1470, moonY = 400, moonR = 112;
const glow = ctx.createRadialGradient(moonX, moonY, moonR * 0.82, moonX, moonY, moonR * 1.5);
glow.addColorStop(0, 'rgba(216,164,87,.16)');
glow.addColorStop(1, 'rgba(216,164,87,0)');
ctx.fillStyle = glow;
ctx.beginPath(); ctx.arc(moonX, moonY, moonR * 1.5, 0, Math.PI * 2); ctx.fill();
ctx.fillStyle = 'rgba(235,206,150,.55)';
ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2); ctx.fill();
ctx.strokeStyle = 'rgba(150,108,54,.30)'; ctx.lineWidth = 2.4; ctx.stroke();
ctx.fillStyle = 'rgba(150,108,54,.08)';
ctx.beginPath(); ctx.arc(moonX - moonR * 0.32, moonY - moonR * 0.22, moonR * 0.18, 0, Math.PI * 2); ctx.fill();
ctx.beginPath(); ctx.arc(moonX + moonR * 0.26, moonY + moonR * 0.3, moonR * 0.13, 0, Math.PI * 2); ctx.fill();
ctx.strokeStyle = 'rgba(74,45,25,.10)'; ctx.lineWidth = 2;
ctx.beginPath(); ctx.moveTo(110, 706); ctx.quadraticCurveTo(430, 698, 880, 708); ctx.stroke();
ctx.strokeStyle = 'rgba(91,64,48,.30)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
for (let i = 0; i < 6; i += 1) {
  const rx = 118 + i * 26, top = 616 - (i % 3) * 34;
  ctx.beginPath(); ctx.moveTo(rx, 882); ctx.quadraticCurveTo(rx - 10, (882 + top) / 2, rx + 7, top); ctx.stroke();
  ctx.fillStyle = 'rgba(91,64,48,.32)';
  ctx.beginPath(); ctx.ellipse(rx + 7, top - 9, 3.2, 8.5, 0.12, 0, Math.PI * 2); ctx.fill();
}
ctx.restore();

// 解下的枷锁留在泽畔，随人群走远而淡出
const shackleQ = C.seg(T, at(0, 0.25), at(0, 0.7), C.E.out) * (1 - C.seg(T, at(1, 0.1), at(1, 0.7), C.E.out));
if (shackleQ > 0) {
  ctx.save(); ctx.globalAlpha *= shackleQ * 0.78;
  C.icon(ctx, api.img('manacles'), { t: T, at: at(0, 0.25), x: 196, y: 818, size: 46 });
  ctx.restore();
}

const COLORS = ['#6E6B58', '#7A6A4F', '#5E6B5A', '#7B6455'];
const VP = { x: 300, y: 700 };
const SLOTS = [
  { x: 1000, y: 756, h: 78 }, { x: 1090, y: 756, h: 78 },
  { x: 1180, y: 756, h: 78 }, { x: 1270, y: 756, h: 78 },
  { x: 900, y: 846, h: 84 }, { x: 990, y: 846, h: 84 }, { x: 1080, y: 846, h: 84 },
  { x: 1170, y: 846, h: 84 }, { x: 1260, y: 846, h: 84 }, { x: 1350, y: 846, h: 84 },
];
const PEOPLE = Array.from({ length: 12 }, (_, i) => {
  const row = i < 6 ? 0 : 1, col = i % 6;
  return {
    i, row,
    hx: 900 + col * 108 + (row ? 22 : 0),
    hy: row ? 842 : 756,
    h: 74 + ((i * 7) % 16),
    color: COLORS[i % 4],
    lean: ((i * 5) % 7 - 3) * 0.006,
    stay: i === 4 || i === 9,
    delay: (i % 5) * 0.08,
    target: i === 4 ? { x: 1420, y: 852, h: 88 } : { x: 1520, y: 852, h: 88 },
  };
});
PEOPLE.filter((p) => !p.stay).forEach((p, k) => { p.order = k; p.slot = SLOTS[k]; });

const leaveBase = at(0, 0.35);
const backBase = at(1, 0.2);
const draws = [];
for (const p of PEOPLE) {
  const step = C.seg(T, leaveBase + p.delay, leaveBase + p.delay + 1.0, C.E.sine);
  const back = C.seg(T, backBase + (p.i === 9 ? 0.18 : 0), backBase + 1.9, C.E.sine);
  let x, y, h, alpha = 1, dir = -1, phase = 0;
  if (p.stay) {
    x = mix(p.hx - 34 * step, p.target.x, back);
    y = mix(p.hy, p.target.y, back);
    h = mix(p.h, p.target.h, back);
    dir = back > 0.03 ? 1 : -1;
    phase = back > 0.02 && back < 0.98 ? back : 0;
  } else {
    const went = C.seg(T, leaveBase + p.delay, leaveBase + p.delay + 1.75, C.E.sine);
    const rStart = at(2, 0.05) + (p.order % 4) * 0.12;
    const rp = C.seg(T, rStart, rStart + 2.3, C.E.sine);
    const vp = { x: VP.x + ((p.i * 5) % 6) * 34, y: VP.y + ((p.i * 3) % 4) * 20 };
    if (rp <= 0) {
      x = mix(p.hx, vp.x, went);
      y = mix(p.hy, vp.y, went);
      h = mix(p.h, 46, went);
      alpha = 1 - 0.55 * C.seg(went, 0.4, 1);
      dir = -1;
      phase = went > 0.02 && went < 0.98 ? went : 0;
    } else {
      x = mix(vp.x, p.slot.x, rp);
      y = mix(vp.y, p.slot.y, rp);
      h = mix(46, p.slot.h, rp);
      alpha = Math.min(1, 0.45 + rp * 1.6);
      dir = 1;
      phase = rp > 0.02 && rp < 0.98 ? rp : 0;
    }
  }
  draws.push({ ...p, x, y, h, alpha, dir, phase, bob: Math.sin(phase * Math.PI * 9) * 2.4 });
}
draws.sort((a, b) => a.y - b.y);

function puff(x, y, p, seed) {
  if (p <= 0.03 || p >= 0.97) return;
  ctx.save(); ctx.globalAlpha *= (1 - p) * 0.32;
  for (let k = 0; k < 3; k += 1) {
    const a = seed * 0.9 + k * 2.1;
    const dx = Math.cos(a) * (6 + 16 * p), dy = -4 - 10 * p - k * 3;
    ctx.fillStyle = '#B99A6B';
    ctx.beginPath(); ctx.ellipse(x + dx, y + dy, 5 + 6 * p, 2.5 + 2 * p, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

for (const p of draws) {
  C.figure(ctx, {
    t: T, at: -10, x: p.x, y: p.y, h: p.h, color: p.color, lean: p.lean, bob: p.bob,
    alpha: p.alpha, dir: p.dir,
  });
  if (p.h > 50) puff(p.x, p.y, p.phase, p.i);
}

C.figure(ctx, {
  t: T, at: 0.2, x: 1660, y: 852, h: 232, style: 'leader', color: 'red', dir: -1,
});
TT.text(ctx, '刘邦', 1660, 590, 34, { fontKey: 'sans-900', color: '#3B2819', align: 'center', baseline: 'bottom' });

const crowdQ = 1 - C.seg(T, at(0, 0.9), at(0, 1.6), C.E.out);
if (crowdQ > 0) {
  ctx.save(); ctx.globalAlpha *= crowdQ;
  TT.text(ctx, '众人', 1180, 618, 32, { fontKey: 'sans-900', color: '#6B5B4A', align: 'center', baseline: 'bottom' });
  ctx.restore();
}
const tenQ = C.seg(T, at(2, 0.6), at(2, 1.05), C.E.out);
if (tenQ > 0) {
  ctx.save(); ctx.globalAlpha *= tenQ;
  TT.text(ctx, '从者十人', 1150, 618, 32, { fontKey: 'sans-900', color: '#7A1E14', align: 'center', baseline: 'bottom' });
  ctx.restore();
}

C.systemCaption(ctx, CUES.find((c) => T >= c.start && T < c.end), { t: T, W, H });
TT.board.stageFrame(ctx, { W, H });
