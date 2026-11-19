/* @ticktoon-ref-shot
{
  "title": "色条变形标题收束",
  "note": "色条连续变成标题下划线，逐字回弹后圆点落位",
  "duration": 5.6,
  "bg": "#2B2BFF",
  "thumbTime": 4.6,
  "tags": ["标题", "逐字", "匹配变形", "收束"],
  "sfx": [
    { "name": "common-whoosh", "at": 0.35, "volume": 0.16 }
  ],
  "resources": [
    { "type": "font", "name": "DouYinMeiHaoTi" },
    { "type": "font", "name": "JiangChengYuanTi" }
  ]
}
*/
const T = api.t;
const C = {
  U: '#2B2BFF', UT: '#3B3BFF', UP: '#A3A3FF', CO: '#FF5A4E',
  SU: '#FFC62B', MI: '#2EE6A8', CR: '#FFF6E9',
};
const p = (at, dur) => TT.clamp01((T - at) / dur);
const lerp = (a, b, k) => a + (b - a) * k;
const pop = (at, dur = 0.48) => Math.max(0, TT.ease.back(1.70158)(p(at, dur)));
const circle = (x, y, r, color) => {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); ctx.fill();
};
const rr = (x, y, w, h, r, color) => {
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
};

ctx.fillStyle = C.U; ctx.fillRect(0, 0, W, H);

// 角部装饰与标题同色不同明度，不能抢主体。
for (const mark of [{ x: 200, y: 200, r: 95, at: 0.2 }, { x: 1720, y: 880, r: 70, at: 0.35 }]) {
  ctx.strokeStyle = C.UT; ctx.lineWidth = 28;
  ctx.beginPath(); ctx.arc(mark.x, mark.y, mark.r * pop(mark.at, 0.55), 0, Math.PI * 2); ctx.stroke();
}
const crossP = pop(0.5, 0.45);
ctx.save(); ctx.translate(1580, 230); ctx.rotate(-0.2 + T * 0.03); ctx.scale(crossP, crossP);
rr(-55, -10, 110, 20, 10, C.UT); rr(-10, -55, 20, 110, 10, C.UT); ctx.restore();

// 同一根奶油色条从短柱连续变成下划线，不用交叉淡化冒充 morph。
const morph = TT.ease.inOutCubic(p(0.35, 1.05));
const barX = lerp(307, 450, morph);
const barY = lerp(340, 650, morph);
const barW = lerp(96, 1020, morph);
const barH = lerp(260, 22, morph);
const barR = lerp(48, 11, morph);
rr(barX, barY, barW, barH, barR, C.CR);

// 标题字宽来自真实测量；逐字围绕自己的中心回弹。
const chars = [...'扁平矢量'];
const size = 230;
const font = TT.font(FONTS, size, 'DouYinMeiHaoTi');
ctx.save(); ctx.font = font.css;
const widths = chars.map((ch) => ctx.measureText(ch).width);
ctx.restore();
const gap = 24;
const total = widths.reduce((sum, value) => sum + value, 0) + gap * (chars.length - 1);
let cursor = W / 2 - total / 2;
const delays = [0.18, 0, 0.06, 0.18];
const centers = [];
for (let i = 0; i < chars.length; i += 1) {
  const cx = cursor + widths[i] / 2;
  centers.push(cx);
  const s = pop(1.25 + delays[i], 0.52);
  const sy = Math.max(0.001, s);
  const sx = 1 + (1 - sy) * 0.14;
  ctx.save(); ctx.translate(cx, 480); ctx.scale(sx, sy);
  TT.text(ctx, chars[i], 0, 0, size, { fontKey: 'DouYinMeiHaoTi', color: C.CR, align: 'center', baseline: 'middle' });
  ctx.restore();
  cursor += widths[i] + gap;
}

// 珊瑚圆点从色条端部跳到标题上方；预备下蹲与落地挤压都围绕接触点。
const dotX = lerp(355, centers[3] + 55, TT.ease.outQuart(p(0.8, 1.1)));
const hop = p(1.9, 0.7);
let dotY = lerp(265, 250, TT.ease.outQuart(hop));
if (hop > 0 && hop < 1) dotY -= 180 * 4 * hop * (1 - hop);
const land = Math.sin(Math.PI * p(2.6, 0.24));
const dotSy = 1 - 0.24 * land;
// 开场仍是字母上的小圆点；落位后才长成太阳。
const dotR = lerp(48, 64, TT.ease.outCubic(p(2.6, 0.3)));
const dotCenterY = dotY + dotR * (1 - dotSy);

// 放大完成后才出现放射线，内半径随圆点增长，始终保留 30px 间隙。
if (T >= 2.6) {
  if (T >= 2.9) {
    for (let i = 0; i < 7; i += 1) {
      const a = lerp(-2.8, -0.35, i / 6);
      const length = 44 * p(2.9 + i * 0.025, 0.3);
      const inner = dotR + 30;
      ctx.strokeStyle = C.SU; ctx.lineWidth = 12; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(dotX + Math.cos(a) * inner, dotY + Math.sin(a) * inner);
      ctx.lineTo(dotX + Math.cos(a) * (inner + length), dotY + Math.sin(a) * (inner + length));
      ctx.stroke();
    }
  }
}
ctx.save(); ctx.translate(dotX, dotCenterY); ctx.scale(1 + 0.2 * land, dotSy);
circle(0, 0, dotR, C.CO); ctx.restore();

// 文案只在标题稳定后进入，末段保持完整 lockup。
const tagP = TT.ease.outCubic(p(2.95, 0.55));
ctx.save(); ctx.globalAlpha = tagP;
TT.text(ctx, '每天，聪明一点点', W / 2, 790 + 50 * (1 - tagP), 62, {
  fontKey: 'JiangChengYuanTi', color: C.CR, align: 'center', baseline: 'middle',
});
ctx.restore();
const enP = TT.ease.outCubic(p(3.25, 0.5));
ctx.save(); ctx.globalAlpha = enP;
TT.text(ctx, 'F L A T   M O T I O N', W / 2, 875, 30, {
  fontKey: 'JiangChengYuanTi', color: C.UP, align: 'center', baseline: 'middle',
});
ctx.restore();

const dots = [C.CR, C.MI, C.SU, C.CO];
for (let i = 0; i < dots.length; i += 1) {
  circle(1665 + (i % 2) * 34, 890 + Math.floor(i / 2) * 34, 10 * pop(3.55 + i * 0.08, 0.35), dots[i]);
}
