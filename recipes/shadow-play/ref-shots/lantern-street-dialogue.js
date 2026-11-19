/* @ticktoon-ref-shot
{
  "title": "灯下相逢",
  "note": "街巷、两侧侧面人物与中央吊灯；底部演示角色名加讲话内容的两段式对白条",
  "duration": 8,
  "resources": [
    { "type": "font", "name": "sans-900" },
    { "type": "font", "name": "sans-400" }
  ],
  "tags": ["皮影", "街巷", "人物", "对白"]
}
*/
// 完整对白场：ref-shot 没有 narration，api.cues 为空时用演示 cue；正式场景自动使用真实 cues。
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

const poly = (pts, fill, stroke = INK, width = 5) => {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.stroke(); }
};
const line = (pts, color = INK, width = 3) => {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
};
const joint = (x, y, r = 9) => {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = INK; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r * 0.4, 0, TAU); ctx.fillStyle = GOLD; ctx.fill();
};
const rounded = (x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const roof = (x, y, w, s, color) => {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  poly([[-w * 0.58, 20], [-w * 0.42, 5], [-w * 0.25, -45], [0, -68], [w * 0.25, -45], [w * 0.42, 5], [w * 0.58, 20], [w * 0.35, 12], [0, 22], [-w * 0.35, 12]], color, INK, 5);
  line([[-w * 0.53, 20], [-w * 0.62, 2]], INK, 5);
  line([[w * 0.53, 20], [w * 0.62, 2]], INK, 5);
  for (let i = -3; i <= 3; i += 1) line([[i * w * 0.1, -37 + Math.abs(i) * 6], [i * w * 0.12, 10]], GOLD, 1.7);
  ctx.restore();
};

// 人物原点在脚底，面朝局部 +x；flip=-1 时面向左。
const figure = (x, y, s, flip, color, gesture, enter) => {
  ctx.save();
  ctx.globalAlpha *= enter;
  ctx.translate(x, y + Math.sin(T * 1.7 + x) * 3);
  ctx.scale(s * flip, s);
  const nod = Math.sin(T * 1.25 + x * 0.01) * 0.025;

  // 皮片在幕布上的偏移灯影。
  ctx.save(); ctx.translate(22, 10); ctx.globalAlpha *= 0.12;
  poly([[-82, -275], [55, -275], [112, -12], [-112, -12]], INK, null);
  ctx.beginPath(); ctx.ellipse(8, -360, 53, 68, 0, 0, TAU); ctx.fillStyle = INK; ctx.fill();
  ctx.restore();

  // 靴与双腿。
  poly([[-62, -80], [-12, -80], [-18, 0], [-90, 0], [-90, -16], [-58, -24]], INK, INK, 4);
  poly([[22, -80], [70, -80], [82, -8], [104, 0], [26, 0]], INK, INK, 4);

  // 身躯与衣摆是两片皮，中间留透光纹样。
  poly([[-78, -268], [62, -268], [92, -92], [128, -38], [44, -48], [4, -22], [-36, -48], [-118, -34], [-92, -104]], color, INK, 7);
  poly([[-72, -272], [-52, -340], [42, -340], [70, -268]], color, INK, 7);
  line([[-77, -254], [70, -254]], GOLD, 4);
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const px = -60 + col * 38 + (row % 2) * 8;
      const py = -220 + row * 48;
      poly([[px, py - 12], [px + 10, py], [px, py + 12], [px - 10, py]], LIGHT, null);
    }
  }
  for (let i = 0; i < 5; i += 1) line([[-82 + i * 39, -90], [-92 + i * 43, -48]], GOLD, 2);

  // 后臂。
  ctx.save(); ctx.translate(-38, -302); ctx.rotate(-0.18);
  poly([[0, 0], [-56, 34], [-75, 112], [-42, 122], [10, 48]], color, INK, 6);
  joint(0, 0, 10); joint(-57, 106, 8);
  ctx.restore();

  // 前臂随讲话轻轻抬起，肩、肘铆钉都可见。
  ctx.save(); ctx.translate(38, -302); ctx.rotate(gesture + Math.sin(T * 2.1) * 0.035);
  poly([[0, 0], [68, 24], [104, 82], [78, 102], [24, 55]], color, INK, 6);
  joint(0, 0, 10);
  ctx.translate(91, 87); ctx.rotate(-0.85);
  poly([[0, 0], [66, -8], [92, 8], [65, 25], [0, 22]], color, INK, 5);
  joint(0, 10, 8);
  ctx.restore();

  // 侧面头：额头、鼻尖、唇与下巴一条轮廓，另一面带发冠。
  ctx.save(); ctx.translate(2, -358); ctx.rotate(nod);
  poly([[-38, 56], [-47, 12], [-42, -42], [-12, -68], [30, -54], [43, -28], [68, -10], [43, 2], [48, 17], [34, 22], [29, 48], [4, 62]], color, INK, 6);
  poly([[-45, -28], [-30, -78], [24, -82], [48, -48], [8, -54]], INK, INK, 4);
  poly([[-42, -70], [-20, -110], [18, -104], [34, -75]], color, INK, 5);
  line([[24, -24], [35, -27]], LIGHT, 4);
  line([[39, 13], [48, 12]], LIGHT, 2.5);
  for (let i = 0; i < 4; i += 1) line([[-30 + i * 9, -42], [-26 + i * 8, 26]], GOLD, 1.8);
  joint(-20, 46, 7);
  ctx.restore();

  // 三根操纵杆随皮片一起走，末端伸向幕布下方。
  line([[-30, -314], [-92, 198]], '#4a2b1a', 3.5);
  line([[55, -276], [128, 202]], '#4a2b1a', 3.5);
  line([[-5, -445], [-10, -560]], '#4a2b1a', 3);
  ctx.restore();
};

