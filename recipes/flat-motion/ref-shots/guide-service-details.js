/* @ticktoon-ref-shot
{
  "title": "讲师与服务细节",
  "note": "医生讲师配合客服插画，橙色标题与四格虚线说明信息",
  "duration": 8.4,
  "bg": "#F7F5F0",
  "thumbTime": 7,
  "tags": ["讲师", "客服", "服务细节", "信息标签"],
  "resources": [
    { "type": "font", "name": "sans-700" },
    { "type": "font", "name": "sans-400" }
  ]
}
*/
const T = api.t;
const C = {
  paper: '#F7F5F0', orange: '#E9853C', orangeDark: '#C96432', yellow: '#F7B84B',
  ink: '#34304A', blue: '#557AC5', blueLight: '#B9D2EA', skin: '#F2B39A',
  hair: '#5A3540', agentHair: '#30366F', white: '#FFFDF8', mint: '#67C9B5',
};
const p = (at, dur) => TT.clamp01((T - at) / dur);
const pop = (at, dur = 0.48) => Math.max(0, TT.ease.back(1.70158)(p(at, dur)));
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
const titlePill = (text, x, y, w, at) => {
  const s = pop(at, 0.45);
  ctx.save(); ctx.translate(x + w / 2, y + 48); ctx.scale(s, s); ctx.translate(-x - w / 2, -y - 48);
  rr(x, y, w, 96, 10, C.orange);
  rr(x - 14, y + 8, 14, 80, 7, C.yellow); rr(x + w, y + 8, 14, 80, 7, C.yellow);
  TT.text(ctx, text, x + w / 2, y + 51, 42, { fontKey: 'sans-700', color: C.white, align: 'center', baseline: 'middle' });
  ctx.restore();
};
const callout = (text, x, y, w, at) => {
  const s = pop(at, 0.4);
  ctx.save(); ctx.translate(x + w / 2, y + 34); ctx.scale(s, s); ctx.translate(-x - w / 2, -y - 34);
  ctx.strokeStyle = C.orangeDark; ctx.lineWidth = 3.5; ctx.setLineDash([14, 9]);
  ctx.beginPath(); ctx.roundRect(x, y, w, 68, 10); ctx.stroke(); ctx.setLineDash([]);
  TT.text(ctx, text, x + w / 2, y + 36, 29, { fontKey: 'sans-400', color: C.orangeDark, align: 'center', baseline: 'middle' });
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
titlePill('1、快速沟通响应', 1040, 100, 720, 0.45);

// 客服主角：耳机、头发、表情、笔记本电脑与植物分开构建。
const agent = pop(0.8, 0.55);
ctx.save(); ctx.translate(1320, 640); ctx.scale(agent, agent);
// 对话气泡与声波
rr(-420, -370, 155, 92, 24, '#D7E3F2');
ctx.fillStyle = '#D7E3F2'; ctx.beginPath(); ctx.moveTo(-310, -285); ctx.lineTo(-285, -255); ctx.lineTo(-330, -270); ctx.closePath(); ctx.fill();
for (const x of [-385, -335]) {
  ctx.save(); ctx.translate(x, -325); ctx.rotate(T * 0.25);
  for (let i = 0; i < 8; i += 1) { ctx.save(); ctx.rotate(i * Math.PI / 4); rr(-7, -35, 14, 24, 5, C.white); ctx.restore(); }
  circle(0, 0, 15, C.white); ctx.restore();
}
for (let i = 0; i < 7; i += 1) rr(-430 + i * 18, -175 - (i % 3) * 10, 8, 35 + (i % 3) * 20, 4, C.blueLight);
// 植物
rr(245, -30, 72, 90, 10, '#B67875');
for (const leaf of [{ x: 220, y: -100, r: -0.5 }, { x: 285, y: -115, r: 0.5 }, { x: 320, y: -75, r: 0.9 }]) {
  ctx.save(); ctx.translate(leaf.x, leaf.y); ctx.rotate(leaf.r); ctx.fillStyle = '#58A9B4'; ctx.beginPath(); ctx.ellipse(0, 0, 22, 58, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
// 头发与躯干
circle(0, -250, 145, C.agentHair); rr(-150, -265, 300, 270, 100, C.agentHair);
rr(-135, -90, 270, 170, 65, C.blue);
rr(-40, -120, 80, 80, 24, C.skin); circle(0, -245, 98, C.skin);
ctx.fillStyle = C.agentHair; ctx.beginPath(); ctx.moveTo(-100, -270); ctx.quadraticCurveTo(-90, -385, 45, -350); ctx.quadraticCurveTo(125, -320, 95, -220); ctx.quadraticCurveTo(35, -310, -100, -270); ctx.fill();
// 耳机
ctx.strokeStyle = C.blueLight; ctx.lineWidth = 13; ctx.beginPath(); ctx.arc(0, -260, 118, Math.PI, Math.PI * 2); ctx.stroke();
rr(-127, -278, 30, 78, 14, '#D96C78'); rr(97, -278, 30, 78, 14, '#D96C78');
stroke([[110, -210], [125, -165], [75, -155]], C.ink, 6); circle(70, -155, 7, C.ink);
for (const x of [-34, 34]) { circle(x, -240, 9, C.ink); circle(x * 1.6, -198, 15, '#ED8D88'); }
stroke([[-18, -185], [0, -172], [20, -186]], C.orangeDark, 5);
ctx.fillStyle = C.white; ctx.beginPath(); ctx.moveTo(-68, -100); ctx.lineTo(-5, -45); ctx.lineTo(-45, -5); ctx.closePath(); ctx.fill();
ctx.beginPath(); ctx.moveTo(68, -100); ctx.lineTo(5, -45); ctx.lineTo(45, -5); ctx.closePath(); ctx.fill();
// 桌面与电脑
rr(-300, 65, 650, 18, 9, C.ink);
ctx.fillStyle = C.orange; ctx.beginPath(); ctx.moveTo(-20, -80); ctx.lineTo(230, -80); ctx.lineTo(195, 65); ctx.lineTo(-55, 65); ctx.closePath(); ctx.fill();
circle(105, -5, 18, C.white); rr(-80, 55, 320, 16, 8, C.orangeDark);
ctx.restore();

callout('7×12小时在线', 830, 745, 450, 1.45);
callout('周一至周日 9:00–21:00', 1310, 745, 520, 1.65);
callout('60秒内回应', 830, 840, 450, 1.85);
callout('及时答疑', 1310, 840, 520, 2.05);
