/**
 * 字幕公共层：cue/逐字时间轴、字体、多行量测、位置、安全区、主体避让和包络。
 * 样式只向 render 提供盒型参数与一个 draw(model) 函数，不各自重算这些规则。
 */
(() => {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const dimension = (value, total, fallback) => value == null ? fallback : value <= 1 ? value * total : value;
  const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
    * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

  function activeCue(c) {
    for (const cue of c.cues || []) if (c.sceneT >= cue.start && c.sceneT < cue.end) return cue;
    return null;
  }

  function timeline(cue) {
    if (cue.chars?.length) return cue.chars;
    const text = [...cue.text];
    const span = cue.end - cue.start;
    return text.map((ch, i) => ({
      text: ch,
      start: cue.start + span * i / Math.max(1, text.length),
      end: cue.start + span * (i + 1) / Math.max(1, text.length),
    }));
  }

  function obstacles(c) {
    const out = [];
    for (const item of c.options?.avoid || []) {
      if (Array.isArray(item) && item.length === 4) out.push({ x: item[0] * c.W, y: item[1] * c.H, w: item[2] * c.W, h: item[3] * c.H });
      else if (item && typeof item === 'object') out.push({ x: item.x * c.W, y: item.y * c.H, w: item.w * c.W, h: item.h * c.H });
    }
    for (const g of c.avoid || []) {
      if (!g.captionActive) continue;
      if (Array.isArray(g.captionAvoid)) {
        out.push(...g.captionAvoid);
        continue;
      }
      if (g.ink && g.ink.w > 0 && g.ink.h > 0) out.push(g.ink);
      else if (g.rect && g.rect.w * g.rect.h < c.W * c.H * 0.72) out.push(g.rect);
    }
    return out;
  }

  function place(c, w, h) {
    const o = c.options || {};
    const mx = c.W * (c.metrics?.margin ?? 0.055);
    const my = c.H * (c.metrics?.margin ?? 0.055);
    const fit = (x, y) => ({
      x: clamp(x, mx, Math.max(mx, c.W - mx - w)),
      y: clamp(y, my, Math.max(my, c.H - my - h)),
      w, h,
    });
    const at = o.at || 'bottom';
    if (typeof at === 'object') return fit(at.x * c.W - w / 2, at.y * c.H - h / 2);
    if (at === 'top') return fit((c.W - w) / 2, my);
    if (at === 'center') return fit((c.W - w) / 2, (c.H - h) / 2);
    if (at === 'bottom') return fit((c.W - w) / 2, (c.metrics?.top ?? 0.78) * c.H);

    const candidates = [
      [0.72, 0.30], [0.28, 0.30], [0.50, 0.25], [0.72, 0.48], [0.28, 0.48],
      [0.50, 0.48], [0.72, 0.72], [0.28, 0.72], [0.50, 0.72],
    ];
    const blocked = obstacles(c);
    let best = null;
    let bestScore = Infinity;
    for (let i = 0; i < candidates.length; i += 1) {
      const [nx, ny] = candidates[i];
      const rect = fit(nx * c.W - w / 2, ny * c.H - h / 2);
      let score = i * 0.002;
      for (const b of blocked) score += overlap(rect, b) / Math.max(1, w * h) * 100;
      if (score < bestScore) { bestScore = score; best = rect; }
    }
    return best;
  }

  function horizontalLayout(c, cue, f, maxWidth, lineHeight) {
    const ctx = c.ctx;
    const lines = [];
    let chars = [];
    let width = 0;
    const flush = () => {
      while (chars.length && /^\s$/.test(chars[chars.length - 1].text)) width -= chars.pop().w;
      lines.push({ chars, width });
      chars = [];
      width = 0;
    };
    for (const source of timeline(cue)) {
      if (source.text === '\n') { flush(); continue; }
      const ch = { ...source, w: ctx.measureText(source.text).width };
      if (chars.length && width + ch.w > maxWidth) flush();
      if (!chars.length && /^\s$/.test(ch.text)) continue;
      chars.push(ch);
      width += ch.w;
    }
    if (chars.length || !lines.length) flush();
    return lines;
  }

  /**
   * 一行文字的真实墨迹度量。canvas 的 actualBoundingBox{Ascent,Descent}
   * 按字形轮廓返回（0 也是合法值，例如纯大写行没有下伸部），只有引擎不提供时才退回字体名义值。
   */
  function measureLineInk(ctx, line, f) {
    if (!line.chars.length) return { asc: f.ascent, desc: f.descent };
    const m = ctx.measureText(line.chars.map((ch) => ch.text).join(''));
    const valid = typeof m.actualBoundingBoxAscent === 'number' && Number.isFinite(m.actualBoundingBoxAscent)
      && typeof m.actualBoundingBoxDescent === 'number' && Number.isFinite(m.actualBoundingBoxDescent);
    if (!valid) return { asc: f.ascent, desc: f.descent };
    return { asc: m.actualBoundingBoxAscent, desc: m.actualBoundingBoxDescent };
  }

  function verticalLayout(c, cue, f, maxHeight, lineHeight) {
    const ctx = c.ctx;
    const columns = [];
    let chars = [];
    let height = 0;
    const flush = () => { columns.push({ chars, width: height }); chars = []; height = 0; };
    for (const source of timeline(cue)) {
      if (source.text === '\n' || (chars.length && height + f.size > maxHeight)) flush();
      if (/^\s$/.test(source.text)) continue;
      const ch = { ...source, w: ctx.measureText(source.text).width };
      chars.push(ch);
      height += lineHeight;
    }
    if (chars.length || !columns.length) flush();
    return columns;
  }

  function model(c, spec) {
    const cue = activeCue(c);
    if (!cue) return null;
    const o = c.options || {};
    const base = c.metrics?.baseSize ?? 46;
    const role = c.metrics?.fontRole || spec.font || o.font || 'caption';
    const f = TT.font(c.style, Math.round(base * (o.size || 1) * (spec.fontScale || 1)), role, c.metrics?.fontFamily);
    const ctx = c.ctx;
    ctx.save();
    ctx.font = f.css;
    const lineHeight = f.size * (o.lineHeight || spec.lineHeight || c.metrics?.lineHeight || 1.24);
    const padding = Array.isArray(o.padding) ? o.padding : [o.padding, o.padding];
    const padX = padding[0] == null ? (spec.padX == null ? f.size * 0.55 : spec.padX) : padding[0] * f.size;
    const padY = padding[1] == null ? (spec.padY == null ? f.size * 0.28 : spec.padY) : padding[1] * f.size;
    const safeWidth = c.W * (1 - 2 * (c.metrics?.margin ?? 0.055));
    const safeHeight = c.H * (1 - 2 * (c.metrics?.margin ?? 0.055));
    const maxWidth = Math.min(safeWidth, dimension(o.maxWidth, c.W, safeWidth)) - padX * 2;
    const maxHeight = Math.min(safeHeight, dimension(o.maxHeight, c.H, c.H * 0.56)) - padY * 2;
    const vertical = !!spec.vertical;
    const lines = vertical
      ? verticalLayout(c, cue, f, maxHeight, lineHeight)
      : horizontalLayout(c, cue, f, maxWidth, lineHeight);
    const contentW = vertical
      ? lines.length * lineHeight
      : Math.max(1, ...lines.map((line) => line.width));
    const contentH = vertical
      ? Math.max(1, ...lines.map((line) => line.width))
      : lines.length * lineHeight;
    // 函数形式让样式按已解析字体追加内容区（如主副两行式版式），盒高仍由公共层统一决定
    const extraHeight = typeof spec.extraHeight === 'function'
      ? spec.extraHeight(f, c)
      : spec.extraHeight || 0;
    // 横排按真实墨迹定盒高：行间仍以 lineHeight 堆叠，但盒高 = 墨迹高 + 对称 padY，
    // 再把整组基线平移到墨迹中心与背衬中心重合，避免名义 ascent/descent 造成的偏上。
    let ink = null;
    let boxW;
    let boxH;
    if (vertical) {
      boxW = contentW + padX * 2;
      boxH = contentH + padY * 2 + extraHeight;
    } else {
      let relTop = Infinity;
      let relBottom = -Infinity;
      lines.forEach((line, i) => {
        const m = measureLineInk(ctx, line, f);
        line.asc = m.asc;
        line.desc = m.desc;
        const baselineRel = i * lineHeight + f.ascent;
        relTop = Math.min(relTop, baselineRel - m.asc);
        relBottom = Math.max(relBottom, baselineRel + m.desc);
      });
      const inkH = Math.max(1, relBottom - relTop);
      ink = { topRel: relTop, bottomRel: relBottom, h: inkH, top: 0, bottom: 0 };
      boxW = spec.fullWidth ? c.W : contentW + padX * 2;
      boxH = inkH + padY * 2 + extraHeight;
    }
    const rect = place(c, boxW, boxH);
    if (spec.fullWidth) { rect.x = 0; rect.w = c.W; }
    if (ink) {
      ink.top = rect.y + padY;
      ink.bottom = rect.y + padY + ink.h;
    }
    const t = c.sceneT - cue.start;
    const alpha = TT.env.fade(t, cue.end - cue.start, spec.fadeIn ?? 0.1, spec.fadeOut ?? 0.1);
    const align = o.align || spec.align || 'center';
    const originX = spec.fullWidth || align === 'center'
      ? rect.x + (rect.w - contentW) / 2
      : align === 'right' ? rect.x + rect.w - padX - contentW : rect.x + padX;
    // 横排：originY 下移到「墨迹顶边恰好落在 rect.y + padY」的位置；竖排维持名义行盒。
    const originY = vertical ? rect.y + padY : rect.y + padY - ink.topRel;
    let index = 0;
    lines.forEach((line, lineIndex) => {
      line.index = lineIndex;
      line.x = vertical ? originX + (lines.length - 1 - lineIndex) * lineHeight : originX;
      line.y = vertical ? originY : originY + lineIndex * lineHeight;
      let cursor = vertical ? line.y : line.x;
      for (const ch of line.chars) {
        ch.index = index++;
        ch.line = lineIndex;
        ch.x = vertical ? line.x : cursor;
        ch.y = vertical ? cursor : line.y;
        ch.baseline = ch.y + f.ascent;
        cursor += vertical ? lineHeight : ch.w;
      }
    });
    ctx.restore();
    return { c, ctx, cue, o, f, lines, rect, contentW, contentH, originX, originY, lineHeight, padX, padY, t, alpha, vertical, ink };
  }

  function render(c, spec, draw) {
    const m = model(c, spec || {});
    if (!m) return;
    const ctx = c.ctx;
    ctx.save();
    ctx.font = m.f.css;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = m.alpha;
    draw(m);
    ctx.restore();
  }

  function rounded(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
    ctx.fill();
  }

  function inkFor(hex) {
    const match = /^#([\da-f]{6})$/i.exec(hex || '');
    if (!match) return '#17232D';
    const n = parseInt(match[1], 16);
    const lum = ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114;
    return lum < 145 ? '#FFF7E7' : '#17232D';
  }

  function noise(seed, index, channel = 0) {
    let x = ((seed | 0) ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(channel + 11, 0x85ebca6b)) >>> 0;
    x ^= x >>> 16; x = Math.imul(x, 0x7feb352d); x ^= x >>> 15; x = Math.imul(x, 0x846ca68b); x ^= x >>> 16;
    return (x >>> 0) / 4294967295;
  }

  function eachChar(m, draw) {
    for (const line of m.lines) for (const ch of line.chars) draw(ch, line);
  }

  TT.captionKit = { render, model, activeCue, timeline, obstacles, place, rounded, inkFor, noise, eachChar, clamp };
})();
