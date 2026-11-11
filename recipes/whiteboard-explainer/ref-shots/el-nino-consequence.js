/* @ticktoon-ref-shot
{
  "title": "厄尔尼诺后果",
  "note": "讲到哪里聚焦哪里，标题不恒占满幅；演示收束场与静态镜头",
  "duration": 5.24,
  "resources": [],
  "tags": [
    "后果",
    "收束",
    "气候"
  ]
}
*/
// 白板手写 · 示例：后果与收束。讲到哪里聚焦哪里，标题不必恒占满幅。
const T = api.t;
// 两段落笔：前 1.5s 画底图，1.5–2.6s 停一拍让观众读完，之后加速补完标注。
// 重映射只作用于笔迹进度；淡入淡出与镜头仍走真实场景时间 T。
const t = T < 1.5 ? T : (T < 2.6 ? 1.5 : 1.5 + (T - 2.6) * 2.6);
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
const stroke = (pts, at, dur, color = ink, width = 4, dash = []) => {
  strokes.push({ pts, at, dur, pen: 'marker', color, width, dash, seed: 0 });
};
const label = (value, x, y, size, color, k, align = 'left', rotate = -0.012) => {
  if (k <= 0) return;
  ctx.save();
  ctx.translate(x, y + (1 - k) * 12);
  ctx.rotate(rotate);
  ctx.globalAlpha = clamp01(k) * alpha;
  TT.text(ctx, value, 0, 0, size, { color, align, role: 'body' });
  ctx.restore();
};

// ---- 第 3 场：东岸被压住的上升流、跟着走的鱼，最后一记红叉收束 ----
const coast = [...cubic([1660, 545], [1695, 472], [1715, 386], [1765, 340]), ...cubic([1765, 340], [1800, 285], [1820, 368], [1855, 326]).slice(1)];
stroke(coast, 0.1, 0.7, ink, bold);
stroke([...cubic([285, 700], [720, 650], [1190, 715], [1605, 675], 36)], 0.2, 0.8, '#576061', mid);

for (let i = 0; i < 3; i += 1) {
  const x = 1455 + i * 63;
  TT.mark.arrow(ctx, { via: cubic([x, 785], [x - 12, 730], [x + 35, 675], [x + 24, 625], 22), color: blue, width: mid, progress: prog(t, 0.8 + i * 0.18, 0.8) });
}
TT.mark.circle(ctx, { at: [1373, 730], rx: 13, ry: 8, color: blue, width: thin, closure: 0.08, progress: prog(t, 1.3, 0.6) });
stroke([[1360, 730], [1350, 720], [1350, 740], [1360, 730]], 1.3, 0.6, blue, thin);

stroke([[1450, 640], [1575, 790]], 1.9, 0.6, red, bold);
stroke([[1570, 640], [1450, 790]], 2.1, 0.6, red, bold);

label('雨带也向东搬家', 1120, 470, rainPx, red, prog(t, 2.5, 0.7), 'center', 0.015);
label('这就是厄尔尼诺', W * 0.5, 250, titlePx, ink, prog(t, 3.0, 0.8), 'center', -0.018);
TT.mark.underline(ctx, { from: [720, 278], to: [1200, 278], color: red, width: bold, offset: 0.03, slack: 0.02, progress: prog(t, 3.4, 0.7) });

TT.pen.track(ctx, strokes, t, { sceneScale: fit * scale });
ctx.restore();
ctx.restore();
