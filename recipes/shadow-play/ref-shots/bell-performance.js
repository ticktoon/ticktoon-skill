/* @ticktoon-ref-shot
{
  "title": "编钟齐鸣",
  "note": "双层编钟架、两名击钟者与扩散声波；建筑式器物构图",
  "duration": 8,
  "resources": [
    { "type": "font", "name": "sans-400" }
  ],
  "tags": ["皮影", "编钟", "乐舞", "声波"]
}
*/
// 编钟架占据主画面，人物反而较小；声波只在击钟节拍后扩散。
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
const joint = (x, y, r = 8) => {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = INK; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r * 0.4, 0, TAU); ctx.fillStyle = GOLD; ctx.fill();
};

const bell = (x, y, s, index) => {
  const strike = Math.max(0, 1 - Math.abs(T - (2.05 + index * 0.17)) / 0.65);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.rotate(Math.sin(T * 8 + index) * 0.035 * strike);
  line([[0, -62], [0, -12]], INK, 4);
  poly([[-18, -24], [18, -24], [24, -5], [-24, -5]], '#6d3926', INK, 4);
  ctx.beginPath();
  ctx.moveTo(-32, -5); ctx.bezierCurveTo(-52, 40, -62, 108, -86, 142);
  ctx.quadraticCurveTo(0, 172, 86, 142);
  ctx.bezierCurveTo(62, 108, 52, 40, 32, -5); ctx.closePath();
  ctx.fillStyle = '#9a6536'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke();
  line([[-76, 135], [0, 151], [76, 135]], GOLD, 5);
  line([[-48, 52], [48, 52]], GOLD, 3);
  for (let row = 0; row < 2; row += 1) {
    for (let col = -2; col <= 2; col += 1) {
      ctx.beginPath(); ctx.arc(col * 22, 78 + row * 32, 5, 0, TAU); ctx.fillStyle = LIGHT; ctx.fill();
    }
  }
  for (let i = -1; i <= 1; i += 1) poly([[i * 24, 8], [i * 24 + 8, 23], [i * 24, 38], [i * 24 - 8, 23]], LIGHT, null);
  ctx.restore();
};

const musician = (x, y, s, flip, color, phase) => {
  const hit = Math.max(0, 1 - Math.abs(T - phase) / 0.7);
  ctx.save(); ctx.translate(x, y + Math.sin(T * 1.6 + phase) * 3); ctx.scale(s * flip, s);
  poly([[-70, -270], [58, -270], [100, -30], [30, -46], [-4, -22], [-42, -48], [-104, -30]], color, INK, 7);
  poly([[-58, -278], [-46, -340], [40, -340], [66, -270]], color, INK, 6);
  for (let i = 0; i < 4; i += 1) {
    poly([[-48 + i * 32, -228], [-38 + i * 32, -214], [-48 + i * 32, -200], [-58 + i * 32, -214]], LIGHT, null);
    line([[-62 + i * 39, -162], [-54 + i * 36, -62]], GOLD, 2);
  }
  poly([[-62, -78], [-12, -78], [-22, 0], [-90, 0]], INK, INK, 4);
  poly([[18, -78], [66, -78], [88, 0], [22, 0]], INK, INK, 4);

  // 击钟臂围绕肩关节转动，钟槌与手是同一根杆。
  ctx.save(); ctx.translate(36, -308); ctx.rotate(-0.75 + hit * 0.75);
  poly([[0, 0], [72, 10], [112, 48], [90, 76], [24, 48]], color, INK, 6);
  joint(0, 0, 10);
  ctx.translate(100, 54); ctx.rotate(-0.2 + hit * 0.28);
  poly([[0, 0], [70, -4], [94, 10], [70, 24], [0, 22]], color, INK, 5);
  joint(0, 10, 8);
  line([[74, 8], [214, -24]], '#4b2d1c', 7);
  ctx.beginPath(); ctx.arc(222, -26, 18, 0, TAU); ctx.fillStyle = '#6b3b27'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
  ctx.restore();

  ctx.save(); ctx.translate(-36, -304); ctx.rotate(0.16);
  poly([[0, 0], [-58, 34], [-70, 100], [-38, 108], [12, 42]], color, INK, 6); joint(-52, 96, 8);
  ctx.restore();

  // 乐师侧脸与高发髻。
  ctx.save(); ctx.translate(0, -390);
  poly([[-40, 52], [-46, -28], [-18, -68], [28, -58], [42, -32], [64, -14], [42, 0], [44, 18], [26, 24], [22, 48]], color, INK, 6);
  poly([[-44, -34], [-34, -82], [26, -82], [44, -48], [2, -60]], INK, INK, 4);
  ctx.beginPath(); ctx.arc(-6, -100, 27, 0, TAU); ctx.fillStyle = INK; ctx.fill();
  line([[22, -29], [34, -30]], LIGHT, 4);
  for (let i = 0; i < 3; i += 1) line([[-30 + i * 10, -42], [-28 + i * 10, 20]], GOLD, 2);
  joint(-20, 40, 7);
  ctx.restore();
  line([[-30, -310], [-104, 205]], '#4a2b1a', 3.5);
  line([[48, -300], [138, 205]], '#4a2b1a', 3.5);
  line([[0, -480], [0, -620]], '#4a2b1a', 3);
  ctx.restore();
};

