/* @ticktoon-ref-shot
{
  "title": "双栏服务流程对比",
  "note": "快速沟通与进度跟踪双栏并排，橙色标题、虚线分隔与总结带",
  "duration": 8.6,
  "bg": "#F7F5F0",
  "thumbTime": 7.2,
  "tags": ["双栏", "对比", "远程服务", "流程"],
  "sfx": [
    { "name": "common-swipe", "at": 0.55, "volume": 0.18 }
  ],
  "resources": [
    { "type": "font", "name": "sans-700" },
    { "type": "font", "name": "sans-400" }
  ]
}
*/
const T = api.t;
const C = {
  paper: '#F7F5F0', orange: '#E9853C', orangeDark: '#C96432', yellow: '#F7B84B',
  ink: '#34304A', blue: '#557AC5', blueLight: '#B9D2EA', screen: '#78B9E6',
  skin: '#F2B39A', hair: '#30366F', white: '#FFFDF8', mint: '#67C9B5', grey: '#8C98A6',
};
const p = (at, dur) => TT.clamp01((T - at) / dur);
const pop = (at, dur = 0.46) => Math.max(0, TT.ease.back(1.70158)(p(at, dur)));
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
  ctx.save(); ctx.translate(x + w / 2, y + 45); ctx.scale(s, s); ctx.translate(-x - w / 2, -y - 45);
  rr(x, y, w, 90, 10, C.orange); rr(x - 12, y + 8, 12, 74, 6, C.yellow); rr(x + w, y + 8, 12, 74, 6, C.yellow);
  TT.text(ctx, text, x + w / 2, y + 48, 39, { fontKey: 'sans-700', color: C.white, align: 'center', baseline: 'middle' }); ctx.restore();
};
const callout = (text, x, y, w, at, size = 28) => {
  const s = pop(at, 0.38);
  ctx.save(); ctx.translate(x + w / 2, y + 32); ctx.scale(s, s); ctx.translate(-x - w / 2, -y - 32);
  ctx.strokeStyle = C.orangeDark; ctx.lineWidth = 3.5; ctx.setLineDash([13, 9]);
  ctx.beginPath(); ctx.roundRect(x, y, w, 64, 10); ctx.stroke(); ctx.setLineDash([]);
  TT.text(ctx, text, x + w / 2, y + 34, size, { fontKey: 'sans-400', color: C.orangeDark, align: 'center', baseline: 'middle' }); ctx.restore();
};

ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
ctx.fillStyle = C.orange; ctx.fillRect(0, 0, W, 54);
TT.text(ctx, '就医服务 · 住院安排协助', 82, 96, 30, { fontKey: 'sans-400', color: C.ink, baseline: 'middle' });

titlePill('1、快速沟通响应', 170, 135, 620, 0.35);
titlePill('2、透明进度跟踪', 1130, 135, 620, 0.65);

// 左栏客服插画。
const left = TT.ease.outCubic(p(0.55, 0.65));
ctx.save(); ctx.translate(-180 + 660 * left, 650); ctx.scale(0.78, 0.78);
rr(-330, -410, 150, 88, 22, '#D7E3F2');
for (const x of [-295, -250]) {
  ctx.save(); ctx.translate(x, -365); ctx.rotate(T * 0.2);
  for (let i = 0; i < 8; i += 1) { ctx.save(); ctx.rotate(i * Math.PI / 4); rr(-6, -30, 12, 21, 5, C.white); ctx.restore(); }
  circle(0, 0, 13, C.white); ctx.restore();
}
for (let i = 0; i < 7; i += 1) rr(-340 + i * 18, -220 - (i % 3) * 9, 8, 34 + (i % 3) * 18, 4, C.blueLight);
circle(0, -250, 140, C.hair); rr(-145, -260, 290, 255, 95, C.hair);
rr(-130, -90, 260, 165, 60, C.blue); rr(-38, -120, 76, 75, 22, C.skin); circle(0, -245, 95, C.skin);
ctx.fillStyle = C.hair; ctx.beginPath(); ctx.moveTo(-98, -268); ctx.quadraticCurveTo(-80, -375, 45, -345); ctx.quadraticCurveTo(120, -315, 92, -220); ctx.quadraticCurveTo(25, -300, -98, -268); ctx.fill();
ctx.strokeStyle = C.blueLight; ctx.lineWidth = 13; ctx.beginPath(); ctx.arc(0, -260, 115, Math.PI, Math.PI * 2); ctx.stroke();
rr(-124, -278, 30, 76, 14, '#D96C78'); rr(94, -278, 30, 76, 14, '#D96C78');
stroke([[107, -210], [120, -168], [72, -155]], C.ink, 6); circle(70, -155, 7, C.ink);
for (const x of [-33, 33]) { circle(x, -240, 9, C.ink); circle(x * 1.6, -198, 15, '#ED8D88'); }
stroke([[-17, -184], [0, -172], [19, -185]], C.orangeDark, 5);
ctx.fillStyle = C.white; ctx.beginPath(); ctx.moveTo(-65, -100); ctx.lineTo(-5, -45); ctx.lineTo(-43, -5); ctx.closePath(); ctx.fill();
ctx.beginPath(); ctx.moveTo(65, -100); ctx.lineTo(5, -45); ctx.lineTo(43, -5); ctx.closePath(); ctx.fill();
rr(-290, 62, 630, 18, 9, C.ink);
ctx.fillStyle = C.orange; ctx.beginPath(); ctx.moveTo(-20, -80); ctx.lineTo(220, -80); ctx.lineTo(188, 62); ctx.lineTo(-52, 62); ctx.closePath(); ctx.fill();
circle(98, -5, 17, C.white); rr(-75, 53, 305, 15, 8, C.orangeDark);
ctx.restore();

