/* @ticktoon-ref-shot
{
  "title": "一卷入水城",
  "note": "横向卷轴展开，层叠民居、拱桥、水纹与小船组成无对白的完整一场",
  "duration": 8,
  "resources": [
    { "type": "font", "name": "sans-400" }
  ],
  "tags": ["皮影", "卷轴", "水城", "拱桥"]
}
*/
// 本场的“戏台”是一幅展开的横卷；幕布背景只来自 TT.board.stage，框角最后由 stageFrame 压上。
const T = api.t;
const clamp01 = TT.clamp01;
const ease = TT.ease;
const TAU = Math.PI * 2;
const INK = '#32170f';
const RED = '#9e3d2c';
const TEAL = '#315c56';
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
const roof = (x, y, w, color) => {
  ctx.save(); ctx.translate(x, y);
  poly([[-w * 0.6, 8], [-w * 0.38, -4], [-w * 0.20, -42], [0, -58], [w * 0.20, -42], [w * 0.38, -4], [w * 0.6, 8], [w * 0.38, 16], [0, 8], [-w * 0.38, 16]], color, INK, 5);
  line([[-w * 0.56, 7], [-w * 0.66, -12]], INK, 4);
  line([[w * 0.56, 7], [w * 0.66, -12]], INK, 4);
  for (let i = -3; i <= 3; i += 1) line([[i * w * 0.09, -35 + Math.abs(i) * 4], [i * w * 0.12, 5]], GOLD, 1.5);
  ctx.restore();
};
const house = (x, y, w, h, color, tiers = 1) => {
  ctx.save(); ctx.translate(x, y);
  for (let tier = 0; tier < tiers; tier += 1) {
    const ty = -tier * (h * 0.65);
    const tw = w * (1 - tier * 0.14);
    poly([[-tw / 2, ty - h], [tw / 2, ty - h], [tw / 2, ty], [-tw / 2, ty]], color, INK, 5);
    roof(0, ty - h, tw * 1.12, tier % 2 ? TEAL : RED);
    for (let i = -1; i <= 1; i += 1) {
      const wx = i * tw * 0.25;
      ctx.fillStyle = LIGHT; ctx.fillRect(wx - 18, ty - h + 44, 36, 58);
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(wx - 18, ty - h + 44, 36, 58);
      line([[wx, ty - h + 45], [wx, ty - h + 101]], INK, 2);
      line([[wx - 17, ty - h + 72], [wx + 17, ty - h + 72]], INK, 2);
    }
    line([[-tw * 0.46, ty - 20], [tw * 0.46, ty - 20]], GOLD, 3);
  }
  ctx.restore();
};

ctx.save();
ctx.globalAlpha = TT.env.fade(T, api.d, 0.4, 0.35);
TT.board.stage(ctx, { W, H }, { seed: 68 });

const open = prog(0.1, 1.25);
// 卷内内容从中轴向两侧展开，轴杆始终属于戏台固定层。
ctx.save();
ctx.beginPath(); ctx.rect(142, 138, 1636, 744); ctx.clip();
ctx.translate(W / 2, 0); ctx.scale(Math.max(0.001, open), 1); ctx.translate(-W / 2, 0);

// 远山和月只用水褐淡层，留出建筑的深色轮廓。
ctx.save(); ctx.globalAlpha *= 0.26;
ctx.beginPath(); ctx.arc(1410, 300, 94, 0, TAU); ctx.fillStyle = GOLD; ctx.fill();
poly([[120, 520], [340, 360], [510, 470], [720, 320], [920, 480], [1150, 340], [1370, 480], [1580, 350], [1800, 490], [1800, 640], [120, 640]], '#9a7048', null);
ctx.restore();

// 两岸民居高低不一，中间留给拱桥。
house(280, 646, 260, 190, '#875038', 2);
house(545, 650, 230, 170, '#315c56', 1);
house(1445, 650, 250, 180, '#875038', 2);
house(1690, 655, 190, 150, '#315c56', 1);
// 远处小阁楼加深层次。
ctx.save(); ctx.globalAlpha *= 0.58; house(1120, 565, 180, 130, '#9a7048', 2); ctx.restore();

// 水面不是现代渐变背景，而是青绿皮片与透雕水纹。
ctx.fillStyle = 'rgba(49,92,86,0.28)'; ctx.fillRect(130, 646, 1660, 238);
line([[130, 648], [1790, 648]], INK, 5);
ctx.save();
ctx.globalAlpha *= 0.42;
for (let i = 0; i < 13; i += 1) {
  const y = 680 + i * 15;
  const x = 160 + (i % 3) * 45;
  const length = 300 + (i % 4) * 120;
  for (let j = 0; j < 3; j += 1) {
    const sx = x + j * 520 + Math.sin(T * 0.8 + i + j) * 12;
    ctx.beginPath(); ctx.moveTo(sx, y);
    ctx.bezierCurveTo(sx + length * 0.24, y - 8, sx + length * 0.38, y + 8, sx + length * 0.58, y);
    ctx.bezierCurveTo(sx + length * 0.76, y - 7, sx + length * 0.88, y + 5, sx + length, y);
    ctx.strokeStyle = i % 3 ? '#6e8b72' : GOLD; ctx.lineWidth = 2.2;
    ctx.stroke();
  }
}
ctx.restore();