ctx.save();
TT.board.stage(ctx, { W, H }, { seed: 37 });

const aura = ctx.createRadialGradient(960, 440, 80, 960, 440, 760);
aura.addColorStop(0, 'rgba(244,185,85,0.26)');
aura.addColorStop(0.65, 'rgba(192,112,40,0.08)');
aura.addColorStop(1, 'rgba(90,40,18,0)');
ctx.fillStyle = aura; ctx.fillRect(120, 0, 1680, 1000);

// 后排云纹远景。
ctx.save(); ctx.globalAlpha *= 0.22; ctx.strokeStyle = '#8b633e'; ctx.lineWidth = 12;
for (let i = 0; i < 7; i += 1) {
  const x = 170 + i * 270;
  ctx.beginPath(); ctx.arc(x, 250 + (i % 2) * 70, 90, Math.PI * 1.05, Math.PI * 1.9); ctx.stroke();
}
ctx.restore();

// 编钟木架：两根立柱、双层横梁、顶部屋檐与透雕脚座。
const rackIn = prog(0.12, 0.85);
ctx.save(); ctx.globalAlpha *= rackIn; ctx.translate(0, (1 - rackIn) * 28);
poly([[424, 254], [1496, 254], [1450, 306], [470, 306]], RED, INK, 8);
poly([[390, 224], [1530, 224], [1470, 178], [1350, 172], [1280, 126], [960, 94], [640, 126], [570, 172], [450, 178]], RED, INK, 8);
line([[430, 213], [1490, 213]], GOLD, 4);
for (let i = 0; i < 11; i += 1) {
  const x = 520 + i * 88;
  poly([[x, 188], [x + 17, 202], [x, 216], [x - 17, 202]], LIGHT, null);
}
poly([[452, 290], [524, 290], [510, 810], [462, 810]], '#743625', INK, 7);
poly([[1396, 290], [1468, 290], [1458, 810], [1410, 810]], '#743625', INK, 7);
poly([[486, 500], [1434, 500], [1410, 540], [510, 540]], RED, INK, 7);
poly([[382, 804], [584, 804], [548, 854], [410, 854]], '#5f3021', INK, 6);
poly([[1336, 804], [1538, 804], [1510, 854], [1372, 854]], '#5f3021', INK, 6);
for (const x of [486, 1432]) {
  for (let i = 0; i < 7; i += 1) poly([[x, 340 + i * 58], [x + 13, 356 + i * 58], [x, 372 + i * 58], [x - 13, 356 + i * 58]], GOLD, null);
}

for (let i = 0; i < 6; i += 1) bell(630 + i * 132, 306, 0.69, i);
for (let i = 0; i < 5; i += 1) bell(690 + i * 136, 540, 0.90, i + 6);
ctx.restore();

// 两侧乐师较钟架小，视线和槌头都指向钟。
const leftIn = prog(0.65, 0.9);
const rightIn = prog(0.9, 0.9);
ctx.save(); ctx.globalAlpha *= leftIn; musician(300 - (1 - leftIn) * 240, 830, 0.78, 1, TEAL, 2.1); ctx.restore();
ctx.save(); ctx.globalAlpha *= rightIn; musician(1620 + (1 - rightIn) * 240, 830, 0.78, -1, RED, 3.45); ctx.restore();

// 两次声波从钟架右侧向外扩散；每道弧由同一个击钟时刻驱动。
for (const [hitAt, cx, cy, direction] of [[2.1, 1300, 440, 1], [3.45, 630, 590, -1]]) {
  for (let i = 0; i < 4; i += 1) {
    const p = clamp01((T - hitAt - i * 0.13) / 1.55);
    if (p <= 0 || p >= 1) continue;
    ctx.save();
    ctx.globalAlpha *= Math.sin(p * Math.PI) * 0.65;
    ctx.strokeStyle = i % 2 ? GOLD : '#b77739';
    ctx.lineWidth = 8 - i;
    ctx.lineCap = 'round';
    const r = 90 + p * 330 + i * 44;
    const start = direction > 0 ? -0.82 : Math.PI - 0.82;
    const end = direction > 0 ? 0.82 : Math.PI + 0.82;
    ctx.beginPath(); ctx.arc(cx, cy, r, start, end); ctx.stroke();
    ctx.restore();
  }
}

// 台基与前景流苏收住画面下沿。
poly([[160, 856], [1760, 856], [1690, 890], [230, 890]], '#4e2b1d', INK, 5);
line([[230, 891], [1690, 891]], GOLD, 3);
TT.board.stageFrame(ctx, { W, H });
ctx.restore();
