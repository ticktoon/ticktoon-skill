/* @ticktoon-ref-shot
{
  "title": "一滴墨",
  "note": "墨滴落纸先洇开再收住；演示主墨线、洇染与留白",
  "duration": 3.796,
  "resources": [
    {
      "type": "font",
      "name": "QianTuBiFengShouXie"
    }
  ],
  "tags": [
    "落墨",
    "留白",
    "水墨"
  ]
}
*/
// 水墨写意 · 示例：落墨。内容写在 code 里，宣纸只来自 TT.board.wash。
const T = api.t;
// 呼吸放在笔画之间：主墨线 0.1–2.0s 画完，2.0–2.4s 停一拍，再补洇染与墨点。
// 不要用会冻结进度的时间重映射；t 停住时正在画的主线会停在半空，看起来像笔卡死。

const clamp01 = TT.clamp01;
const ease = TT.ease;
const TAU = Math.PI * 2;
const SCALE = RULES.scale || { title: 1, label: 0.75, note: 1.25 };
const STROKE = Array.isArray(RULES.stroke) ? RULES.stroke : [3, 12];
const M = Number.isFinite(RULES.safeMargin) ? RULES.safeMargin : 0.09;
const thin = STROKE[0];
const mid = (STROKE[0] + STROKE[1]) / 2;
const bold = STROKE[1];
const ink = '#2b2d2b';
const midInk = '#6b6e69';
const pale = '#a8aaa4';
const sealColor = '#a34030';
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
// 两块笔迹：strokes 跟随主轴带笔；detailStrokes 只落墨，笔不在纹理上来回跳。
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

// 主墨线：一笔三段，起笔重、行笔提、收笔再按。浓淡靠叠笔与灰度，不用色块。
const spine = [
  ...cubic([280, 690], [520, 470], [760, 690], [1010, 500]),
  ...cubic([1010, 500], [1240, 340], [1420, 520], [1660, 380]).slice(1),
];
stroke(spine.slice(0, 22), 0.10, 0.75, ink, bold, [], true);
stroke(spine.slice(21, 46), 0.72, 0.70, midInk, mid, [], true);
stroke(spine.slice(45), 1.30, 0.70, ink, bold * 0.8, [], true);

// 洇染：沿主线下缘铺几道淡墨平行线，越远越淡，留出纸的白。
for (let i = 0; i < 5; i += 1) {
  const off = 26 + i * 22;
  const paleLine = spine.map((p, j) => [p[0] + i * 3, p[1] + off + Math.sin(j * 0.35 + i) * 9]);
  stroke(paleLine, 2.4 + i * 0.07, 0.4, i < 2 ? midInk : pale, thin * (1.4 - i * 0.16));
}

// 溅出的墨点：位置是序号的固定函数，不用随机数。
for (let i = 0; i < 7; i += 1) {
  const x = 330 + i * 197;
  const y = 760 - (i * 37) % 190;
  const r = 3 + (i % 3) * 2;
  stroke([[x, y], [x + r, y - r * 0.4]], 2.8 + i * 0.03, 0.15, i % 2 ? midInk : ink, thin);
}

label('一滴墨', W * 0.12, 190, titlePx, ink, prog(T, 0.15, 0.5), 'left', -0.02);
label('先洇开，再收住', W * 0.12, 268, notePx, ink, prog(T, 2.35, 0.5), 'left', -0.01);

TT.pen.track(ctx, detailStrokes, T, { sceneScale: fit * scale, penBody: false });
TT.pen.track(ctx, strokes, T, { sceneScale: fit * scale });
ctx.restore();
ctx.restore();
