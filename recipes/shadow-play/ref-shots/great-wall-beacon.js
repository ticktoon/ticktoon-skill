/* @ticktoon-ref-shot
{
  "title": "烽火过山",
  "note": "远中山三层、折线长城、烽火台与小比例行进人物；远景叙事构图",
  "duration": 8,
  "resources": [
    { "type": "font", "name": "sans-400" }
  ],
  "tags": ["皮影", "长城", "山水", "烽火"]
}
*/
// 大远景也可以演皮影：人物缩小，让山、墙与烽火承担动作。
const T = api.t;
const clamp01 = TT.clamp01;
const ease = TT.ease;
const TAU = Math.PI * 2;
const INK = '#32170f';
const RED = '#9e3d2c';
const GOLD = '#d8a457';
const LIGHT = '#f1d59a';
const prog = (at, dur = 0.6) => ease.inOutCubic(clamp01((T - at) / dur));
const poly = (pts, fill, stroke = INK, width = 5) => {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.stroke(); }
};
const line = (pts, color = INK, width = 4) => {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
};
const mountain = (pts, fill) => {
  ctx.beginPath(); ctx.moveTo(pts[0][0], H);
  for (const p of pts) ctx.lineTo(p[0], p[1]);
  ctx.lineTo(pts[pts.length - 1][0], H); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
};

const wallSegment = (a, b) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  ctx.save(); ctx.translate(a[0], a[1]); ctx.rotate(angle);
  poly([[0, -40], [len, -40], [len, 42], [0, 42]], '#8b5838', INK, 6);
  line([[0, -36], [len, -36]], GOLD, 3);
  for (let x = 8; x < len - 15; x += 58) {
    ctx.fillStyle = '#8b5838'; ctx.fillRect(x, -62, 32, 25);
    ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.strokeRect(x, -62, 32, 25);
  }
  for (let x = 48; x < len - 20; x += 116) {
    poly([[x, -4], [x + 15, -4], [x + 15, 24], [x, 24]], '#3e271b', null);
  }
  ctx.restore();
};

const guard = (x, y, s, flip, offset) => {
  const walk = Math.sin(T * 3.2 + offset);
  ctx.save(); ctx.translate(x + Math.sin(T * 0.35 + offset) * 14, y); ctx.scale(s * flip, s);
  poly([[-52, -210], [40, -210], [72, -24], [12, -36], [-18, -18], [-70, -26]], RED, INK, 6);
  poly([[-42, -218], [-34, -270], [32, -270], [48, -210]], '#315c56', INK, 5);
  for (let i = 0; i < 3; i += 1) poly([[-30 + i * 28, -176], [-20 + i * 28, -162], [-30 + i * 28, -148], [-40 + i * 28, -162]], LIGHT, null);
  ctx.save(); ctx.translate(-25, -52); ctx.rotate(walk * 0.16);
  poly([[-18, 0], [20, 0], [12, 58], [-32, 58]], INK, INK, 4); ctx.restore();
  ctx.save(); ctx.translate(24, -52); ctx.rotate(-walk * 0.16);
  poly([[-18, 0], [20, 0], [34, 58], [-12, 58]], INK, INK, 4); ctx.restore();
  poly([[-32, -314], [-36, -360], [-8, -388], [28, -366], [38, -342], [58, -328], [36, -314], [32, -292], [-4, -282]], RED, INK, 5);
  poly([[-40, -358], [-10, -404], [36, -382], [44, -350]], INK, INK, 4);
  line([[24, -340], [34, -341]], LIGHT, 3);
  // 持矛臂与长矛。
  ctx.save(); ctx.translate(28, -244); ctx.rotate(-0.28 + walk * 0.05);
  poly([[0, 0], [64, 20], [84, 52], [62, 68], [8, 38]], '#315c56', INK, 5);
  ctx.beginPath(); ctx.arc(70, 48, 8, 0, TAU); ctx.fillStyle = GOLD; ctx.fill();
  line([[68, 48], [134, -236]], '#4a2b1a', 6);
  poly([[134, -236], [146, -278], [154, -232]], GOLD, INK, 3);
  ctx.restore();
  line([[-24, -240], [-70, 180]], '#4a2b1a', 3);
  line([[20, -230], [86, 180]], '#4a2b1a', 3);
  ctx.restore();
};

ctx.save();
ctx.globalAlpha = TT.env.fade(T, api.d, 0.45, 0.35);
TT.board.stage(ctx, { W, H }, { seed: 51 });

// 烽火后的暖天光只照亮局部，远山仍保持皮影层片感。
const sky = ctx.createRadialGradient(1430, 270, 30, 1430, 270, 780);
sky.addColorStop(0, 'rgba(244,164,65,0.38)');
sky.addColorStop(0.52, 'rgba(205,121,47,0.12)');
sky.addColorStop(1, 'rgba(102,49,22,0)');
ctx.fillStyle = sky; ctx.fillRect(520, 0, 1400, 1000);

