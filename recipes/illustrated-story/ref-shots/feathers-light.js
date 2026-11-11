/* @ticktoon-ref-shot
{
  "title": "羽毛与光",
  "note": "动作过去后画面只剩轻的东西；演示留白与收束",
  "duration": 4.448,
  "resources": [],
  "tags": [
    "收束",
    "留白",
    "拼贴"
  ]
}
*/
// 插画剪报 · 示例：动作过去之后，画面只剩轻的东西。
const T = api.t;
const t = T < 1.5 ? T : (T < 2.6 ? 1.5 : 1.5 + (T - 2.6) * 2.6);
const clamp01 = TT.clamp01;
const ease = TT.ease;
const SCALE = RULES.scale || { title: 1, label: 0.8, note: 0.6 };
const STROKE = Array.isArray(RULES.stroke) ? RULES.stroke : [2, 4];
const thin = STROKE[0];
const mid = (STROKE[0] + STROKE[1]) / 2;
const bold = STROKE[1];
const ink = '#2b3a42';
const warm = '#c96a4d';
const muted = '#8b8578';
const notePx = 34 * SCALE.note;

const enterDur = 0.62;
const exitDur = 0.3472;
const alpha = TT.env.fade(T, api.d, enterDur, exitDur);
ctx.save();
ctx.globalAlpha = alpha;
TT.board.cream(ctx, api, { seed: 3 });

const prog = (value, at, dur = 1) => ease.inOutCubic(clamp01((value - at) / dur));
const strokes = [];
const stroke = (pts, at, dur, color = ink, width = 4, dash = []) => {
  strokes.push({ pts, at, dur, pen: 'marker', color, width, dash, seed: 0 });
};
const label = (value, x, y, size, color, k, align = 'left', rotate = -0.012) => {
  if (k <= 0) return;
  ctx.save();
  ctx.translate(x, y + (1 - k) * 10);
  ctx.rotate(rotate);
  ctx.globalAlpha = clamp01(k) * alpha;
  TT.text(ctx, value, 0, 0, size, { color, align, role: 'body' });
  ctx.restore();
};

// 慢慢落下的光：斜向长排线，越往右越稀。
for (let i = 0; i < 18; i += 1) {
  const x = 880 + i * 42;
  stroke([[x, 150], [x + 190, 600]], 0.1 + i * 0.06, 0.6, i % 3 === 0 ? warm : muted, thin * 0.75);
}

stroke([[660, 660], [1200, 632], [1800, 608]], 0.9, 0.6, ink, bold);
stroke([[660, 692], [1200, 668], [1800, 642]], 1.1, 0.6, muted, mid);

// 三根羽毛：中轴 + 两侧短斜线，落点各不相同。
for (let i = 0; i < 3; i += 1) {
  const x = 1120 + i * 190;
  const y = 600 - i * 34;
  stroke([[x, y], [x + 16, y - 62]], 1.6 + i * 0.16, 0.5, ink, thin);
  for (let j = 0; j < 5; j += 1) {
    const yy = y - 10 - j * 11;
    stroke([[x + 4 + j * 2.6, yy], [x + 20 + j * 2.2, yy - 8]], 1.9 + i * 0.12 + j * 0.03, 0.3, muted, thin * 0.6);
  }
}

label('窗台上只剩光', 180, 170, 66 * SCALE.title, ink, prog(t, 0.2, 0.7), 'left', -0.02);

// 插画剪报：只要笔迹（画面本身就是手绘线条），不要那支跟在后面的马克笔——penBody:false。
TT.pen.track(ctx, strokes, t, { sceneScale: 1, penBody: false });
ctx.restore();
