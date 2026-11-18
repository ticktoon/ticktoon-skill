/**
 * TT.mark —— 标注词条。
 *
 * 这里只回答「画什么样的线」：箭头、圈、框、涂底、下划、删除线、对勾、叉、
 * 数字圈、分割线。
 * 「怎么画一条线」全部交给 TT.pen：线稿质感、墨迹粗细、毛边与墨迹框都从
 * `TT.pen.stroke` 来，mark 自己不碰 ctx.stroke()。
 *
 * 扰动分两层：
 * - mark 层只做低频轮廓形变：每种词条使用内部固定的手绘强度，短、小元素
 *   自动衰减；调用方不再传 wobble 或 dash。
 * - pen 层负责高频墨迹：粉粒、毛边、起收笔。taper 是 pen 的全局预设，
 *   不开放成每个图形的参数。
 *
 * 默认 penBody:false：标注只落墨，不生第二支笔——白板的主轮廓通常已经有一支
 * TT.pen.track 的笔在画。需要强调标注自己带笔时（圈重点、下划线、箭头），
 * 显式传 `penBody: true` 与 `sceneScale`，并保证那段时间没有 track 的笔在动。
 *
 * 填充类（highlight、箭头实心头）用 fill 画，但必须把区域
 * 并入 `TT.pen.addBox` 的墨迹框，否则 qa 看不到它们。
 *
 * 所有扰动都是参数与 seed 的纯函数。同一帧、同一 progress、同一 seed 的两次
 * 调用结果完全相同；progress=1 视为已收笔，不再画笔身，避免静态标注上挂着
 * 一支永远不走的笔。
 */
