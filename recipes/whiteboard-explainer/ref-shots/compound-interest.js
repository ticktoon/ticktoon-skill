/* @ticktoon-ref-shot
{
  "title": "手绘复利曲线",
  "note": "手绘指数曲线：坐标系、分段揭示、翻倍阶梯；适合任意随时间增长的数据",
  "duration": 16.5,
  "resources": [
    {
      "type": "font",
      "name": "TsangerYuMo"
    }
  ],
  "tags": [
    "图表",
    "曲线",
    "数据"
  ]
}
*/
/*
 * 图表类构图范例：一张手绘的指数曲线。
 * 看四段：
 * 1) TT.geom 的 safeBox / keyframes / preimage / fit —— 相机推近时内容仍不越安全框；
 * 2) RULES 三字段 —— 字号、线宽、边距都从规范派生，不在代码里写死；
 * 3) 坐标轴与曲线 —— 先轴后线，整条曲线一笔生长；
 * 4) 翻倍阶梯与标注 —— 标注在主体落笔之后出现，最后一笔早于场景结束。
 * 5) 笔跟当拍主体：两条轴、整条曲线、翻倍阶梯，以及标题 / 本金 / 收束三处下划线、
 *    右上角框、单利对照线都进 heroStrokes；刻度、点只做短揭示。
 *    带笔时段彼此错开，同一时刻只有一支笔；其余时间靠墨迹与文字推进，
 *    观众不会一直等一条线画完。
 * 不要照抄“复利 / 利率”这个题材：换成任意随时间指数增长的数据，骨架不变。
 * 时间按 16.5s 编排；api.d 变化时 S 会等比缩放全部节拍。
 */

const t = api.t;
const D = api.d;
const BASE = 16.5;
const S = D / BASE;
const when = (sec) => sec * S;
const span = (sec) => sec * S;

const clamp01 = TT.clamp01;
const ease = TT.ease;
const TAU = Math.PI * 2;

// ---- 视觉规范：边距、字号阶梯、线宽区间都由 recipe.rules 决定 ----
const SCALE = RULES.scale || { title: 1, label: 0.8, note: 0.6 };
const STROKE = Array.isArray(RULES.stroke) ? RULES.stroke : [2.4, 4.5];
const M = Number.isFinite(RULES.safeMargin) ? RULES.safeMargin : 0.06;
const thin = STROKE[0];
const mid = (STROKE[0] + STROKE[1]) / 2;
const bold = STROKE[1];

const titlePx = 66 * SCALE.title;
const bigPx = 60 * SCALE.label;
const calloutPx = 54 * SCALE.label;
const notePx = 50 * SCALE.note;
const tinyPx = notePx * 0.66;

const prog = (at, dur = 1) => ease.inOutCubic(clamp01((t - when(at)) / span(dur)));
const circle = (x, y, r, start = 0, n = 24) => Array.from({ length: n + 1 }, (_, i) => {
  const a = start + TAU * i / n;
  return [x + Math.cos(a) * r, y + Math.sin(a) * r];
});
const pointAt = (angle, x, y) => [
  Math.cos(angle) * x - Math.sin(angle) * y,
  Math.sin(angle) * x + Math.cos(angle) * y,
];

// ---- 镜头与安全框：统一 zoom 路径和反像采样 ----
const enterDur = 0.62;
const exitDur = 0.3472;
const alpha = TT.env.fade(t, D, enterDur, exitDur);

ctx.save();
ctx.globalAlpha = alpha;
TT.board.paper(ctx, api);

const FRAME = { x: -20, y: 20, w: 1900, h: 880 };
const ZOOM = { mode: 'in', from: 1.0, to: 1.04, focus: [0.5, 0.5] };

const frames = TT.geom.keyframes(ZOOM, D);
const safe = TT.geom.safeBox({ W, H, m: M });
const pre = TT.geom.preimage({ frames, dur: D, W, H, safe });
const framing = TT.geom.fit(FRAME, pre);
const fit = framing.scale;
const z = TT.geom.camera(frames, t);
const scale = Math.min(2, Math.max(0.01, z.scale));
const fx = clamp01(z.fx) * W;
const fy = clamp01(z.fy) * H;

ctx.save();
ctx.translate(fx, fy);
ctx.scale(scale, scale);
ctx.translate(-fx, -fy);
ctx.translate(framing.dx, framing.dy);
ctx.scale(framing.scale, framing.scale);

const ink = '#343a3b';
const blue = '#446b84';
const red = '#c66b57';
const muted = '#576061';
const green = '#5f7f66';
// 两块笔迹：strokes 只落墨；heroStrokes 额外带笔身（轴、曲线、阶梯）。
const strokes = [];
const heroStrokes = [];
const stroke = (pts, at, dur, color = ink, width = mid, dash = [], hero = false) => {
  const item = { pts, at: when(at), dur: span(dur), pen: 'marker', color, width, dash, seed: 0 };
  (hero ? heroStrokes : strokes).push(item);
};

const label = (value, x, y, size, color, k, align = 'left', rotate = -0.012) => {
  if (k <= 0) return;
  ctx.save();
  ctx.translate(x, y + (1 - clamp01(k)) * 10);
  ctx.rotate(rotate);
  ctx.globalAlpha = clamp01(k) * alpha;
  TT.text(ctx, value, 0, 0, size, { color, align, fontKey: 'TsangerYuMo' });
  ctx.restore();
};

// ---- 标题：先给“这是什么”，再落笔 ----
label('复利', W * 0.5, 116, titlePx, ink, prog(0.15, 1.0), 'center', -0.018);
stroke([[880, 143], [950, 146], [1040, 141]], 0.8, 0.3, red, bold, [], true);

