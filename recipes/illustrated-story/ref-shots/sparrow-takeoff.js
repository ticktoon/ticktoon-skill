/* @ticktoon-ref-shot
{
  "title": "麻雀起飞",
  "note": "同一张纸，视线跟着起飞的动作向右上走",
  "duration": 5.893,
  "resources": [
    {
      "type": "font",
      "name": "sans-400"
    }
  ],
  "tags": [
    "动作",
    "视线",
    "拼贴"
  ]
}
*/
// 插画剪报 · 示例：同一张纸，视线跟着起飞的动作向右上走。
const T = api.t;
const t = T < 1.5 ? T : (T < 2.6 ? 1.5 : 1.5 + (T - 2.6) * 2.6);
const clamp01 = TT.clamp01;
const ease = TT.ease;
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
TT.board.cream(ctx, api, { seed: 3 });

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

// 大块蓝：不用平涂，用一组向右上倾斜的排线把色域织出来。
for (let i = 0; i < 26; i += 1) {
  const x = 640 + i * 38;
  stroke([[x, 600], [x + 150, 190 + Math.sin(i * 0.7) * 26]], 0.1 + i * 0.045, 0.5, i % 4 === 0 ? ink : blue, thin);
}

// 窗台与电线快速重画，观众认得出还是同一个地方。
stroke([[660, 660], [1200, 632], [1800, 608]], 1.0, 0.6, ink, bold);
stroke(cubic([300, 170], [900, 330], [1400, 300], [1800, 430], 40), 1.2, 0.7, blue, mid);

// 展翅：两道对称弧线，末端出锋。
stroke(cubic([1120, 470], [1240, 340], [1360, 330], [1440, 400], 30), 1.9, 0.9, ink, bold);
stroke(cubic([1120, 470], [1000, 350], [900, 340], [820, 410], 30), 2.1, 0.9, ink, bold);
stroke([[1100, 470], [1140, 486], [1120, 496]], 2.4, 0.5, warm, mid);

// 左侧只给一个侧影轮廓，不画五官：拼贴风不靠细节。
stroke(cubic([420, 640], [360, 520], [380, 420], [450, 390], 24), 1.5, 0.8, ink, mid);
stroke([[450, 390], [500, 400], [520, 440]], 1.8, 0.5, ink, mid);

// 插画剪报：只要笔迹（画面本身就是手绘线条），不要那支跟在后面的马克笔——penBody:false。
TT.pen.track(ctx, strokes, t, { sceneScale: 1, penBody: false });
ctx.restore();