// 右栏：患者与屏幕里的医生形成远程沟通关系。
const right = TT.ease.outCubic(p(0.85, 0.65));
ctx.save(); ctx.translate(2100 - 670 * right, 590);
rr(-20, -270, 470, 330, 16, C.ink); rr(0, -250, 430, 270, 6, C.screen);
rr(155, 60, 120, 45, 4, C.ink); rr(85, 100, 280, 20, 8, C.ink);
// 屏幕内医生：后发、脸型与短发际线分层，不再用两个错位圆头。
rr(145, -110, 150, 115, 45, C.white); rr(198, -128, 44, 50, 16, C.skin);
ctx.fillStyle = C.hair; ctx.beginPath(); ctx.ellipse(220, -174, 51, 57, 0, 0, Math.PI * 2); ctx.fill();
circle(178, -164, 10, C.skin); circle(262, -164, 10, C.skin);
ctx.fillStyle = C.skin; ctx.beginPath(); ctx.ellipse(220, -163, 41, 46, 0, 0, Math.PI * 2); ctx.fill();
ctx.fillStyle = C.hair; ctx.beginPath(); ctx.moveTo(179, -170);
ctx.bezierCurveTo(180, -216, 207, -231, 224, -226);
ctx.bezierCurveTo(255, -222, 267, -197, 260, -166);
ctx.quadraticCurveTo(237, -192, 215, -194); ctx.quadraticCurveTo(197, -181, 179, -170); ctx.fill();
for (const x of [204, 236]) { circle(x, -160, 4, C.ink); circle(x - 1, -162, 1.2, C.white); }
stroke([[220, -153], [217, -145], [222, -144]], '#D88F7D', 2.5);
ctx.strokeStyle = C.orangeDark; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(211, -136); ctx.quadraticCurveTo(220, -128, 230, -137); ctx.stroke();
ctx.strokeStyle = C.ink; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(175, -95); ctx.quadraticCurveTo(170, -15, 220, -15); ctx.quadraticCurveTo(260, -25, 255, -95); ctx.stroke(); circle(255, -20, 10, C.ink);
ctx.save(); ctx.translate(150, -85); ctx.rotate(0.85 + 0.05 * Math.sin(T * 2)); rr(-20, 0, 40, 120, 20, C.white); circle(0, 130, 18, C.skin); ctx.restore();
// 屏幕前患者与座椅
rr(-235, -50, 160, 180, 28, C.yellow); rr(-220, 100, 18, 100, 6, C.ink); rr(-105, 100, 18, 100, 6, C.ink);
// 坐姿患者使用统一短发轮廓与正面脸型，颈部接回肩线。
rr(-205, -55, 110, 140, 38, '#D86E67'); rr(-192, 70, 42, 110, 18, C.ink); rr(-135, 70, 42, 110, 18, C.ink);
rr(-164, -76, 28, 32, 10, '#A96F55');
ctx.fillStyle = C.ink; ctx.beginPath(); ctx.ellipse(-150, -103, 39, 45, 0, 0, Math.PI * 2); ctx.fill();
circle(-183, -94, 9, '#A96F55'); circle(-117, -94, 9, '#A96F55');
ctx.fillStyle = '#A96F55'; ctx.beginPath(); ctx.ellipse(-150, -94, 33, 38, 0, 0, Math.PI * 2); ctx.fill();
ctx.fillStyle = C.ink; ctx.beginPath(); ctx.moveTo(-183, -101);
ctx.bezierCurveTo(-182, -139, -158, -151, -143, -146);
ctx.bezierCurveTo(-119, -143, -113, -120, -117, -99);
ctx.quadraticCurveTo(-140, -119, -160, -116); ctx.quadraticCurveTo(-172, -108, -183, -101); ctx.fill();
circle(-162, -91, 3.5, C.ink); circle(-138, -91, 3.5, C.ink);
stroke([[-151, -83], [-154, -75], [-149, -74]], '#875442', 2.5);
ctx.strokeStyle = '#754438'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-159, -66); ctx.quadraticCurveTo(-150, -59, -140, -67); ctx.stroke();
ctx.save(); ctx.translate(-100, -35); ctx.rotate(-0.9); rr(-16, 0, 32, 110, 16, '#A96F55'); circle(0, 118, 17, '#A96F55'); ctx.restore();
ctx.restore();

// 分隔线随两栏就位后生长。
const divider = TT.ease.outCubic(p(1.05, 0.5));
ctx.save(); ctx.strokeStyle = C.orangeDark; ctx.lineWidth = 4; ctx.setLineDash([10, 9]);
ctx.beginPath(); ctx.moveTo(960, 240); ctx.lineTo(960, 240 + 670 * divider); ctx.stroke(); ctx.restore();

callout('7×12小时在线', 120, 750, 340, 1.5);
callout('9:00–21:00', 500, 750, 340, 1.65);
callout('60秒内回应', 120, 840, 340, 1.8);
callout('及时答疑', 500, 840, 340, 1.95);
callout('4小时内反馈', 1210, 750, 500, 2.1);
callout('48小时内同步进展', 1210, 840, 500, 2.25);