mountain([[0, 510], [160, 360], [300, 460], [480, 250], [660, 440], [830, 310], [1020, 470], [1220, 290], [1410, 420], [1610, 250], [1800, 410], [1920, 330]], '#b8986c');
mountain([[0, 660], [190, 500], [370, 610], [560, 420], [760, 590], [960, 430], [1160, 590], [1390, 400], [1580, 560], [1760, 420], [1920, 520]], '#8c6d4c');
// 山脊透光线顺着坡向，不铺写实纹理。
ctx.save(); ctx.globalAlpha *= 0.34;
line([[380, 596], [558, 442], [632, 520]], LIGHT, 4);
line([[970, 450], [1080, 520], [1150, 580]], LIGHT, 4);
line([[1390, 420], [1490, 480], [1560, 548]], LIGHT, 4);
ctx.restore();
mountain([[0, 810], [180, 670], [390, 760], [610, 610], [800, 780], [1030, 650], [1230, 770], [1480, 610], [1690, 730], [1920, 620]], '#584733');

// 城墙沿山脊折转，城砖与垛口随每段方向旋转。
const wall = [[-40, 790], [360, 690], [720, 742], [1060, 570], [1515, 455]];
for (let i = 0; i < wall.length - 1; i += 1) wallSegment(wall[i], wall[i + 1]);

// 烽火台是最高、最重的轮廓。
ctx.save(); ctx.translate(1500, 444);
poly([[-132, 8], [132, 8], [108, -222], [-108, -222]], '#77452e', INK, 8);
poly([[-158, -224], [158, -224], [136, -270], [-136, -270]], '#8d5131', INK, 7);
for (let i = -2; i <= 2; i += 1) {
  ctx.fillStyle = '#8d5131'; ctx.fillRect(i * 58 - 18, -300, 36, 34);
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.strokeRect(i * 58 - 18, -300, 36, 34);
}
for (let row = 0; row < 3; row += 1) {
  for (let col = -1; col <= 1; col += 1) {
    const x = col * 70;
    const y = -180 + row * 64;
    poly([[x - 14, y], [x + 14, y], [x + 14, y + 34], [x - 14, y + 34]], '#3b251a', null);
  }
}
line([[-108, -214], [108, -214]], GOLD, 3);
// 火盆、火舌和受风拉长的烟。
poly([[-82, -302], [82, -302], [58, -272], [-58, -272]], '#4d2a1c', INK, 5);
const fireIn = prog(1.1, 0.7);
ctx.save(); ctx.translate(0, -312); ctx.scale(1, Math.max(0.001, fireIn)); ctx.globalAlpha *= fireIn;
const fireGlow = ctx.createRadialGradient(0, -75, 8, 0, -75, 245);
fireGlow.addColorStop(0, 'rgba(255,198,82,0.56)'); fireGlow.addColorStop(1, 'rgba(212,93,31,0)');
ctx.fillStyle = fireGlow; ctx.fillRect(-270, -330, 540, 400);
for (let i = -2; i <= 2; i += 1) {
  const sway = Math.sin(T * 4.8 + i) * 13;
  ctx.save(); ctx.translate(i * 30, 0);
  ctx.beginPath(); ctx.moveTo(-24, 0); ctx.bezierCurveTo(-50, -60, sway - 18, -112 - Math.abs(i) * 12, sway + 8, -170 + Math.abs(i) * 20); ctx.bezierCurveTo(sway + 30, -94, 52, -48, 24, 0); ctx.closePath();
  ctx.fillStyle = i % 2 ? '#d96b2e' : '#f2ad47'; ctx.fill();
  ctx.restore();
}
ctx.restore();
for (let i = 0; i < 4; i += 1) {
  const drift = prog(1.6 + i * 0.25, 1.4);
  ctx.save(); ctx.globalAlpha *= 0.12 * (1 - i * 0.16) * drift;
  ctx.beginPath(); ctx.ellipse(40 + i * 66 + Math.sin(T + i) * 18, -500 - i * 74, 100 + i * 20, 45 + i * 9, -0.28, 0, TAU);
  ctx.fillStyle = '#5a4434'; ctx.fill(); ctx.restore();
}
ctx.restore();

const guardsIn = prog(0.7, 0.9);
ctx.save(); ctx.globalAlpha *= guardsIn;
guard(705 - (1 - guardsIn) * 180, 699, 0.42, 1, 0);
guard(1060 - (1 - guardsIn) * 140, 534, 0.36, 1, 2.2);
ctx.restore();

// 前景松枝用大片镂空形封住左下角，增强台口深度。
ctx.save(); ctx.translate(40, 905); ctx.rotate(-0.18);
line([[0, 80], [70, -120], [180, -300]], '#30271c', 24);
for (let i = 0; i < 7; i += 1) {
  const x = 45 + i * 24;
  const y = -60 - i * 35;
  poly([[x, y], [x - 120, y - 22], [x - 36, y - 48], [x - 136, y - 78], [x + 12, y - 58], [x + 104, y - 94], [x + 44, y - 36]], '#354233', INK, 3);
}
ctx.restore();
TT.board.stageFrame(ctx, { W, H });
ctx.restore();
