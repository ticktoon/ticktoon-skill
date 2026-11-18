/* @ticktoon-ref-shot
{
  "title": "讲师与双特点插画",
  "note": "左侧医生讲师，右侧入院通道与病床两组插画，虚线框提炼卖点",
  "duration": 8,
  "bg": "#F7F5F0",
  "thumbTime": 6.5,
  "tags": ["讲师", "医疗服务", "双特点", "虚线说明框"],
  "resources": [
    { "type": "font", "name": "sans-700" },
    { "type": "font", "name": "sans-400" }
  ]
}
*/
const T = api.t;
const C = {
  paper: '#F7F5F0', orange: '#E9853C', orangeDark: '#C96432', yellow: '#F7B84B',
  ink: '#34304A', blue: '#78B9D0', blueDark: '#4D87B5', paleBlue: '#DCEEF2',
  mint: '#67C9B5', skin: '#F2B39A', hair: '#5A3540', white: '#FFFDF8', grey: '#8C98A6',
};
const p = (at, dur) => TT.clamp01((T - at) / dur);
const pop = (at, dur = 0.5) => Math.max(0, TT.ease.back(1.70158)(p(at, dur)));
const circle = (x, y, r, color) => {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); ctx.fill();
};
const rr = (x, y, w, h, r, color) => {
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)); ctx.fill();
};
const stroke = (points, color, width = 6) => {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
};
const callout = (text, x, y, w, at) => {
  const s = pop(at, 0.42);
  ctx.save(); ctx.translate(x + w / 2, y + 46); ctx.scale(s, s); ctx.translate(-x - w / 2, -y - 46);
  ctx.strokeStyle = C.orangeDark; ctx.lineWidth = 4; ctx.setLineDash([15, 10]);
  ctx.beginPath(); ctx.roundRect(x, y, w, 92, 12); ctx.stroke(); ctx.setLineDash([]);
  TT.text(ctx, text, x + w / 2, y + 49, 36, { fontKey: 'sans-700', color: C.orangeDark, align: 'center', baseline: 'middle' });
  ctx.restore();
};

ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
ctx.fillStyle = C.orange; ctx.fillRect(0, 0, W, 58);

/* ===== 优化后的女医生：圆脸大眼 + 干净波波头，与右侧客服统一扁平 chibi 风 ===== */
const host = TT.ease.outCubic(p(0, 0.65));
ctx.save(); ctx.translate(-350 + 740 * host, 930 + 2 * Math.sin(T * 2)); ctx.scale(1.03, 1.03);

const hair = '#6D4437', hairLight = '#8F5D48';
const scrub = '#67BCCB', scrubDark = '#3E96A9';
const coat = '#F7FAFB', coatShade = '#DDE7EC', coatEdge = '#CAD9E2';
const ink = '#2F2930', skin = '#F3B99F', skinShade = '#E4A087';
const headBob = 2 * Math.sin(T * 2.4);
const headTilt = 0.035 * Math.sin(T * 1.4);
const blink = Math.max(
  4 * p(2.2, 0.16) * (1 - p(2.2, 0.16)),
  4 * p(5.4, 0.16) * (1 - p(5.4, 0.16)),
);

// 1. 后发随头部轻摆；脖子延长至脸与衣领之间，保留可见皮肤。
ctx.save(); ctx.translate(0, -20 + headBob);
ctx.translate(0, -570); ctx.rotate(headTilt); ctx.translate(0, 570);
ctx.fillStyle = hair; ctx.beginPath();
ctx.moveTo(0, -700);
ctx.bezierCurveTo(-92, -704, -116, -642, -106, -562);
ctx.bezierCurveTo(-116, -504, -98, -458, -68, -442);
ctx.quadraticCurveTo(-38, -430, -22, -458); ctx.lineTo(22, -458);
ctx.quadraticCurveTo(38, -430, 68, -442);
ctx.bezierCurveTo(98, -458, 116, -504, 106, -562);
ctx.bezierCurveTo(116, -642, 92, -704, 0, -700); ctx.fill();
ctx.restore();
rr(-29, -518, 58, 84, 18, skin);
ctx.fillStyle = skinShade; ctx.beginPath();
ctx.moveTo(10, -518); ctx.lineTo(29, -510); ctx.lineTo(24, -438); ctx.lineTo(5, -434); ctx.closePath(); ctx.fill();

