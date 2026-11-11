/* @ticktoon-ref-shot
{
  "title": "一根弦",
  "note": "与三场示例不同题材，水墨骨架相同：曲线控制点、排线区间与题款可变",
  "duration": 3.6,
  "resources": [],
  "tags": [
    "水墨",
    "线条",
    "留白"
  ]
}
*/
/*
 * 「一根弦」——与本 recipe 的三场示例不同题材，骨架完全一样。
 * 用来证明：换内容只换曲线控制点、排线区间与题款，contract 里的物理规律一行不动。
 * 宣纸 TT.board.wash / 墨线 inkbrush / 文字 TT.text / 印章 TT.mark.seal / 静态镜头。
 */
const T = api.t;
const t = T < 1.2 ? T : (T < 2.2 ? 1.2 : 1.2 + (T - 2.2) * 2.2);
const clamp01 = TT.clamp01;
const ease = TT.ease;
const SCALE = RULES.scale || { title: 1, label: 0.75, note: 0.55 };
const STROKE = Array.isArray(RULES.stroke) ? RULES.stroke : [3, 12];
const M = Number.isFinite(RULES.safeMargin) ? RULES.safeMargin : 0.09;
const thin = STROKE[0];
const mid = (STROKE[0] + STROKE[1]) / 2;
const bold = STROKE[1];
const ink = '#2b2d2b';
const midInk = '#6b6e69';
const pale = '#a8aaa4';
const sealColor = '#a34030';

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

// 一条绷紧的线：中段最细，两端最重，笔锋提按全靠分段换宽度。
const chord = [
  ...cubic([220, 560], [560, 546], [820, 574], [1080, 558]),
  ...cubic([1080, 558], [1360, 542], [1580, 570], [1720, 552]).slice(1),
];
stroke(chord.slice(0, 20), 0.08, 0.7, ink, bold);
stroke(chord.slice(19, 44), 0.55, 0.6, midInk, mid);
stroke(chord.slice(43), 0.95, 0.7, ink, bold * 0.9);

// 振颤：上下成对淡墨短弧，越往外越淡。位置是序号的固定函数。
for (let i = 0; i < 6; i += 1) {
  const x = 360 + i * 220;
  const amp = 26 + (i % 3) * 14;
  const up = cubic([x - 70, 552], [x - 20, 552 - amp], [x + 20, 552 - amp], [x + 70, 552], 16);
  const down = cubic([x - 70, 562], [x - 20, 562 + amp * 0.6], [x + 20, 562 + amp * 0.6], [x + 70, 562], 16);
  stroke(up, 2.2 + i * 0.08, 0.5, i < 3 ? midInk : pale, thin);
  stroke(down, 2.5 + i * 0.08, 0.5, pale, thin * 0.8);
}

// 拨点：三个重墨点落在线上，不铺色块。
for (let i = 0; i < 3; i += 1) {
  const x = 520 + i * 430;
  stroke([[x, 556], [x + 8, 550]], 2.7 + i * 0.12, 0.3, ink, mid);
}

label('一根弦', W * 0.12, 190, 62 * SCALE.title, ink, prog(t, 0.2, 0.8), 'left', -0.02);
label('振过之后才安静', W * 0.12, 250, 42 * SCALE.note, midInk, prog(t, 2.4, 0.7), 'left', -0.01);
TT.mark.seal(ctx, { at: [1680, 300], text: '写意', shape: 'square', size: 0.055, color: sealColor, alpha: prog(t, 2.7, 0.6) });

TT.pen.track(ctx, strokes, t, { sceneScale: fit * scale });
ctx.restore();
ctx.restore();
