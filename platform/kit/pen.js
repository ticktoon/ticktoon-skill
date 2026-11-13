/**
 * TT.pen —— 公共笔迹与笔具预设。
 *
 * 调用方只提交路径和时间，不在这里之外实现笔尖跟随、显隐或纸张纹理。
 * 所有扰动都是路径、序号与 seed 的纯函数；同一帧重复 seek 不会抖动。
 */
(() => {
  const TAU = Math.PI * 2;
  const FADE_OUT = 0.08;
  const FIXED_ANGLE = 35 * Math.PI / 180;
  const IDS = ['marker', 'pencil', 'brush', 'inkbrush', 'chalk', 'fineliner'];
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const mix = (a, b, k) => a + (b - a) * k;
  const smooth = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const noise = (i, seed = 0) => {
    const x = Math.sin(i * 127.1 + seed * 0.013 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const rgbOf = (hex) => {
    const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(String(hex || ''));
    if (!match) return null;
    const value = match[1].length === 3 ? [...match[1]].map((c) => c + c).join('') : match[1];
    const n = parseInt(value, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  /** 只在合法 #rrggbb 上做明暗微调；其它颜色原样返回，笔帽颜色始终跟随笔迹。 */
  const shade = (hex, amount) => {
    const rgb = rgbOf(hex);
    if (!rgb) return hex;
    const target = amount < 0 ? 0 : 255;
    const k = Math.abs(amount);
    const out = rgb.map((c) => Math.round(c + (target - c) * k));
    return `#${out.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  };
  const roundRect = (ctx, x, y, w, h, r) => {
    const radius = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, radius);
    else {
      ctx.moveTo(x + radius, y);
      ctx.arcTo(x + w, y, x + w, y + h, radius);
      ctx.arcTo(x + w, y + h, x, y + h, radius);
      ctx.arcTo(x, y + h, x, y, radius);
      ctx.arcTo(x, y, x + w, y, radius);
      ctx.closePath();
    }
  };

  /**
   * 墨迹框累计：把笔迹中心线经当前 ctx 变换映射到画布坐标后并入 bbox，再按线宽补半径。
   * 只在 TT.pen 的绘制通道里累计，所以调用方自己画的底色/道具不会被算成笔迹。
   * code 场由 emit 每帧 resetBBox，帧末读 bbox 上报 __ttReceipt。
   */
  let inkBBox = null;
  function accumulateBBox(ctx, points, width) {
    if (!Array.isArray(points) || !points.length) return;
    let matrix = null;
    try {
      matrix = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
    } catch {
      matrix = null;
    }
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const point of points) {
      if (!Array.isArray(point)) continue;
      const px = Number(point[0]);
      const py = Number(point[1]);
      if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
      const x = matrix ? matrix.a * px + matrix.c * py + matrix.e : px;
      const y = matrix ? matrix.b * px + matrix.d * py + matrix.f : py;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
    if (!Number.isFinite(x0)) return;
    // 线宽在用户坐标系里，补到屏幕坐标要乘当前变换的线性倍率。
    const scale = matrix ? Math.sqrt(Math.abs(matrix.a * matrix.d - matrix.b * matrix.c)) || 1 : 1;
    const half = Math.max(0, Number.isFinite(width) ? width : 4) / 2 * scale;
    x0 -= half; y0 -= half; x1 += half; y1 += half;
    if (!inkBBox) {
      inkBBox = { x0, y0, x1, y1 };
    } else {
      if (x0 < inkBBox.x0) inkBBox.x0 = x0;
      if (y0 < inkBBox.y0) inkBBox.y0 = y0;
      if (x1 > inkBBox.x1) inkBBox.x1 = x1;
      if (y1 > inkBBox.y1) inkBBox.y1 = y1;
    }
  }

  /** 保留白板原有马克笔的坐标扰动；seed=0 时与旧样片完全同式。 */
  function texturedPoints(pts, pen, seed) {
    if (pen === 'fineliner') return pts;
    const amount = pen === 'marker' ? 1.25 : pen === 'pencil' ? 0.62 : pen === 'chalk' ? 1.05 : 0.38;
    const phase = pen === 'marker' && !seed ? 0 : seed * 0.0007;
    return pts.map((p, i) => [
      p[0] + Math.sin(i * 8.73 + p[1] * 0.031 + phase) * amount,
      p[1] + Math.cos(i * 7.17 + p[0] * 0.027 + phase) * amount,
    ]);
  }

  /** 累计弧长裁切。返回的实际末端同时是笔具的笔尖锚点。 */
  function partial(pts, k) {
    if (k <= 0 || !Array.isArray(pts) || pts.length < 2) return null;
    const lengths = [0];
    for (let i = 1; i < pts.length; i += 1) {
      lengths.push(lengths[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    }
    const total = lengths[lengths.length - 1];
    if (!(total > 0)) return null;
    const target = total * clamp01(k);
    const out = [pts[0]];
    let last = pts[0];
    let before = pts[0];
    for (let i = 1; i < pts.length; i += 1) {
      before = last;
      if (lengths[i] <= target) {
        out.push(pts[i]);
        last = pts[i];
        continue;
      }
      const span = lengths[i] - lengths[i - 1] || 1;
      const q = clamp01((target - lengths[i - 1]) / span);
      last = [mix(pts[i - 1][0], pts[i][0], q), mix(pts[i - 1][1], pts[i][1], q)];
      out.push(last);
      break;
    }
    let angle = Math.atan2(last[1] - before[1], last[0] - before[0]);
    if (!Number.isFinite(angle) || (last[0] === before[0] && last[1] === before[1])) {
      angle = Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]);
    }
    return { points: out, lengths, total, last, before, angle };
  }

  function path(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
  }

  function grain(ctx, cut, color, width, seed, chalk) {
    const baseAlpha = ctx.globalAlpha;
    ctx.fillStyle = color;
    let revealedLength = 0;
    for (let i = 1; i < cut.points.length; i += 1) {
      revealedLength += Math.hypot(cut.points[i][0] - cut.points[i - 1][0], cut.points[i][1] - cut.points[i - 1][1]);
    }
    const count = Math.min(900, Math.floor(revealedLength / (chalk ? 8 : 14)));
    // 用已揭示点列而不是墙钟随机数撒颗粒；颗粒只在笔画附近，不污染纸面。
    const revealed = Math.max(1, cut.points.length - 1);
    for (let i = 0; i < count; i += 1) {
      const at = noise(i, seed + 17) * revealed;
      const index = Math.min(revealed - 1, Math.floor(at));
      const q = at - index;
      const a = cut.points[index];
      const b = cut.points[index + 1];
      const x = mix(a[0], b[0], q);
      const y = mix(a[1], b[1], q);
      const angle = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2;
      const spread = (noise(i, seed + 41) - 0.5) * width * (chalk ? 1.8 : 1.15);
      const size = (chalk ? 0.65 : 0.35) + noise(i, seed + 83) * (chalk ? 1.6 : 0.75);
      ctx.globalAlpha = baseAlpha * ((chalk ? 0.18 : 0.12) + noise(i, seed + 103) * (chalk ? 0.38 : 0.22));
      ctx.fillRect(x + Math.cos(angle) * spread, y + Math.sin(angle) * spread, size, size);
    }
  }

  function drawTrace(ctx, pts, k, opts = {}) {
    const pen = IDS.includes(opts.pen) ? opts.pen : 'marker';
    // smooth 供标注等规整线稿关闭坐标扰动；普通白板笔迹仍保留原有墨迹质感。
    const source = opts.smooth === true ? pts : texturedPoints(pts, pen, opts.seed || 0);
    const cut = partial(source, k);
    if (!cut) return null;
    const color = opts.color || (pen === 'inkbrush' ? '#202923' : '#353b3c');
    const width = Number.isFinite(opts.width) ? opts.width : 4;
    const dash = Array.isArray(opts.dash) ? opts.dash : [];
    const seed = opts.seed || 0;
    accumulateBBox(ctx, cut.points, width);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineJoin = 'round';
    ctx.lineCap = pen === 'chalk' || pen === 'fineliner' ? 'butt' : 'round';

    if ((pen === 'brush' || pen === 'inkbrush') && !dash.length) {
      // 分段圆叠出连续中锋；水墨笔用更饱满的笔肚与低透明度底层表现纸面墨晕。
      ctx.lineCap = 'round';
      const baseAlpha = ctx.globalAlpha;
      const paint = (wash) => {
        ctx.globalAlpha = baseAlpha * (wash ? 0.055 : pen === 'inkbrush' ? 0.96 : 1);
        for (let i = 1; i < cut.points.length; i += 1) {
          const q = cut.total ? (cut.lengths[i - 1] || 0) / cut.total : 0;
          let pressure;
          if (pen === 'inkbrush') {
            pressure = 0.16 + Math.pow(Math.sin(Math.PI * clamp01(q)), 0.58) * 1.55;
          } else if (opts.taper === 'end') {
            // 起笔饱满、末端逐渐收尖，适合对勾的长上扬笔。
            pressure = 0.20 + Math.pow(1 - clamp01(q), 0.72) * 1.30;
          } else if (opts.taper === 'start') {
            pressure = 0.20 + Math.pow(clamp01(q), 0.72) * 1.30;
          } else if (opts.taper === 'soft') {
            // 两端仍保持圆厚，只在中段轻微加压，适合手写叉。
            pressure = 0.72 + Math.pow(Math.sin(Math.PI * clamp01(q)), 0.72) * 0.58;
          } else if (opts.taper === 'none') {
            pressure = 1;
          } else {
            pressure = 0.30 + Math.pow(Math.sin(Math.PI * clamp01(q)), 0.72) * 1.22;
          }
          ctx.lineWidth = Math.max(0.65, width * pressure + (wash ? 2.2 : 0));
          ctx.beginPath();
          ctx.moveTo(cut.points[i - 1][0], cut.points[i - 1][1]);
          ctx.lineTo(cut.points[i][0], cut.points[i][1]);
          ctx.stroke();
        }
      };
      if (pen === 'inkbrush') paint(true);
      paint(false);
    } else if (pen === 'chalk') {
      // 粉笔线连续不断：不再用缺省 dash 模拟粉粒，而是逐段轻微调粗细。
      // 相邻段共享端点 + round cap，接缝处不会出现纸色的断点；`dash` 只有作者显式传入时才生效。
      ctx.lineCap = 'round';
      const baseWidth = Math.max(0.85, width * 1.14);
      if (dash.length) ctx.setLineDash(dash);
      for (let i = 1; i < cut.points.length; i += 1) {
        const wobble = 1
          + Math.sin(i * 1.87 + seed * 0.37) * 0.055
          + (noise(i, seed + 7) - 0.5) * 0.08;
        ctx.lineWidth = baseWidth * wobble;
        ctx.beginPath();
        ctx.moveTo(cut.points[i - 1][0], cut.points[i - 1][1]);
        ctx.lineTo(cut.points[i][0], cut.points[i][1]);
        ctx.stroke();
      }
    } else {
      ctx.lineWidth = Math.max(0.65, width * (pen === 'pencil' ? 0.78 : pen === 'fineliner' ? 0.55 : pen === 'brush' ? 0.9 : 1));
      ctx.setLineDash(dash);
      if (pen === 'pencil') ctx.globalAlpha *= 0.88;
      path(ctx, cut.points);
      ctx.stroke();
    }

    if (pen === 'pencil' || pen === 'chalk') grain(ctx, cut, color, width, seed, pen === 'chalk');
    ctx.restore();
    cut.color = color;
    cut.width = width;
    return cut;
  }

  function polygon(ctx, points, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * 以下都是笔尖在 (0,0)、笔身向负 Y 延伸的实物剪影。
   *
   * marker 改成「经典白杆马克笔」：白色/浅灰笔杆、黑色笔箍与笔夹，彩色笔帽跟随笔迹颜色，
   * 笔头斜切。宽白杆 + 深色箍 + 彩色帽形成强剪影，缩小到 150px 也一眼认得。
   */
  function markerBody(ctx, opts = {}) {
    const cap = opts.color || '#353b3c';
    const capDark = shade(cap, -0.26);
    const capLight = shade(cap, 0.16);
    const tipInk = shade(cap, -0.52);

    // 斜切笔头：深灰毡面 + 笔迹色的墨迹前沿。
    polygon(ctx, [[-7, 0], [6, 0], [9.5, -9], [-6.5, -15]], '#3c4042');
    polygon(ctx, [[-6.5, -6], [7.5, -1.5], [9.5, -9], [0, -12.5]], tipInk);
    // 黑色笔箍（nib collar）：宽出笔杆一圈，剪影上的第一道重色。
    ctx.fillStyle = '#1e2224';
    roundRect(ctx, -13.5, -33, 27, 22, 3); ctx.fill();
    ctx.fillStyle = '#3b4144'; ctx.fillRect(-13.5, -16, 27, 2.6);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(-10, -31, 4, 14);

    // 白色笔杆：左侧冷灰阴影、右侧稍深、中央高光，保持「白杆」的大块亮面。
    ctx.fillStyle = '#f5f3ec';
    roundRect(ctx, -16, -145, 32, 116, 4); ctx.fill();
    ctx.fillStyle = '#e2dfd5'; ctx.fillRect(-16, -145, 7, 116);
    ctx.fillStyle = '#cdcbc2'; ctx.fillRect(9, -145, 7, 116);
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(-4, -141, 4, 104);
    // 黑色笔箍与尾环，固定白杆的两端。
    ctx.fillStyle = '#1e2224'; ctx.fillRect(-16, -149, 32, 5); ctx.fillRect(-16, -37, 32, 4);

    // 彩色标签环：笔帽之外的第二处笔迹色，避免整支笔只有帽尖一点颜色。
    ctx.fillStyle = cap; ctx.fillRect(-16, -113, 32, 32);
    ctx.fillStyle = capLight; ctx.fillRect(-16, -113, 32, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.32)'; ctx.fillRect(-12, -103, 10, 3);
    ctx.fillStyle = capDark; ctx.fillRect(-16, -85, 32, 4);

    // 彩色笔帽：比笔杆更宽，圆顶，右侧留一道暗面，全部跟随笔迹色。
    ctx.fillStyle = cap;
    roundRect(ctx, -18, -191, 36, 47, 8); ctx.fill();
    ctx.fillStyle = capLight;
    roundRect(ctx, -18, -191, 12, 47, 8); ctx.fill();
    ctx.fillStyle = capDark;
    roundRect(ctx, 10, -191, 8, 47, 6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.38)'; ctx.fillRect(-13, -185, 3, 31);
    // 帽顶的注塑环。
    ctx.fillStyle = capDark; ctx.fillRect(-18, -147, 36, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(-14, -146, 28, 1.5);
    // 黑色笔夹：从帽顶垂下，压在白杆上，是「马克笔」最具辨识度的细节。
    ctx.fillStyle = '#191d1f';
    roundRect(ctx, 11, -188, 8, 55, 3); ctx.fill();
    ctx.fillStyle = '#4a5154'; ctx.fillRect(12.5, -184, 2, 42);
    ctx.fillStyle = '#101315'; ctx.fillRect(11, -193, 8, 5);
  }

  function pencilBody(ctx) {
    polygon(ctx, [[0, 0], [-4, -13], [4, -13]], '#303337');
    polygon(ctx, [[-4, -13], [-13, -45], [13, -45], [4, -13]], '#d7ad73');
    polygon(ctx, [[0, 0], [-4, -13], [0, -17], [4, -13]], '#44474a');
    polygon(ctx, [[-4, -13], [-13, -45], [-3, -45], [0, -17]], '#edc994');
    polygon(ctx, [[-13, -45], [-7, -49], [-7, -153], [-13, -148]], '#c88f25');
    ctx.fillStyle = '#efbc3f'; ctx.fillRect(-7, -49, 14, -104);
    polygon(ctx, [[7, -49], [13, -45], [13, -148], [7, -153]], '#d99c29');
    ctx.fillStyle = '#ffda68'; ctx.fillRect(-4, -51, 3, -96);
    ctx.fillStyle = '#a7adb0'; ctx.fillRect(-13, -163, 26, 15);
    ctx.fillStyle = '#d9ddde'; ctx.fillRect(-9, -163, 4, 15);
    ctx.fillStyle = '#d88f83'; ctx.fillRect(-12, -176, 24, 13);
  }

  function brushBody(ctx) {
    ctx.fillStyle = '#eee9dc';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-7, -17, -14, -36, -12, -58);
    ctx.lineTo(12, -58);
    ctx.bezierCurveTo(14, -36, 7, -17, 0, 0);
    ctx.fill();
    ctx.fillStyle = '#3b3c38';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-4, -8, -5, -13, -5, -18);
    ctx.lineTo(5, -18);
    ctx.bezierCurveTo(5, -13, 4, -8, 0, 0);
    ctx.fill();
    ctx.fillStyle = '#b8884d'; ctx.fillRect(-10, -176, 20, 118);
    ctx.fillStyle = '#d8ae6b'; ctx.fillRect(-6, -176, 6, 118);
    ctx.fillStyle = '#76572f'; ctx.fillRect(7, -176, 3, 118);
    for (const y of [-137, -99, -62]) {
      ctx.fillStyle = '#806039'; ctx.fillRect(-11, y, 22, 4);
      ctx.fillStyle = '#dfbd7c'; ctx.fillRect(-9, y, 16, 1);
    }
    ctx.fillStyle = '#6e5130'; ctx.fillRect(-11, -177, 22, 5);
  }

  function inkbrushBody(ctx) {
    const bristle = ctx.createLinearGradient(-16, -40, 16, -40);
    bristle.addColorStop(0, '#111714');
    bristle.addColorStop(0.48, '#4b5149');
    bristle.addColorStop(0.72, '#30372f');
    bristle.addColorStop(1, '#0d1210');
    ctx.fillStyle = bristle;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-2, -13, -17, -28, -16, -47);
    ctx.bezierCurveTo(-15, -60, -10, -67, 0, -69);
    ctx.bezierCurveTo(10, -67, 15, -60, 16, -47);
    ctx.bezierCurveTo(17, -28, 2, -13, 0, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(155,158,139,0.22)';
    ctx.lineWidth = 0.8;
    for (const x of [-8, -3, 4, 9]) {
      ctx.beginPath();
      ctx.moveTo(x * 0.12, -4);
      ctx.bezierCurveTo(x * 0.5, -24, x * 1.35, -43, x, -61);
      ctx.stroke();
    }
    polygon(ctx, [[-10, -61], [10, -61], [9, -80], [-9, -80]], '#28251e');
    ctx.fillStyle = '#62543a'; ctx.fillRect(-10, -66, 20, 3);
    const wood = ctx.createLinearGradient(-11, 0, 11, 0);
    wood.addColorStop(0, '#11130f');
    wood.addColorStop(0.35, '#4a4432');
    wood.addColorStop(0.62, '#2e2c22');
    wood.addColorStop(1, '#0d100d');
    ctx.fillStyle = wood; ctx.fillRect(-10, -188, 20, 110);
    for (const y of [-145, -106]) {
      ctx.fillStyle = '#171912'; ctx.fillRect(-11, y, 22, 4);
      ctx.fillStyle = '#706448'; ctx.fillRect(-8, y, 14, 1);
    }
    ctx.fillStyle = '#141711'; ctx.fillRect(-11, -190, 22, 6);
    ctx.fillStyle = '#77684a'; ctx.fillRect(-6, -185, 2, 100);
  }

  function chalkBody(ctx) {
    polygon(ctx, [[-8, 0], [8, 0], [12, -17], [12, -156], [-12, -156], [-12, -17]], '#e9e7de');
    polygon(ctx, [[-8, 0], [0, 0], [0, -156], [-12, -156], [-12, -17]], '#ffffff');
    polygon(ctx, [[7, 0], [8, 0], [12, -17], [12, -156], [7, -156]], '#c9cbc6');
    ctx.fillStyle = '#f8f7ef';
    ctx.beginPath(); ctx.ellipse(0, -156, 12, 5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(125,128,121,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, -156, 12, 5, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#d6d5cc'; ctx.fillRect(-8, -2, 16, 2);
  }

  function finelinerBody(ctx) {
    polygon(ctx, [[0, 0], [-2.5, -20], [2.5, -20]], '#252d32');
    polygon(ctx, [[-2.5, -20], [-6, -42], [6, -42], [2.5, -20]], '#a7b0b4');
    polygon(ctx, [[0, -20], [-2.5, -20], [-6, -42], [0, -42]], '#e0e4e4');
    ctx.fillStyle = '#33434d'; ctx.fillRect(-7, -163, 14, 121);
    ctx.fillStyle = '#60727b'; ctx.fillRect(-4, -160, 3, 115);
    ctx.fillStyle = '#1e292f'; ctx.fillRect(-8, -180, 16, 19);
    ctx.fillStyle = '#829097'; ctx.fillRect(-6, -166, 12, 3);
    ctx.fillStyle = '#1d272c'; ctx.fillRect(5, -174, 4, 45);
  }

  const bodies = { marker: markerBody, pencil: pencilBody, brush: brushBody, inkbrush: inkbrushBody, chalk: chalkBody, fineliner: finelinerBody };

  function drawPen(ctx, cut, pen, alpha = 1, rotate = 'fixed', opts = {}) {
    if (!cut || alpha <= 0) return;
    const canvas = ctx.canvas || { width: 1920, height: 1080 };
    const matrix = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
    const outerScale = matrix ? Math.sqrt(Math.abs(matrix.a * matrix.d - matrix.b * matrix.c)) || 1 : 1;
    // 导出器会把 canvas backing store 与 ctx 一起放大；只按逻辑画布定量，避免 HiDPI 二次放大。
    // sceneScale 是调用方施加的场景变换（边距 fit × 镜头 zoom）：笔在纸上，
    // 这部分缩放必须原样保留，只扣除 HiDPI 这一层。
    const sceneScale = Number.isFinite(opts.sceneScale) && opts.sceneScale > 0 ? opts.sceneScale : 1;
    const scale = Math.min(canvas.width, canvas.height) / 1080 / outerScale * sceneScale;
    ctx.save();
    ctx.translate(cut.last[0], cut.last[1]);
    ctx.rotate(rotate === 'follow' ? cut.angle - Math.PI / 2 + 0.35 : FIXED_ANGLE);
    ctx.scale(scale, scale);
    ctx.globalAlpha *= clamp01(alpha);
    ctx.shadowColor = 'rgba(20,24,25,0.24)';
    ctx.shadowBlur = 7;
    ctx.shadowOffsetX = 7;
    ctx.shadowOffsetY = 9;
    // 笔身配色跟随本次笔迹（marker 的彩色笔帽尤其依赖这一项）。
    bodies[pen](ctx, { ...opts, color: cut.color || opts.color });
    ctx.restore();
  }

  TT.pen = {
    list() { return [...IDS]; },

    /** 本帧经 TT.pen 落下的墨迹框（画布逻辑像素）；没有笔迹时为 null。 */
    bbox() {
      if (!inkBBox) return null;
      return { x: inkBBox.x0, y: inkBBox.y0, w: inkBBox.x1 - inkBBox.x0, h: inkBBox.y1 - inkBBox.y0 };
    },

    resetBBox() { inkBBox = null; },

    /**
     * 把一块填充区域并入本帧墨迹框。highlight 这类填充没有中心线，不经过
     * drawTrace，若不记账就会在 qa 里变成隐形墨水。box 用当前用户坐标，
     * 经 ctx 变换映射到画布坐标；负宽高会自动归一化。
     */
    addBox(ctx, box) {
      if (!box || typeof box !== 'object') return;
      let x = Number(box.x);
      let y = Number(box.y);
      let w = Number(box.w);
      let h = Number(box.h);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) return;
      if (w < 0) { x += w; w = -w; }
      if (h < 0) { y += h; h = -h; }
      if (!(w > 0) || !(h > 0)) return;
      accumulateBBox(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], 0);
    },

    /**
     * 单笔即时绘制；k=0 不画，k>0 时笔具锚在真实笔迹末端。默认固定 35°，rotate:'follow' 可跟随路径。
     * opts.penBody === false：只落墨、不画笔身（插画/快闪这类「有笔迹但不要笔」的场景用）。
     */
    stroke(ctx, pts, k, opts = {}) {
      const pen = IDS.includes(opts.pen) ? opts.pen : 'marker';
      const cut = drawTrace(ctx, pts, k, { ...opts, pen });
      if (cut && opts.penBody !== false) drawPen(ctx, cut, pen, opts.alpha == null ? 1 : opts.alpha, opts.rotate, opts);
      return cut;
    },

    /**
     * 时间轴批量绘制。每笔可写 { pts, at, dur, pen, color, width, seed, dash, ease, rotate }。
     * rotate 默认 fixed；并笔只跟「最早排定、尚未收笔」的那一笔（index 最小），
     * 笔身按落笔顺序单向前进，不会在多笔之间来回瞬移；没有未完笔才做 80ms 收笔淡出。
     * 第 4 参 opts.sceneScale：外层 ctx 变换的总倍率（如白板的边距 fit × 镜头 zoom），
     * 笔身按该倍率随画面一起缩放，默认 1 = 旧行为。
     * opts.penBody === false：只落墨、不画笔身（见 stroke）。
     */
    track(ctx, strokes, t, opts = {}) {
      if (!Array.isArray(strokes) || !strokes.length) return null;
      let active = null;
      let fading = null;
      for (let i = 0; i < strokes.length; i += 1) {
        const item = strokes[i];
        const at = Number(item.at) || 0;
        const dur = Math.max(0.001, Number(item.dur) || 1);
        const end = at + dur;
        const raw = clamp01((t - at) / dur);
        const eased = (typeof item.ease === 'function' ? item.ease : smooth)(raw);
        const progress = t >= at && t < end ? Math.max(0.00001, eased) : eased;
        const pen = IDS.includes(item.pen) ? item.pen : 'marker';
        const cut = drawTrace(ctx, item.pts, progress, { ...item, pen });
        const candidate = { cut, pen, at, end, index: i, alpha: 1, rotate: item.rotate };
        if (cut && t >= at && t < end) {
          // 单笔优先：同一时刻多笔并行时，笔只跟「最早排定、尚未收笔」的那一笔走。
          // 旧版取 at 最新，会在新笔落笔瞬间把笔瞬移到画面另一处，看起来像同时有好几根笔。
          if (!active || i < active.index) active = candidate;
        } else if (cut && t >= end && t < end + FADE_OUT) {
          candidate.alpha = 1 - (t - end) / FADE_OUT;
          if (!fading || i < fading.index) fading = candidate;
        }
      }
      const shown = active || fading;
      if (shown && opts.penBody !== false) drawPen(ctx, shown.cut, shown.pen, shown.alpha, shown.rotate, opts);
      return shown;
    },
  };
})();
