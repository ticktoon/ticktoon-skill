/**
 * TT.mark —— 标注词条。
 *
 * 这里只回答「画什么样的线」：箭头、圈、框、波浪、涂底、下划、删除线、印章。
 * 「怎么画一条线」全部交给 TT.pen：线稿质感、手绘抖动、墨迹框、笔身跟随都从
 * `TT.pen.stroke` 来，mark 自己不碰 ctx.stroke()。
 *
 * 唯一例外是填充：highlight 的 fill 模式与 arrow 的 solid 箭头没有中心线，
 * 它们用 fill 画，但必须把区域并入 `TT.pen.addBox` 的墨迹框，否则 qa/verify
 * 看不到它们。
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

  /**
   * 一条笔迹：走 TT.pen.stroke 落墨。标注只是「墨」，不是第二支笔——
   * penBody:false 保证箭头/圈/框/下划等在绘制过程中不会再凭空长出一支笔身。
   * 一支笔只由显式的 TT.pen.track / TT.pen.stroke 负责（白板就是靠这一条保证「只有一根笔」）。
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
      dash: Array.isArray(o.dash) ? o.dash : [],
      alpha: live ? 1 : 0,
      penBody: false,
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

  /** 闭合折线按固定步长重采样；云朵需要密采样才能长出圆滑的扇贝边。 */
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
   */
  function cloudPath(rect, radius, seed) {
    const short = Math.min(rect.w, rect.h);
    const base = resampleClosed(rectPath(rect, radius, 12), clamp(short / 36, 3, 8));
    const total = lengthOf(base);
    if (!(total > 0)) return base;
    const amp = clamp(short * 0.085, 6, 30);
    const lobes = clamp(Math.round(total / Math.max(40, short * 0.38)), 8, 20);
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
      // 顺时针路径的外法线。
      const nx = ty / len;
      const ny = -tx / len;
      // |sin| 的谷是尖的、峰是圆的；再抬一点基线，避免谷口咬回框内。
      const scallop = 0.18 + 0.82 * Math.pow(Math.abs(Math.sin(Math.PI * lobes * walked / total + phase)), 1.35);
      out.push([cur[0] + nx * amp * scallop, cur[1] + ny * amp * scallop]);
    }
    return out;
  }

  /** 用 TT.text 排印章文字，返回文字框（画布坐标）。 */
  function drawSealText(ctx, text, sizePx, color, alpha, maxWidth) {
    const value = String(text == null ? '' : text);
    if (!value.trim()) return null;
    let px = Math.max(8, sizePx);
    let font = null;
    ctx.save();
    for (; px >= 6; px -= 1) {
      try {
        font = TT.font(FONTS, px, 'display');
      } catch {
        font = null;
        break;
      }
      ctx.font = font.css;
      if (ctx.measureText(value).width <= maxWidth) break;
    }
    ctx.restore();
    if (!font) return null;
    return TT.text(ctx, value, 0, 0, px, {
      font,
      color,
      alpha,
      align: 'center',
      baseline: 'middle',
    });
  }

  const entries = [
    {
      id: 'arrow',
      desc: '箭头：直线或弧线，开口/实心箭头，可双线',
      when: '指向方向、增长、因果关系，或把视线推到某个结论',
    },
    {
      id: 'circle',
      desc: '不规则圈：椭圆、旋转、多绕 8%–16% 的闭合手绘圈',
      when: '圈住一个人物、数字或局部，强调“看这里”',
    },
    {
      id: 'box',
      desc: '标注框：方框、圆角框、云朵框',
      when: '框住一段文案或一个区域；云朵用于概念/气泡',
    },
    {
      id: 'wavy',
      desc: '波浪线：振幅与频率可调的强调线',
      when: '下划线式强调，比直线更活泼；别用在长段落',
    },
    {
      id: 'highlight',
      desc: '重点涂底色：圆角色块或粗笔斜涂',
      when: '给关键词铺底色；必须先 highlight 再写字',
    },
    {
      id: 'underline',
      desc: '普通下划线：微弯、两端略出头',
      when: '轻轻托住一行字，不想像波浪线那样抢眼',
    },
    {
      id: 'strike',
      desc: '删除线：划掉一个说法，可双线',
      when: '否定旧结论、划掉错误说法、做前后对比',
    },
    {
      id: 'seal',
      desc: '印章/角标：双线圈 + 文字，整体倾斜',
      when: '盖章式结论、已核实/已归档角标；不支持渐进',
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
      const via = Array.isArray(o.via) ? o.via.map(pointOf).filter(Boolean) : [];
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
      const head = ['open', 'solid', 'none'].includes(o.head) ? o.head : 'open';
      const double = !!o.double;
      const last = points[points.length - 1];
      const before = points[points.length - 2];
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
      let box = pointBox(ctx, points, width);
      let length = total;

      // 双线：第二条平行线略晚一点起笔，起笔/收笔都不完全重合。
      const lines = [];
      if (double) {
        const off = Math.max(2.2, width * 0.72);
        const offsetPoints = points.map((p) => [p[0] + perpX * off, p[1] + perpY * off]);
        const p2 = clamp01((progress - 0.035) / 0.965);
        lines.push({ pts: offsetPoints, p: p2, live: false });
        box = unionBox(box, pointBox(ctx, offsetPoints, width));
        length += lengthOf(offsetPoints);
      }
      lines.push({ pts: points, p: shaftP, live: progress < headStart });

      for (const line of lines) {
        if (line.p > 0) stroke(ctx, line.pts, line.p, o, { color, width, live: line.live });
      }

      if (headP > 0 && head !== 'none') {
        const base = [last[0] - dirX * headLen, last[1] - dirY * headLen];
        const wingA = [base[0] + perpX * headHalf, base[1] + perpY * headHalf];
        const wingB = [base[0] - perpX * headHalf, base[1] - perpY * headHalf];
        if (head === 'open') {
          const live = progress < 1 && headP < 0.98;
          // 箭头翼永远实线：虚线只属于杆，箭头也断会读不出方向。
          stroke(ctx, [wingA, last], headP, { ...o, dash: [] }, { color, width, live: false });
          stroke(ctx, [wingB, last], headP, { ...o, dash: [] }, { color, width, live });
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
      const closure = finite(o.closure) ? clamp(o.closure, -1, 1) : 0.16;
      const laps = finite(o.laps) ? clamp(o.laps, 0.5, 3) : 1.08;
      const seed = seedOf(o);
      const width = widthOf(o);
      const color = colorOf(o, 'ink');
      const sweep = TAU * laps + closure;
      const steps = Math.max(72, Math.ceil(Math.abs(sweep) / TAU * 168));
      const start = -Math.PI / 2 + (noise(1, seed) - 0.5) * 0.22;
      const pts = [];
      const cosR = Math.cos(rotate);
      const sinR = Math.sin(rotate);
      for (let i = 0; i <= steps; i += 1) {
        const a = start + sweep * i / steps;
        // 低频正弦叠加：起伏是圈上位置的平滑函数，不会画成锯齿多边形。
        const wobble = 1
          + Math.sin(a * 3.1 + seed * 0.37) * 0.021
          + Math.sin(a * 5.7 - seed * 0.21) * 0.012
          + Math.sin(a * 9.3 + seed * 0.53) * 0.005;
        const x = Math.cos(a) * rx * wobble;
        const y = Math.sin(a) * ry * wobble;
        pts.push([at[0] + x * cosR - y * sinR, at[1] + x * sinR + y * cosR]);
      }
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
      const short = Math.min(rect.w, rect.h);
      const radius = finite(o.radius) && o.radius >= 0
        ? o.radius
        : (shape === 'cloud' ? short * 0.16 : shape === 'round' ? short * 0.14 : 0);
      let pts = shape === 'cloud' ? cloudPath(rect, radius, seed) : rectPath(rect, shape === 'rect' ? 0 : radius, 10);
      // 手画框的收笔重叠：沿第一条边继续走 3%。
      pts = overshoot(pts, shape === 'cloud' ? 0.03 : 0.035);
      const box = unionBox(rectBox(ctx, rect, width), pointBox(ctx, pts, width));
      stroke(ctx, pts, progress, o, { color, width, live: progress < 1 });
      return { box, length: lengthOf(pts) };
    },

    wavy(ctx, o = {}) {
      const from = pointOf(o.from);
      const to = pointOf(o.to);
      if (!from || !to) return null;
      const progress = progressOf(o);
      if (progress <= 0 || alphaOf(o) <= 0) return null;
      const width = widthOf(o);
      const color = colorOf(o, 'ink');
      const amp = finite(o.amp) ? Math.abs(o.amp) : 6;
      const freq = finite(o.freq) ? Math.abs(o.freq) : 5;
      const phase = finite(o.phase) ? o.phase : 0;
      const seed = seedOf(o);
      const dx = to[0] - from[0];
      const dy = to[1] - from[1];
      const len = Math.hypot(dx, dy);
      if (!(len > 0)) return null;
      const nx = -dy / len;
      const ny = dx / len;
      const steps = clamp(Math.ceil(len / 4), 24, 240);
      const pts = [];
      for (let i = 0; i <= steps; i += 1) {
        const u = i / steps;
        const wave = Math.sin(TAU * freq * u + phase) * amp
          + (noise(i, seed + 23) - 0.5) * Math.min(1.2, amp * 0.12);
        pts.push([from[0] + dx * u + nx * wave, from[1] + dy * u + ny * wave]);
      }
      stroke(ctx, pts, progress, o, { color, width, live: progress < 1 });
      return { box: pointBox(ctx, pts, width + amp * 0.2), length: lengthOf(pts) };
    },

    highlight(ctx, o = {}) {
      const rect = spanOf(o.rect);
      if (!rect || !(rect.w > 0) || !(rect.h > 0)) return null;
      const progress = progressOf(o);
      if (progress <= 0 || alphaOf(o) <= 0) return null;
      const mode = o.mode === 'pen' ? 'pen' : 'fill';
      const color = colorOf(o, 'accent');
      const alpha = finite(o.alpha) ? clamp01(o.alpha) : 0.28;
      const grow = finite(o.grow) ? Math.max(0, o.grow) : 0.06;
      const growPx = grow * Math.min(rect.w, rect.h);
      const x = rect.x - growPx;
      const y = rect.y - growPx;
      const w = rect.w + growPx * 2;
      const h = rect.h + growPx * 2;
      const radius = Math.min(w, h) * 0.22;
      const revealed = w * smooth(progress);
      const box = rectBox(ctx, { x, y, w, h });
      if (mode === 'fill') {
        ctx.save();
        ctx.globalAlpha *= alpha;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, radius);
        else {
          ctx.moveTo(x + radius, y);
          ctx.arcTo(x + w, y, x + w, y + h, radius);
          ctx.arcTo(x + w, y + h, x, y + h, radius);
          ctx.arcTo(x, y + h, x, y, radius);
          ctx.arcTo(x, y, x + w, y, radius);
        }
        ctx.clip();
        ctx.fillStyle = color;
        ctx.fillRect(x, y, revealed, h);
        // 荧光笔前沿略亮一点，像墨水刚铺上去。
        ctx.globalAlpha *= 0.55;
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(x + Math.max(0, revealed - Math.max(2, w * 0.012)), y, Math.max(2, w * 0.012), h);
        ctx.restore();
        // 填充没有笔迹中心线，必须自己记账。
        TT.pen.addBox(ctx, { x, y, w: revealed, h });
        return { box, length: 0 };
      }
      // pen 模式：粗笔在框内来回涂；不是写字，不显示笔身。
      const bandW = h * 0.55;
      const passes = [
        { cy: y + h * 0.30, seed: seedOf(o) + 5 },
        { cy: y + h * 0.52, seed: seedOf(o) + 9 },
        { cy: y + h * 0.74, seed: seedOf(o) + 13 },
      ];
      let length = 0;
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, radius);
      else {
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + w, y, x + w, y + h, radius);
        ctx.arcTo(x + w, y + h, x, y + h, radius);
        ctx.arcTo(x, y + h, x, y, radius);
        ctx.arcTo(x, y, x + w, y, radius);
      }
      ctx.clip();
      for (let i = 0; i < passes.length; i += 1) {
        const p = clamp01((progress - i * 0.04) / (1 - 0.08));
        if (p <= 0) continue;
        const pts = [[x + w * 0.04, passes[i].cy], [x + w * 0.5, passes[i].cy - h * 0.01], [x + w * 0.96, passes[i].cy + h * 0.01]];
        // 外层已经乘过一次 alpha；这里把 alpha 置 1，避免透明度被平方。
        stroke(ctx, pts, p, { ...o, seed: passes[i].seed, alpha: 1 }, {
          color,
          width: bandW,
          live: false,
        });
        length += (w * 0.92) * p;
      }
      ctx.restore();
      return { box, length };
    },

    underline(ctx, o = {}) {
      const from = pointOf(o.from);
      const to = pointOf(o.to);
      if (!from || !to) return null;
      const progress = progressOf(o);
      if (progress <= 0 || alphaOf(o) <= 0) return null;
      const width = widthOf(o);
      const color = colorOf(o, 'ink');
      const dx = to[0] - from[0];
      const dy = to[1] - from[1];
      const len = Math.hypot(dx, dy);
      if (!(len > 0)) return null;
      const ux = dx / len;
      const uy = dy / len;
      // 法线翻到屏幕下方；下划线永远托在字下面，不跟着倒转。
      let nx = -uy;
      let ny = ux;
      if (ny < 0) { nx = -nx; ny = -ny; }
      const offset = finite(o.offset) ? Math.abs(o.offset) : 0.14;
      const slack = finite(o.slack) ? Math.max(0, o.slack) : 0.06;
      const bow = offset * Math.min(len, 60);
      const overhang = clamp(slack * len, 2, 14);
      const a = [from[0] - ux * overhang, from[1] - uy * overhang];
      const b = [to[0] + ux * overhang, to[1] + uy * overhang];
      const mid = [(a[0] + b[0]) / 2 + nx * bow * 2, (a[1] + b[1]) / 2 + ny * bow * 2];
      const pts = quadPoints(a, mid, b, Math.max(24, Math.ceil((len + overhang * 2) / 5)));
      stroke(ctx, pts, progress, o, { color, width, live: progress < 1 });
      return { box: pointBox(ctx, pts, width + bow * 0.2), length: lengthOf(pts) };
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
      const bow = (noise(5, seed) - 0.5) * Math.min(4, len * 0.07);
      const mid = [(from[0] + to[0]) / 2 + nx * bow, (from[1] + to[1]) / 2 + ny * bow];
      const pts = quadPoints(from, mid, to, Math.max(24, Math.ceil(len / 5)));
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

    seal(ctx, o = {}) {
      const at = pointOf(o.at);
      if (!at) return null;
      const text = String(o.text == null ? '' : o.text);
      const shape = o.shape === 'square' ? 'square' : 'circle';
      const size = finite(o.size) && o.size > 0 ? o.size : 0.10;
      const rotate = finite(o.rotate) ? o.rotate : -0.08;
      const width = widthOf(o);
      const color = colorOf(o, 'accent');
      const alpha = alphaOf(o);
      if (alpha <= 0) return null;
      const canvas = ctx.canvas || { width: 1080, height: 1080 };
      let scale = 1;
      try {
        const m = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
        if (m) scale = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
      } catch {
        scale = 1;
      }
      const short = Math.min(canvas.width, canvas.height) / scale;
      const R = short * size / 2;
      if (!(R > 2)) return null;
      let box = null;
      let length = 0;
      ctx.save();
      ctx.translate(at[0], at[1]);
      ctx.rotate(rotate);
      const ring = (r, lineWidth, live) => {
        const pts = [];
        const steps = Math.max(40, Math.ceil(r * 1.4));
        for (let i = 0; i <= steps; i += 1) {
          const a = -Math.PI / 2 + TAU * 0.012 + TAU * i / steps;
          pts.push([Math.cos(a) * r, Math.sin(a) * r]);
        }
        stroke(ctx, pts, 1, { ...o, seed: seedOf(o) }, { color, width: lineWidth, live });
        length += TAU * r;
        return pointBox(ctx, pts, lineWidth);
      };
      if (shape === 'circle') {
        box = unionBox(ring(R, Math.max(2.4, width * 1.55), false), ring(R * 0.82, Math.max(1.2, width * 0.72), false));
      } else {
        const side = R * 0.93;
        const outer = overshoot(rectPath({ x: -side, y: -side, w: side * 2, h: side * 2 }, R * 0.16, 6), 0.02);
        const inner = rectPath({ x: -side * 0.8, y: -side * 0.8, w: side * 1.6, h: side * 1.6 }, R * 0.12, 5);
        stroke(ctx, outer, 1, { ...o, seed: seedOf(o) }, { color, width: Math.max(2.4, width * 1.55), live: false });
        stroke(ctx, inner, 1, { ...o, seed: seedOf(o) }, { color, width: Math.max(1.2, width * 0.72), live: false });
        box = unionBox(pointBox(ctx, outer, width * 1.55), pointBox(ctx, inner, width * 0.72));
        length += lengthOf(outer) + lengthOf(inner);
      }
      if (text.trim()) {
        const textBox = drawSealText(ctx, text, R * 0.56, color, alpha, R * 1.18);
        box = unionBox(box, textBox);
      }
      ctx.restore();
      return box ? { box, length } : null;
    },
  };
})();
