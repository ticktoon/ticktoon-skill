/* @ticktoon-ref-shot
{
  "title": "通知触发角色行动",
  "note": "手机气泡弹出，角色先停顿再转头伸手，演示关节与表情",
  "duration": 7.6,
  "bg": "#FFC62B",
  "thumbTime": 4.8,
  "tags": ["角色", "关节", "通知", "预备动作"],
  "resources": [
    { "type": "font", "name": "JiangChengYuanTi" }
  ]
}
*/
const T = api.t;
const C = {
  U: '#2B2BFF', UD: '#1F1FCC', UL: '#4D4DFF', CO: '#FF5A4E', COL: '#FF8C82',
  SU: '#FFC62B', SUD: '#F0A91A', MI: '#2EE6A8', MID: '#1FC28C',
  CR: '#FFF6E9', INK: '#151433', SK: '#FFB48C',
};
const p = (at, dur) => TT.clamp01((T - at) / dur);
const lerp = (a, b, k) => a + (b - a) * k;
const pop = (at, dur = 0.45) => Math.max(0, TT.ease.back(1.70158)(p(at, dur)));
const hump = (k) => 4 * k * (1 - k);
const circle = (x, y, r, color) => {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); ctx.fill();
};
const rr = (x, y, w, h, r, color) => {
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
};
const limb = (length, width, color) => {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, length); ctx.stroke();
};

ctx.fillStyle = C.SU; ctx.fillRect(0, 0, W, H);

// 房间只保留能支撑动作的物件。
ctx.save(); ctx.translate(0, 40);
rr(140, 170, 430, 300, 18, C.CR);
ctx.fillStyle = C.U; ctx.fillRect(165, 195, 380, 250);
circle(475, 270, 48, C.CO);
const skyline = [80, 135, 100, 165, 120, 90];
for (let i = 0; i < skyline.length; i += 1) {
  ctx.fillStyle = C.UL; ctx.fillRect(175 + i * 62, 445 - skyline[i], 50, skyline[i]);
}
ctx.fillStyle = C.CR; ctx.fillRect(346, 190, 14, 260); ctx.fillRect(160, 310, 390, 14);
rr(120, 458, 470, 24, 12, C.SUD);
ctx.restore();

rr(1530, 170, 240, 310, 18, C.MI);
rr(1552, 192, 196, 266, 10, C.CR);
circle(1650, 290, 62, C.CO);
ctx.fillStyle = C.U; ctx.beginPath(); ctx.moveTo(1575, 430); ctx.lineTo(1650, 345); ctx.lineTo(1725, 430); ctx.closePath(); ctx.fill();

const lampSwing = 2 * Math.sin(T * Math.PI * 1.1);
ctx.save(); ctx.translate(760, 0); ctx.rotate(lampSwing * Math.PI / 180);
ctx.strokeStyle = C.INK; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 160); ctx.stroke();
ctx.fillStyle = C.INK; ctx.beginPath(); ctx.moveTo(-72, 220); ctx.lineTo(-38, 158); ctx.lineTo(38, 158); ctx.lineTo(72, 220); ctx.closePath(); ctx.fill();
circle(0, 220, 17, C.CR); ctx.restore();

TT.text(ctx, '一个提醒，一次行动', 105, 108, 58, { fontKey: 'JiangChengYuanTi', color: C.INK, baseline: 'middle' });
TT.text(ctx, 'NOTICE  →  ACTION', 108, 158, 27, { fontKey: 'JiangChengYuanTi', color: C.INK, baseline: 'middle' });

// 手机：通知亮屏与震动是主动作前的信号。
const ping = p(2.25, 0.25);
const vibration = T > 2.25 && T < 2.75 ? Math.cos((T - 2.25) * Math.PI * 24) * 4 * (1 - p(2.25, 0.5)) : 0;
ctx.save(); ctx.translate(1320 + vibration, 760);
rr(-64, -250, 128, 238, 24, C.INK);
rr(-52, -236, 104, 204, 14, ping > 0 ? C.CR : C.UD);
ctx.fillStyle = C.INK; ctx.beginPath(); ctx.moveTo(-52, -12); ctx.lineTo(-34, -42); ctx.lineTo(34, -42); ctx.lineTo(52, -12); ctx.closePath(); ctx.fill();
if (ping > 0) {
  circle(25, -205, 12, C.CO);
  rr(-35, -165, 70, 10, 5, C.INK); rr(-35, -140, 48, 10, 5, C.INK);
}
ctx.restore();

