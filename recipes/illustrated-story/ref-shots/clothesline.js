/* @ticktoon-ref-shot
{
  "title": "晾衣绳与信",
  "note": "与三场故事示例不同题材，拼贴骨架相同：透视、撕边、排线、分区不变",
  "duration": 4,
  "resources": [
    {
      "type": "font",
      "name": "sans-400"
    }
  ],
  "tags": [
    "拼贴",
    "窗台",
    "静物"
  ]
}
*/
/*
 * 「晾衣绳与信」——与本 recipe 的三场故事示例不同题材，拼贴骨架完全一样。
 * 换内容只换曲线控制点、纸片四角与题款；contract 里的透视/撕边/排线/分区规律一行不动。
 * 舞台 TT.board.cream / 笔迹 TT.pen / 文字 TT.text / 字幕 captions.collage（bottom，一层）。
 */
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
const blue = '#3f6f8f';
const warm = '#c96a4d';
const muted = '#8b8578';

const enterDur = 0.62;
const exitDur = 0.3472;
const alpha = TT.env.fade(T, api.d, enterDur, exitDur);
ctx.save();
ctx.globalAlpha = alpha;
TT.board.cream(ctx, api, { seed: 5 });

const prog = (value, at, dur = 1) => ease.inOutCubic(clamp01((value - at) / dur));
const cubic = (a, b, c, d, n = 30) => {
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
  ctx.translate(x, y + (1 - k) * 10);
  ctx.rotate(rotate);
  ctx.globalAlpha = clamp01(k) * alpha;
  TT.text(ctx, value, 0, 0, size, { color, align, fontKey: 'sans-400' });
  ctx.restore();
};

// 撕边纸片：四边 12 段短折线，端点按序号抖动，转角不封死。
const scrap = [[280, 230], [660, 214], [676, 470], [292, 486]];
for (let e = 0; e < 4; e += 1) {
  const a = scrap[e];
  const b = scrap[(e + 1) % 4];
  const seg = [];
  for (let i = 0; i <= 12; i += 1) {
    const k = i / 12;
    seg.push([
      a[0] + (b[0] - a[0]) * k + Math.sin(i * 2.7 + e) * 5,
      a[1] + (b[1] - a[1]) * k + Math.sin(i * 1.9 + e) * 5,
    ]);
  }
  stroke(seg, 0.1 + e * 0.12, 0.55, warm, mid);
}
// 纸片内部斜向排线，代替整块平涂。
for (let i = 0; i < 14; i += 1) {
  const x = 310 + i * 25;
  stroke([[x, 258], [x + 40, 452]], 0.7 + i * 0.05, 0.4, muted, thin * 0.7);
}

// 晾衣绳：三次曲线给垂度，两根不同灰度形成前后层次。
stroke(cubic([180, 190], [760, 350], [1300, 320], [1780, 430], 40), 1.6, 1.0, blue, mid);
stroke(cubic([180, 258], [780, 410], [1320, 392], [1780, 500], 40), 1.8, 1.0, muted, thin);

// 挂着的几张小纸：每张都是一条短竖线加两道折角。
for (let i = 0; i < 5; i += 1) {
  const x = 820 + i * 190;
  const y = 330 + Math.sin(i * 1.3) * 22;
  stroke([[x, y], [x, y + 96]], 2.0 + i * 0.12, 0.5, ink, thin);
  stroke([[x, y + 96], [x + 34, y + 88], [x + 30, y + 46]], 2.2 + i * 0.1, 0.45, warm, thin);
}

// 窗台透视：两条不平行斜线交出厚度，右端收在安全框内。
stroke([[660, 660], [1200, 632], [1780, 608]], 1.1, 0.8, ink, bold);
stroke([[660, 692], [1200, 668], [1780, 642]], 1.3, 0.8, muted, mid);

label('晾衣绳', 1180, 170, 72 * SCALE.title, ink, prog(t, 0.15, 0.7), 'left', -0.02);
label('一封没寄出的信', 1182, 220, 34 * SCALE.note, muted, prog(t, 0.35, 0.7), 'left', -0.012);

TT.pen.track(ctx, strokes, t, { sceneScale: 1 });
ctx.restore();
