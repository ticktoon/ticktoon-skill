/* @ticktoon-ref-shot
{
  "title": "信风减弱",
  "note": "同一张纸重新聚焦到信风与暖水；演示一段旁白内的转折场",
  "duration": 6.187,
  "resources": [
    {
      "type": "font",
      "name": "TsangerYuMo"
    }
  ],
  "tags": [
    "剖面",
    "转折",
    "气候"
  ]
}
*/
/*
 * 白板手写 · 示例：转折。同一张纸，镜头重新聚焦到信风与暖水。
 * 笔跟三条主轮廓与两支强调箭头；暖水排线是纹理，只做短揭示，不跟笔。
 * 所有带笔时段错开，同一时刻只有一支笔。
 * 时间轴不冻结：停顿用笔画之间的空档表达，已经在动的笔画不会停在半空。
 */
const T = api.t;
const clamp01 = TT.clamp01;
const ease = TT.ease;
const SCALE = RULES.scale || { title: 1, label: 0.8, note: 0.6 };
const STROKE = Array.isArray(RULES.stroke) ? RULES.stroke : [2.4, 4.5];
const M = Number.isFinite(RULES.safeMargin) ? RULES.safeMargin : 0.06;
const thin = STROKE[0];
const mid = (STROKE[0] + STROKE[1]) / 2;
const bold = STROKE[1];
const ink = '#343a3b';
const blue = '#446b84';
const red = '#c66b57';
const muted = '#576061';
const windPx = 53 * SCALE.label;
const warmPx = 54 * SCALE.label;
const notePx = 50 * SCALE.note;

const enterDur = 0.62;
const exitDur = 0.3472;
const alpha = TT.env.fade(T, api.d, enterDur, exitDur);
ctx.save();
ctx.globalAlpha = alpha;
TT.board.paper(ctx, api);

const FRAME = { x: -70, y: 30, w: 2060, h: 850 };
const ZOOM = { mode: 'in', from: 1.0, to: 1.0, focus: [0.5, 0.5] };
const frames = TT.geom.keyframes(ZOOM, api.d);
const safe = TT.geom.safeBox({ W, H, m: M });
const pre = TT.geom.preimage({ frames, dur: api.d, W, H, safe });
const framing = TT.geom.fit(FRAME, pre);
const fit = framing.scale;
const z = TT.geom.camera(frames, T);
const scale = Math.min(2, Math.max(0.01, z.scale));
const fx = clamp01(z.fx) * W;
const fy = clamp01(z.fy) * H;
ctx.save();
ctx.translate(fx, fy);
ctx.scale(scale, scale);
ctx.translate(-fx, -fy);
ctx.translate(framing.dx, framing.dy);
ctx.scale(framing.scale, framing.scale);

const prog = (value, at, dur = 1) => ease.inOutCubic(clamp01((value - at) / dur));
const cubic = (a, b, c, d, n = 28) => {
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const k = i / n;
    const u = 1 - k;
    pts.push([
      u * u * u * a[0] + 3 * u * u * k * b[0] + 3 * u * k * k * c[0] + k * k * k * d[0],
      u * u * u * a[1] + 3 * u * u * k * b[1] + 3 * u * k * k * c[1] + k * k * k * d[1],
    ]);
  }
  return pts;
};
const strokes = [];
const heroStrokes = [];
const stroke = (pts, at, dur, color = ink, width = 4, dash = [], hero = false) => {
  const item = { pts, at, dur, pen: 'marker', color, width, dash, seed: 0 };
  (hero ? heroStrokes : strokes).push(item);
};
const label = (value, x, y, size, color, k, align = 'left', rotate = -0.012) => {
  if (k <= 0) return;
  ctx.save();
  ctx.translate(x, y + (1 - k) * 12);
  ctx.rotate(rotate);
  ctx.globalAlpha = clamp01(k) * alpha;
  TT.text(ctx, value, 0, 0, size, { color, align, fontKey: 'TsangerYuMo' });
  ctx.restore();
};

// ---- 第 2 场：先快速重画剖面，再让红色暖水一层层压过去 ----
const asia = [...cubic([-40, 515], [45, 405], [122, 426], [178, 505]), ...cubic([178, 505], [190, 600], [210, 720], [285, 845]).slice(1)];
const america = [...cubic([1660, 545], [1695, 472], [1715, 386], [1765, 340]), ...cubic([1765, 340], [1800, 285], [1820, 368], [1855, 326]).slice(1)];
stroke(asia, 0.1, 0.7, ink, bold, [], true);
stroke(america, 0.8, 0.7, ink, bold, [], true);
stroke([...cubic([178, 505], [195, 640], [235, 788], [380, 820]), ...cubic([380, 820], [720, 868], [1280, 843], [1515, 758]).slice(1)], 1.55, 0.7, muted, mid, [], true);
label('西', 120, 600, notePx, ink, prog(T, 0.9, 0.35), 'center', -0.02);
label('东', 1760, 638, notePx, ink, prog(T, 1.6, 0.35), 'center', 0.02);

// 暖水区：上下两条贝塞尔边界之间铺红色手绘排线，不裁剪、不平涂，笔迹全部进 ink 回执。
// 排线是色块纹理，用短揭示一次性铺开，不让笔逐条描。
const topEdge = cubic([285, 566], [660, 530], [1080, 570], [1645, 548], 40);
const botEdge = cubic([310, 700], [720, 650], [1190, 715], [1605, 675], 40);
for (let i = 0; i < 17; i += 1) {
  const k = i / 16;
  const j = Math.round(k * 39);
  const a = topEdge[j];
  const b = botEdge[j];
  stroke([[a[0], a[1] + 10], [(a[0] + b[0]) / 2 + 12, (a[1] + b[1]) / 2], [b[0], b[1] - 10]], 2.3 + i * 0.03, 0.15, '#c77c63', thin);
}

TT.mark.arrow(ctx, { via: cubic([350, 588], [700, 555], [1120, 602], [1560, 570], 72), color: red, width: bold, progress: prog(T, 3.05, 0.7), penBody: true, sceneScale: fit * scale });
label('暖水向东', 1390, 525, warmPx, red, prog(T, 3.35, 0.5), 'center', 0.022);

// highlight 必须先于文字：底色铺在字下面，不能盖住已经写好的字。
TT.mark.highlight(ctx, { rect: [812, 360, 196, 58], color: red, alpha: 0.22, progress: prog(T, 3.6, 0.4) });
label('信风减弱', 910, 405, windPx, red, prog(T, 3.7, 0.5), 'center', -0.035);
stroke([[840, 418], [985, 416]], 4.1, 0.25, red, mid, [], true);
TT.mark.arrow(ctx, { via: [[1450, 435], [1260, 426], [1030, 432], [800, 424]], color: blue, width: mid, progress: prog(T, 2.3, 0.7), penBody: true, sceneScale: fit * scale });

TT.pen.track(ctx, strokes, T, { sceneScale: fit * scale, penBody: false });
TT.pen.track(ctx, heroStrokes, T, { sceneScale: fit * scale });
ctx.restore();
ctx.restore();
