/* @ticktoon-ref-shot
{
  "title": "一滴墨",
  "note": "墨滴落纸先洇开再收住；演示主墨线、洇染与留白",
  "duration": 3.796,
  "resources": [],
  "tags": [
    "落墨",
    "留白",
    "水墨"
  ]
}
*/
// 水墨写意 · 示例：落墨。内容写在 code 里，宣纸只来自 TT.board.wash。
const T = api.t;
// 一段留白式呼吸：前 1.2s 落主墨，1.2–2.2s 停一拍，之后补洇染。t 只喂笔迹。
const t = T < 1.2 ? T : (T < 2.2 ? 1.2 : 1.2 + (T - 2.2) * 2.2);
const clamp01 = TT.clamp01;
const ease = TT.ease;
const TAU = Math.PI * 2;
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
const titlePx = 62 * SCALE.title;
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

// 主墨线：一笔三段，起笔重、行笔提、收笔再按。浓淡靠叠笔与灰度，不用色块。
const spine = [
  ...cubic([280, 690], [520, 470], [760, 690], [1010, 500]),
  ...cubic([1010, 500], [1240, 340], [1420, 520], [1660, 380]).slice(1),
];
stroke(spine.slice(0, 22), 0.08, 0.8, ink, bold);
stroke(spine.slice(21, 46), 0.6, 0.7, midInk, mid);
stroke(spine.slice(45), 1.0, 0.7, ink, bold * 0.8);

// 洇染：沿主线下缘铺几道淡墨平行线，越远越淡，留出纸的白。
for (let i = 0; i < 5; i += 1) {
  const off = 26 + i * 22;
  const paleLine = spine.map((p, j) => [p[0] + i * 3, p[1] + off + Math.sin(j * 0.35 + i) * 9]);
  stroke(paleLine, 2.3 + i * 0.09, 0.6, i < 2 ? midInk : pale, thin * (1.4 - i * 0.16));
}

// 溅出的墨点：位置是序号的固定函数，不用随机数。
for (let i = 0; i < 7; i += 1) {
  const x = 330 + i * 197;
  const y = 760 - (i * 37) % 190;
  const r = 3 + (i % 3) * 2;
  stroke([[x, y], [x + r, y - r * 0.4]], 2.7 + i * 0.06, 0.3, i % 2 ? midInk : ink, thin);
}

label('一滴墨', W * 0.12, 190, titlePx, ink, prog(t, 0.2, 0.8), 'left', -0.02);
label('先洇开，再收住', W * 0.12, 250, notePx, midInk, prog(t, 2.4, 0.7), 'left', -0.01);

TT.pen.track(ctx, strokes, t, { sceneScale: fit * scale });
ctx.restore();
ctx.restore();
