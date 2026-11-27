/* @ticktoon-ref-shot
{
  "title": "意义 · 从亭长到同行者",
  "note": "用一根差遣绳、一块亭长牌和一面幡交代身份变化：绳断、牌落、众人出现",
  "duration": 8.8,
  "resources": [
    { "type": "font", "name": "sans-900" },
    { "type": "font", "name": "sans-400" }
  ],
  "sfx": [
    { "type": "wood", "at": 0.5, "gain": 0.4 },
    { "type": "whoosh", "at": 4.4, "gain": 0.45 },
    { "type": "gong", "at": 4.9, "gain": 0.5 }
  ],
  "tags": ["纸上剧场", "身份", "转变", "旗幡", "纸偶"]
}
*/
const T = api.t;
const C = TT.chronicle;
const CUES = api.cues.length ? api.cues : [
  { text: '放徒之前，他只是奉命押送的沛县亭长。', start: 0.8, end: 4.0 },
  { text: '放徒之后，他要自己承担选择，也不再是一个人。', start: 4.3, end: 8.2 },
];
const at = (i, dt = 0) => (CUES[i]?.start ?? 0) + dt;
const CUT = CUES[1].start + 0.05;
TT.board.stage(ctx, { W, H }, { seed: 3, variant: 0, screen: 'white' });
TT.text(ctx, '一次选择，改变了什么？', W * 0.5, 150, 46,
  { fontKey: 'sans-900', color: '#7A1E14', align: 'center', baseline: 'middle' });

const dim = C.seg(T, CUT, CUT + 1.1, C.E.out);
C.gate(ctx, { t: T, at: 0.3, x: 340, y: 600, w: 330, h: 350, alpha: 0.94 - 0.5 * dim });
ctx.save(); ctx.globalAlpha *= 0.9 - 0.5 * dim;
TT.text(ctx, '沛县县廷', 340, 648, 30, { fontKey: 'sans-900', color: '#5B4030', align: 'center', baseline: 'middle' });
ctx.restore();

if (T < CUT) {
  const sag = 74 + Math.sin(T * 2.2) * 3;
  ctx.save(); ctx.strokeStyle = 'rgba(122,30,20,.72)'; ctx.lineWidth = 3.2;
  ctx.beginPath(); ctx.moveTo(504, 516); ctx.quadraticCurveTo(724, 516 + sag, 932, 648); ctx.stroke();
  ctx.restore();
} else {
  const r = C.seg(T, CUT, CUT + 0.55, C.E.out);
  if (r < 1) {
    ctx.save(); ctx.globalAlpha *= 0.75 * (1 - r);
    ctx.strokeStyle = 'rgba(122,30,20,.8)'; ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(504, 516); ctx.quadraticCurveTo(584, 532, 504 + 170 * (1 - r), 522); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(932, 648); ctx.quadraticCurveTo(872, 634, 932 - 170 * (1 - r), 636); ctx.stroke();
    ctx.restore();
  }
}

C.banner(ctx, {
  t: T, at: CUT + 0.15, x: 1600, y: 862, h: 420, w: 108, ch: 300,
  text: '同行者', color: 'red',
});

const followerAt = CUT + 0.35;
const FOLLOWERS = [
  [1100, 780, 74], [1180, 780, 74], [1260, 780, 74], [1340, 780, 74], [1420, 780, 74],
  [1080, 850, 84], [1170, 850, 84], [1260, 850, 84], [1350, 850, 84], [1440, 850, 84],
];
const FCOLORS = ['#6E6B58', '#7A6A4F', '#5E6B5A', '#7B6455'];
FOLLOWERS.forEach(([x0, y0, h0], i) => {
  const x = x0 + ((i * 13) % 17) - 8;
  const y = y0 + ((i * 7) % 11) - 5;
  const h = h0 + ((i * 5) % 9) - 4;
  const ap = C.seg(T, followerAt + i * 0.06, followerAt + i * 0.06 + 0.4, C.E.out);
  C.figure(ctx, {
    t: T, at: followerAt + i * 0.06, x: x + (1 - ap) * 70, y, h,
    color: FCOLORS[(i * 3) % 4], dir: -1, lean: ((i * 3) % 5 - 2) * 0.008,
  });
});

C.figure(ctx, {
  t: T, at: 0.35, x: 980, y: 860, h: 300,
  style: T < CUT ? 'official' : 'leader',
  color: T < CUT ? '#5E6B5A' : 'red', dir: 1,
});
TT.text(ctx, '刘邦', 980, 535, 30, { fontKey: 'sans-900', color: '#3B2819', align: 'center', baseline: 'bottom' });

const fall = C.seg(T, CUT, CUT + 1.3, C.E.sine);
ctx.save();
ctx.globalAlpha *= C.seg(T, 0.7, 1.1, C.E.out) * (1 - C.seg(fall, 0.86, 1));
ctx.translate(700, 613 + 165 * fall * fall);
ctx.rotate(0.045 + 0.5 * fall * fall);
ctx.fillStyle = '#EAD3A6';
ctx.strokeStyle = '#5B4030'; ctx.lineWidth = 2.6;
ctx.beginPath(); ctx.rect(-50, 0, 100, 64); ctx.fill(); ctx.stroke();
ctx.strokeStyle = 'rgba(122,30,20,.55)'; ctx.lineWidth = 1.6;
ctx.beginPath(); ctx.rect(-41, 9, 82, 46); ctx.stroke();
TT.text(ctx, '亭长', 0, 34, 30, { fontKey: 'sans-900', color: '#5B2A18', align: 'center', baseline: 'middle' });
ctx.restore();

if (T < CUT) {
  ctx.save(); ctx.strokeStyle = 'rgba(122,30,20,.55)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(700, 589); ctx.lineTo(672, 613); ctx.moveTo(700, 589); ctx.lineTo(728, 613); ctx.stroke();
  ctx.restore();
}

const fq = C.seg(T, CUT, CUT + 0.75, C.E.out);
if (fq > 0 && fq < 1) {
  ctx.save(); ctx.globalAlpha *= (1 - fq) * 0.45;
  ctx.strokeStyle = '#B5321F'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(980, 700, 80 + 110 * fq, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#B5321F';
  for (let k = 0; k < 5; k += 1) {
    const a = -0.5 + k * 0.62, r = 110 + 100 * fq;
    ctx.beginPath();
    ctx.arc(980 + Math.cos(a) * r, 700 + Math.sin(a) * r * 0.86, 5 + 4 * (1 - fq), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

C.systemCaption(ctx, CUES.find((c) => T >= c.start && T < c.end), { t: T, W, H });
TT.board.stageFrame(ctx, { W, H });