// ---- 左栏：一个本金、一条公式、一句机制 ----
label('本金', 300, 300, notePx, muted, prog(1.7, 0.6));
label('100 元', 300, 352, bigPx, ink, prog(1.9, 0.6));
stroke([[302, 360], [430, 363], [560, 358]], 2.05, 0.2, ink, mid, [], true);

const formula = '100 × (1 + 8%)';
const formulaFont = TT.font(FONTS, notePx, 'TsangerYuMo');
ctx.font = formulaFont.css;
const formulaW = TT.text.measure(ctx, formula);
label(formula, 300, 425, notePx, muted, prog(2.5, 0.7));
label('n', 304 + formulaW, 412, tinyPx, muted, prog(2.6, 0.5));
label('每年增长 8%', 300, 480, notePx, muted, prog(2.9, 0.7));
label('第 1 年 +8 元', 300, 560, notePx, ink, prog(6.75, 0.6));
label('这 8 元也开始生息', 300, 608, notePx, red, prog(7.15, 0.6));
label('单利 30 年 = 340 元', 300, 700, notePx, green, prog(9.7, 0.6));

// ---- 右上角注：把“每年 ×1.08”变成一个视觉锚点 ----
stroke([
  [1440, 124],
  [1655, 124],
  [1655, 183],
  [1440, 183],
  [1440, 124]
], 5.3, 0.5, blue, mid, [], true);
label('每年 ×1.08', 1465, 166, notePx, blue, prog(5.45, 0.6));


// ---- 图表：轴先立，曲线后长 ----
const chartX0 = 760;
const chartX1 = 1700;
const chartY0 = 700;
const chartTop = 250;
const yMax = 1000;
const valuePx = (value) => chartY0 - (value / yMax) * (chartY0 - chartTop);
const yearX = (year) => chartX0 + (year / 30) * (chartX1 - chartX0);
const pv = (year) => 100 * Math.pow(1.08, year);
const curve = (from, to, steps) => {
  const pts = [];
  for (let i = 0; i <= steps; i += 1) {
    const year = from + (to - from) * (i / steps);
    pts.push([yearX(year), valuePx(pv(year))]);
  }
  return pts;
};

// 两条轴是主干，各给 0.8s；两条轴之间留 0.15s 抬笔间隙。
stroke([[chartX0, chartY0], [chartX0, chartTop]], 3.2, 0.8, ink, bold, [], true);
stroke([[chartX0, chartY0], [chartX1, chartY0]], 4.15, 0.8, ink, bold, [], true);
const yTicks = TT.chart.ticks(yMax, 2);
for (let i = 0; i < yTicks.length; i += 1) {
  const y = valuePx(yTicks[i]);
  stroke([[chartX0 - 12, y], [chartX0, y]], 4.85 + i * 0.03, 0.1, muted, thin);
  label(String(yTicks[i]), chartX0 - 24, y + 10, notePx, muted, prog(4.9 + i * 0.03, 0.5), 'right');
}
for (let i = 1; i <= 3; i += 1) {
  const x = chartX0 + (i / 3) * (chartX1 - chartX0);
  stroke([[x, chartY0], [x, chartY0 + 8]], 5.0 + i * 0.03, 0.1, muted, thin);
  label(i === 3 ? '30 年' : String(i * 10), x, chartY0 + 46, notePx, muted, prog(5.05 + i * 0.03, 0.5), 'center');
}

// 整条曲线一次绘制，步数提升到 60，更平滑
const fullCurvePts = curve(0, 30, 60);
const curveEndPt = fullCurvePts.at(-1);
stroke(fullCurvePts, 5.9, 2.6, red, bold, [], true);

// 保留终点文字标注，去掉箭头引线
label('30 年 ≈1000 元', 1760, 235, calloutPx, red, prog(8.7, 0.6), 'right');

// 单利对照：一条斜率固定的虚线。
stroke([[chartX0, valuePx(100)], [chartX1, valuePx(340)]], 9.85, 0.3, green, mid, [14, 11], true);
label('单利 340 元', 1660, 590, notePx, green, prog(9.95, 0.6), 'right');

// 翻倍点：9 / 18 / 27 年各一个点，标注写在点的上方。
const doubles = [9, 18, 27];
for (let i = 0; i < doubles.length; i += 1) {
  const year = doubles[i];
  const x = yearX(year);
  const y = valuePx(pv(year));
  stroke(circle(x, y, 10, -Math.PI / 2), 9.5 + i * 0.12, 0.15, red, mid);
  label(`${year} 年 ×${Math.pow(2, i + 1)}`, x, y - 38, notePx, red, prog(9.62 + i * 0.6), 'center');
}

// ---- 翻倍阶梯：把 ×2 / ×4 / ×8 变成一段可读的台阶 ----
stroke([[980, 880], [1042, 880], [1042, 856], [1324, 856], [1324, 832], [1606, 832], [1606, 808], [1640, 808]], 11.6, 0.9, blue, bold, [], true);
label('9 年 ×2', 1050, 850, notePx, blue, prog(12.6, 0.6));
label('18 年 ×4', 1332, 826, notePx, blue, prog(12.75, 0.6));
label('27 年 ×8', 1614, 802, notePx, blue, prog(12.9, 0.6));

// 收束：最后一句与下划线先落，末段留静止给观众读。
label('时间放大每一次增长', 300, 820, 48, red, prog(13.0, 0.6));
stroke([[302, 852], [400, 850], [500, 855], [740, 851]], 13.2, 0.25, red, bold, [], true);

// 笔与笔迹在同一变换内：sceneScale 让 TT.pen 保留 fit × zoom 这层场景倍率。
TT.pen.track(ctx, strokes, t, { sceneScale: fit * scale, penBody: false });
TT.pen.track(ctx, heroStrokes, t, { sceneScale: fit * scale });
ctx.restore();
ctx.restore();