// 气泡以尾尖为 pivot，而不是按中心缩放。
const bubbleP = pop(2.4, 0.48);
if (bubbleP > 0) {
  ctx.save(); ctx.translate(1320, 520); ctx.scale(bubbleP, bubbleP);
  ctx.fillStyle = C.CO; ctx.beginPath(); ctx.moveTo(-18, -38); ctx.lineTo(0, 0); ctx.lineTo(18, -38); ctx.closePath(); ctx.fill();
  circle(0, -96, 62, C.CO);
  rr(-22, -116, 44, 52, 20, C.CR); rr(-31, -70, 62, 10, 5, C.CR); circle(0, -54, 7, C.CR);
  ctx.restore();
  for (let i = 0; i < 2; i += 1) {
    const u = p(2.65 + i * 0.22, 0.6);
    if (u > 0 && u < 1) {
      ctx.strokeStyle = C.CO; ctx.lineWidth = 10 * (1 - u); ctx.beginPath();
      ctx.arc(1320, 424, 75 + 80 * u, 0, Math.PI * 2); ctx.stroke();
    }
  }
}

// 人物：通知前先打字，随后预备下蹲、转头、伸手。
const typing = 1 - p(2.35, 0.25);
const anticipation = hump(p(2.85, 0.4));
const reach = TT.ease.back(1.6)(p(3.15, 0.65));
const celebrate = pop(4.25, 0.5);
const look = pop(3.05, 0.35);
ctx.save(); ctx.translate(770, 770 + 10 * anticipation); ctx.rotate(-0.035 * look);
rr(-170, -220, 340, 285, 80, C.MI);
ctx.fillStyle = C.MID; ctx.beginPath(); ctx.moveTo(115, -205); ctx.lineTo(170, -160); ctx.lineTo(170, 65); ctx.lineTo(120, 65); ctx.closePath(); ctx.fill();

// 左臂继续低频打字，右臂绕肩、肘连续伸向手机。
ctx.save(); ctx.translate(-135, -155); ctx.rotate(0.25 + Math.sin(T * 16) * 0.06 * typing - celebrate * 1.9);
limb(112, 54, C.MID); ctx.translate(0, 112); ctx.rotate(0.9 + Math.sin(T * 18) * 0.12 * typing - celebrate * 0.4);
limb(98, 38, C.SK); circle(0, 106, 23, C.SK); ctx.restore();
ctx.save(); ctx.translate(135, -155); ctx.rotate(lerp(-0.2, -1.35, reach) - celebrate * 0.15);
limb(118, 54, C.MID); ctx.translate(0, 118); ctx.rotate(lerp(0.95, 0.15, reach));
limb(105, 38, C.SK); circle(0, 112, 23, C.SK); ctx.restore();

ctx.save(); ctx.translate(8 * look, -280 - 8 * anticipation);
circle(-92, 10, 18, C.SK); circle(92, 10, 18, C.SK); circle(0, 0, 95, C.SK);
ctx.fillStyle = C.INK; ctx.beginPath(); ctx.moveTo(-96, 0); ctx.quadraticCurveTo(-105, -110, 0, -112); ctx.quadraticCurveTo(108, -105, 96, 4); ctx.quadraticCurveTo(35, -72, -96, 0); ctx.fill();
circle(35, -112, 35, C.INK);
const blink = Math.max(hump(p(1.55, 0.16)), hump(p(5.25, 0.16)));
for (const x of [-34, 34]) {
  ctx.save(); ctx.translate(x + 8 * look, 8); ctx.scale(1 + 0.18 * look, Math.max(0.1, 1 - blink));
  ctx.fillStyle = C.INK; ctx.beginPath(); ctx.ellipse(0, 0, 9, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.strokeStyle = C.INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, 10, 29, 0, Math.PI * 2); ctx.stroke();
}
ctx.strokeStyle = C.INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-5, 8); ctx.lineTo(5, 8); ctx.stroke();
ctx.lineWidth = 7; ctx.beginPath();
if (look > 0.4) ctx.ellipse(8, 52, 11, 15, 0, 0, Math.PI * 2);
else { ctx.moveTo(-18, 45); ctx.quadraticCurveTo(0, 60, 18, 45); }
ctx.stroke(); ctx.restore();
ctx.restore();

// 桌面遮住腿部，让人物关节动作保持清楚。
ctx.fillStyle = C.UL; ctx.fillRect(0, 780, W, 36);
ctx.fillStyle = C.U; ctx.fillRect(0, 816, W, H - 816);
rr(260, 850, 340, 18, 9, C.UD); rr(1310, 850, 340, 18, 9, C.UD);
rr(900, 630, 280, 150, 18, C.INK); circle(1040, 705, 16, C.CO);

const exclaim = pop(3.15, 0.4);
if (exclaim > 0) {
  ctx.save(); ctx.translate(1030, 300); ctx.scale(exclaim, exclaim); ctx.rotate(-0.12);
  rr(-10, -65, 20, 62, 10, C.INK); circle(0, 20, 11, C.INK); ctx.restore();
}