// 2. 腿 + 收腰大衣
rr(-58, -160, 46, 160, 16, '#386E79'); rr(12, -160, 46, 160, 16, '#386E79');
ctx.fillStyle = coat; ctx.beginPath();
ctx.moveTo(-108, -450);
ctx.quadraticCurveTo(-116, -484, -64, -498);
ctx.lineTo(64, -498);
ctx.quadraticCurveTo(116, -484, 108, -450);
ctx.quadraticCurveTo(98, -302, 146, -6);   // 腰身收一点
ctx.lineTo(-146, -6);
ctx.quadraticCurveTo(-98, -302, -108, -450);
ctx.closePath(); ctx.fill();
ctx.fillStyle = scrub; ctx.beginPath();
ctx.moveTo(-50, -480); ctx.lineTo(0, -418); ctx.lineTo(50, -480);
ctx.lineTo(62, -120); ctx.lineTo(-62, -120); ctx.closePath(); ctx.fill();
stroke([[-44, -468], [0, -412], [44, -468]], scrubDark, 5);
ctx.fillStyle = coat; ctx.beginPath();
ctx.moveTo(-64, -498); ctx.lineTo(-4, -432); ctx.lineTo(-38, -384); ctx.lineTo(-84, -460); ctx.closePath(); ctx.fill();
ctx.beginPath();
ctx.moveTo(64, -498); ctx.lineTo(4, -432); ctx.lineTo(38, -384); ctx.lineTo(84, -460); ctx.closePath(); ctx.fill();
for (const y of [-358, -298, -238, -178]) { circle(-6, y, 4, '#AEBCC4'); circle(10, y, 4, '#AEBCC4'); } // 双排扣
stroke([[-136, -204], [-86, -201], [-86, -146]], coatEdge, 4);
stroke([[86, -201], [136, -204], [86, -146]], coatEdge, 4);
ctx.strokeStyle = coatEdge; ctx.lineWidth = 4;
ctx.beginPath(); ctx.moveTo(-146, -68); ctx.quadraticCurveTo(-60, -46, 0, -56);
ctx.quadraticCurveTo(60, -46, 146, -68); ctx.stroke();

// 3. 袖子
ctx.strokeStyle = coat; ctx.lineWidth = 60; ctx.lineCap = 'round';
ctx.beginPath(); ctx.moveTo(-104, -434); ctx.quadraticCurveTo(-142, -328, -68, -242); ctx.stroke();
ctx.beginPath(); ctx.moveTo(104, -434); ctx.quadraticCurveTo(156, -342, 194, -270); ctx.stroke();

