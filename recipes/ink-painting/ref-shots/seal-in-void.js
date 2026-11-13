/* @ticktoon-ref-shot
{
  "title": "印落空处",
  "note": "最后一方印落在留白里，不压主体墨线",
  "duration": 2.927,
  "resources": [
    {
      "type": "font",
      "name": "QianTuBiFengShouXie"
    }
  ],
  "tags": [
    "印章",
    "收束",
    "留白"
  ]
}
*/
// 水墨写意 · 示例：收束。印不压墨线，落在留白里。
const T = api.t;
// 呼吸放在笔画之间：收笔 0.1–1.0s 落完，随后才是淡墨与印。
// 不要用会冻结进度的时间重映射；t 停住时正在画的墨线会停在半空，看起来像卡死。
const clamp01 = TT.clamp01;
const ease = TT.ease;
const SCALE = RULES.scale || { title: 1, label: 0.75, note: 1.25 };
const STROKE = Array.isArray(RULES.stroke) ? RULES.stroke : [3, 12];
const M = Number.isFinite(RULES.safeMargin) ? RULES.safeMargin : 0.09;
const thin = STROKE[0];
const ink = '#2b2d2b';
const pale = '#a8aaa4';
const sealColor = '#a34030';
const titlePx = 76 * SCALE.title;

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
// 两块笔迹：收笔带笔；淡墨下沿只落墨，笔不在收束后重新冒出来。
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

// 收笔：一道短而重的墨线，把三场的视线收回到右下。
const finish = cubic([1180, 720], [1320, 690], [1460, 740], [1580, 690], 28);
stroke(finish, 0.10, 0.90, ink, thin * 3, [], true);
stroke([[1180, 748], [1330, 742], [1450, 752]], 1.08, 0.30, pale, thin * 0.8);

label('落在空处', W * 0.12, 200, titlePx, ink, prog(T, 0.15, 0.5), 'left', -0.02);
label('印不压墨线', W * 0.12, 278, 42 * SCALE.note, ink, prog(T, 0.95, 0.3), 'left', -0.01);

// 印章用方框 + 题字拼出：盒形走 TT.mark.box，文字走 TT.text，整体轻斜、淡入。
const sealAlpha = prog(T, 1.1, 0.4);
if (sealAlpha > 0) {
  ctx.save();
  ctx.translate(1680, 300);
  ctx.rotate(-0.08);
  TT.mark.box(ctx, { rect: [-28, -28, 56, 56], shape: 'round', radius: 5, color: sealColor, width: 4.5, alpha: sealAlpha });
  TT.text(ctx, '写意', 0, 4, 17, { fontKey: 'QianTuBiFengShouXie', color: sealColor, alpha: sealAlpha, align: 'center', baseline: 'middle', maxWidth: 44 });
  ctx.restore();
}

TT.pen.track(ctx, detailStrokes, T, { sceneScale: fit * scale, penBody: false });
TT.pen.track(ctx, strokes, T, { sceneScale: fit * scale });
ctx.restore();
ctx.restore();
