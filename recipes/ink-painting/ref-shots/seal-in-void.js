/* @ticktoon-ref-shot
{
  "title": "印落空处",
  "note": "最后一方印落在留白里，不压主体墨线",
  "duration": 2.927,
  "resources": [],
  "tags": [
    "印章",
    "收束",
    "留白"
  ]
}
*/
// 水墨写意 · 示例：收束。印不压墨线，落在留白里。
const T = api.t;
const t = T < 1.2 ? T : (T < 2.2 ? 1.2 : 1.2 + (T - 2.2) * 2.2);
const clamp01 = TT.clamp01;
const ease = TT.ease;
const SCALE = RULES.scale || { title: 1, label: 0.75, note: 0.55 };
const STROKE = Array.isArray(RULES.stroke) ? RULES.stroke : [3, 12];
const M = Number.isFinite(RULES.safeMargin) ? RULES.safeMargin : 0.09;
const thin = STROKE[0];
const ink = '#2b2d2b';
const midInk = '#6b6e69';
const pale = '#a8aaa4';
const sealColor = '#a34030';
const titlePx = 62 * SCALE.title;

const enterDur = 0.4;
const exitDur = 0.168;
const alpha = TT.env.fade(T, api.d, enterDur, exitDur);
ctx.save();
ctx.globalAlpha = alpha;
TT.board.wash(ctx, api, { bleed: true });

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
const cubic = (a, b, c, d, n = 32) => {
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
  strokes.push({ pts, at, dur, pen: 'inkbrush', color, width, dash, seed: 0 });
};
const label = (value, x, y, size, color, k, align = 'left', rotate = -0.01) => {
  if (k <= 0) return;
  ctx.save();
  ctx.translate(x, y + (1 - k) * 10);
  ctx.rotate(rotate);
  ctx.globalAlpha = clamp01(k) * alpha;
  TT.text(ctx, value, 0, 0, size, { color, align, role: 'body' });
  ctx.restore();
};

// 收笔：一道短而重的墨线，把三场的视线收回到右下。
const finish = cubic([1180, 720], [1320, 690], [1460, 740], [1580, 690], 28);
stroke(finish, 0.08, 0.9, ink, thin * 3);
stroke([[1180, 748], [1330, 742], [1450, 752]], 0.9, 0.3, pale, thin * 0.8);

label('落在空处', W * 0.12, 200, titlePx, ink, prog(t, 0.2, 0.7), 'left', -0.02);
label('印不压墨线', W * 0.12, 260, 42 * SCALE.note, midInk, prog(t, 0.95, 0.25), 'left', -0.01);

// 印章走 TT.mark.seal：它自带双线圈与倾斜，用 alpha 淡入，不手写方框。
TT.mark.seal(ctx, { at: [1680, 300], text: '写意', shape: 'square', size: 0.055, color: sealColor, alpha: prog(t, 0.9, 0.3) });

TT.pen.track(ctx, strokes, t, { sceneScale: fit * scale });
ctx.restore();
ctx.restore();
