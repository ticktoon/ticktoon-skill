/* @ticktoon-ref-shot
{
  "title": "厄尔尼诺后果",
  "note": "讲到哪里聚焦哪里，标题不恒占满幅；演示收束场与静态镜头",
  "duration": 5.24,
  "resources": [
    {
      "type": "font",
      "name": "sans-400"
    }
  ],
  "tags": [
    "后果",
    "收束",
    "气候"
  ]
}
*/
/*
 * 白板手写 · 示例：后果与收束。讲到哪里聚焦哪里，标题不必恒占满幅。
 * 海岸、海面线、第一支上升流箭头、红叉与标题下划线带笔；鱼太小，只做短揭示，
 * 不让笔停在小图形上。所有带笔时段错开，同一时刻只有一支笔。
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
const titlePx = 66 * SCALE.title;
const ink = '#343a3b';
const blue = '#446b84';
const red = '#c66b57';
const rainPx = 47.5 * SCALE.label;

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
  TT.text(ctx, value, 0, 0, size, { color, align, fontKey: 'sans-400' });
  ctx.restore();
};

// ---- 第 3 场：东岸被压住的上升流、跟着走的鱼，最后一记红叉收束 ----
const coast = [...cubic([1660, 545], [1695, 472], [1715, 386], [1765, 340]), ...cubic([1765, 340], [1800, 285], [1820, 368], [1855, 326]).slice(1)];
stroke(coast, 0.1, 0.65, ink, bold, [], true);
stroke([...cubic([285, 700], [720, 650], [1190, 715], [1605, 675], 36)], 0.75, 0.6, '#576061', mid, [], true);

for (let i = 0; i < 3; i += 1) {
  const x = 1455 + i * 63;
  TT.mark.arrow(ctx, { via: cubic([x, 785], [x - 12, 730], [x + 35, 675], [x + 24, 625], 22), color: blue, width: mid, progress: prog(T, 1.4 + i * 0.08, 0.45), penBody: i === 0, sceneScale: fit * scale });
}
TT.mark.circle(ctx, { at: [1373, 730], rx: 13, ry: 8, color: blue, width: thin, closure: 0.08, progress: prog(T, 1.65, 0.3) });
stroke([[1360, 730], [1350, 720], [1350, 740], [1360, 730]], 1.7, 0.15, blue, thin);

stroke([[1450, 640], [1575, 790]], 1.9, 0.18, red, bold, [], true);
stroke([[1570, 640], [1450, 790]], 2.02, 0.18, red, bold, [], true);

label('雨带也向东搬家', 1120, 470, rainPx, red, prog(T, 2.25, 0.5), 'center', 0.015);
label('这就是厄尔尼诺', W * 0.5, 250, titlePx, ink, prog(T, 2.75, 0.55), 'center', -0.018);
TT.mark.underline(ctx, { from: [720, 278], to: [1200, 278], color: red, width: bold, progress: prog(T, 3.15, 0.45), penBody: true, sceneScale: fit * scale });

TT.pen.track(ctx, strokes, T, { sceneScale: fit * scale, penBody: false });
TT.pen.track(ctx, heroStrokes, T, { sceneScale: fit * scale });
ctx.restore();
ctx.restore();
