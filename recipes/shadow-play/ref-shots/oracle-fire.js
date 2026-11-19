/* @ticktoon-ref-shot
{
  "title": "火问龟甲",
  "note": "油灯特写、侧面占者与逐段亮起的龟甲裂纹；器物是画面主体",
  "duration": 7.5,
  "resources": [
    { "type": "font", "name": "sans-400" }
  ],
  "tags": ["皮影", "油灯", "龟甲", "光影"]
}
*/
// 不求人物齐全：一盏近景油灯、一片龟甲和一个占者就足以组织整幕。
const T = api.t;
const clamp01 = TT.clamp01;
const ease = TT.ease;
const TAU = Math.PI * 2;
const INK = '#32170f';
const RED = '#9e3d2c';
const GOLD = '#d8a457';
const LIGHT = '#f1d59a';
const prog = (at, dur = 0.6) => ease.inOutCubic(clamp01((T - at) / dur));
const line = (pts, color = INK, width = 4) => {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
};
const poly = (pts, fill, stroke = INK, width = 5) => {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.stroke(); }
};
const joint = (x, y, r = 9) => {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = INK; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r * 0.38, 0, TAU); ctx.fillStyle = GOLD; ctx.fill();
};

ctx.save();
TT.board.stage(ctx, { W, H }, { seed: 23 });

// 本场比常态更暗，只让油灯和龟甲两处透光；径向暗角不替代幕布。
const shade = ctx.createRadialGradient(850, 490, 160, 850, 490, 1120);
shade.addColorStop(0, 'rgba(75,35,15,0)');
shade.addColorStop(0.65, 'rgba(64,30,15,0.15)');
shade.addColorStop(1, 'rgba(35,17,10,0.48)');
ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H);

// 后方只占者：侧面长冠、独立前臂与三根操纵杆。
const seerIn = prog(0.35, 1.1);
ctx.save();
ctx.translate(1515 + (1 - seerIn) * 320, 790);
ctx.scale(-0.88, 0.88);
ctx.globalAlpha *= seerIn;
poly([[-92, -320], [50, -320], [118, -40], [42, -52], [0, -24], [-48, -52], [-132, -36]], '#315c56', INK, 7);
poly([[-68, -330], [-52, -410], [38, -410], [70, -320]], '#315c56', INK, 7);
for (let i = 0; i < 5; i += 1) {
  const x = -70 + i * 35;
  poly([[x, -278], [x + 11, -260], [x, -242], [x - 11, -260]], LIGHT, null);
  line([[x, -210], [x + 12, -72]], GOLD, 2);
}
poly([[-70, -84], [-15, -84], [-24, 0], [-102, 0]], INK, INK, 4);
poly([[20, -84], [74, -84], [96, 0], [22, 0]], INK, INK, 4);

// 伸向龟甲的前臂是两片可转动皮片。
ctx.save(); ctx.translate(38, -372); ctx.rotate(-0.50 + Math.sin(T * 1.5) * 0.025);
poly([[0, 0], [92, 12], [134, 52], [112, 82], [32, 54]], '#315c56', INK, 6);
joint(0, 0, 11);
ctx.translate(121, 61); ctx.rotate(-0.48);
poly([[0, 0], [90, -6], [125, 10], [90, 28], [0, 24]], '#315c56', INK, 5);
joint(0, 10, 8);
line([[112, 9], [170, 2]], GOLD, 4);
ctx.restore();

// 侧脸朝局部 +x，经外层翻转后面向龟甲。
ctx.save(); ctx.translate(0, -458);
poly([[-44, 62], [-50, -22], [-24, -70], [24, -64], [42, -38], [68, -20], [43, -5], [47, 13], [30, 20], [26, 52]], '#9e3d2c', INK, 6);
poly([[-48, -35], [-38, -96], [18, -110], [45, -62], [8, -72]], INK, INK, 4);
poly([[-42, -94], [-24, -190], [4, -216], [28, -112]], '#9e3d2c', INK, 6);
line([[-18, -178], [8, -124]], GOLD, 3);
line([[24, -34], [36, -36]], LIGHT, 4);
joint(-24, 44, 8);
ctx.restore();
line([[-30, -376], [-100, 210]], '#4a2b1a', 3.5);
line([[62, -355], [150, 205]], '#4a2b1a', 3.5);
line([[0, -620], [0, -770]], '#4a2b1a', 3);
ctx.restore();