ctx.save();
TT.board.stage(ctx, { W, H }, { seed: 11 });

// 中央灯笼照亮街巷，光晕属于本场的灯，不是第二层幕布。
const flicker = 1 + Math.sin(T * 5.2) * 0.025 + Math.sin(T * 8.7) * 0.012;
const glow = ctx.createRadialGradient(W * 0.5, H * 0.32, 30, W * 0.5, H * 0.32, 570 * flicker);
glow.addColorStop(0, 'rgba(255,201,98,0.48)');
glow.addColorStop(0.45, 'rgba(232,151,55,0.18)');
glow.addColorStop(1, 'rgba(108,54,24,0)');
ctx.fillStyle = glow; ctx.fillRect(250, 0, 1420, 900);

// 远景屋顶低对比，近景屋檐深色，形成三层街道。
ctx.save(); ctx.globalAlpha *= 0.34;
roof(690, 505, 400, 1, '#9a7048');
roof(1210, 520, 360, 0.9, '#9a7048');
poly([[470, 510], [1450, 510], [1450, 760], [470, 760]], '#b28a5b', null);
ctx.restore();

// 两侧建筑给中央人物留出完整表演区。
poly([[70, 390], [440, 390], [440, 795], [70, 795]], '#75402b', INK, 7);
roof(255, 390, 500, 1, '#743424');
poly([[1480, 400], [1850, 400], [1850, 795], [1480, 795]], '#604334', INK, 7);
roof(1665, 400, 500, 1, '#315c56');
for (const bx of [130, 1540]) {
  for (let i = 0; i < 3; i += 1) {
    const wx = bx + i * 92;
    ctx.fillStyle = '#d5aa6c'; ctx.fillRect(wx, 490, 62, 130);
    ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.strokeRect(wx, 490, 62, 130);
    line([[wx + 31, 492], [wx + 31, 618]], INK, 3);
    line([[wx + 2, 554], [wx + 60, 554]], INK, 3);
  }
}
line([[55, 795], [1865, 795]], '#5c321e', 9);
line([[120, 820], [1800, 820]], 'rgba(90,49,29,0.35)', 3);