// 4. 脸 + 头发与后发共用头部动作，避免错位。
ctx.save(); ctx.translate(0, -20 + headBob);
ctx.translate(0, -570); ctx.rotate(headTilt); ctx.translate(0, 570);
circle(-70, -570, 15, skin); circle(70, -570, 15, skin);
ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(0, -570, 72, 80, 0, 0, Math.PI * 2); ctx.fill();
ctx.fillStyle = hair; ctx.beginPath();
ctx.moveTo(-70, -588);
ctx.bezierCurveTo(-76, -658, -36, -696, 6, -696);
ctx.bezierCurveTo(60, -696, 82, -652, 72, -586);
ctx.bezierCurveTo(44, -620, 18, -632, 0, -632);
ctx.bezierCurveTo(-22, -632, -46, -614, -70, -588); ctx.fill();
ctx.beginPath(); ctx.moveTo(6, -694);
ctx.bezierCurveTo(-38, -710, -84, -668, -78, -614);
ctx.bezierCurveTo(-54, -642, -26, -648, -8, -624);
ctx.quadraticCurveTo(14, -606, 30, -630);
ctx.quadraticCurveTo(34, -664, 6, -694); ctx.fill();
ctx.strokeStyle = hairLight; ctx.lineWidth = 8;
ctx.beginPath(); ctx.moveTo(-52, -672); ctx.quadraticCurveTo(-74, -648, -66, -622); ctx.stroke();
stroke([[-36, -598], [-24, -603], [-13, -599]], '#795446', 3.5);
stroke([[13, -599], [24, -603], [36, -598]], '#795446', 3.5);
for (const x of [-26, 26]) {
  ctx.save(); ctx.translate(x, -566); ctx.scale(1, Math.max(0.1, 1 - blink * 0.94));
  ctx.fillStyle = '#4B3530'; ctx.beginPath(); ctx.ellipse(0, 0, 10, 12, 0, 0, Math.PI * 2); ctx.fill();
  circle(-3, -4, 3, C.white); circle(3, 4, 1.6, C.white);
  ctx.restore();
}
ctx.save(); ctx.globalAlpha = 0.18; circle(-44, -546, 9, '#EC8F87'); circle(44, -546, 9, '#EC8F87'); ctx.restore(); // 腮红收小上移
stroke([[-1, -554], [-3, -545], [3, -543]], '#DCA08D', 2.5);
ctx.strokeStyle = '#B75E61'; ctx.lineWidth = 4;
ctx.beginPath(); ctx.moveTo(-13, -532); ctx.quadraticCurveTo(0, -520, 14, -533); ctx.stroke();
ctx.restore();

// 5. 听诊器
ctx.strokeStyle = ink; ctx.lineWidth = 8;
ctx.beginPath(); ctx.moveTo(-50, -490); ctx.bezierCurveTo(-92, -428, -100, -354, -100, -314); ctx.stroke();
ctx.beginPath(); ctx.moveTo(50, -490); ctx.bezierCurveTo(90, -434, 92, -376, 66, -340); ctx.stroke();
circle(-100, -305, 18, ink); circle(-100, -305, 11, '#AAB9C1'); circle(-100, -305, 5, '#E1E9ED');
circle(-47, -490, 6, '#AAB9C1'); circle(47, -490, 6, '#AAB9C1');

// 6. 病历夹 + 圆润双手
ctx.save(); ctx.translate(30, -272); ctx.rotate(-0.045 + 0.018 * Math.sin(T * 1.7));
rr(-82, -116, 164, 232, 12, '#B98765');
rr(-69, -101, 138, 202, 5, '#FFFDF9');
rr(-34, -128, 68, 28, 9, '#80909A'); rr(-24, -122, 48, 15, 6, '#D4DDE2'); circle(0, -114, 5, C.white);
rr(-49, -68, 98, 4, 2, '#E7EDF1'); rr(-49, -50, 74, 4, 2, '#EEF2F4');
ctx.restore();
ctx.save(); ctx.translate(-55, -232); ctx.rotate(-0.1);
ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(0, 0, 18, 24, 0, 0, Math.PI * 2); ctx.fill();
for (let i = 0; i < 3; i += 1) stroke([[8, -8 + i * 9], [30, -7 + i * 9]], skin, 7);
ctx.restore();
ctx.save(); ctx.translate(213, -244 + 6 * Math.sin(T * 2)); ctx.rotate(-0.3 + 0.035 * Math.sin(T * 1.6));
ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(0, 0, 23, 30, 0, 0, Math.PI * 2); ctx.fill();
for (const [x, y] of [[-11, -26], [0, -31], [11, -26]]) stroke([[x * 0.7, -14], [x, y]], skin, 8);
stroke([[-16, 7], [-25, -7]], skinShade, 6);
ctx.restore();
ctx.restore();
const hospital = pop(0.65, 0.55);
ctx.save(); ctx.translate(1080, 480); ctx.scale(hospital, hospital);
// 医院平台与建筑
rr(-245, 95, 490, 72, 34, '#9ACDE6');
ctx.fillStyle = '#4B4E60'; ctx.fillRect(-105, -170, 210, 260);
ctx.fillStyle = '#353746'; ctx.beginPath(); ctx.moveTo(105, -170); ctx.lineTo(180, -125); ctx.lineTo(180, 90); ctx.lineTo(105, 90); ctx.closePath(); ctx.fill();
ctx.fillStyle = '#686B7B'; ctx.beginPath(); ctx.moveTo(-105, -170); ctx.lineTo(-25, -220); ctx.lineTo(180, -125); ctx.lineTo(105, -170); ctx.closePath(); ctx.fill();
for (let row = 0; row < 4; row += 1) for (let col = 0; col < 3; col += 1) rr(-85 + col * 62, -140 + row * 55, 34, 24, 3, '#C8D6DC');
rr(-35, 30, 70, 60, 4, C.white); rr(-9, 40, 18, 50, 2, C.orangeDark); rr(-25, 55, 50, 16, 2, C.orangeDark);
// 救护车
rr(-210, 35, 140, 55, 12, C.white); rr(-190, 5, 75, 45, 10, C.white); rr(-178, 15, 45, 25, 4, C.blueDark);
circle(-180, 92, 15, C.ink); circle(-95, 92, 15, C.ink); rr(-90, 45, 35, 12, 3, C.orangeDark);
// 蛇形听诊路径作为通道隐喻
ctx.strokeStyle = C.orangeDark; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(125, 70); ctx.bezierCurveTo(250, -30, 250, 130, 135, 110); ctx.stroke();
ctx.restore();