// 供桌与布边，把灯和龟甲放在同一个表演平面。
poly([[120, 715], [1700, 715], [1760, 770], [90, 770]], '#5e3020', INK, 7);
poly([[170, 770], [1650, 770], [1600, 862], [220, 862]], '#7d3b27', INK, 6);
for (let i = 0; i < 19; i += 1) {
  const x = 245 + i * 70;
  poly([[x, 792], [x + 16, 810], [x, 828], [x - 16, 810]], GOLD, null);
}
line([[110, 770], [1730, 770]], GOLD, 3);

// 龟甲先出现轮廓，再随占卜逐段亮起裂纹。
const shellIn = prog(0.65, 0.9);
const shellGlow = ctx.createRadialGradient(1015, 480, 35, 1015, 480, 420);
shellGlow.addColorStop(0, `rgba(255,196,82,${0.24 * shellIn})`);
shellGlow.addColorStop(0.55, `rgba(223,137,43,${0.12 * shellIn})`);
shellGlow.addColorStop(1, 'rgba(96,45,19,0)');
ctx.fillStyle = shellGlow; ctx.fillRect(560, 80, 920, 800);

ctx.save();
ctx.translate(1010, 476); ctx.rotate(-0.12); ctx.scale(1.05, 1.05);
ctx.globalAlpha *= shellIn;
ctx.beginPath();
ctx.moveTo(-265, -40);
ctx.bezierCurveTo(-275, -205, -125, -300, 35, -274);
ctx.bezierCurveTo(205, -250, 290, -118, 260, 48);
ctx.bezierCurveTo(230, 214, 82, 276, -80, 238);
ctx.bezierCurveTo(-220, 205, -292, 100, -265, -40);
ctx.fillStyle = '#9b6338'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.stroke();
ctx.beginPath(); ctx.ellipse(0, -5, 224, 225, 0, 0, TAU);
ctx.strokeStyle = GOLD; ctx.lineWidth = 4; ctx.stroke();

// 甲片不是规则网格：中脊与六块不规则盾片组成雕版。
poly([[-34, -222], [40, -218], [58, -112], [18, -42], [-45, -98]], '#7c472d', GOLD, 3);
poly([[-46, -82], [20, -34], [48, 62], [-12, 142], [-70, 65]], '#815036', GOLD, 3);
poly([[-8, 150], [54, 74], [92, 142], [40, 218], [-42, 205]], '#75432c', GOLD, 3);
line([[-48, -204], [-168, -146], [-206, -40], [-154, 36], [-74, 60]], GOLD, 3);
line([[52, -204], [160, -142], [208, -36], [158, 46], [54, 68]], GOLD, 3);
line([[-152, 48], [-188, 124], [-96, 196], [-38, 202]], GOLD, 3);
line([[158, 54], [182, 126], [96, 196], [48, 208]], GOLD, 3);
for (let i = 0; i < 9; i += 1) {
  const a = -2.75 + i * 0.67;
  const x = Math.cos(a) * 237;
  const y = Math.sin(a) * 224 - 5;
  ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fillStyle = LIGHT; ctx.fill();
}

