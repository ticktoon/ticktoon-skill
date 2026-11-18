/* @ticktoon-ref-shot
{
  "title": "盲区便利贴",
  "note": "重学循环与薄荷绿便利贴，最后写下讲不下去的地方",
  "duration": 8,
  "resources": [
    {
      "type": "font",
      "name": "TsangerYuMo"
    }
  ],
  "tags": [
    "便利贴",
    "盲区",
    "重学"
  ]
}
*/
// 白板手写 · 便利贴：主循环先落笔，盲区说明最后落下。
const T = api.t;
const D = api.d;
const clamp01 = TT.clamp01;
const lerp = (a, b, k) => a + (b - a) * k;
const ease = TT.ease;
const C = {
  ink: '#292824', mint: '#82CDB6', yellow: '#F2D26B', red: '#C0503F', muted: '#576061',
};
const STROKE = Array.isArray(RULES.stroke) ? RULES.stroke : [2.4, 4.5];
const thin = STROKE[0];
const mid = (STROKE[0] + STROKE[1]) / 2;
const bold = STROKE[1];
const alpha = TT.env.fade(T, D, 0.62, 0.3472);
const line = (x1, y1, x2, y2, n = 20) => Array.from({ length: n + 1 }, (_, i) => [lerp(x1, x2, i / n), lerp(y1, y2, i / n)]);
const arc = (cx, cy, rx, ry, a0, a1, n = 48) => Array.from({ length: n + 1 }, (_, i) => {
  const a = lerp(a0, a1, i / n);
  return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
});
const measure = (str, size) => {
  ctx.save();
  ctx.font = TT.font(FONTS, size, 'TsangerYuMo').css;
  const widths = [...str].map((ch) => ctx.measureText(ch).width);
  ctx.restore();
  return widths;
};
const prog = (at, dur = 1) => ease.inOutCubic(clamp01((T - at) / dur));

ctx.save();
ctx.globalAlpha = alpha;
TT.board.paper(ctx, api);

// 点阵只增加纸面触感，不另铺第二层底色。
ctx.fillStyle = 'rgba(83,78,68,.14)';
for (let y = 26; y < H; y += 46) {
  for (let x = 24; x < W; x += 46) {
    ctx.beginPath();
    ctx.arc(x, y, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 文字统一走 TT.text，逐字揭示但不做一套私有笔身。
function handwriting(str, x, y, size, color, at, dur, align = 'left') {
  const p = prog(at, dur);
  if (p <= 0) return;
  const widths = measure(str, size);
  const total = widths.reduce((sum, w) => sum + w, 0);
  let cx = align === 'center' ? x - total / 2 : x;
  ctx.save();
  ctx.font = TT.font(FONTS, size, 'TsangerYuMo').css;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  const n = widths.length;
  for (let i = 0; i < n; i += 1) {
    const lp = clamp01((p * n - i) * 1.25);
    if (lp > 0) {
      const wy = y + Math.sin(i * 91 + size) * size * 0.012;
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx - 3, y - size * 1.12, (widths[i] + 6) * lp, size * 1.55);
      ctx.clip();
      ctx.globalAlpha = Math.min(1, 0.18 + lp * 1.5) * alpha;
      TT.text(ctx, str[i], cx, wy, size, { fontKey: 'TsangerYuMo', color });
      ctx.restore();
    }
    cx += widths[i];
  }
  ctx.restore();
}

const HEAD = '卡住就重学';
const titleSize = 84 * RULES.scale.title;
const hws = measure(HEAD, titleSize);
const HW = hws.reduce((sum, w) => sum + w, 0);
const HX = (W - HW) / 2 - 260;
const hat = HEAD.indexOf('重学');
const hBefore = hws.slice(0, hat).reduce((sum, w) => sum + w, 0);
const hKeyWidth = hws.slice(hat, hat + 2).reduce((sum, w) => sum + w, 0);
TT.mark.highlight(ctx, {
  rect: { x: HX + hBefore - 8, y: 300 - titleSize * 0.78, w: hKeyWidth + 16, h: titleSize * 1.2 },
  color: 'rgba(130,205,182,.68)', progress: prog(0.55, 0.35), seed: 7,
});
handwriting(HEAD, HX, 300, titleSize, C.ink, 0.12, 0.95);

// 两段循环箭头走公共 mark，带笔时间与方框循环错开。
TT.mark.arrow(ctx, {
  via: arc(560, 600, 200, 190, -2.7, 0.6, 60), color: C.ink, width: bold,
  progress: prog(1.55, 0.85), penBody: true, sceneScale: 1, seed: 3, smooth: true,
});
TT.mark.arrow(ctx, {
  via: arc(560, 600, 200, 190, 0.4, 3.5, 48), color: C.ink, width: mid,
  progress: prog(2.55, 0.85), penBody: true, sceneScale: 1, seed: 5, smooth: true,
});

// 循环小方块：贯通折线只走 TT.pen。
const heroStrokes = [];
const square = [
  ...line(470, 548, 560, 584, 16),
  ...line(560, 584, 650, 548, 16),
  ...line(650, 548, 650, 652, 16),
  ...line(650, 652, 560, 688, 16),
  ...line(560, 688, 470, 652, 16),
  ...line(470, 652, 470, 548, 16),
  ...line(470, 548, 560, 584, 16),
];
heroStrokes.push({ pts: square, at: 3.55, dur: 0.9, pen: 'marker', color: C.ink, width: mid, seed: 0, smooth: true });
heroStrokes.push({ pts: line(560, 584, 560, 688, 16), at: 4.05, dur: 0.45, pen: 'marker', color: C.ink, width: mid, seed: 0, smooth: true });
TT.pen.track(ctx, heroStrokes, T, { sceneScale: 1 });

// 便利贴：短距落下，文字随后在纸上书写。
const NP0 = 4.55;
const np = ease.back(1.2)(clamp01((T - NP0) / 0.6));
if (np > 0) {
  ctx.save();
  ctx.translate(1330, 560 - (1 - np) * 70);
  ctx.rotate(-0.09 + (1 - np) * 0.07);
  ctx.scale(np, np);
  ctx.shadowColor = 'rgba(53,45,34,.2)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 13;
  ctx.fillStyle = '#CDE9DC';
  ctx.beginPath();
  ctx.roundRect(-240, -150, 480, 300, 14);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // 顶部半透明胶带与斜纹。
  ctx.save();
  ctx.translate(0, -172);
  ctx.rotate(0.05);
  ctx.fillStyle = 'rgba(242,210,107,.72)';
  ctx.fillRect(-78, -24, 156, 48);
  ctx.strokeStyle = 'rgba(255,255,255,.25)';
  ctx.lineWidth = 3;
  for (let x = -68; x < 72; x += 15) {
    ctx.beginPath();
    ctx.moveTo(x, -21);
    ctx.lineTo(x + 18, 21);
    ctx.stroke();
  }
  ctx.restore();

  handwriting('讲不下去的地方', 0, -18, 44, C.ink, NP0 + 0.3, 0.95, 'center');
  handwriting('就是你的盲区', 0, 56, 44, C.ink, NP0 + 0.85, 0.95, 'center');
  ctx.restore();
}
ctx.restore();