const bed = pop(1.1, 0.55);
ctx.save(); ctx.translate(1580, 500); ctx.scale(bed, bed);
const nx = -190;
const patientSkin = '#DDA185';
// 护士：双腿、鞋底与躯干先连成完整站姿。
rr(nx - 29, -24, 25, 132, 11, C.mint); rr(nx + 5, -24, 25, 132, 11, C.mint);
rr(nx - 36, 98, 38, 20, 9, C.grey); rr(nx + 3, 98, 38, 20, 9, C.grey);
ctx.fillStyle = C.mint; ctx.beginPath();
ctx.moveTo(nx - 38, -153); ctx.quadraticCurveTo(nx, -174, nx + 38, -153);
ctx.lineTo(nx + 32, -18); ctx.lineTo(nx - 32, -18); ctx.closePath(); ctx.fill();
rr(nx - 12, -184, 24, 35, 9, C.skin);
// 两只袖子从肩到肘，前臂再汇合到平板，消除漂浮手臂。
ctx.strokeStyle = C.mint; ctx.lineWidth = 24; ctx.lineCap = 'round';
ctx.beginPath(); ctx.moveTo(nx - 32, -140); ctx.lineTo(nx - 50, -96); ctx.stroke();
ctx.beginPath(); ctx.moveTo(nx + 32, -140); ctx.lineTo(nx + 48, -96); ctx.stroke();
ctx.strokeStyle = C.skin; ctx.lineWidth = 16;
ctx.beginPath(); ctx.moveTo(nx - 50, -96); ctx.lineTo(nx - 22, -70); ctx.stroke();
ctx.beginPath(); ctx.moveTo(nx + 48, -96); ctx.lineTo(nx + 20, -70); ctx.stroke();
ctx.save(); ctx.translate(nx, -82); ctx.rotate(-0.12); rr(-36, -24, 72, 48, 6, C.ink); rr(-29, -18, 58, 34, 3, '#596579'); ctx.restore();
circle(nx - 25, -69, 10, C.skin); circle(nx + 25, -72, 10, C.skin);
// 头部、颈部和护士帽/发髻保持连续。
circle(nx, -216, 34, '#B85E55'); circle(nx + 27, -232, 16, '#B85E55');
circle(nx, -211, 29, C.skin);
ctx.fillStyle = '#B85E55'; ctx.beginPath(); ctx.arc(nx, -217, 31, Math.PI, Math.PI * 2); ctx.lineTo(nx + 26, -209); ctx.quadraticCurveTo(nx, -239, nx - 28, -209); ctx.closePath(); ctx.fill();
circle(nx - 10, -208, 3, C.ink); circle(nx + 10, -208, 3, C.ink);
ctx.strokeStyle = C.orangeDark; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(nx - 8, -194); ctx.quadraticCurveTo(nx, -187, nx + 8, -194); ctx.stroke();
rr(nx - 7, -142, 14, 18, 3, C.white); circle(nx - 18, -126, 6, C.white);
stroke([[nx - 14, -152], [nx, -134], [nx + 14, -152]], C.white, 4);
// 设备在病床后方：监护屏与输液架各自有支架。
rr(140, -212, 92, 68, 8, C.blueDark); rr(151, -201, 70, 43, 4, '#9DD3E3');
stroke([[158, -178], [170, -178], [178, -190], [187, -166], [197, -178], [214, -178]], C.white, 3);
stroke([[186, -144], [186, -78]], C.grey, 7); rr(156, -82, 60, 10, 5, C.grey);
stroke([[258, 62], [258, -230], [294, -230]], C.grey, 7);
rr(270, -220, 42, 62, 6, C.blue); rr(278, -208, 26, 32, 4, '#BDE2EA');
stroke([[291, -158], [291, -112], [220, -70]], C.blue, 3);
// 床架、床垫与枕头先于患者绘制。
rr(-88, -25, 370, 64, 15, C.blueDark); rr(-102, 32, 400, 26, 7, C.grey);
rr(-76, -30, 96, 24, 11, C.white);
// 患者颈部先接躯干，头部只用一个后发轮廓，不再叠出第二颗头。
rr(-9, -65, 28, 28, 9, patientSkin);
ctx.save(); ctx.translate(-35, -60); ctx.rotate(-0.08);
ctx.fillStyle = C.ink; ctx.beginPath(); ctx.ellipse(-6, 0, 36, 28, 0, 0, Math.PI * 2); ctx.fill();
ctx.fillStyle = patientSkin; ctx.beginPath(); ctx.ellipse(6, 0, 27, 23, 0, 0, Math.PI * 2); ctx.fill();
ctx.fillStyle = C.ink; ctx.beginPath(); ctx.moveTo(-34, -4);
ctx.bezierCurveTo(-32, -31, 0, -36, 20, -18);
ctx.quadraticCurveTo(2, -25, -15, -17); ctx.quadraticCurveTo(-25, -12, -34, -4); ctx.fill();
circle(-14, 5, 6, patientSkin); circle(15, -6, 2.8, C.ink);
stroke([[24, -1], [28, 2], [23, 4]], '#B97568', 2.5);
stroke([[13, 11], [21, 9]], '#B97568', 2.5);
ctx.restore();
rr(4, -82, 178, 56, 26, C.mint);
ctx.strokeStyle = patientSkin; ctx.lineWidth = 17; ctx.lineCap = 'round';
ctx.beginPath(); ctx.moveTo(28, -58); ctx.lineTo(74, -35); ctx.lineTo(98, -44); ctx.stroke();
circle(99, -44, 9, patientSkin);
rr(157, -72, 104, 38, 17, patientSkin); circle(254, -55, 17, patientSkin);
// 护栏与床腿在最前层，明确压住床垫而不是穿过患者。
stroke([[-78, 2], [-50, 24], [40, 24], [68, 2]], '#C6D0D8', 8);
stroke([[-84, 54], [-84, 122], [258, 122], [258, 54]], C.grey, 10);
stroke([[-64, 63], [-34, 88]], C.white, 7); stroke([[206, 88], [236, 63]], C.white, 7);
circle(-72, 134, 15, C.ink); circle(-72, 134, 7, C.white);
circle(246, 134, 15, C.ink); circle(246, 134, 7, C.white);
ctx.restore();

callout('搭建优享通道', 850, 690, 450, 1.65);
callout('加速入院进程', 1350, 690, 450, 2.0);
