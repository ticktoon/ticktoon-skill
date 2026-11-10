/**
 * TT.text —— 排版、量测、真实墨迹框。
 *
 * 断行规则是中文优先：CJK 逐字可断，西文按词，空格是唯一允许被丢弃的断点。
 * 这不是通用排版引擎，是"播报字幕级"的排版：不处理标点悬挂、不做两端对齐，
 * 因为这两件事在 1080p 短片上肉眼不可辨，却会让量测结果与 block 的绘制对不上。
 */
(() => {
  const CJK = /[\u2e80-\u303f\u3040-\u9fff\uac00-\ud7af\uf900-\ufaff\ufe30-\ufe4f\uff00-\uffef]/;

  /** 把一段文字切成"不可再分的最小单元"：CJK 单字、西文单词、单个空格。 */
  function tokenize(str) {
    const out = [];
    let word = '';
    for (const ch of str) {
      if (CJK.test(ch)) {
        if (word) out.push(word), (word = '');
        out.push(ch);
      } else if (ch === ' ' || ch === '\t') {
        if (word) out.push(word), (word = '');
        out.push(' ');
      } else {
        word += ch;
      }
    }
    if (word) out.push(word);
    return out;
  }

  function layout(ctx, str, maxWidth) {
    const lines = [];
    for (const paragraph of String(str == null ? '' : str).split('\n')) {
      if (paragraph === '') {
        lines.push('');
        continue;
      }
      let line = '';
      for (const token of tokenize(paragraph)) {
        const next = line + token;
        if (line && ctx.measureText(next).width > maxWidth) {
          lines.push(line.replace(/\s+$/, ''));
          line = token === ' ' ? '' : token;
        } else {
          line = next;
        }
      }
      if (line) lines.push(line.replace(/\s+$/, ''));
    }
    return lines;
  }

  // ---- 文字回执：独立于 TT.pen 的墨迹框，只累计本帧真正 fillText 出去的文字 ----
  // 逐条记账（textItems）与并集记账（textBBox）同时保留：并集供安全框断言，
  // 逐条供"同场文字互相压住"的碰撞检测。code 场由 emit 每帧 resetBBox；
  // raw ctx.fillText 由 emit 注入的包装器自动记账，TT.text(...) 走同一套量测。
  let textBBox = null;
  let textItems = [];
  const LABEL_LIMIT = 40;
  const finite = (value) => typeof value === 'number' && Number.isFinite(value);

  function fontSize(ctx) {
    const match = /([\d.]+)px/.exec(String(ctx.font || ''));
    return match ? Number(match[1]) : 0;
  }

  /**
   * 量测一段文字在当前 ctx 状态下的真实墨迹框（画布逻辑像素），不累计。
   * actualBoundingBox* 已按 textAlign / textBaseline 给出相对对齐点的距离；
   * 引擎不提供时按字号与对齐方式保守回退。
   */
  function measureBox(ctx, str, x, y) {
    const value = String(str == null ? '' : str);
    if (!value.trim()) return null;
    let metrics = null;
    try {
      metrics = ctx.measureText(value);
    } catch {
      return null;
    }
    if (!metrics) return null;
    const width = finite(metrics.width) ? metrics.width : 0;
    const left = finite(metrics.actualBoundingBoxLeft) ? metrics.actualBoundingBoxLeft : null;
    const right = finite(metrics.actualBoundingBoxRight) ? metrics.actualBoundingBoxRight : null;
    const asc = finite(metrics.actualBoundingBoxAscent) ? metrics.actualBoundingBoxAscent : null;
    const desc = finite(metrics.actualBoundingBoxDescent) ? metrics.actualBoundingBoxDescent : null;
    const size = fontSize(ctx);
    let x0;
    let x1;
    if (left !== null && right !== null) {
      x0 = x - left;
      x1 = x + right;
    } else {
      const align = ctx.textAlign || 'left';
      const w = width;
      x0 = align === 'center' ? x - w / 2 : align === 'right' || align === 'end' ? x - w : x;
      x1 = x0 + w;
    }
    const ascPx = asc !== null ? asc : size * 0.78;
    const descPx = desc !== null ? desc : size * 0.22;
    const y0 = y - ascPx;
    const y1 = y + descPx;
    if (!(x1 > x0 && y1 > y0)) return null;

    let matrix = null;
    try {
      matrix = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
    } catch {
      matrix = null;
    }
    const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [px, py] of corners) {
      const tx = matrix ? matrix.a * px + matrix.c * py + matrix.e : px;
      const ty = matrix ? matrix.b * px + matrix.d * py + matrix.f : py;
      if (tx < minX) minX = tx;
      if (ty < minY) minY = ty;
      if (tx > maxX) maxX = tx;
      if (ty > maxY) maxY = ty;
    }
    if (!(maxX > minX && maxY > minY)) return null;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function accumulate(box) {
    if (!box) return;
    if (!textBBox) {
      textBBox = { x0: box.x, y0: box.y, x1: box.x + box.w, y1: box.y + box.h };
    } else {
      if (box.x < textBBox.x0) textBBox.x0 = box.x;
      if (box.y < textBBox.y0) textBBox.y0 = box.y;
      if (box.x + box.w > textBBox.x1) textBBox.x1 = box.x + box.w;
      if (box.y + box.h > textBBox.y1) textBBox.y1 = box.y + box.h;
    }
  }

  /**
   * 记一条文字：并集 + 逐条。label 取 fillText 的第一个参数（原始字符串）截断 40 字符，
   * 只用于报告/碰撞文案；bbox 是量测后的画布逻辑像素框。
   */
  function remember(ctx, str, box) {
    if (!box) return box;
    accumulate(box);
    textItems.push({
      text: String(str == null ? '' : str).slice(0, LABEL_LIMIT),
      bbox: { x: box.x, y: box.y, w: box.w, h: box.h },
      size: fontSize(ctx),
    });
    return box;
  }

  function record(ctx, str, x, y) {
    return remember(ctx, str, measureBox(ctx, str, x, y));
  }

  /**
   * TT.text(ctx, text, x, y, size, opts) —— 写一行文字并记账。
   * opts: font(css 字符串或 TT.font 结果) / role / color / align / baseline / alpha / maxWidth。
   * 默认字体取 style 的 role；调用方仍可用 ctx 状态画更复杂的排版。
   */
  function draw(ctx, str, x, y, size, opts = {}) {
    if (!ctx) return null;
    const o = opts || {};
    const font = o.font == null
      ? (typeof TT.font === 'function' && typeof STYLE !== 'undefined'
        ? TT.font(STYLE, finite(size) ? size : 56, o.role || 'body')
        : null)
      : (typeof o.font === 'string' ? { css: o.font } : o.font);
    ctx.save();
    if (font && font.css) ctx.font = font.css;
    if (o.color != null) ctx.fillStyle = o.color;
    if (finite(o.alpha)) ctx.globalAlpha *= o.alpha;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.baseline || 'alphabetic';
    const prev = ctx.__ttTextInternal;
    ctx.__ttTextInternal = true;
    let box = null;
    try {
      if (o.maxWidth != null) ctx.fillText(str, x, y, o.maxWidth);
      else ctx.fillText(str, x, y);
      box = measureBox(ctx, str, x, y);
      if (box) remember(ctx, str, box);
    } finally {
      ctx.__ttTextInternal = prev;
      ctx.restore();
    }
    return box;
  }

  Object.assign(draw, {
    bbox() {
      if (!textBBox) return null;
      return { x: textBBox.x0, y: textBBox.y0, w: textBBox.x1 - textBBox.x0, h: textBBox.y1 - textBBox.y0 };
    },

    /** 本帧逐条文字 `{ text, bbox, size }`；顺序就是本帧 fillText 的绘制顺序。 */
    items() {
      return textItems.map((item) => ({
        text: item.text,
        bbox: { x: item.bbox.x, y: item.bbox.y, w: item.bbox.w, h: item.bbox.h },
        size: item.size,
      }));
    },

    resetBBox() { textBBox = null; textItems = []; },

    measureBox,
    record,

    measure(ctx, str) {
      return ctx.measureText(str).width;
    },

    wrap(ctx, str, maxWidth) {
      return layout(ctx, str, maxWidth);
    },

    /**
     * 从显式的最大像素字号往下试，直到整段能塞进 rect。
     * 返回 `{ font, lines }`；到 minPx 仍塞不下时返回最小字号的结果，
     * 由调用方（或 check）决定是截断还是换 block。
     */
    fit(ctx, str, rect, style, role, maxPx, minPx) {
      const from = maxPx;
      const floor = minPx || 32;
      let best = null;
      for (let px = from; px >= floor; px -= 2) {
        const font = TT.font(style, px, role);
        ctx.font = font.css;
        const lines = layout(ctx, str, rect.w);
        best = { font, lines };
        if (lines.length * font.lineHeight <= rect.h) return best;
      }
      return best;
    },

    /**
     * 真实墨迹包围盒，供 receipts 用。`input` 可以是字符串（内部再断行）
     * 或已排好的行数组——block 已经算过行时传数组，省一次量测且保证与绘制一致。
     */
    inkBox(ctx, input, rect, font, align) {
      const lines = Array.isArray(input) ? input : layout(ctx, input, rect.w);
      const prevFont = ctx.font;
      ctx.font = font.css;
      const blockH = lines.length * font.lineHeight;
      const top = align === 'middle' ? rect.y + (rect.h - blockH) / 2 : rect.y;

      let left = Infinity;
      let right = -Infinity;
      let inkTop = Infinity;
      let inkBottom = -Infinity;

      lines.forEach((line, i) => {
        if (!line) return;
        const m = ctx.measureText(line);
        const baseline = top + i * font.lineHeight + font.ascent;
        const asc = typeof m.actualBoundingBoxAscent === 'number' ? m.actualBoundingBoxAscent : font.ascent;
        const desc = typeof m.actualBoundingBoxDescent === 'number' ? m.actualBoundingBoxDescent : font.descent;
        if (m.width > 0) {
          left = Math.min(left, rect.x);
          right = Math.max(right, rect.x + m.width);
          inkTop = Math.min(inkTop, baseline - asc);
          inkBottom = Math.max(inkBottom, baseline + desc);
        }
      });

      ctx.font = prevFont;
      if (!Number.isFinite(left)) return { x: rect.x, y: rect.y, w: 0, h: 0 };
      return { x: left, y: inkTop, w: right - left, h: inkBottom - inkTop };
    },
  });

  // 可调用（TT.text(ctx, …)），同时保留 measure / wrap / fit / inkBox / bbox 等成员。
  TT.text = draw;
})();
