/* @ticktoon-ref-shot
{
  "title": "窗台与电线",
  "note": "米色纸、窗台透视、电线与撕边纸片；主体在上半，字幕带留在下半",
  "duration": 7.197,
  "resources": [
    {
      "type": "font",
      "name": "sans-400"
    }
  ],
  "tags": [
    "拼贴",
    "透视",
    "窗台"
  ]
}
*/
// 插画剪报 · 示例：米色纸 + 窗台透视 + 电线 + 撕边纸片。
// 主体集中在画面上半，字幕带留在下半，两层互不压。
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
const notePx = 34 * SCALE.note;

const enterDur = 0.62;
const exitDur = 0.3472;
const alpha = TT.env.fade(T, api.d, enterDur, exitDur);
ctx.save();
ctx.globalAlpha = alpha;
TT.board.cream(ctx, api, { seed: 3 });

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

// 撕边纸片：四边都是短折线，转角不封死，像手撕下来贴上去的。
const scrap = [[1240, 220], [1620, 208], [1640, 470], [1252, 486]];
for (let e = 0; e < 4; e += 1) {
  const a = scrap[e];
  const b = scrap[(e + 1) % 4];
  const seg = [];
  for (let i = 0; i <= 12; i += 1) {
    const k = i / 12;
    seg.push([a[0] + (b[0] - a[0]) * k + Math.sin(i * 2.7 + e) * 5, a[1] + (b[1] - a[1]) * k + Math.sin(i * 1.9 + e) * 5]);
  }
  stroke(seg, 0.1 + e * 0.12, 0.55, warm, mid);
}
// 纸片内的斜向排线，代替整块平涂。
for (let i = 0; i < 14; i += 1) {
  const x = 1270 + i * 26;
  stroke([[x, 250], [x + 44, 455]], 0.7 + i * 0.05, 0.4, muted, thin * 0.7);
}

// 窗台透视：两条不平行的斜线交出厚度，台面用短排线带出进深。
stroke([[660, 660], [1200, 632], [1800, 608]], 1.1, 0.8, ink, bold);
stroke([[660, 692], [1200, 668], [1800, 642]], 1.3, 0.8, ink, mid);
for (let i = 0; i < 9; i += 1) {
  const x = 700 + i * 125;
  stroke([[x, 666], [x + 22, 694]], 1.7 + i * 0.05, 0.4, muted, thin);
}

// 两根电线：弧线垂度由控制点给，不随帧摆动（det 要稳）。
stroke(cubic([300, 170], [900, 330], [1400, 300], [1800, 430], 40), 2.0, 1.0, blue, mid);
stroke(cubic([300, 250], [920, 400], [1420, 380], [1800, 500], 40), 2.2, 1.0, muted, thin);

// 停在电线上的主角：不规则圈 + 尖嘴 + 两笔尾羽。
TT.mark.circle(ctx, { at: [1480, 370], rx: 34, ry: 26, color: ink, width: mid, progress: prog(t, 2.4, 0.7) });
stroke([[1512, 362], [1540, 356]], 2.7, 0.4, warm, mid);
stroke([[1448, 384], [1414, 410], [1420, 392]], 2.8, 0.5, ink, mid);
label('窗边', 180, 170, 72 * SCALE.title, ink, prog(t, 0.15, 0.7), 'left', -0.02);
label('午后观察手记', 182, 220, notePx, muted, prog(t, 0.35, 0.7), 'left', -0.012);

// 插画剪报：只要笔迹（画面本身就是手绘线条），不要那支跟在后面的马克笔——penBody:false。
TT.pen.track(ctx, strokes, t, { sceneScale: 1, penBody: false });
ctx.restore();
