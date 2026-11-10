/*
 * 白板「常态剖面」单场范例 —— 与 recipes/whiteboard-explainer/demo.storyboard.json 的 s01 同源。
 * 完整三场（常态 / 转折 / 后果）与呼吸节拍的时间重映射见该 demo。
 * 看四点：
 * 1) 舞台 TT.board、笔迹 TT.pen、文字 TT.text、标注 TT.mark，四者各管一段；
 * 2) RULES 给字号 / 线宽 / 边距，规范不散落在上千个数字里；
 * 3) 相机与反像采样走 TT.geom；本片用静态镜头，避免面积序列把推镜误读成落笔；
 * 4) 填充一律改成手绘排线，每笔都进 ink 回执，qa 才抓得到越界与碰撞。
 * 不要照抄题材：换主题时换掉剖面内容，骨架不变。
 */
// 白板手写 · 第 1/3 场：常态。内容写在 code 里，视觉规范从 RULES 读。
// 舞台 TT.board、笔迹 TT.pen、文字 TT.text、标注 TT.mark，四者各管一段。
const T = api.t;
// 两段落笔：前 1.5s 画底图，1.5–2.6s 停一拍让观众读完，之后加速补完标注。
// 重映射只作用于笔迹进度；淡入淡出与镜头仍走真实场景时间 T。
const t = T < 1.5 ? T : (T < 2.6 ? 1.5 : 1.5 + (T - 2.6) * 2.6);
const clamp01 = TT.clamp01;
const ease = TT.ease;
const TAU = Math.PI * 2;
const SCALE = RULES.scale || { title: 1, label: 0.8, note: 0.6 };
const STROKE = Array.isArray(RULES.stroke) ? RULES.stroke : [2.4, 4.5];
const M = Number.isFinite(RULES.safeMargin) ? RULES.safeMargin : 0.06;
const thin = STROKE[0];
const mid = (STROKE[0] + STROKE[1]) / 2;
const bold = STROKE[1];
const titlePx = 66 * SCALE.title;
const notePx = 50 * SCALE.note;
const westPx = 60 * SCALE.label;
const oceanPx = 65 * SCALE.label;
const ink = '#343a3b';
const blue = '#446b84';
const red = '#c66b57';
const muted = '#576061';

const enterDur = 0.62;
const exitDur = 0.3472;
const alpha = TT.env.fade(T, api.d, enterDur, exitDur);
ctx.save();
ctx.globalAlpha = alpha;
TT.board.paper(ctx, api);

// 镜头与安全框：TT.geom 复用 block 同一条 zoom 路径与反像采样。
// 本片用静态镜头：聚焦靠「讲到哪画到哪」，缓慢推镜会让 ink 面积被误读成持续落笔。
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
const cubic = (a, b, c, d, n = 28) => {
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
// 文字统一走 TT.text：它带 text 回执，qa 才抓得到越界与碰撞。
const label = (value, x, y, size, color, k, align = 'left', rotate = -0.012) => {
  if (k <= 0) return;
  ctx.save();
  ctx.translate(x, y + (1 - k) * 12);
  ctx.rotate(rotate);
  ctx.globalAlpha = clamp01(k) * alpha;
  TT.text(ctx, value, 0, 0, size, { color, align, role: 'body' });
  ctx.restore();
};

// ---- 第 1 场：先把常态画出来，前 3.8s 落笔，末尾留白给观众读 ----
label('厄尔尼诺', W * 0.5, 116, titlePx, ink, prog(t, 0.1, 0.9), 'center', -0.018);
TT.mark.underline(ctx, { from: [680, 145], to: [1240, 145], color: red, width: bold, offset: 0.03, slack: 0.02, progress: prog(t, 0.7, 0.8) });

const asia = [
  ...cubic([-40, 515], [45, 405], [122, 426], [178, 505]),
  ...cubic([178, 505], [190, 600], [210, 720], [285, 845]).slice(1),
];
const america = [
  ...cubic([1660, 545], [1695, 472], [1715, 386], [1765, 340]),
  ...cubic([1765, 340], [1800, 285], [1820, 368], [1855, 326]).slice(1),
  ...cubic([1855, 326], [1895, 304], [1918, 362], [1970, 420]).slice(1),
];
stroke(asia, 1.0, 1.1, ink, bold);
stroke(america, 1.3, 1.1, ink, bold);
stroke([[178, 505], [285, 503], [410, 506]], 1.7, 0.6, ink, mid);
stroke([[1525, 544], [1660, 545], [1740, 542]], 1.8, 0.6, ink, mid);

const basin = [
  ...cubic([178, 505], [195, 640], [235, 788], [380, 820]),
  ...cubic([380, 820], [720, 868], [1280, 843], [1515, 758]).slice(1),
  ...cubic([1515, 758], [1610, 710], [1640, 625], [1660, 545]).slice(1),
];
stroke(basin, 2.0, 1.0, muted, mid);

// 海面用淡蓝手绘排线，不用整块色域平涂：每一笔都进 ink 回执。
for (let i = 0; i < 5; i += 1) {
  const y = 585 + i * 44;
  stroke([[270 + i * 16, y], [560 + i * 10, y - 7], [980, y + 4], [1390 - i * 12, y - 5], [1620 - i * 18, y]], 2.4 + i * 0.1, 0.5, '#7ba0aa', thin, [16, 14]);
}

TT.mark.circle(ctx, { at: [430, 305], rx: 58, ry: 58, color: '#bd8b58', width: bold, progress: prog(t, 2.6, 0.8) });
for (let i = 0; i < 9; i += 1) {
  const a = TAU * i / 9;
  stroke([[430 + Math.cos(a) * 82, 305 + Math.sin(a) * 82], [430 + Math.cos(a) * 109, 305 + Math.sin(a) * 109]], 2.9 + i * 0.03, 0.3, '#bd8b58', mid);
}

const cloud = [
  ...cubic([1045, 350], [1010, 300], [1075, 270], [1115, 298]),
  ...cubic([1115, 298], [1120, 230], [1215, 222], [1230, 290]).slice(1),
  ...cubic([1230, 290], [1285, 250], [1340, 300], [1305, 342]).slice(1),
  ...cubic([1305, 342], [1230, 358], [1120, 354], [1045, 350]).slice(1),
];
stroke(cloud, 3.0, 0.8, blue, bold);
for (let i = 0; i < 7; i += 1) {
  const x = 1080 + i * 36;
  stroke([[x, 378], [x - 8, 420]], 3.3 + i * 0.04, 0.5, '#5c8094', mid, [10, 8]);
}

TT.mark.arrow(ctx, { via: [[1450, 435], [1260, 426], [1030, 432], [800, 424]], color: blue, width: mid, dash: [15, 12], progress: prog(t, 3.5, 0.9) });

label('亚洲', 118, 540, notePx, '#4a4c47', prog(t, 1.9, 0.6), 'center', 0.01);
label('西', 120, 600, westPx, ink, prog(t, 2.1, 0.6), 'center', -0.02);
label('南美洲', 1760, 580, notePx, '#4a4c47', prog(t, 2.2, 0.6), 'center', -0.01);
label('东', 1760, 638, westPx, ink, prog(t, 2.3, 0.6), 'center', 0.02);
label('太 平 洋', 920, 760, oceanPx, blue, prog(t, 2.5, 0.8), 'center', -0.018);

// 笔与笔迹在同一变换内：sceneScale 让 TT.pen 保留 fit × zoom 这层场景倍率。
TT.pen.track(ctx, strokes, t, { sceneScale: fit * scale });
ctx.restore();
ctx.restore();