(() => {
  const TAU = Math.PI * 2;
  const finite = (value) => typeof value === 'number' && Number.isFinite(value);
  const clamp = (value, lo, hi) => (value < lo ? lo : value > hi ? hi : value);
  const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value);
  const mix = (a, b, k) => a + (b - a) * k;
  const smooth = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  /** 与 pen.js 同式的确定性噪声：位置与 seed 的纯函数，不做顺序状态。 */
  const noise = (i, seed = 0) => {
    const x = Math.sin(i * 127.1 + seed * 0.013 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const pointOf = (value) => (Array.isArray(value) && finite(Number(value[0])) && finite(Number(value[1]))
    ? [Number(value[0]), Number(value[1])]
    : null);
  const spanOf = (rect) => {
    if (Array.isArray(rect) && rect.length >= 4 && rect.every((v) => finite(Number(v)))) {
      let x = Number(rect[0]);
      let y = Number(rect[1]);
      let w = Number(rect[2]);
      let h = Number(rect[3]);
      if (w < 0) { x += w; w = -w; }
      if (h < 0) { y += h; h = -h; }
      return { x, y, w, h };
    }
    if (rect && typeof rect === 'object'
      && finite(rect.x) && finite(rect.y) && finite(rect.w) && finite(rect.h)) {
      let { x, y, w, h } = rect;
      if (w < 0) { x += w; w = -w; }
      if (h < 0) { y += h; h = -h; }
      return { x, y, w, h };
    }
    return null;
  };
  // 标注的默认色属于 kit：铅笔灰与陶土红。调用方传 color 即可换品牌色。
  const colorAt = (_key, fallback) => fallback;
  const inkColor = () => colorAt('ink', '#353b3c');
  const accentColor = () => colorAt('accent', colorAt('ink', '#c66b57'));
  const colorOf = (o, kind) => {
    if (typeof o.color === 'string' && o.color) return o.color;
    return kind === 'accent' ? accentColor() : inkColor();
  };
  const penIdOf = (o) => {
    const ids = TT.pen.list();
    return ids.includes(o.pen) ? o.pen : 'marker';
  };
  const widthOf = (o) => (finite(o.width) && o.width > 0 ? o.width : 3.2);
  const alphaOf = (o) => (finite(o.alpha) ? clamp01(o.alpha) : 1);
  const progressOf = (o) => clamp01(finite(o.progress) ? o.progress : 1);
  const seedOf = (o) => (finite(o.seed) ? o.seed : 0);
  /** 箭头、对勾、叉的内部基准手绘强度；其他词条使用各自固定值。 */
  const BASE_WOBBLE = 0.12;
  /** 短元素自动衰减；用户不需要自己传阈值。 */
  const shortAttenuation = (length, reference = 90) => clamp(length / (length + reference), 0.12, 1);

  /**
   * 线稿端点映射到画布坐标后的墨迹框。调用时 ctx 上的变换（镜头、fit、
   * HiDPI/导出放大）都会像 TT.pen 的 accumulateBBox 一样被计入。
   */
  function pointBox(ctx, pts, width) {
    if (!Array.isArray(pts) || !pts.length) return null;
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
    for (const p of pts) {
      if (!Array.isArray(p) || !finite(p[0]) || !finite(p[1])) continue;
      const x = matrix ? matrix.a * p[0] + matrix.c * p[1] + matrix.e : p[0];
      const y = matrix ? matrix.b * p[0] + matrix.d * p[1] + matrix.f : p[1];
      if (!finite(x) || !finite(y)) continue;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
    if (!finite(x0)) return null;
    const scale = matrix ? Math.sqrt(Math.abs(matrix.a * matrix.d - matrix.b * matrix.c)) || 1 : 1;
    const half = Math.max(0, finite(width) ? width : 4) / 2 * scale;
    return { x: x0 - half, y: y0 - half, w: (x1 - x0) + half * 2, h: (y1 - y0) + half * 2 };
  }

  function rectBox(ctx, rect, grow = 0) {
    if (!rect) return null;
    const box = { x: rect.x - grow, y: rect.y - grow, w: rect.w + grow * 2, h: rect.h + grow * 2 };
    return pointBox(ctx, [[box.x, box.y], [box.x + box.w, box.y], [box.x + box.w, box.y + box.h], [box.x, box.y + box.h]], 0);
  }

  function unionBox(a, b) {
    if (!a) return b;
    if (!b) return a;
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const x1 = Math.max(a.x + a.w, b.x + b.w);
    const y1 = Math.max(a.y + a.h, b.y + b.h);
    return { x, y, w: x1 - x, h: y1 - y };
  }

  function lengthOf(pts) {
    let total = 0;
    for (let i = 1; i < (pts || []).length; i += 1) {
      total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
    return total;
  }

  function quadPoints(a, c, b, n = 40) {
    const pts = [];
    for (let i = 0; i <= n; i += 1) {
      const k = i / n;
      const u = 1 - k;
      pts.push([
        u * u * a[0] + 2 * u * k * c[0] + k * k * b[0],
        u * u * a[1] + 2 * u * k * c[1] + k * k * b[1],
      ]);
    }
    return pts;
  }

  function linePoints(a, b, n = 16) {
    const pts = [];
    for (let i = 0; i <= n; i += 1) {
      const k = i / n;
      pts.push([mix(a[0], b[0], k), mix(a[1], b[1], k)]);
    }
    return pts;
  }

  /**
   * mark 层低频扰动：沿路径法线叠三条低频正弦，起伏只随路径位置变化。
   * `wobble` 与 `ampPx` 分开传：短元素先由调用方衰减 `ampPx`。
   */
  function smoothWobble(points, wobble, seed, ampPx, { closed = false } = {}) {
    if (!(wobble > 0) || !(ampPx > 0) || !Array.isArray(points) || points.length < 2) {
      return Array.isArray(points) ? points.slice() : [];
    }
    const total = lengthOf(points);
    if (!(total > 0)) return points.slice();
    const cycles = closed ? TAU : Math.PI;
    const p1 = noise(101, seed) * TAU;
    const p2 = noise(102, seed) * TAU;
    const p3 = noise(103, seed) * TAU;
    let walked = 0;
    return points.map((p, i) => {
      if (i > 0) walked += Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]);
      const u = walked / total;
      const wave = 0.62 * Math.sin(cycles * u + p1)
        + 0.27 * Math.sin(cycles * 2 * u + p2)
        + 0.11 * Math.sin(cycles * 3 * u + p3);
      const prev = points[i - 1] || p;
      const next = points[i + 1] || p;
      const tx = next[0] - prev[0];
      const ty = next[1] - prev[1];
      const len = Math.hypot(tx, ty) || 1;
      const d = wave * ampPx * wobble;
      // 顺时针路径的外法线（与 cloudPath 一致）。
      return [p[0] + ty / len * d, p[1] - tx / len * d];
    });
  }

  /**
   * 一条笔迹：走 TT.pen.stroke 落墨。默认 penBody:false，标注只是「墨」，
   * 不会凭空长出第二支笔；强调标注显式传 penBody:true 时，笔身只在 progress<1
   * 期间出现（alpha 直接归零，不复用 track 的 80ms 淡出）。
   */
  function stroke(ctx, pts, progress, o, { color, width, live }) {
    if (!(progress > 0) || alphaOf(o) <= 0 || !Array.isArray(pts) || pts.length < 2) return null;
    ctx.save();
    const alpha = alphaOf(o);
    if (alpha < 1) ctx.globalAlpha *= alpha;
    const cut = TT.pen.stroke(ctx, pts, progress, {
      pen: penIdOf(o),
      color,
      width,
      seed: seedOf(o),
      // 标注的中心线已经由内部手绘强度控制；关闭 pen 的逐点高频扰动。
      smooth: true,
      taper: o.taper,
      alpha: live ? 1 : 0,
      // 强调标注可以显式要一支笔；默认仍然只落墨，避免和 track 的笔重复。
      penBody: o.penBody === true,
      sceneScale: finite(o.sceneScale) && o.sceneScale > 0 ? o.sceneScale : undefined,
    });
    ctx.restore();
    return cut;
  }

  /** 圆角矩形/圆/云的公共边界采样。 */
  function rectPath(rect, radius, cornerSamples = 8) {
    const { x, y, w, h } = rect;
    const r = clamp(radius, 0, Math.min(w, h) / 2);
    if (!(r > 0)) {
      return [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
    }
    const pts = [];
    const arc = (cx, cy, from, to) => {
      for (let i = 0; i <= cornerSamples; i += 1) {
        const a = from + (to - from) * i / cornerSamples;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
    };
    pts.push([x + r, y]);
    pts.push([x + w - r, y]);
    arc(x + w - r, y + r, -Math.PI / 2, 0);
    pts.push([x + w, y + h - r]);
    arc(x + w - r, y + h - r, 0, Math.PI / 2);
    pts.push([x + r, y + h]);
    arc(x + r, y + h - r, Math.PI / 2, Math.PI);
    pts.push([x, y + r]);
    arc(x + r, y + r, Math.PI, Math.PI * 1.5);
    return pts;
  }

  /** 沿闭合路径多走一小段，模拟手画框在起点处的收笔重叠。 */
  function overshoot(pts, fraction, n = 3) {
    if (!pts || pts.length < 2 || !(fraction > 0)) return pts;
    const total = lengthOf(pts);
    const extra = total * fraction;
    const first = pts[0];
    const next = pts[1];
    const dx = next[0] - first[0];
    const dy = next[1] - first[1];
    const len = Math.hypot(dx, dy) || 1;
    const out = pts.slice();
    const last = pts[pts.length - 1];
    for (let i = 1; i <= n; i += 1) {
      const step = extra * i / n;
      out.push([last[0] + dx / len * step, last[1] + dy / len * step]);
    }
    return out;
  }

  /** 闭合折线按固定步长重采样；框和云朵都需要密采样，形变才不会只落在角点。 */
  function resampleClosed(pts, step) {
    if (!Array.isArray(pts) || pts.length < 2) return pts || [];
    const total = lengthOf(pts);
    if (!(total > 0)) return pts.slice();
    const n = Math.max(16, Math.ceil(total / step));
    const out = [];
    let seg = 0;
    let segStart = 0;
    for (let i = 0; i <= n; i += 1) {
      const at = total * i / n;
      while (seg < pts.length - 1) {
        const a = pts[seg];
        const b = pts[seg + 1];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (at <= segStart + len + 1e-6) {
          const k = len > 0 ? (at - segStart) / len : 0;
          out.push([mix(a[0], b[0], k), mix(a[1], b[1], k)]);
          break;
        }
        segStart += len;
        seg += 1;
      }
      if (seg >= pts.length - 1) out.push([pts[pts.length - 1][0], pts[pts.length - 1][1]]);
    }
    return out;
  }

  /**
   * 云朵：圆角矩形轮廓重采样后，沿外法线做扇贝起伏。
   * 峰要圆、谷要尖，像一圈鼓出来的圆弧；只用稀疏折点会退化成歪框。
   * 扇贝幅度是内部质感，不单独暴露参数。
   */
  function cloudPath(rect, radius, seed) {
    const short = Math.min(rect.w, rect.h);
    const base = resampleClosed(rectPath(rect, radius, 12), clamp(short / 40, 3, 7));
    const total = lengthOf(base);
    if (!(total > 0)) return base;
    const amp = clamp(short * 0.072, 5, 26);
    const lobes = clamp(Math.round(total / Math.max(42, short * 0.40)), 8, 20);
    const phase = (noise(3, seed) - 0.5) * 0.7;
    let walked = 0;
    const out = [];
    for (let i = 0; i < base.length; i += 1) {
      const prev = base[i - 1] || base[base.length - 2];
      const cur = base[i];
      const next = base[i + 1] || base[1] || cur;
      if (i > 0) walked += Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
      const tx = next[0] - prev[0];
      const ty = next[1] - prev[1];
      const len = Math.hypot(tx, ty) || 1;
      const nx = ty / len;
      const ny = -tx / len;
      // |sin| 的谷是尖的、峰是圆的；再抬一点基线，避免谷口咬回框内。
      const scallop = 0.18 + 0.82 * Math.pow(Math.abs(Math.sin(Math.PI * lobes * walked / total + phase)), 1.35);
      out.push([cur[0] + nx * amp * scallop, cur[1] + ny * amp * scallop]);
    }
    return out;
  }

  /**
   * 手绘圈的主体：只用 2、3 次低频起伏，轮廓整体平滑，不做沿圈的高频抖动。
   * 起笔在左上方，闭合时多走一点，给 circle 预留压过起笔的收尾。
   * 小圈按半径衰减；`wobble=0` 时退化成标准椭圆，闭合重合。
   */
  function loopPoints(at, rx, ry, rotate, seed, wobble, o = {}) {
    const closure = finite(o.closure) ? clamp(o.closure, -1, 1) : (wobble > 0 ? 0.22 : 0);
    const laps = finite(o.laps) ? clamp(o.laps, 0.5, 3) : (wobble > 0 ? 1.03 : 1);
    const sweep = TAU * laps + closure;
    const steps = Math.max(72, Math.ceil(Math.abs(sweep) / TAU * 180));
    const start = -Math.PI * 0.75 + (noise(1, seed) - 0.5) * 0.18 * wobble;
    const sizeFactor = clamp(Math.min(rx, ry) / 90, 0.3, 1);
    const amp = wobble * sizeFactor;
    const minR = Math.min(rx, ry);
    const p1 = noise(11, seed) * TAU;
    const p2 = noise(12, seed) * TAU;
    const p3 = noise(13, seed) * TAU;
    const p4 = noise(14, seed) * TAU;
    const cosR = Math.cos(rotate);
    const sinR = Math.sin(rotate);
    const pts = [];
    for (let i = 0; i <= steps; i += 1) {
      const a = start + sweep * i / steps;
      // 只有两个低频项：轮廓起伏是整体的，不会出现一圈小波纹。
      const radial = 1
        + amp * (0.10 * Math.sin(a * 2 + p1)
          + 0.045 * Math.sin(a * 3 + p2));
      const cx = amp * minR * 0.022 * Math.sin(a + p3);
      const cy = amp * minR * 0.022 * Math.sin(a + p4);
      const x = Math.cos(a) * rx * radial + cx;
      const y = Math.sin(a) * ry * radial + cy;
      pts.push([at[0] + x * cosR - y * sinR, at[1] + x * sinR + y * cosR]);
    }
    return pts;
  }

  /** 圈的长起笔：从圈起点沿逆切线伸出去，像参考图左上角那道长尾。 */
  function loopTail(loop, rx, ry, wobble, o = {}) {
    if (!(wobble > 0) || o.tail === false || !loop || loop.length < 2) return [];
    const start = loop[0];
    const next = loop[1];
    const dx = next[0] - start[0];
    const dy = next[1] - start[1];
    const len = Math.hypot(dx, dy) || 1;
    const ux = -dx / len;
    const uy = -dy / len;
    // 尾巴长度由短半径决定，不单独暴露参数。
    const tail = clamp(Math.min(rx, ry) * 0.68, 5, 240);
    const end = [start[0] + ux * tail, start[1] + uy * tail];
    const nx = -uy;
    const ny = ux;
    const mid = [start[0] + ux * tail * 0.55 + nx * tail * 0.10,
      start[1] + uy * tail * 0.55 + ny * tail * 0.10];
    return quadPoints(end, mid, start, 12);
  }

  const entries = [
    {
      id: 'arrow',
      desc: '箭头：直线或弧线，低频扰动；开口/实心箭头，可双线',
      when: '指向方向、增长、因果关系，或把视线推到某个结论',
    },
    {
      id: 'circle',
      desc: '手绘圈：低频不规则轮廓，左上长起笔，收笔压过起点',
      when: '圈住一个人物、数字或局部，强调“看这里”',
    },
    {
      id: 'box',
      desc: '标注框：不规则方框、圆角框、云朵框；内部固定手绘强度',
      when: '框住一段文案或一个区域；云朵用于概念/气泡',
    },
    {
      id: 'highlight',
      desc: '重点涂底色：一笔连续手涂，边缘带抖动，两端略收',
      when: '给关键词铺底色；必须先 highlight 再写字',
    },
    {
      id: 'underline',
      desc: '下划线：轻微低频扰动，两端略出头',
      when: '轻轻托住一行字，不抢正文',
    },
    {
      id: 'strike',
      desc: '删除线：平直、无波浪，可双线',
      when: '否定旧结论、划掉错误说法、做前后对比',
    },
    {
      id: 'check',
      desc: '对勾：一笔连续下压再弧线上扬，短笔较短，末端收尖',
      when: '确认、完成、正确项',
    },
    {
      id: 'cross',
      desc: '叉：两条微弧粗笔交叉，两端圆厚、中段轻压',
      when: '否定、错误、取消项',
    },
    {
      id: 'numberCircle',
      desc: '数字圈：轻薄空心圈 + 居中短文字',
      when: '步骤编号、序号、投票计数',
    },
    {
      id: 'divider',
      desc: '分割线：横向/纵向，内部固定轻微手绘扰动',
      when: '分隔段落、步骤或画面层级',
    },
  ];

  TT.mark = {
    list() {
      return entries.map((item) => ({ ...item }));
    },

    arrow(ctx, o = {}) {
      const from = pointOf(o.from);
      const to = pointOf(o.to);
      const progress = progressOf(o);
      if (progress <= 0 || alphaOf(o) <= 0) return null;
      const width = widthOf(o);
      const color = colorOf(o, 'ink');
      const seed = seedOf(o);
      const wobble = 0.045;
      const via = Array.isArray(o.via) ? o.via.map(pointOf).filter(Boolean) : [];
      const curved = via.length >= 2 || (finite(o.bend) && Math.abs(o.bend) > 0.02);
      const points = via.length >= 2 ? via : (!from || !to ? null : (() => {
        const dx = to[0] - from[0];
        const dy = to[1] - from[1];
        const dist = Math.hypot(dx, dy) || 1;
        // 正 bend 朝行进方向左侧拱起；屏幕上左 = 逆时针 90°。
        const bend = finite(o.bend) ? o.bend : 0.2;
        const nx = dy / dist;
        const ny = -dx / dist;
        const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
        const control = [mid[0] + nx * bend * dist, mid[1] + ny * bend * dist];
        return quadPoints(from, control, to, 40);
      })());
      if (!points) return null;
      const total = lengthOf(points);
      if (!(total > 0)) return null;
      // 直线箭头压低扰动，弧线箭头放宽；短线再自动衰减。
      const amp = Math.min(total * (curved ? 0.034 : 0.018), curved ? 26 : 14)
        * shortAttenuation(total, 90);
      const shaft = o.smooth === true ? points : smoothWobble(points, wobble, seed + 17, amp);
      const head = ['open', 'solid', 'none'].includes(o.head) ? o.head : 'open';
      const double = !!o.double;
      const last = shaft[shaft.length - 1];
      const before = shaft[shaft.length - 2];
      const angle = Math.atan2(last[1] - before[1], last[0] - before[0]);
      const dirX = Math.cos(angle);
      const dirY = Math.sin(angle);
      const perpX = -dirY;
      const perpY = dirX;
      const headLen = clamp(width * 5.2, 12, 30);
      const headHalf = headLen * (o.head === 'solid' ? 0.46 : 0.42);
      const headStart = head === 'none' ? 1 : 0.785;
      const shaftP = head === 'none' ? progress : clamp01(progress / headStart);
      const headP = head === 'none' ? 0 : clamp01((progress - headStart) / (1 - headStart));
      let box = pointBox(ctx, shaft, width);
      let length = total;

      // 双线：第二条平行线略晚一点起笔，起笔/收笔都不完全重合。
      const lines = [];
      if (double) {
        const off = Math.max(2.2, width * 0.72);
        const offsetPoints = shaft.map((p) => [p[0] + perpX * off, p[1] + perpY * off]);
        const p2 = clamp01((progress - 0.035) / 0.965);
        lines.push({ pts: offsetPoints, p: p2, live: false });
        box = unionBox(box, pointBox(ctx, offsetPoints, width));
        length += lengthOf(offsetPoints);
      }
      lines.push({ pts: shaft, p: shaftP, live: progress < headStart });

      for (const line of lines) {
        if (line.p > 0) stroke(ctx, line.pts, line.p, o, { color, width, live: line.live });
      }

      if (headP > 0 && head !== 'none') {
        const base = [last[0] - dirX * headLen, last[1] - dirY * headLen];
        const wingA = [base[0] + perpX * headHalf, base[1] + perpY * headHalf];
        const wingB = [base[0] - perpX * headHalf, base[1] - perpY * headHalf];
        if (head === 'open') {
          const live = progress < 1 && headP < 0.98;
          // 箭头翼与杆保持相同的实线笔迹。
          stroke(ctx, [wingA, last], headP, o, { color, width, live: false });
          stroke(ctx, [wingB, last], headP, o, { color, width, live });
          box = unionBox(box, pointBox(ctx, [wingA, last, wingB], width));
          length += lengthOf([wingA, last]) + lengthOf([wingB, last]);
        } else {
          // 实心箭头是填充，不是线稿：用 addBox 进墨迹框，笔不参与。
          const scale = 0.72 + 0.28 * smooth(headP);
          ctx.save();
          ctx.globalAlpha *= alphaOf(o);
          ctx.fillStyle = color;
          ctx.translate(last[0], last[1]);
          ctx.scale(scale, scale);
          ctx.translate(-last[0], -last[1]);
          ctx.beginPath();
          ctx.moveTo(last[0], last[1]);
          ctx.lineTo(wingA[0], wingA[1]);
          ctx.lineTo(wingB[0], wingB[1]);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          const tri = [[last[0], last[1]], wingA, wingB];
          const tx0 = Math.min(tri[0][0], tri[1][0], tri[2][0]);
          const ty0 = Math.min(tri[0][1], tri[1][1], tri[2][1]);
          const tx1 = Math.max(tri[0][0], tri[1][0], tri[2][0]);
          const ty1 = Math.max(tri[0][1], tri[1][1], tri[2][1]);
          TT.pen.addBox(ctx, { x: tx0, y: ty0, w: tx1 - tx0, h: ty1 - ty0 });
          box = unionBox(box, pointBox(ctx, tri, 0));
          length += headLen * 1.6;
        }
      }
      return box ? { box, length } : null;
    },

    circle(ctx, o = {}) {
      const at = pointOf(o.at);
      if (!at) return null;
      const progress = progressOf(o);
      if (progress <= 0 || alphaOf(o) <= 0) return null;
      const rx = finite(o.rx) && o.rx !== 0 ? Math.abs(o.rx) : 80;
      const ry = finite(o.ry) && o.ry !== 0 ? Math.abs(o.ry) : rx;
      const rotate = finite(o.rotate) ? o.rotate : 0;
      const seed = seedOf(o);
      const width = widthOf(o);
      const color = colorOf(o, 'ink');
      const wobble = 1;
      const loop = loopPoints(at, rx, ry, rotate, seed, wobble, o);
      // 起点往左上伸出一道长尾，再接回圈身；一笔连续画完。
      const tail = loopTail(loop, rx, ry, wobble, o);
      const pts = tail.length ? tail.concat(loop.slice(1)) : loop;
      stroke(ctx, pts, progress, o, { color, width, live: progress < 1 });
      return { box: pointBox(ctx, pts, width), length: lengthOf(pts) };
    },

    box(ctx, o = {}) {
      const rect = spanOf(o.rect);
      if (!rect || !(rect.w > 0) || !(rect.h > 0)) return null;
      const progress = progressOf(o);
      if (progress <= 0 || alphaOf(o) <= 0) return null;
      const shape = ['rect', 'round', 'cloud'].includes(o.shape) ? o.shape : 'rect';
      const seed = seedOf(o);
      const width = widthOf(o);
      const color = colorOf(o, 'ink');
      const wobble = 0.6;
      const short = Math.min(rect.w, rect.h);
      const radius = finite(o.radius) && o.radius >= 0
        ? o.radius
        : (shape === 'cloud' ? short * 0.16 : shape === 'round' ? short * 0.14 : 0);
      let pts = shape === 'cloud'
        ? cloudPath(rect, radius, seed)
        : resampleClosed(rectPath(rect, shape === 'rect' ? 0 : radius, 10), clamp(short / 30, 4, 10));
      // 普通框要有可见但不抖的手画轮廓：密采样后只叠低频形变；云朵已有扇贝，保持克制。
      const amp = shape === 'cloud'
        ? clamp(short * 0.012, 1, 6)
        : clamp(short * 0.18, 2, 40) * shortAttenuation(short, 55);
      pts = smoothWobble(pts, wobble, seed + 31, amp, { closed: true });
      // 手画框的收笔重叠：沿第一条边继续走 3%。
      const over = finite(o.overshoot) ? Math.max(0, o.overshoot) : (wobble > 0 ? 0.035 : 0);
      pts = overshoot(pts, over);
      const box = unionBox(rectBox(ctx, rect, width), pointBox(ctx, pts, width));
      stroke(ctx, pts, progress, o, { color, width, live: progress < 1 });
      return { box, length: lengthOf(pts) };
    },

    highlight(ctx, o = {}) {
      const rect = spanOf(o.rect);
      if (!rect || !(rect.w > 0) || !(rect.h > 0)) return null;
      const progress = progressOf(o);
      if (progress <= 0 || alphaOf(o) <= 0) return null;
      const color = colorOf(o, 'accent');
      const alpha = finite(o.alpha) ? clamp01(o.alpha) : 0.28;
      const seed = seedOf(o);
      const revealed = rect.w * smooth(progress);
      const right = rect.x + revealed;

      // 一笔从词头扫到词尾：上下边缘抖动、两端略收，避免读成圆角色块。
      const midY = rect.y + rect.h * (0.48 + noise(1, seed) * 0.08);
      const bandH = rect.h * (0.60 + noise(2, seed) * 0.12);
      const tilt = (noise(3, seed) - 0.5) * rect.h * 0.16;
      const wobble = rect.h * 0.05;
      const steps = 10;
      const top = [];
      const bot = [];
      for (let i = 0; i <= steps; i += 1) {
        const u = i / steps;
        // 两端收 12%，中间满高；像马克笔起笔、收笔时笔头压得轻一点。
        const taper = 0.88 + 0.12 * Math.min(1, u * 4, (1 - u) * 4);
        const y = midY + tilt * (u - 0.5);
        top.push([rect.x + revealed * u, y - bandH * taper / 2 + (noise(i + 7, seed) - 0.5) * wobble]);
        bot.push([rect.x + revealed * u, y + bandH * taper / 2 + (noise(i + 19, seed) - 0.5) * wobble]);
      }

      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(top[0][0], top[0][1]);
      for (let i = 1; i < top.length; i += 1) ctx.lineTo(top[i][0], top[i][1]);
      ctx.lineTo(right + (noise(31, seed) - 0.5) * wobble, midY + tilt * 0.5);
      ctx.lineTo(right + (noise(32, seed) - 0.5) * wobble, bot[bot.length - 1][1]);
      for (let i = bot.length - 2; i >= 0; i -= 1) ctx.lineTo(bot[i][0], bot[i][1]);
      ctx.lineTo(rect.x + (noise(33, seed) - 0.5) * wobble, midY - tilt * 0.5);
      ctx.lineTo(rect.x + (noise(34, seed) - 0.5) * wobble, top[0][1]);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      TT.pen.addBox(ctx, { x: rect.x, y: rect.y, w: revealed, h: rect.h });
      return { box: rectBox(ctx, rect), length: 0 };
    },

    underline(ctx, o = {}) {
      const from = pointOf(o.from);
      const to = pointOf(o.to);
      if (!from || !to) return null;
      const progress = progressOf(o);
      if (progress <= 0 || alphaOf(o) <= 0) return null;
      const width = widthOf(o);
      const color = colorOf(o, 'ink');
      const seed = seedOf(o);
      const wobble = 0.3;
      const dx = to[0] - from[0];
      const dy = to[1] - from[1];
      const len = Math.hypot(dx, dy);
      if (!(len > 0)) return null;
      const ux = dx / len;
      const uy = dy / len;
      // 两端出头是几何，不是松弛度：默认 6%，可按比例覆盖。
      const overhang = finite(o.overhang)
        ? clamp(o.overhang, 0, 0.5) * len
        : clamp(len * 0.06, 2, 14);
      const a = [from[0] - ux * overhang, from[1] - uy * overhang];
      const b = [to[0] + ux * overhang, to[1] + uy * overhang];
      const span = len + overhang * 2;
      // 只留很轻的低频手感，不形成连续可见的波浪。
      let pts = linePoints(a, b, clamp(Math.ceil(span / 5), 24, 240));
      const amp = Math.min(span, 260) * 0.035 * shortAttenuation(span, 100);
      pts = smoothWobble(pts, wobble, seed + 43, amp);
      stroke(ctx, pts, progress, o, { color, width, live: progress < 1 });
      return { box: pointBox(ctx, pts, width), length: lengthOf(pts) };
    },

    strike(ctx, o = {}) {
      const from = pointOf(o.from);
      const to = pointOf(o.to);
      if (!from || !to) return null;
      const progress = progressOf(o);
      if (progress <= 0 || alphaOf(o) <= 0) return null;
      const width = widthOf(o);
      const color = colorOf(o, 'accent');
      const seed = seedOf(o);
      const dx = to[0] - from[0];
      const dy = to[1] - from[1];
      const len = Math.hypot(dx, dy);
      if (!(len > 0)) return null;
      const nx = -dy / len;
      const ny = dx / len;
      const steps = clamp(Math.ceil(len / 5), 24, 240);
      // 删除线同样是直线；double 只是平移复制，不引入波浪。
      const pts = linePoints(from, to, steps);
      let box = pointBox(ctx, pts, width);
      let length = lengthOf(pts);
      stroke(ctx, pts, progress, o, { color, width, live: progress < 1 && !o.double });
      if (o.double) {
        const off = Math.max(2.4, width * 0.8);
        const second = pts.map((p) => [p[0] + nx * off, p[1] + ny * off]);
        stroke(ctx, second, clamp01((progress - 0.04) / 0.96), { ...o, seed: seed + 3 }, {
          color,
          width,
          live: progress < 1,
        });
        box = unionBox(box, pointBox(ctx, second, width));
        length += lengthOf(second);
      }
      return { box, length };
    },

    check(ctx, o = {}) {
      const at = pointOf(o.at);
      if (!at) return null;
      const progress = progressOf(o);
      if (progress <= 0 || alphaOf(o) <= 0) return null;
      const size = finite(o.size) && o.size > 0 ? o.size : 64;
      const width = finite(o.width) && o.width > 0 ? o.width : clamp(size * 0.075, 3, 10);
      const color = colorOf(o, 'ink');
      const seed = seedOf(o);
      const wobble = BASE_WOBBLE;
      const map = (p) => [at[0] + p[0] * size, at[1] + p[1] * size];
      const control = (curved, salt) => map([
        curved[0] + (noise(salt, seed) - 0.5) * 0.035 * wobble,
        curved[1] + (noise(salt + 1, seed) - 0.5) * 0.035 * wobble,
      ]);
      // 短笔更短，下压后直接进入长笔弧线上扬。
      const start = map([-0.34, 0.02]);
      const corner = map([-0.10, 0.38]);
      const end = map([0.48, -0.48]);
      const first = quadPoints(start, control([-0.23, 0.26], 71), corner, 14);
      const second = quadPoints(corner, control([0.10, 0.14], 75), end, 30);
      // 两段共享点并合并为同一条笔迹，粗细和 progress 都连续，不会留下断口。
      const pts = first.concat(second.slice(1));
      const pen = typeof o.pen === 'string' && TT.pen.list().includes(o.pen) ? o.pen : 'brush';
      stroke(ctx, pts, progress, { ...o, pen, taper: 'end' }, { color, width, live: progress < 1 });
      return { box: pointBox(ctx, pts, width * 1.55), length: lengthOf(pts) };
    },

    cross(ctx, o = {}) {
      const at = pointOf(o.at);
      if (!at) return null;
      const progress = progressOf(o);
      if (progress <= 0 || alphaOf(o) <= 0) return null;
      const size = finite(o.size) && o.size > 0 ? o.size : 60;
      const width = finite(o.width) && o.width > 0 ? o.width : clamp(size * 0.075, 3, 10);
      const color = colorOf(o, 'accent');
      const seed = seedOf(o);
      const wobble = BASE_WOBBLE;
      const rotate = finite(o.rotate) ? o.rotate : 0;
      const cosR = Math.cos(rotate);
      const sinR = Math.sin(rotate);
      const map = (p) => {
        const x = p[0] * size;
        const y = p[1] * size;
        return [at[0] + x * cosR - y * sinR, at[1] + x * sinR + y * cosR];
      };
      const control = (curved, salt) => map([
        curved[0] + (noise(salt, seed) - 0.5) * 0.035 * wobble,
        curved[1] + (noise(salt + 1, seed) - 0.5) * 0.035 * wobble,
      ]);
      // 两条略有弧度的粗笔；两端圆厚，中段轻压，不是机械等宽交叉线。
      const a = quadPoints(map([-0.40, -0.40]), control([0.035, -0.025], 83), map([0.40, 0.40]), 26);
      const b = quadPoints(map([0.40, -0.40]), control([-0.030, -0.020], 89), map([-0.40, 0.40]), 26);
      const pen = typeof o.pen === 'string' && TT.pen.list().includes(o.pen) ? o.pen : 'brush';
      const p1 = clamp01(progress / 0.55);
      const p2 = clamp01((progress - 0.45) / 0.55);
      const boxWidth = width * 1.4;
      let box = null;
      let length = 0;
      if (p1 > 0) {
        stroke(ctx, a, p1, { ...o, pen, taper: 'soft' }, { color, width, live: progress < 0.55 });
        box = unionBox(box, pointBox(ctx, a, boxWidth));
        length += lengthOf(a);
      }
      if (p2 > 0) {
        stroke(ctx, b, p2, { ...o, pen, taper: 'soft' }, { color, width, live: progress < 1 });
        box = unionBox(box, pointBox(ctx, b, boxWidth));
        length += lengthOf(b);
      }
      return box ? { box, length } : null;
    },

    numberCircle(ctx, o = {}) {
      const at = pointOf(o.at);
      if (!at) return null;
      const progress = progressOf(o);
      if (progress <= 0 || alphaOf(o) <= 0) return null;
      const r = finite(o.r) && o.r > 0 ? o.r : 28;
      const width = finite(o.width) && o.width > 0 ? o.width : clamp(r * 0.05, 1.2, 2.6);
      const color = colorOf(o, 'ink');
      const seed = seedOf(o);
      const wobble = 1;
      const ring = loopPoints(at, r, r, 0, seed, wobble, {
        ...o,
        closure: finite(o.closure) ? o.closure : (wobble > 0 ? 0.05 : 0),
        laps: finite(o.laps) ? o.laps : (wobble > 0 ? 1.02 : 1),
      });
      stroke(ctx, ring, progress, o, { color, width, live: progress < 1 });
      let box = pointBox(ctx, ring, width);
      const text = String(o.text == null ? '' : o.text).trim();
      if (text && progress > 0.45) {
        const textAlpha = alphaOf(o) * smooth(clamp01((progress - 0.45) / 0.55));
        const size = finite(o.textSize) && o.textSize > 0 ? o.textSize : r * 1.05;
        const textBox = TT.text(ctx, text, at[0], at[1], size, {
          fontKey: typeof o.fontKey === 'string' && o.fontKey ? o.fontKey : 'sans-900',
          color,
          alpha: textAlpha,
          align: 'center',
          baseline: 'middle',
          maxWidth: r * 1.75,
        });
        box = unionBox(box, textBox);
      }
      return box ? { box, length: lengthOf(ring) } : null;
    },

    divider(ctx, o = {}) {
      const at = pointOf(o.at);
      if (!at) return null;
      const progress = progressOf(o);
      if (progress <= 0 || alphaOf(o) <= 0) return null;
      const orient = o.orient === 'v' ? 'v' : 'h';
      const length = finite(o.length) && o.length > 0 ? o.length : 320;
      const width = widthOf(o);
      const color = colorOf(o, 'ink');
      const seed = seedOf(o);
      const wobble = 0.4;
      const dx = orient === 'h' ? length / 2 : 0;
      const dy = orient === 'v' ? length / 2 : 0;
      let pts = linePoints([at[0] - dx, at[1] - dy], [at[0] + dx, at[1] + dy], 24);
      const amp = length * 0.035 * shortAttenuation(length, 100);
      pts = smoothWobble(pts, wobble, seed + 127, amp);
      stroke(ctx, pts, progress, o, { color, width, live: progress < 1 });
      return { box: pointBox(ctx, pts, width + amp * 0.15), length: lengthOf(pts) };
    },
  };
})();
