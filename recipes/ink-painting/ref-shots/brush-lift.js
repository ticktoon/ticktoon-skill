/* @ticktoon-ref-shot
{
  "title": "提笔与皴擦",
  "note": "笔锋提起，大面留白，笔迹只占一角",
  "duration": 3.579,
  "resources": [
    {
      "type": "font",
      "name": "QianTuBiFengShouXie"
    }
  ],
  "tags": [
    "提按",
    "皴擦",
    "留白"
  ]
}
*/
// 水墨写意 · 示例：提按与皴擦。大面留白，笔迹只占一角。
const T = api.t;
// 呼吸放在笔画之间：飞白 0.1–1.85s 收笔，停一拍后 2.3s 才起皴擦。
// 不要用会冻结进度的时间重映射；t 停住时笔和墨线会一起停在半空，看起来像卡死。
const clamp01 = TT.clamp01;
const ease = TT.ease;
const SCALE = RULES.scale || { title: 1, label: 0.75, note: 1.25 };
const STROKE = Array.isArray(RULES.stroke) ? RULES.stroke : [3, 12];
const M = Number.isFinite(RULES.safeMargin) ? RULES.safeMargin : 0.09;
const thin = STROKE[0];
const mid = (STROKE[0] + STROKE[1]) / 2;
const bold = STROKE[1];
const ink = '#2b2d2b';
const midInk = '#6b6e69';
const pale = '#a8aaa4';
const titlePx = 76 * SCALE.title;
const notePx = 42 * SCALE.note;

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
// 两块笔迹：飞白主轴带笔；皴擦与远影是纹理，只落墨，笔不在一角来回跳。
const strokes = [];
const detailStrokes = [];
const stroke = (pts, at, dur, color = ink, width = 4, dash = [], hero = false) => {
  const item = { pts, at, dur, pen: 'inkbrush', color, width, dash, seed: 0 };
  (hero ? strokes : detailStrokes).push(item);
};
const label = (value, x, y, size, color, k, align = 'left', rotate = -0.01) => {
  if (k <= 0) return;
  ctx.save();
  ctx.translate(x, y + (1 - k) * 10);
  ctx.rotate(rotate);
  ctx.globalAlpha = clamp01(k) * alpha;
  TT.text(ctx, value, 0, 0, size, { color, align, fontKey: 'QianTuBiFengShouXie' });
  ctx.restore();
};

// 提笔：一条由粗到细的飞白，靠分段换宽度做出笔锋离开纸面的过程。
const lift = [
  ...cubic([300, 760], [560, 660], [820, 700], [1080, 560]),
  ...cubic([1080, 560], [1300, 450], [1480, 500], [1700, 410]).slice(1),
];
stroke(lift.slice(0, 18), 0.10, 0.55, ink, bold, [], true);
stroke(lift.slice(17, 36), 0.55, 0.55, midInk, mid, [], true);
stroke(lift.slice(35, 52), 0.95, 0.55, pale, thin, [], true);
stroke(lift.slice(51), 1.30, 0.55, pale, thin * 0.7, [], true);

// 皴擦：短斜线成组，疏密随序号变化；只压在画面下三分之一，上方留白。
for (let i = 0; i < 22; i += 1) {
  const x = 260 + i * 68;
  const y = 790 + Math.sin(i * 1.7) * 26;
  const len = 30 + (i % 4) * 16;
  stroke([[x, y], [x + len * 0.6, y - len]], 2.3 + i * 0.02, 0.22, i % 3 === 0 ? midInk : pale, thin * 0.8);
}

// 淡墨远影：两道几乎看不见的长线，给留白一个下沿。
stroke(cubic([240, 850], [700, 830], [1250, 860], [1700, 835], 24), 2.55, 0.3, pale, thin * 0.6);
stroke(cubic([300, 880], [760, 866], [1280, 888], [1660, 870], 24), 2.62, 0.3, pale, thin * 0.5);

label('笔锋提起来', W * 0.12, 190, titlePx, ink, prog(T, 0.15, 0.5), 'left', -0.02);
label('剩下的交给留白', W * 0.12, 270, notePx, ink, prog(T, 2.2, 0.5), 'left', -0.01);

TT.pen.track(ctx, detailStrokes, T, { sceneScale: fit * scale, penBody: false });
TT.pen.track(ctx, strokes, T, { sceneScale: fit * scale });
ctx.restore();
ctx.restore();