// 单孔拱桥：外轮廓和内拱同一路径，桥下真正留出水与远岸。
ctx.beginPath();
ctx.moveTo(650, 754); ctx.lineTo(650, 690);
ctx.quadraticCurveTo(940, 478, 1240, 690); ctx.lineTo(1240, 754);
ctx.lineTo(1135, 754); ctx.quadraticCurveTo(944, 596, 758, 754); ctx.closePath();
ctx.fillStyle = '#8a4b32'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.stroke();
ctx.beginPath(); ctx.moveTo(650, 682); ctx.quadraticCurveTo(940, 470, 1240, 682);
ctx.strokeStyle = GOLD; ctx.lineWidth = 4; ctx.stroke();
for (let i = 0; i <= 12; i += 1) {
  const p = i / 12;
  const x = 650 + p * 590;
  const y = (1 - p) * (1 - p) * 682 + 2 * (1 - p) * p * 470 + p * p * 682;
  line([[x, y - 50], [x, y + 4]], INK, 4);
}
ctx.beginPath(); ctx.moveTo(650, 632); ctx.quadraticCurveTo(940, 420, 1240, 632);
ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke();

// 桥上两个微小身影只作比例尺，不抢建筑和舟。
for (const [x, y, flip] of [[900, 528, 1], [1010, 540, -1]]) {
  ctx.save(); ctx.translate(x, y); ctx.scale(0.42 * flip, 0.42);
  poly([[-28, -112], [26, -112], [42, 0], [-40, 0]], RED, INK, 5);
  poly([[-22, -158], [-20, -198], [12, -210], [28, -184], [48, -172], [25, -160], [20, -128], [-12, -122]], TEAL, INK, 5);
  line([[22, -100], [62, -46]], INK, 9);
  line([[0, -116], [10, 90]], '#4a2b1a', 4);
  ctx.restore();
}

// 小船独立横向滑行，船夫、撑篙和灯笼同在一个局部坐标系。
const boatIn = prog(1.0, 0.8);
const boatX = 1390 - prog(1.0, 5.5) * 190;
ctx.save(); ctx.translate(boatX + (1 - boatIn) * 240, 786 + Math.sin(T * 1.7) * 5); ctx.globalAlpha *= boatIn;
ctx.beginPath(); ctx.moveTo(-190, -20); ctx.quadraticCurveTo(-130, 68, 90, 54); ctx.quadraticCurveTo(166, 40, 206, -30); ctx.quadraticCurveTo(30, 4, -190, -20); ctx.closePath();
ctx.fillStyle = '#6f3928'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke();
line([[-156, -15], [172, -24]], GOLD, 3);
for (let i = 0; i < 5; i += 1) line([[-110 + i * 55, 4], [-90 + i * 50, 40]], GOLD, 2);
// 船夫侧影与关节。
poly([[-36, -132], [22, -132], [48, -24], [-48, -24]], TEAL, INK, 5);
poly([[-24, -180], [-22, -214], [8, -230], [30, -206], [52, -192], [28, -180], [24, -148], [-12, -142]], RED, INK, 5);
poly([[-34, -216], [16, -250], [52, -214]], INK, INK, 4);
ctx.save(); ctx.translate(20, -112); ctx.rotate(-0.4 + Math.sin(T * 1.7) * 0.05);
poly([[0, 0], [64, 10], [88, 30], [70, 50], [8, 34]], TEAL, INK, 5);
ctx.beginPath(); ctx.arc(76, 32, 7, 0, TAU); ctx.fillStyle = GOLD; ctx.fill();
line([[74, 30], [176, 190]], '#4a2b1a', 5);
ctx.restore();
line([[-20, -120], [-60, 80]], '#4a2b1a', 3);
// 船头小灯。
line([[-118, -18], [-118, -96]], INK, 4);
ctx.beginPath(); ctx.ellipse(-118, -112, 24, 31, 0, 0, TAU); ctx.fillStyle = RED; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
line([[-118, -140], [-118, -84]], GOLD, 2);
ctx.restore();

ctx.restore(); // 卷内裁剪与展开变换

// 卷轴上下细边与左右轴杆，不把整个幕布换成一张卡片。
const rodOffset = (1 - open) * 790;
for (const side of [-1, 1]) {
  const x = W / 2 + side * (835 + rodOffset * 0) - side * rodOffset;
  ctx.save(); ctx.translate(x, 510);
  ctx.fillStyle = '#4e3020'; ctx.fillRect(-15, -390, 30, 780);
  ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.strokeRect(-15, -390, 30, 780);
  for (const y of [-410, 410]) {
    ctx.beginPath(); ctx.ellipse(0, y, 34, 22, 0, 0, TAU); ctx.fillStyle = '#6f442b'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, y, 8, 0, TAU); ctx.fillStyle = GOLD; ctx.fill();
  }
  line([[0, -370], [0, 370]], GOLD, 2);
  ctx.restore();
}
ctx.save(); ctx.globalAlpha *= open;
line([[142, 138], [1778, 138]], GOLD, 3);
line([[142, 882], [1778, 882]], GOLD, 3);
for (const x of [160, 1760]) {
  poly([[x, 154], [x + 9, 166], [x, 178], [x - 9, 166]], RED, null);
  poly([[x, 842], [x + 9, 854], [x, 866], [x - 9, 854]], RED, null);
}
ctx.restore();
TT.board.stageFrame(ctx, { W, H });
ctx.restore();