// 发光裂纹只沿刻痕生长，不出现白板笔身。
const cracks = [
  [[-12, -198], [-28, -142], [8, -94], [-20, -34], [18, 18]],
  [[-24, -139], [-88, -118], [-128, -64], [-184, -48]],
  [[5, -92], [72, -118], [118, -80], [176, -92]],
  [[-18, -30], [-80, 6], [-98, 70], [-152, 112]],
  [[16, 20], [74, 48], [86, 112], [142, 148]],
  [[-6, 32], [-20, 98], [12, 156], [-8, 206]],
];
cracks.forEach((pts, i) => {
  const k = prog(1.55 + i * 0.32, 0.52);
  TT.pen.stroke(ctx, pts, k, { pen: 'marker', color: '#ffbf55', width: 13, alpha: 0.16, smooth: true, penBody: false });
  TT.pen.stroke(ctx, pts, k, { pen: 'marker', color: '#ffe3a0', width: 4.2, alpha: 0.94, smooth: true, taper: 'soft', penBody: false });
});
ctx.restore();

// 近景油灯：底座、灯盏、灯芯与双层火舌。
const lampIn = prog(0.1, 0.75);
ctx.save(); ctx.translate(400, 696); ctx.scale(1.12, 1.12); ctx.globalAlpha *= lampIn;
const lampGlow = ctx.createRadialGradient(0, -210, 10, 0, -210, 340);
lampGlow.addColorStop(0, 'rgba(255,211,114,0.62)');
lampGlow.addColorStop(0.38, 'rgba(244,156,54,0.24)');
lampGlow.addColorStop(1, 'rgba(164,76,25,0)');
ctx.fillStyle = lampGlow; ctx.fillRect(-370, -580, 740, 680);
poly([[-120, 4], [120, 4], [92, 34], [-92, 34]], '#5c3021', INK, 6);
poly([[-38, -100], [38, -100], [58, 4], [-58, 4]], '#8a4a2b', INK, 6);
for (let i = -1; i <= 1; i += 1) poly([[i * 24, -76], [i * 24 + 9, -58], [i * 24, -40], [i * 24 - 9, -58]], GOLD, null);
ctx.beginPath(); ctx.moveTo(-160, -130); ctx.quadraticCurveTo(-120, -64, 0, -70); ctx.quadraticCurveTo(124, -64, 172, -142); ctx.quadraticCurveTo(70, -114, 0, -124); ctx.quadraticCurveTo(-80, -112, -160, -130); ctx.closePath();
ctx.fillStyle = '#9e3d2c'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.stroke();
line([[-140, -129], [142, -137]], GOLD, 4);
line([[72, -137], [92, -174]], INK, 6);
const flame = 1 + Math.sin(T * 6.2) * 0.055 + Math.sin(T * 9.1) * 0.025;
ctx.save(); ctx.translate(92, -174); ctx.scale(flame, flame);
ctx.beginPath(); ctx.moveTo(0, 8); ctx.bezierCurveTo(-52, -24, -28, -92, 10, -152); ctx.bezierCurveTo(14, -98, 62, -62, 30, -12); ctx.quadraticCurveTo(18, 8, 0, 8); ctx.closePath();
ctx.fillStyle = '#d96b2e'; ctx.fill();
ctx.beginPath(); ctx.moveTo(4, 0); ctx.bezierCurveTo(-20, -30, -4, -72, 12, -100); ctx.bezierCurveTo(16, -58, 36, -34, 20, -6); ctx.closePath(); ctx.fillStyle = '#ffe3a0'; ctx.fill();
ctx.restore();
ctx.restore();

// 少量固定浮尘只在光柱里缓慢漂移。
ctx.save();
for (let i = 0; i < 18; i += 1) {
  const x = 260 + ((i * 137) % 1040);
  const y = 160 + ((i * 83) % 470) + Math.sin(T * 0.45 + i) * 12;
  ctx.globalAlpha = 0.16 + (i % 3) * 0.05;
  ctx.beginPath(); ctx.arc(x, y, 2 + (i % 2), 0, TAU); ctx.fillStyle = LIGHT; ctx.fill();
}
ctx.restore();
TT.board.stageFrame(ctx, { W, H });
ctx.restore();
