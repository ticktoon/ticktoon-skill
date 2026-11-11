/**
 * crayon-guide 模板 —— 整幅蜡笔绘本场景。
 *
 * 一张暖米纸上的图解：红圈角标、紫描边气泡、通用图标槽与领线标签、
 * 三根蜡笔柱状步骤卡、右下角注。所有斜纹、颗粒与手抖偏移都由序号哈希算出，
 * 同一帧重复渲染得到同一张纸，不依赖 Math.random，也不跨帧持有随机状态。
 */
  const { font, ease, clamp01 } = TT;
  const TAU = Math.PI * 2;
  const prog = (t, at, dur = 1) => ease.inOutCubic(clamp01((t - at) / dur));
  const pop = (t, at, dur = 0.58) => ease.back(1.3)(clamp01((t - at) / dur));

  /** 纯函数哈希：只由整数序号与通道决定，同一条线每帧都落在同一处。 */
  const hash = (i, ch = 0) => {
    let x = (Math.imul(Math.round(i) + 1, 0x9e3779b1) ^ Math.imul(Math.round(ch) + 13, 0x85ebca6b)) >>> 0;
    x ^= x >>> 16;
    x = Math.imul(x, 0x7feb352d) >>> 0;
    x ^= x >>> 15;
    x = Math.imul(x, 0x846ca68b) >>> 0;
    x ^= x >>> 16;
    return (x >>> 0) / 4294967295;
  };

  const INK = '#3A352D';
  const SOFT = '#6C6255';
  const PAPER = '#F6EEE0';
  const PANEL = '#FBF5E9';
  const ORANGE = '#D97A52';
  const PURPLE = '#8F7BC2';
  const GREEN = '#7FAE8C';
  const RED = '#C9605B';
  const BLUE = '#5F87A8';
  const OCHRE = '#D9A74F';

  const roundRectPath = (ctx, x, y, w, h, r = 3) => {
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
    else {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
  };

  /** 蜡笔线：沿线采样加抖动，叠第二遍细线制造蜡质毛边。 */
  const strokePts = (ctx, pts, color, width, seed, alpha = 1, wobble = 1.4) => {
    if (!pts || pts.length < 2 || alpha <= 0) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const parent = ctx.globalAlpha;
    for (let pass = 0; pass < 2; pass += 1) {
      ctx.lineWidth = Math.max(1, pass ? width * 0.55 : width);
      ctx.globalAlpha = parent * alpha * (pass ? 0.34 : 1);
      ctx.beginPath();
      for (let i = 0; i < pts.length; i += 1) {
        const amp = pass ? wobble * 1.7 : wobble;
        const px = pts[i][0] + (hash(seed + i, pass ? 6 : 1) - 0.5) * amp;
        const py = pts[i][1] + (hash(seed + i, pass ? 7 : 2) - 0.5) * amp;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  };

  const ellipsePts = (cx, cy, rx, ry, seed, n = 72, wob = 0.022, rotate = 0) => {
    const pts = [];
    for (let i = 0; i <= n; i += 1) {
      const a = TAU * i / n;
      const r = 1 + (hash(seed + i, 3) - 0.5) * 2 * wob;
      const x = Math.cos(a) * rx * r;
      const y = Math.sin(a) * ry * r;
      pts.push([
        cx + x * Math.cos(rotate) - y * Math.sin(rotate),
        cy + x * Math.sin(rotate) + y * Math.cos(rotate),
      ]);
    }
    return pts;
  };

  /** 斜线 + 颗粒的蜡笔填充，裁剪在 pathFn 画出的形状里。 */
  const crayonFill = (ctx, pathFn, bbox, color, seed, opts = {}) => {
    const gap = opts.gap || 8;
    const alpha = opts.alpha == null ? 0.5 : opts.alpha;
    const grain = opts.grain == null ? 0.55 : opts.grain;
    if (!(bbox.w > 0 && bbox.h > 0) || alpha <= 0) return;
    ctx.save();
    const parent = ctx.globalAlpha;
    ctx.beginPath();
    pathFn(ctx);
    ctx.clip();
    ctx.fillStyle = color;
    ctx.globalAlpha = parent * alpha * 0.16;
    ctx.fillRect(bbox.x, bbox.y, bbox.w, bbox.h);

    const diag = Math.hypot(bbox.w, bbox.h);
    const count = Math.ceil(diag / gap) + 1;
    const angle = -1.02; // 约 58° 的斜纹，接近参考图的蜡笔排线
    const cx = bbox.x + bbox.w / 2;
    const cy = bbox.y + bbox.h / 2;
    const dx = Math.cos(angle) * diag * 0.5;
    const dy = Math.sin(angle) * diag * 0.5;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    for (let i = -count; i <= count; i += 1) {
      const off = i * gap + (hash(seed + i, 8) - 0.5) * gap * 0.55;
      const px = cx + Math.sin(angle) * off;
      const py = cy - Math.cos(angle) * off;
      const bend = (hash(seed + i, 9) - 0.5) * 4;
      ctx.globalAlpha = parent * alpha * (0.42 + hash(seed + i, 10) * 0.38);
      ctx.lineWidth = 1.7 + hash(seed + i, 11) * 1.7;
      ctx.beginPath();
      ctx.moveTo(px - dx, py - dy);
      ctx.lineTo(px - dx * 0.08 + bend, py - dy * 0.08 - bend);
      ctx.lineTo(px + dx, py + dy);
      ctx.stroke();
    }

    const dots = Math.min(240, Math.floor((bbox.w * bbox.h) / 720));
    ctx.fillStyle = color;
    for (let i = 0; i < dots; i += 1) {
      const px = bbox.x + hash(seed * 7 + i, 12) * bbox.w;
      const py = bbox.y + hash(seed * 11 + i, 13) * bbox.h;
      const s = 0.8 + hash(seed + i, 14) * 1.5;
      ctx.globalAlpha = parent * alpha * grain * (0.06 + hash(seed + i, 15) * 0.24);
      ctx.fillRect(px, py, s, s);
    }
    ctx.restore();
  };

  /** 手绘方框：四边各自抖动并向外多画一点，避免像 UI 圆角卡片。 */
  const sketchBox = (ctx, x, y, w, h, seed, opts = {}) => {
    const stroke = opts.stroke || INK;
    const width = opts.width || 2.2;
    const alpha = opts.alpha == null ? 1 : opts.alpha;
    if (opts.fill) {
      ctx.save();
      ctx.globalAlpha *= alpha;
      roundRectPath(ctx, x, y, w, h, 3);
      ctx.fillStyle = opts.fill;
      ctx.fill();
      ctx.restore();
    }
    strokePts(ctx, [[x - 3, y], [x + w + 2, y - 2]], stroke, width, seed + 1, alpha, 1.5);
    strokePts(ctx, [[x + w, y - 2], [x + w + 2, y + h + 2]], stroke, width, seed + 2, alpha, 1.2);
    strokePts(ctx, [[x + w + 2, y + h], [x - 2, y + h + 1]], stroke, width, seed + 3, alpha, 1.6);
    strokePts(ctx, [[x, y + h + 1], [x - 2, y - 1]], stroke, width, seed + 4, alpha, 1.2);
  };

  const setFont = (ctx, fonts, size, role) => {
    ctx.font = font(fonts, size, role).css;
  };

  /** 手写字：逐字偏移与轻转，只用字序哈希，不随帧闪烁。 */
  const handText = (ctx, fonts, text, x, y, size, role, color, seed, opts = {}) => {
    const align = opts.align || 'left';
    const alpha = opts.alpha == null ? 1 : opts.alpha;
    const jitter = opts.jitter == null ? 1.2 : opts.jitter;
    const rot = opts.rot == null ? 0.012 : opts.rot;
    setFont(ctx, fonts, size, role);
    const chars = [...String(text)];
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0);
    let cursor = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    chars.forEach((ch, i) => {
      const dx = (hash(seed + i, 21) - 0.5) * jitter;
      const dy = (hash(seed + i, 22) - 0.5) * jitter * 1.3;
      const r = (hash(seed + i, 23) - 0.5) * 2 * rot;
      ctx.save();
      ctx.translate(cursor + widths[i] / 2 + dx, y + dy);
      ctx.rotate(r);
      ctx.fillText(ch, -widths[i] / 2, 0);
      ctx.restore();
      cursor += widths[i];
    });
    ctx.restore();
    return total;
  };

  /** 数字标签：数字用拉丁粗体、单位用手写，基线对齐。 */
  const numberText = (ctx, fonts, value, unit, cx, y, size, color, seed, alpha = 1) => {
    setFont(ctx, fonts, size, 'num');
    const wValue = ctx.measureText(value).width;
    setFont(ctx, fonts, Math.round(size * 0.52), 'hand');
    const wUnit = unit ? ctx.measureText(unit).width + size * 0.12 : 0;
    const left = cx - (wValue + wUnit) / 2;
    ctx.save();
    ctx.globalAlpha *= alpha;
    setFont(ctx, fonts, size, 'num');
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, left, y);
    if (unit) {
      setFont(ctx, fonts, Math.round(size * 0.52), 'hand');
      ctx.fillStyle = SOFT;
      ctx.fillText(unit, left + wValue + size * 0.12, y);
    }
    ctx.restore();
  };

  // ---- 通用图标槽：全部在局部坐标里画，外层只做 translate / scale ----
  const tomatoIcon = (ctx, k, seed) => {
    const body = (c) => {
      c.beginPath();
      for (let i = 0; i <= 72; i += 1) {
        const a = TAU * i / 72;
        const r = 1 + 0.05 * Math.sin(a * 6 + 0.4) + 0.02 * Math.sin(a * 11 + 1.2);
        const px = Math.cos(a) * 54 * r;
        const py = Math.sin(a) * 48 * r + 4;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.closePath();
    };
    crayonFill(ctx, body, { x: -62, y: -58, w: 124, h: 124 }, ORANGE, seed, { gap: 7, alpha: 0.56, grain: 0.65 });
    strokePts(ctx, ellipsePts(0, 4, 55, 49, seed), '#C25B43', 3.2, seed + 3, Math.min(1, k), 1.5);
    // 蒂与五瓣叶
    ctx.save();
    ctx.globalAlpha *= Math.min(1, k);
    ctx.beginPath();
    for (let i = 0; i <= 10; i += 1) {
      const a = -Math.PI / 2 + i * TAU / 10;
      const r = i % 2 ? 12 : 27;
      const px = Math.cos(a) * r;
      const py = -43 + Math.sin(a) * r * 0.5;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = GREEN;
    ctx.globalAlpha *= 0.7;
    ctx.fill();
    ctx.restore();
    strokePts(ctx, [[0, -46], [-2, -62]], '#6C5A3D', 4, seed + 5, Math.min(1, k), 1);
    strokePts(ctx, [[-46, 18], [-26, 4], [-8, -2]], '#E9A17F', 2.2, seed + 6, Math.min(1, k) * 0.7, 1);
  };

  const eggIcon = (ctx, k, seed) => {
    const body = (c) => {
      c.beginPath();
      c.ellipse(0, 0, 62, 45, -0.12, 0, TAU);
      c.closePath();
    };
    crayonFill(ctx, body, { x: -66, y: -50, w: 132, h: 100 }, '#E8D3A8', seed, { gap: 10, alpha: 0.3, grain: 0.4 });
    strokePts(ctx, ellipsePts(0, 0, 62, 45, seed, 72, 0.03, -0.12), '#C9B79D', 3, seed + 2, Math.min(1, k), 1.3);
    const yolk = (c) => { c.beginPath(); c.arc(9, 5, 24, 0, TAU); c.closePath(); };
    crayonFill(ctx, yolk, { x: -18, y: -22, w: 55, h: 55 }, OCHRE, seed + 1, { gap: 6, alpha: 0.62, grain: 0.55 });
    strokePts(ctx, ellipsePts(9, 5, 24, 24, seed + 4, 48, 0.03), '#C68F39', 2.4, seed + 3, Math.min(1, k), 1);
    strokePts(ctx, [[-34, -16], [-20, -29], [-4, -34]], '#FFFBEF', 2.2, seed + 5, Math.min(1, k) * 0.55, 1);
  };

  const noodleIcon = (ctx, k, seed) => {
    ctx.save();
    ctx.globalAlpha *= Math.min(1, k);
    for (let i = 0; i < 7; i += 1) {
      const x0 = -48 + i * 16;
      const pts = [];
      for (let j = 0; j <= 16; j += 1) {
        const yy = -58 + j * (110 / 16);
        pts.push([x0 + Math.sin(yy * 0.075 + i * 1.4) * 6, yy]);
      }
      strokePts(ctx, pts, OCHRE, 4.2, seed + i, 0.85, 0.8);
      strokePts(ctx, pts.map(([x, y]) => [x + 1.5, y]), '#F2D89F', 1.6, seed + i + 20, 0.55, 0.8);
    }
    ctx.restore();
    // 中间的纸带
    sketchBox(ctx, -60, -12, 120, 36, seed + 30, { stroke: '#8B7A64', width: 1.8, fill: 'rgba(251,245,233,0.88)', alpha: Math.min(1, k) });
    strokePts(ctx, [[-58, -4], [58, -4]], RED, 2.4, seed + 31, Math.min(1, k) * 0.7, 0.8);
    strokePts(ctx, [[-58, 16], [58, 16]], RED, 2.4, seed + 32, Math.min(1, k) * 0.7, 0.8);
  };

  const scallionIcon = (ctx, k, seed) => {
    ctx.save();
    ctx.globalAlpha *= Math.min(1, k);
    for (let i = 0; i < 3; i += 1) {
      const x0 = [-22, 4, 26][i];
      const pts = [];
      for (let j = 0; j <= 16; j += 1) {
        const yy = 52 - j * (104 / 16);
        pts.push([x0 + Math.sin(yy * 0.05 + i * 2.1) * 5 + i * 2, yy]);
      }
      strokePts(ctx, pts, GREEN, 5.4, seed + i * 3, 0.9, 1);
      strokePts(ctx, pts.map(([x, y]) => [x + 1, y]), '#D7E8D6', 2, seed + i * 3 + 1, 0.55, 0.8);
      // 根部小葱白
      ctx.save();
      ctx.globalAlpha *= 0.85;
      ctx.beginPath();
      ctx.ellipse(x0 + 2, 54, 6.5, 9, 0.1, 0, TAU);
      ctx.fillStyle = '#F7F1DF';
      ctx.fill();
      ctx.restore();
      strokePts(ctx, [[x0 - 3, 55], [x0 + 7, 55]], '#9C8C73', 1.4, seed + 10 + i, 0.7, 1);
      // 顶端分叉
      strokePts(ctx, [pts[pts.length - 1], [pts[pts.length - 1][0] - 8, -63]], GREEN, 3, seed + 40 + i, 0.8, 1);
      strokePts(ctx, [pts[pts.length - 1], [pts[pts.length - 1][0] + 7, -60]], GREEN, 3, seed + 50 + i, 0.8, 1);
    }
    ctx.restore();
  };


  const plateIcon = (ctx, k, seed) => {
    crayonFill(ctx, (c) => { c.beginPath(); c.ellipse(0, 4, 64, 28, 0, 0, TAU); c.closePath(); }, { x: -70, y: -30, w: 140, h: 68 }, '#E9DDBB', seed, { gap: 9, alpha: 0.38, grain: 0.5 });
    strokePts(ctx, ellipsePts(0, 4, 64, 28, seed), '#9C8A6A', 3, seed + 2, Math.min(1, k), 1.2);
    strokePts(ctx, ellipsePts(0, 1, 46, 19, seed + 3), '#C9B79D', 1.8, seed + 4, Math.min(1, k), 1);
  };
  const potIcon = (ctx, k, seed) => {
    const body = (c) => { c.beginPath(); c.moveTo(-58, -26); c.lineTo(58, -26); c.lineTo(46, 52); c.lineTo(-46, 52); c.closePath(); };
    crayonFill(ctx, body, { x: -62, y: -30, w: 124, h: 88 }, '#B08A63', seed, { gap: 8, alpha: 0.5, grain: 0.6 });
    strokePts(ctx, [[-58, -26], [-46, 52], [46, 52], [58, -26]], '#6C5A3D', 3.4, seed + 2, Math.min(1, k), 1.3);
    strokePts(ctx, [[-72, -26], [72, -26]], '#6C5A3D', 3.4, seed + 3, Math.min(1, k), 1.2);
    strokePts(ctx, [[-72, -26], [-88, -8]], '#6C5A3D', 3, seed + 4, Math.min(1, k), 1);
    strokePts(ctx, [[72, -26], [88, -8]], '#6C5A3D', 3, seed + 5, Math.min(1, k), 1);
  };
  const meatIcon = (ctx, k, seed) => {
    const body = (c) => { c.beginPath(); c.moveTo(-52, -20); c.quadraticCurveTo(-40, -52, 8, -46); c.quadraticCurveTo(56, -40, 52, 8); c.quadraticCurveTo(48, 44, 0, 42); c.quadraticCurveTo(-56, 40, -52, -20); c.closePath(); };
    crayonFill(ctx, body, { x: -58, y: -54, w: 116, h: 102 }, '#C77A62', seed, { gap: 8, alpha: 0.5, grain: 0.6 });
    strokePts(ctx, [[-44, -16], [-20, -36], [18, -34], [44, -10]], '#8E4C3C', 2.4, seed + 2, Math.min(1, k), 1.2);
  };
  const spoonIcon = (ctx, k, seed) => {
    const head = (c) => { c.beginPath(); c.ellipse(-22, -28, 30, 22, -0.3, 0, TAU); c.closePath(); };
    crayonFill(ctx, head, { x: -56, y: -54, w: 68, h: 52 }, '#D9C9A6', seed, { gap: 7, alpha: 0.5, grain: 0.5 });
    strokePts(ctx, ellipsePts(-22, -28, 30, 22, seed), '#9C8A6A', 2.8, seed + 2, Math.min(1, k), 1.2);
    strokePts(ctx, [[-6, -12], [46, 48]], '#9C8A6A', 6, seed + 3, Math.min(1, k), 1.2);
  };

  // 通用图标槽：只认器皿 / 食材大类，不认具体菜名。
  const ICONS = {
    bowl: noodleIcon, egg: eggIcon, veg: tomatoIcon, spice: scallionIcon,
    plate: plateIcon, pot: potIcon, meat: meatIcon, spoon: spoonIcon,
  };
  const ITEM_KINDS = Object.keys(ICONS);

  const drawIngredient = (ctx, item, index, cx, cy, t, at, seed, fonts) => {
    const label = item.label || '';
    const k = pop(t, at, 0.55);
    if (k <= 0) return;
    const bob = Math.sin(t * 0.8 + index * 1.4) * 1.4;
    ctx.save();
    ctx.translate(cx, cy + bob);
    ctx.scale(k, k);
    const icon = ICONS[item.kind] || ICONS.bowl;
    icon(ctx, k, seed);
    ctx.restore();

    const lk = prog(t, at + 0.42, 0.45);
    if (lk <= 0) return;
    setFont(ctx, fonts, 26, 'hand');
    const w = Math.min(180, ctx.measureText(label).width + 34);
    const x = cx - w / 2;
    const y = 466;
    // 引线：从食材底部落到标签框上沿，短且略带弧度
    strokePts(ctx, [[cx + 3, cy + 58 + bob], [cx - 6, y - 6]], SOFT, 1.5, seed + 60, lk * 0.55, 1.1);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(cx + 3, cy + 58 + bob, 1.7, 0, TAU);
    ctx.fill();
    sketchBox(ctx, x, y, w, 42, seed + 61, {
      stroke: SOFT, width: 1.8, fill: 'rgba(252,246,233,0.8)', alpha: lk,
    });
    handText(ctx, fonts, label, cx, y + 30, 26, 'hand', INK, seed + 62, { align: 'center', alpha: lk, jitter: 1 });
  };

  // ---- 主场景 ----
function draw(g, p) {
    const { ctx, W, H, fonts } = g;
    const t = g.sceneT;
    ctx.save();
    ctx.globalAlpha = g.a;

    // 纸底 + 纸纹 + 四周压暗，全部满幅且不进任何变换。
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    const vignette = ctx.createRadialGradient(W / 2, H * 0.46, H * 0.2, W / 2, H * 0.46, H * 0.78);
    vignette.addColorStop(0, 'rgba(255,252,242,0.10)');
    vignette.addColorStop(0.62, 'rgba(255,252,242,0)');
    vignette.addColorStop(1, 'rgba(116,92,64,0.075)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 900; i += 1) {
      const x = hash(i, 31) * W;
      const y = hash(i, 32) * H;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(109,91,67,0.055)';
      ctx.fillRect(x, y, 0.8 + hash(i, 33) * 1.4, 0.8 + hash(i, 34) * 1.1);
    }
    for (let i = 0; i < 46; i += 1) {
      const x = hash(i, 35) * W;
      const y = hash(i, 36) * H;
      strokePts(ctx, [[x, y], [x + 18 + hash(i, 37) * 30, y + (hash(i, 38) - 0.5) * 5]], 'rgba(120,100,75,0.10)', 1, 900 + i, 1, 0.8);
    }

    // ① 红圈角标：双圈手绘 + 大字在前、小字在后。
    const badgeK = prog(t, 0.12, 1.15);
    if (badgeK > 0) {
      const badge = String(p.badge || '3步搞定');
      const chars = [...badge];
      const big = chars.slice(0, 2).join('');
      const sub = chars.slice(2).join('');
      const cx = 195;
      const cy = 150;
      const wob = Math.sin(t * 0.85) * 0.008;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(wob);
      ctx.translate(-cx, -cy);
      const ring = (rx, ry, width, seed) => {
        const n = Math.max(2, Math.round(72 * badgeK));
        const pts = [];
        for (let i = 0; i <= n; i += 1) {
          const a = -2.3 + TAU * badgeK * i / n;
          const r = 1 + (hash(seed + i, 40) - 0.5) * 0.03;
          pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
        }
        strokePts(ctx, pts, RED, width, seed, 0.9, 1.2);
      };
      ring(72, 65, 4.2, 701);
      ring(65, 58, 2, 702);
      const textK = prog(t, 0.8, 0.5);
      if (textK > 0) {
        handText(ctx, fonts, big, cx, cy + 6, 50, 'display', RED, 703, { align: 'center', alpha: textK, jitter: 1.8, rot: 0.02 });
        if (sub) handText(ctx, fonts, sub, cx, cy + 42, 20, 'hand', RED, 704, { align: 'center', alpha: textK, jitter: 1, rot: 0.015 });
      }
      ctx.restore();
    }

    // ② 标题与手写下划线。
    const titleK = prog(t, 0.3, 0.9);
    if (titleK > 0) {
      const rise = (1 - titleK) * 18;
      handText(ctx, fonts, p.title, 312, 148 + rise, 82, 'display', INK, 710, { alpha: titleK, jitter: 2.4, rot: 0.014 });
      if (p.subtitle) {
        handText(ctx, fonts, p.subtitle, 314, 216 + rise, 26, 'hand', SOFT, 711, { alpha: titleK, jitter: 1 });
      }
      const uK = prog(t, 0.95, 0.8);
      if (uK > 0) {
        strokePts(ctx, [[306, 196], [420, 192], [540, 198], [660, 192], [762, 195]], ORANGE, 7, 712, 0.82 * uK, 2.4);
      }
    }

    // ③ 紫描边对话气泡：先画椭圆、再画尾巴，最后文字。
    const bubbleK = prog(t, 1.0, 1.05);
    if (bubbleK > 0) {
      const cx = 1390;
      const cy = 165 + Math.sin(t * 1.05) * 2;
      const rx = 295;
      const ry = 82;
      ctx.save();
      ctx.globalAlpha *= 0.06;
      ctx.fillStyle = PURPLE;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx - 4, ry - 4, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
      const n = Math.max(2, Math.round(72 * ease.inOutCubic(bubbleK)));
      const arc = [];
      for (let i = 0; i <= n; i += 1) {
        const a = -2.2 + TAU * ease.inOutCubic(bubbleK) * i / n;
        const r = 1 + (hash(801 + i, 41) - 0.5) * 0.022;
        arc.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
      }
      strokePts(ctx, arc, PURPLE, 3.2, 801, 0.92, 1.1);
      strokePts(ctx, ellipsePts(cx + 3, cy - 3, rx - 6, ry - 5, 802, 64, 0.02), PURPLE, 1.7, 802, 0.5 * bubbleK, 1);
      // 尾巴：两条微弧线收成 V
      if (bubbleK > 0.55) {
        const tk = prog(t, 1.9, 0.55);
        strokePts(ctx, [[1168, cy + 58], [1168, cy + 102], [1202, cy + 160]], PURPLE, 2.8, 803, tk * 0.85, 1.6);
        strokePts(ctx, [[1272, cy + 57], [1246, cy + 116], [1210, cy + 160]], PURPLE, 2.8, 804, tk * 0.85, 1.6);
      }
      const textK = prog(t, 1.55, 0.55);
      if (p.bubble && textK > 0) {
        handText(ctx, fonts, p.bubble, cx, cy + 12, 31, 'hand', INK, 805, { align: 'center', alpha: textK, jitter: 1.2 });
      }
    }

    // ④ 材料区标题与四格小图（items[] 优先，旧 ingredients[] 兼容）。
    const rawItems = Array.isArray(p.items) && p.items.length
      ? p.items
      : (p.ingredients || []).map((label, i) => ({ label, kind: ITEM_KINDS[i % ITEM_KINDS.length] }));
    const items = rawItems.slice(0, 4);
    if (items.length) {
      const secK = prog(t, 1.5, 0.6);
      if (secK > 0) {
        handText(ctx, fonts, `材料 · ${items.length} 样`, 120, 292, 31, 'hand', SOFT, 820, { alpha: secK, jitter: 1.2 });
        strokePts(ctx, [[122, 306], [212, 304], [298, 308]], ORANGE, 3.6, 821, secK * 0.6, 1.4);
      }
      const cxs = [200, 395, 590, 785];
      items.forEach((item, i) => {
        drawIngredient(ctx, item, i, cxs[i], 380, t, 1.9 + i * 0.52, 850 + i * 17, fonts);
      });
    }

    // ⑤ 步骤柱状图：三根蜡笔柱、柱顶编号、用时数字与右侧标签框。
    const steps = (p.steps || []).slice(0, 3);
    const times = (p.times || []).slice(0, 3);
    const baseY = 840;
    const barW = 150;
    const barCx = [390, 920, 1450];
    const barColor = [ORANGE, PURPLE, GREEN];
    const values = times.map((text, i) => {
      const n = parseFloat(String(text));
      return Number.isFinite(n) && n > 0 ? n : i + 2;
    });
    const maxValue = Math.max(1, ...values);
    let total = 0;

    steps.forEach((step, i) => {
      const value = values[i] || i + 2;
      total += value;
      const h = 120 + value / maxValue * 220;
      const topY = baseY - h;
      const cx = barCx[i];
      const at = 3.7 + i * 1.08;
      const k = prog(t, at, 0.9);
      if (k <= 0) return;
      const color = barColor[i];
      const seed = 900 + i * 31;
      const hVis = h * k;
      const yVis = baseY - hVis;

      // 柱底投影
      ctx.save();
      ctx.globalAlpha *= k * 0.35;
      ctx.fillStyle = SOFT;
      ctx.beginPath();
      ctx.ellipse(cx + 8, baseY + 3, barW * 0.52, 8, 0, 0, TAU);
      ctx.fill();
      ctx.restore();

      const barPath = (c) => { c.beginPath(); c.rect(cx - barW / 2, yVis, barW, hVis); c.closePath(); };
      crayonFill(ctx, barPath, { x: cx - barW / 2, y: yVis, w: barW, h: hVis }, color, seed, { gap: 8, alpha: 0.58, grain: 0.65 });

      // 轮廓：两条竖边 + 生长中的顶边
      strokePts(ctx, [[cx - barW / 2, baseY], [cx - barW / 2 - 1, yVis + 2]], color, 3.2, seed + 1, 0.9, 1.2);
      strokePts(ctx, [[cx + barW / 2, yVis + 1], [cx + barW / 2 + 1, baseY]], color, 3.2, seed + 2, 0.9, 1.2);
      if (k > 0.6) {
        const tk = prog(t, at + 0.55, 0.35);
        strokePts(ctx, [[cx - barW / 2 - 2, yVis], [cx, yVis - 3], [cx + barW / 2 + 2, yVis + 1]], color, 3.4, seed + 3, tk * 0.95, 1.4);
      }

      // 内部 X 桁架：参考图柱身的交叉支撑
      if (k > 0.25) {
        const braceK = prog(t, at + 0.4, 0.6);
        const levels = Math.max(1, Math.floor(hVis / 90));
        ctx.save();
        ctx.globalAlpha *= braceK;
        for (let b = 0; b < levels; b += 1) {
          const y0 = baseY - hVis * (b + 0.15) / levels;
          const y1 = baseY - hVis * (b + 0.85) / levels;
          const inset = 14 + (b % 2) * 4;
          strokePts(ctx, [[cx - barW / 2 + inset, y0], [cx + barW / 2 - inset, y1]], 'rgba(252,244,226,0.6)', 2.4, seed + 10 + b, 1, 1);
          strokePts(ctx, [[cx + barW / 2 - inset, y0], [cx - barW / 2 + inset, y1]], 'rgba(252,244,226,0.6)', 2.4, seed + 20 + b, 1, 1);
        }
        ctx.restore();
      }

      // 柱顶编号章：实色圆片 + 蜡笔斜纹，数字用深墨保证可读。
      const badgeP = pop(t, at + 0.72, 0.5);
      if (badgeP > 0) {
        ctx.save();
        ctx.translate(cx, topY - 2);
        ctx.scale(Math.max(0.001, badgeP), Math.max(0.001, badgeP));
        const cap = (c) => { c.beginPath(); c.arc(0, 0, 28, 0, TAU); c.closePath(); };
        ctx.save();
        ctx.globalAlpha *= 0.96;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, TAU);
        ctx.fill();
        ctx.restore();
        crayonFill(ctx, cap, { x: -31, y: -31, w: 62, h: 62 }, color, seed + 30, { gap: 6, alpha: 0.42, grain: 0.5 });
        strokePts(ctx, ellipsePts(0, 0, 28, 28, seed + 31, 48, 0.02), INK, 2.2, seed + 31, 0.9, 1);
        handText(ctx, fonts, String(i + 1), 0, 11, 32, 'display', INK, seed + 32, { align: 'center', jitter: 0.8, rot: 0.01 });
        ctx.restore();
      }

      // 用时数字：柱顶上方
      if (times[i]) {
        const timeK = prog(t, at + 0.82, 0.45);
        const parts = /^([\d.]+)\s*(.*)$/.exec(String(times[i])) || [null, String(times[i]), ''];
        numberText(ctx, fonts, parts[1], parts[2], cx, topY - 46, 42, color, seed + 33, timeK);
      }

      // 步骤标签框 + 引线
      const tagK = prog(t, at + 0.9, 0.5);
      if (tagK > 0) {
        setFont(ctx, fonts, 27, 'hand');
        const tw = ctx.measureText(step).width + 34;
        let tx = cx + barW / 2 + 18;
        if (tx + tw > 1800) tx = cx - barW / 2 - 18 - tw;
        const ty = topY - 92;
        strokePts(ctx, [[tx, ty + 23], [cx + (tx > cx ? barW / 2 + 2 : -barW / 2 - 2), ty + 42]], SOFT, 1.6, seed + 40, tagK * 0.6, 1.2);
        sketchBox(ctx, tx, ty, tw, 46, seed + 41, {
          stroke: INK, width: 2, fill: 'rgba(251,245,233,0.88)', alpha: tagK,
        });
        handText(ctx, fonts, step, tx + 17, ty + 33, 27, 'hand', INK, seed + 42, { alpha: tagK, jitter: 1 });
      }
    });

    // 地面线：一条粗蜡笔横线加一条轻描
    const groundK = prog(t, 3.5, 0.8);
    if (groundK > 0) {
      const ptsA = [];
      const ptsB = [];
      for (let i = 0; i <= 24; i += 1) {
        const x = 116 + i * (1688 / 24);
        ptsA.push([x, baseY + (hash(i, 50) - 0.5) * 3]);
        ptsB.push([x, baseY + 7 + (hash(i, 51) - 0.5) * 4]);
      }
      strokePts(ctx, ptsA.slice(0, Math.max(2, Math.round(ptsA.length * groundK))), INK, 4.6, 990, 0.9, 1.4);
      strokePts(ctx, ptsB.slice(0, Math.max(2, Math.round(ptsB.length * groundK))), 'rgba(108,98,85,0.5)', 1.6, 991, 0.8, 1.2);
    }

    // ⑥ 合计写在气泡下方（不占底部字幕带），右下角保留手写注。
    if (steps.length) {
      const totalK = prog(t, 6.9, 0.7);
      if (totalK > 0) {
        handText(ctx, fonts, `合计 ${total} 分钟`, 1500, 312, 32, 'hand', ORANGE, 1000, { align: 'center', alpha: totalK, jitter: 1.5 });
        strokePts(ctx, [[1392, 324], [1450, 320], [1560, 326], [1612, 322]], ORANGE, 3.6, 1001, totalK * 0.55, 1.8);
      }
    }
    if (p.note) {
      const noteK = prog(t, 7.35, 0.6);
      if (noteK > 0) {
        handText(ctx, fonts, p.note, 1798, 944, 21, 'hand', SOFT, 1002, { align: 'right', alpha: noteK, jitter: 0.9 });
        strokePts(ctx, [[1640, 936], [1660, 926], [1700, 922]], 'rgba(108,98,85,0.45)', 1.3, 1003, noteK * 0.6, 1.2);
      }
    }

    // 装饰性蜡笔屑：极轻，只在大块留白处出现
    const dustK = prog(t, 8.0, 0.6);
    if (dustK > 0) {
      ctx.save();
      ctx.globalAlpha *= dustK;
      for (let i = 0; i < 22; i += 1) {
        const x = 1100 + hash(i, 60) * 500;
        const y = 300 + hash(i, 61) * 220;
        strokePts(ctx, [[x, y], [x + 8 + hash(i, 62) * 15, y - 3 + hash(i, 63) * 6]], i % 2 ? ORANGE : BLUE, 1.4, 1100 + i, 0.16, 1);
      }
      ctx.restore();
    }

    g.captionAvoid = [
      { x: 90, y: H * 0.36, w: W * 0.88, h: H * 0.42 },
    ];
    g.ink = null;
    ctx.restore();
}