// 吊灯从顶部垂下，竹骨、透光孔与流苏都是独立皮片。
const lanternIn = prog(0.12, 0.8);
ctx.save(); ctx.translate(W * 0.5, 140 + (1 - lanternIn) * -170); ctx.globalAlpha *= lanternIn;
line([[0, -150], [0, 42]], INK, 5);
ctx.translate(0, 175);
ctx.rotate(Math.sin(T * 1.35) * 0.025);
poly([[-72, -112], [72, -112], [104, -68], [88, 82], [42, 120], [-42, 120], [-88, 82], [-104, -68]], RED, INK, 7);
for (let i = -2; i <= 2; i += 1) {
  ctx.beginPath(); ctx.ellipse(0, 0, 28 + Math.abs(i) * 30, 112, 0, -1.35, 1.35);
  ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.stroke();
}
line([[-94, -55], [94, -55]], GOLD, 4);
line([[-86, 65], [86, 65]], GOLD, 4);
for (let i = -2; i <= 2; i += 1) poly([[i * 27, -20], [i * 27 + 9, -5], [i * 27, 10], [i * 27 - 9, -5]], LIGHT, null);
poly([[-84, -124], [84, -124], [68, -105], [-68, -105]], INK, INK, 3);
poly([[-62, 116], [62, 116], [46, 135], [-46, 135]], INK, INK, 3);
for (let i = -2; i <= 2; i += 1) line([[i * 16, 136], [i * 18, 210 + Math.abs(i) * 8]], RED, 5);
ctx.restore();

const leftIn = prog(0.45, 1.0);
const rightIn = prog(0.75, 1.0);
figure(570 - (1 - leftIn) * 330, 790, 0.92, 1, RED, -0.12, leftIn);
figure(1360 + (1 - rightIn) * 330, 790, 0.96, -1, TEAL, -0.28, rightIn);

// 前景只压两角，不盖中央表演与对白。
ctx.save(); ctx.globalAlpha *= 0.72;
poly([[0, 760], [190, 720], [330, 830], [0, 880]], '#3c2c20', null);
poly([[1920, 750], [1750, 720], [1610, 830], [1920, 880]], '#3c2c20', null);
ctx.restore();

// 角色名与讲话内容是两段；narration / TTS 中不写“小影说”。
const cues = api.cues.length
  ? api.cues
  : [{ text: '灯里也有影子在跑！', start: 1.6, end: api.d - 0.35 }];
const cue = cues.find((c) => T >= c.start && T < c.end);
const speaker = '小影';
if (cue) {
  const k = prog(cue.start, 0.28);
  const x = W * 0.10;
  const y = H * 0.835;
  const w = W * 0.80;
  const h = 104;
  ctx.save();
  ctx.globalAlpha *= k;
  ctx.translate(0, (1 - k) * 18);
  ctx.shadowColor = 'rgba(50,23,15,0.30)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 7;
  rounded(x, y, w, h, 12); ctx.fillStyle = 'rgba(247,226,181,0.96)'; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#7c472a'; ctx.lineWidth = 4; ctx.stroke();
  rounded(x + 10, y + 10, w - 20, h - 20, 7); ctx.strokeStyle = GOLD; ctx.lineWidth = 1.8; ctx.stroke();

  rounded(x + 30, y + 17, 214, 70, 7); ctx.fillStyle = RED; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  line([[x + 258, y + 24], [x + 258, y + 80]], GOLD, 2);
  TT.text(ctx, speaker, x + 137, y + 54, 72 * RULES.scale.speaker, {
    fontKey: 'sans-900', color: LIGHT, align: 'center', baseline: 'middle', maxWidth: 176,
  });
  TT.text(ctx, cue.text, x + 292, y + 54, 72 * RULES.scale.dialogue, {
    fontKey: 'sans-400', color: INK, align: 'left', baseline: 'middle', maxWidth: w - 340,
  });
  for (const dx of [18, w - 18]) {
    poly([[x + dx, y + h / 2 - 8], [x + dx + 7, y + h / 2], [x + dx, y + h / 2 + 8], [x + dx - 7, y + h / 2]], GOLD, null);
  }
  ctx.restore();
}
TT.board.stageFrame(ctx, { W, H });
ctx.restore();
