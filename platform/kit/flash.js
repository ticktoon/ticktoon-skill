/**
 * TT.flash —— 快闪大字卡点的绘制词法。
 *
 * 只回答「这一帧怎么把字、图、色块、条纹、网格画到位」：不读时间轴、不写故事、
 * 不决定场上几秒。所有 progress / t 都由 scene.code 显式传入；同一参数同一帧的
 * 两次调用结果完全相同。
 *
 * 这些词法来自早期快闪组件，但不再做「组件拼装」：每个函数都是可组合的画笔，
 * 内容、版位、节奏仍由 scene.code 决定。图像填字、多层字、故障切片等需要离屏
 * 合成的效果走 `api.canvas`，只把最终像素 blit 回主画布；文字回执照旧只记一次，
 * 避免装饰层触发 text-text 碰撞。
 */
(() => {
  const TAU = Math.PI * 2;
  const finite = (value) => typeof value === 'number' && Number.isFinite(value);
  const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value);
  const clamp = (value, lo, hi) => (value < lo ? lo : value > hi ? hi : value);
  const num = (value, fallback) => (finite(value) ? value : fallback);
  const str = (value) => String(value == null ? '' : value);
  const hash = (index, seed = 0) => {
    const x = Math.sin(index * 127.1 + seed * 311.7 + 17.17) * 43758.5453;
    return x - Math.floor(x);
  };
  const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
  // 快闪的调色板属于 kit 本身：黑底、白字、灰、橙、深蓝。调用方要品牌色时
  // 直接传 hex（color / colors / colorA…），不经过 recipe 的 token。
  const styleColor = (_key, fallback) => fallback;
  const colorOf = (value, fallback) => (typeof value === 'string' && value ? value : fallback);
  const bgColor = () => styleColor('bg', '#0A0A0A');
  const inkColor = () => styleColor('ink', '#FFFFFF');
  const mutedColor = () => styleColor('muted', '#8A8A8A');
  const accentColor = () => styleColor('accent', '#FF4D00');
  const lineColor = () => styleColor('line', '#12305C');
  const paletteColor = (index) => {
    const list = [accentColor(), lineColor(), inkColor(), mutedColor()];
    return list[((index % list.length) + list.length) % list.length];
  };
  const isLight = (color) => {
    const match = /^#([0-9a-f]{6})$/i.exec(String(color || ''));
    if (!match) return false;
    const n = parseInt(match[1], 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 150;
  };
  const readableOn = (background) => isLight(background) ? bgColor() : inkColor();

  const rectOf = (value, fallback) => {
    if (value && finite(value.x) && finite(value.y) && finite(value.w) && finite(value.h)) {
      return { x: value.x, y: value.y, w: value.w, h: value.h };
    }
    if (Array.isArray(value) && value.length >= 4 && value.every((v) => finite(Number(v)))) {
      const x = Number(value[0]);
      const y = Number(value[1]);
      const w = Number(value[2]);
      const h = Number(value[3]);
      return { x, y, w, h };
    }
    return fallback || { x: 0, y: 0, w: 0, h: 0 };
  };
  const pointOf = (value, fallback) => (Array.isArray(value) && value.length >= 2
    && finite(Number(value[0])) && finite(Number(value[1]))
    ? [clamp01(Number(value[0])), clamp01(Number(value[1]))]
    : fallback || [0.5, 0.5]);

  function positiveSize(value) {
    return finite(value) && value > 0;
  }

  function fontOf(o, size, role) {
    const px = positiveSize(size) ? size : 48;
    if (o && typeof o.font === 'object' && o.font && typeof o.font.css === 'string') {
      return {
        css: o.font.css,
        size: finite(o.font.size) ? o.font.size : px,
        lineHeight: finite(o.font.lineHeight) ? o.font.lineHeight : px * 1.24,
        ascent: finite(o.font.ascent) ? o.font.ascent : px * 0.78,
        descent: finite(o.font.descent) ? o.font.descent : px * 0.22,
      };
    }
    if (o && typeof o.font === 'string' && o.font.trim()) {
      return { css: o.font, size: px, lineHeight: px * 1.24, ascent: px * 0.78, descent: px * 0.22 };
    }
    try {
      return TT.font(FONTS, px, (o && o.role) || role || 'display');
    } catch {
      return { css: px + 'px sans-serif', size: px, lineHeight: px * 1.24, ascent: px * 0.78, descent: px * 0.22 };
    }
  }
  function setFont(ctx, font) {
    ctx.font = font.css;
  }

  /**
   * 不进文字回执的原始绘制，只给镜头运动中的卡片纹理用。
   * `TT.text` 会主动记回执，外层的 __ttTextInternal 只能挡住 emit 的包装。
   */
  function drawRawText(ctx, text, x, y, size, o = {}) {
    const font = fontOf(o, size, o.role);
    ctx.save();
    setFont(ctx, font);
    ctx.fillStyle = colorOf(o.color, inkColor());
    if (finite(o.alpha)) ctx.globalAlpha *= clamp01(o.alpha);
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.baseline || 'alphabetic';
    const prev = ctx.__ttTextInternal;
    ctx.__ttTextInternal = true;
    ctx.fillText(text, x, y);
    ctx.__ttTextInternal = prev;
    ctx.restore();
  }

  function textWidth(ctx, text, font, tracking = 0) {
    setFont(ctx, font);
    const value = str(text);
    const base = ctx.measureText(value).width;
    const count = Array.from(value).length;
    return base + Math.max(0, count - 1) * tracking;
  }

  function roundRect(ctx, x, y, w, h, radius) {
    const r = Math.max(0, Math.min(num(radius, 0), Math.abs(w) / 2, Math.abs(h) / 2));
    if (r <= 0) {
      ctx.rect(x, y, w, h);
      return;
    }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fillRoundRect(ctx, x, y, w, h, radius, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    roundRect(ctx, x, y, w, h, radius);
    ctx.fill();
    ctx.restore();
  }

  function sourceSize(source) {
    if (!source) return { w: 0, h: 0 };
    const w = num(source.videoWidth, num(source.naturalWidth, num(source.width, 0)));
    const h = num(source.videoHeight, num(source.naturalHeight, num(source.height, 0)));
    return { w, h };
  }

  /**
   * 在给定矩形内按 cover / contain 画图。`focus` 是 0…1 的裁切中心，
   * `zoom` 在 fit 之后追加放大；视频帧尺寸未知时按整幅铺开，不抛异常。
   */
  function drawFitted(ctx, source, rect, o = {}) {
    const size = sourceSize(source);
    if (!source || size.w <= 0 || size.h <= 0) return false;
    const fit = o.fit === 'contain' ? 'contain' : 'cover';
    const zoom = Math.max(0.01, num(o.zoom, 1));
    const base = fit === 'contain'
      ? Math.min(rect.w / size.w, rect.h / size.h)
      : Math.max(rect.w / size.w, rect.h / size.h);
    const scale = base * zoom;
    const dw = size.w * scale;
    const dh = size.h * scale;
    const focus = pointOf(o.focus, [0.5, 0.5]);
    const x = rect.x + (rect.w - dw) * focus[0];
    const y = rect.y + (rect.h - dh) * focus[1];
    try {
      ctx.drawImage(source, x, y, dw, dh);
    } catch {
      return false;
    }
    return true;
  }

  function resolveMedia(api, value) {
    if (!value) return null;
    if (typeof value === 'string') {
      try {
        return typeof api.img === 'function' ? api.img(value) : null;
      } catch {
        return null;
      }
    }
    return value;
  }

  function resolveCellMedia(api, cell) {
    if (!cell) return null;
    if (cell.video) {
      try {
        return typeof api.video === 'function' ? api.video(cell.video) : null;
      } catch {
        return null;
      }
    }
    return resolveMedia(api, cell.image || cell.src);
  }

  function easeOf(name, p) {
    const value = clamp01(p);
    if (name === 'linear') return TT.ease.linear(value);
    if (name === 'outQuart') return TT.ease.outQuart(value);
    if (name === 'outExpo') return TT.ease.outExpo(value);
    if (name === 'inOutCubic') return TT.ease.inOutCubic(value);
    if (name === 'back') return TT.ease.back(1.7)(value);
    return TT.ease.outCubic(value);
  }

  function progressOf(o, fallback = 1) {
    if (finite(o.progress)) return clamp01(o.progress);
    if (finite(o.t) && finite(o.dur) && o.dur > 0) return clamp01(o.t / o.dur);
    return fallback;
  }

  function microText(o) {
    if (o.text != null) return str(o.text);
    if (finite(o.index) && finite(o.total)) {
      const pad = Math.max(2, Math.floor(num(o.pad, 2)));
      return String(Math.floor(o.index)).padStart(pad, '0') + ' / ' + String(Math.floor(o.total)).padStart(pad, '0');
    }
    return '';
  }

  /** 单行文字的可用字号：从 maxPx 往下试，直到能塞进 maxWidth。 */
  function fit(ctx, text, maxWidth, o = {}) {
    const maxPx = Math.max(8, num(o.maxPx, 400));
    const minPx = Math.max(8, num(o.minPx, 24));
    const role = o.role || 'display';
    for (let px = Math.floor(maxPx); px >= minPx; px -= 2) {
      const font = fontOf(o, px, role);
      if (textWidth(ctx, text, font, num(o.tracking, 0)) <= maxWidth) return px;
    }
    return minPx;
  }

  /** 大字的逐字弹入 / 重击。每个字一个独立 progress，最终 x 位置由逐字宽度累加。 */
  function stagger(ctx, api, o = {}) {
    if (!ctx) return null;
    const text = str(o.text);
    if (!text) return null;
    const size = Math.max(8, num(o.size, 240));
    const font = fontOf(o, size, o.role || 'display');
    const tracking = num(o.tracking, 0);
    const t = num(o.t, num(api && api.t, 0));
    const dur = Math.max(0.001, num(o.dur, 0.32));
    const gap = num(o.stagger, 0.055);
    const direction = o.direction || 'scale';
    const fromScale = num(o.fromScale, 1.9);
    const fromOffset = num(o.fromOffset, size * 0.24);
    const seed = num(o.seed, 0);
    const colors = Array.isArray(o.colors) ? o.colors : null;
    const baseColor = colorOf(o.color, inkColor());
    const align = o.align || 'center';
    const baseline = o.baseline || 'middle';
    const chars = Array.from(text);
    const widths = chars.map((ch) => textWidth(ctx, ch, font, 0));
    const total = widths.reduce((sum, w) => sum + w, 0) + Math.max(0, chars.length - 1) * tracking;
    const anchorX = finite(o.x) ? o.x : (api && api.W ? api.W / 2 : ctx.canvas ? ctx.canvas.width / 2 : 0);
    let start = anchorX;
    if (align === 'center') start -= total / 2;
    else if (align === 'right' || align === 'end') start -= total;
    const y = finite(o.y) ? o.y : (api && api.H ? api.H / 2 : ctx.canvas ? ctx.canvas.height / 2 : 0);
    let cursor = start;

    ctx.save();
    setFont(ctx, font);
    ctx.textAlign = 'center';
    ctx.textBaseline = baseline;
    if (finite(o.alpha)) ctx.globalAlpha *= clamp01(o.alpha);
    // 逐字变换会让相邻字的真实框在弹入阶段互相压住；逐字绘制不进回执，
    // 末了按整行锚点记一条，QA 看到的是最终版位，而不是动画中间态。
    const prevInternal = ctx.__ttTextInternal;
    ctx.__ttTextInternal = true;
    for (let i = 0; i < chars.length; i += 1) {
      const ch = chars[i];
      const width = widths[i];
      const p = clamp01((t - i * gap) / dur);
      if (p <= 0) {
        cursor += width + (i < chars.length - 1 ? tracking : 0);
        continue;
      }
      const e = o.ease === 'back' ? TT.ease.back(num(o.back, 1.9))(p) : easeOf(o.ease, p);
      const scale = fromScale + (1 - fromScale) * e;
      let dx = 0;
      let dy = 0;
      if (direction === 'up') dy = fromOffset * (1 - e);
      else if (direction === 'down') dy = -fromOffset * (1 - e);
      else if (direction === 'left') dx = fromOffset * (1 - e);
      else if (direction === 'right') dx = -fromOffset * (1 - e);
      const jitter = num(o.jitter, 0);
      if (jitter > 0) {
        dx += (hash(i, seed) - 0.5) * jitter * 2;
        dy += (hash(i + 11, seed) - 0.5) * jitter * 2;
      }
      const rotate = num(o.rotate, 0);
      const spin = rotate * (1 - e) * ((i % 2) ? -1 : 1);
      ctx.save();
      ctx.globalAlpha *= Math.min(1, p * 2.4);
      ctx.translate(cursor + width / 2 + dx, y + dy);
      ctx.rotate(spin);
      ctx.scale(scale, scale);
      ctx.fillStyle = colors ? colorOf(colors[i % colors.length], baseColor) : baseColor;
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      cursor += width + (i < chars.length - 1 ? tracking : 0);
    }
    ctx.__ttTextInternal = prevInternal;
    ctx.restore();

    ctx.save();
    setFont(ctx, font);
    ctx.textAlign = align === 'left' ? 'left' : align === 'right' || align === 'end' ? 'right' : 'center';
    ctx.textBaseline = baseline;
    if (finite(o.alpha)) ctx.globalAlpha *= clamp01(o.alpha);
    TT.text.record(ctx, text, anchorX, y);
    ctx.restore();
    return { x: start, y: y - font.ascent, w: total, h: font.ascent + font.descent };
  }

  /**
   * 取图像平均亮度，返回与其对比更强的底色：亮图配深底、暗图配浅底。
   * 图像填字场先调用它，再铺满整帧，避免底色与字窗里的图亮度接近。
   */
  function contrastColor(api, image, o = {}) {
    const light = colorOf(o.light, '#FFFFFF');
    const dark = colorOf(o.dark, '#0A0A0A');
    const threshold = num(o.threshold, 0.55);
    const source = resolveMedia(api, image);
    if (!source || !api || typeof api.canvas !== 'function') return dark;
    try {
      const probe = api.canvas(16, 9);
      probe.ctx.drawImage(source, 0, 0, 16, 9);
      const data = probe.ctx.getImageData(0, 0, 16, 9).data;
      let sum = 0;
      let weight = 0;
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3] / 255;
        if (a <= 0) continue;
        sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255 * a;
        weight += a;
      }
      const lum = weight > 0 ? sum / weight : 0.5;
      const preferLight = o.invert ? lum > threshold : lum <= threshold;
      return preferLight ? light : dark;
    } catch {
      return dark;
    }
  }

  /**
   * 图像 / 棋盘 / 半调 / 纯色填字，可选多层字。文字在离屏画布里合成，主画布只 blit
   * 一次并记一条文字回执；`layers` 里的装饰层不会进入 text-text 碰撞。
   */
  function mask(ctx, api, o = {}) {
    if (!ctx || !api || typeof api.canvas !== 'function') return null;
    const text = str(o.text);
    if (!text) return null;
    const size = Math.max(8, num(o.size, 240));
    const font = fontOf(o, size, o.role || 'display');
    const align = o.align || 'center';
    const baseline = o.baseline || 'middle';
    const tracking = num(o.tracking, 0);
    const width = textWidth(ctx, text, font, tracking);
    const pad = Math.max(12, num(o.pad, size * 0.18));
    const w = Math.ceil(width + pad * 2);
    const h = Math.ceil(font.ascent + font.descent + pad * 2);
    const ax = align === 'left' ? pad : align === 'right' || align === 'end' ? w - pad : w / 2;
    const ay = baseline === 'alphabetic' ? pad + font.ascent : h / 2;
    const x = finite(o.x) ? o.x : (api.W ? api.W / 2 : 0);
    const y = finite(o.y) ? o.y : (api.H ? api.H / 2 : 0);
    const rotate = num(o.rotate, 0);
    const skewX = num(o.skewX, 0);
    const skewY = num(o.skewY, 0);
    const scaleX = num(o.scaleX, 1);
    const scaleY = num(o.scaleY, 1);
    const layers = Array.isArray(o.layers) ? o.layers : [];
    const alpha = finite(o.alpha) ? clamp01(o.alpha) : 1;
    const p = progressOf(o, 1);
    const reveal = o.reveal == null ? 1 : clamp01(Number(o.reveal));
    const revealDir = o.revealDir || 'l';

    const applySpace = (c, anchorX, anchorY) => {
      c.translate(anchorX, anchorY);
      if (rotate) c.rotate(rotate);
      if (skewX || skewY) c.transform(1, skewY, skewX, 1, 0, 0);
      if (scaleX !== 1 || scaleY !== 1) c.scale(scaleX, scaleY);
      c.translate(-anchorX, -anchorY);
    };

    ctx.save();
    setFont(ctx, font);
    const keyCtx = ctx;
    keyCtx.textAlign = align === 'left' ? 'left' : align === 'right' || align === 'end' ? 'right' : 'center';
    keyCtx.textBaseline = baseline;
    applySpace(keyCtx, x, y);
    TT.text.record(keyCtx, text, x, y);
    ctx.restore();

    const out = api.canvas(w, h);
    if (layers.length) {
      out.ctx.save();
      applySpace(out.ctx, ax, ay);
      setFont(out.ctx, font);
      out.ctx.textAlign = align === 'left' ? 'left' : align === 'right' || align === 'end' ? 'right' : 'center';
      out.ctx.textBaseline = baseline;
      for (let i = layers.length - 1; i >= 0; i -= 1) {
        const layer = layers[i] || {};
        const dx = num(layer.dx, (i + 1) * size * 0.025);
        const dy = num(layer.dy, (i + 1) * size * 0.025);
        out.ctx.fillStyle = colorOf(layer.color, paletteColor(i + 1));
        out.ctx.fillText(text, ax + dx, ay + dy);
      }
      out.ctx.restore();
    }

    const fill = api.canvas(w, h);
    const fillCtx = fill.ctx;
    // 没有给 fill 时默认纯色，不要默认棋盘：棋盘只在明确要“图案填字”时出现。
    const fillKind = o.fill === 'image' ? 'image' : o.fill || (o.image ? 'image' : 'color');
    if (fillKind === 'image') {
      const source = resolveMedia(api, o.image);
      const rect = { x: 0, y: 0, w, h };
      const fit = o.fit || 'cover';
      const zoom = num(o.zoom, 1);
      let focus = o.focus;
      // 字窗里的图默认静止。`drift` 是像素/秒：负 x 向左、负 y 向上；
      // 通过移动 cover 裁切中心实现，不把图平移出画布，所以边缘不会露底。
      const drift = Array.isArray(o.drift) ? o.drift : null;
      if (drift && source) {
        const size = sourceSize(source);
        if (size.w > 0 && size.h > 0) {
          const scale = (fit === 'contain' ? Math.min(w / size.w, h / size.h) : Math.max(w / size.w, h / size.h)) * zoom;
          const overX = Math.max(0, size.w * scale - w);
          const overY = Math.max(0, size.h * scale - h);
          const base = pointOf(o.focus, [0.5, 0.5]);
          const time = num(o.t, num(api && api.t, 0));
          const dx = num(Number(drift[0]), 0);
          const dy = num(Number(drift[1]), 0);
          focus = [
            clamp01(base[0] - (overX > 0 ? dx * time / overX : 0)),
            clamp01(base[1] - (overY > 0 ? dy * time / overY : 0)),
          ];
        }
      }
      const drawn = drawFitted(fillCtx, source, rect, { fit, focus, zoom });
      if (!drawn) {
        fillCtx.fillStyle = colorOf(o.colorA, accentColor());
        fillCtx.fillRect(0, 0, w, h);
      }
    } else if (fillKind === 'checker') {
      pattern(fillCtx, {
        kind: 'checker', rect: { x: 0, y: 0, w, h },
        colorA: o.colorA, colorB: o.colorB, cell: o.cell, angle: o.angle,
      });
    } else if (fillKind === 'halftone') {
      pattern(fillCtx, {
        kind: 'halftone', rect: { x: 0, y: 0, w, h },
        colorA: o.colorA, colorB: o.colorB, cell: o.cell, dot: o.dot, angle: o.angle,
      });
    } else {
      fillCtx.fillStyle = colorOf(o.colorA, colorOf(o.color, accentColor()));
      fillCtx.fillRect(0, 0, w, h);
    }

    // 旧组件的 mask 是 fill + stroke 一起当字形：stroke 不是可见描边，而是把字口加粗、
    // 把外角磨圆。默认按字号 3% 加粗（320px 字约 10px），可用 weight 覆盖。
    const weight = finite(o.weight) ? Math.max(0, o.weight) : size * 0.03;
    const glyph = api.canvas(w, h);
    const glyphCtx = glyph.ctx;
    glyphCtx.save();
    applySpace(glyphCtx, ax, ay);
    setFont(glyphCtx, font);
    glyphCtx.textAlign = align === 'left' ? 'left' : align === 'right' || align === 'end' ? 'right' : 'center';
    glyphCtx.textBaseline = baseline;
    glyphCtx.fillStyle = '#FFFFFF';
    glyphCtx.fillText(text, ax, ay);
    if (weight > 0) {
      glyphCtx.strokeStyle = '#FFFFFF';
      glyphCtx.lineWidth = weight;
      glyphCtx.lineJoin = 'round';
      glyphCtx.miterLimit = 2;
      glyphCtx.strokeText(text, ax, ay);
    }
    glyphCtx.restore();

    fillCtx.save();
    fillCtx.globalCompositeOperation = 'destination-in';
    fillCtx.drawImage(glyph.canvas, 0, 0);
    fillCtx.restore();

    if (layers.length) {
      out.ctx.save();
      out.ctx.globalCompositeOperation = 'source-over';
      out.ctx.drawImage(fill.canvas, 0, 0, w, h);
      out.ctx.restore();
    } else {
      out.ctx.clearRect(0, 0, w, h);
      out.ctx.drawImage(fill.canvas, 0, 0, w, h);
    }

    const drawX = x - ax;
    const drawY = y - ay;
    ctx.save();
    ctx.globalAlpha *= alpha * p;
    if (reveal < 1) {
      const rw = revealDir === 'u' || revealDir === 'd' ? w : w * reveal;
      const rh = revealDir === 'l' || revealDir === 'r' ? h : h * reveal;
      const rx = revealDir === 'r' ? drawX + w - rw : drawX;
      const ry = revealDir === 'd' ? drawY + h - rh : drawY;
      ctx.beginPath();
      ctx.rect(rx, ry, rw, rh);
      ctx.clip();
    }
    out.blit(ctx, drawX, drawY);
    ctx.restore();
    return { x: drawX, y: drawY, w, h };
  }

  /** 拉伸字 + 速度线。`p` 从 0 到 1 时，字从拉伸状态回正并横向进场。 */
  function stretch(ctx, api, o = {}) {
    if (!ctx) return null;
    const text = str(o.text);
    if (!text) return null;
    const size = Math.max(8, num(o.size, 320));
    const font = fontOf(o, size, o.role || 'display');
    const x = finite(o.x) ? o.x : (api && api.W ? api.W / 2 : 0);
    const y = finite(o.y) ? o.y : (api && api.H ? api.H / 2 : 0);
    const t = num(o.t, num(api && api.t, 0));
    const dur = Math.max(0.001, num(o.dur, 0.34));
    const p = easeOf(o.ease, clamp01(t / dur));
    const skew = num(o.skew, -0.18);
    const scaleY = num(o.scaleY, 0.72);
    const offset = num(o.offset, -160);
    const color = colorOf(o.color, inkColor());
    const speed = num(o.speed, o.speedLines === false ? 0 : 1);

    if (speed > 0) {
      speedLines(ctx, {
        rect: { x: 0, y: y - size * 0.7, w: api && api.W ? api.W : ctx.canvas.width, h: size * 1.4 },
        count: Math.max(3, Math.floor(num(o.lineCount, 14))),
        color: colorOf(o.lineColor, accentColor()),
        alpha: 0.35 * speed, seed: num(o.seed, 0), length: num(o.lineLength, 0.55),
      });
    }
    ctx.save();
    if (finite(o.alpha)) ctx.globalAlpha *= clamp01(o.alpha);
    ctx.translate(x, y);
    ctx.transform(1, 0, skew, 1, 0, 0);
    ctx.scale(1, scaleY);
    ctx.globalAlpha *= clamp01(p * 1.6);
    setFont(ctx, font);
    ctx.fillStyle = color;
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = o.baseline || 'middle';
    ctx.fillText(text, (1 - p) * offset, 0);
    ctx.restore();
    return true;
  }

  /** 速度线：水平短促线，长度、位置、透明度都由 seed 决定。 */
  function speedLines(ctx, o = {}) {
    if (!ctx) return;
    const rect = rectOf(o.rect, { x: 0, y: 0, w: ctx.canvas ? ctx.canvas.width : 0, h: ctx.canvas ? ctx.canvas.height : 0 });
    const count = Math.max(0, Math.min(80, Math.floor(num(o.count, 16))));
    const color = colorOf(o.color, accentColor());
    const alpha = finite(o.alpha) ? clamp01(o.alpha) : 0.35;
    const seed = num(o.seed, 0);
    const length = clamp(num(o.length, 0.55), 0.02, 1);
    const width = Math.max(1, num(o.width, 3));
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    for (let i = 0; i < count; i += 1) {
      const yy = rect.y + (i + 0.5) * rect.h / count + (hash(i, seed) - 0.5) * rect.h / count * 0.6;
      const len = rect.w * (0.08 + hash(i + 7, seed) * length);
      const xx = rect.x + (rect.w - len) * hash(i + 17, seed);
      ctx.beginPath();
      ctx.moveTo(xx, yy);
      ctx.lineTo(xx + len, yy);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** 棋盘 / 半调 / 斜条 / 扫描线 / 网格。只画场，不画字。 */
  function pattern(ctx, o = {}) {
    if (!ctx) return;
    const rect = rectOf(o.rect, { x: 0, y: 0, w: ctx.canvas ? ctx.canvas.width : 0, h: ctx.canvas ? ctx.canvas.height : 0 });
    const kind = o.kind || 'checker';
    const colorA = colorOf(o.colorA, bgColor());
    const colorB = colorOf(o.colorB, accentColor());
    const cell = Math.max(4, num(o.cell, 64));
    const alpha = finite(o.alpha) ? clamp01(o.alpha) : 1;
    ctx.save();
    ctx.globalAlpha *= alpha;
    if (finite(o.angle) && o.angle !== 0) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate(o.angle);
      ctx.translate(-(rect.x + rect.w / 2), -(rect.y + rect.h / 2));
    }
    if (kind === 'checker') {
      ctx.fillStyle = colorA;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = colorB;
      const cols = Math.ceil(rect.w / cell);
      const rows = Math.ceil(rect.h / cell);
      for (let r = 0; r < rows; r += 1) {
        for (let c = (r % 2); c < cols; c += 2) {
          ctx.fillRect(rect.x + c * cell, rect.y + r * cell, cell, cell);
        }
      }
    } else if (kind === 'halftone') {
      ctx.fillStyle = colorB;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = colorA;
      const step = Math.max(6, num(o.dotGap, cell));
      const cols = Math.ceil(rect.w / step);
      const rows = Math.ceil(rect.h / step);
      const maxDot = Math.max(1, num(o.dot, step * 0.46));
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const radius = maxDot * (0.18 + 0.82 * hash(r * cols + c, num(o.seed, 0)));
          ctx.beginPath();
          ctx.arc(rect.x + (c + 0.5) * step, rect.y + (r + 0.5) * step, radius, 0, TAU);
          ctx.fill();
        }
      }
    } else if (kind === 'stripes') {
      ctx.fillStyle = colorA;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = colorB;
      ctx.lineWidth = Math.max(1, num(o.width, cell * 0.22));
      const gap = Math.max(4, num(o.gap, cell));
      const diagonal = Math.hypot(rect.w, rect.h);
      const count = Math.ceil(diagonal / gap) + 2;
      ctx.beginPath();
      for (let i = -1; i < count; i += 1) {
        const x0 = rect.x + i * gap;
        ctx.moveTo(x0, rect.y);
        ctx.lineTo(x0 + diagonal, rect.y + diagonal);
      }
      ctx.stroke();
    } else if (kind === 'scan') {
      ctx.fillStyle = colorA;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = colorB;
      const gap = Math.max(2, num(o.gap, 6));
      for (let y = rect.y; y < rect.y + rect.h; y += gap) {
        ctx.fillRect(rect.x, y, rect.w, Math.max(1, gap * 0.38));
      }
    } else {
      ctx.fillStyle = colorB;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = colorA;
      ctx.lineWidth = Math.max(1, num(o.width, 2));
      const gap = Math.max(8, num(o.gap, cell));
      ctx.beginPath();
      for (let x = rect.x; x <= rect.x + rect.w; x += gap) {
        ctx.moveTo(x, rect.y);
        ctx.lineTo(x, rect.y + rect.h);
      }
      for (let y = rect.y; y <= rect.y + rect.h; y += gap) {
        ctx.moveTo(rect.x, y);
        ctx.lineTo(rect.x + rect.w, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /** 跨镜承接：色块铺屏 / 下一镜从同色揭开 / 残留圆。 */
  function carry(ctx, o = {}) {
    if (!ctx) return;
    const w = num(o.W, ctx.canvas ? ctx.canvas.width : 0);
    const h = num(o.H, ctx.canvas ? ctx.canvas.height : 0);
    if (!(w > 0 && h > 0)) return;
    const mode = o.mode || 'out';
    const color = colorOf(o.color, accentColor());
    const p = easeOf(o.ease, progressOf(o, 1));
    const origin = pointOf(o.origin, [0.5, 0.5]);
    const ox = origin[0] * w;
    const oy = origin[1] * h;
    const maxR = Math.hypot(Math.max(ox, w - ox), Math.max(oy, h - oy));
    ctx.save();
    ctx.fillStyle = color;
    if (mode === 'out') {
      if (o.shape === 'rect') {
        const rw = w * p;
        const rh = h * p;
        ctx.fillRect(ox - rw * origin[0], oy - rh * origin[1], rw, rh);
      } else {
        ctx.beginPath();
        ctx.arc(ox, oy, maxR * p, 0, TAU);
        ctx.fill();
      }
    } else if (mode === 'residual') {
      const r = maxR * (1 - p);
      ctx.beginPath();
      ctx.arc(ox, oy, r, 0, TAU);
      ctx.fill();
    } else {
      const r = maxR * p;
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.arc(ox, oy, r, 0, TAU, true);
      ctx.fill('evenodd');
    }
    ctx.restore();
  }

  const COLLAGE = [
    [0.00, 0.00, 0.42, 0.58],
    [0.44, 0.00, 0.56, 0.34],
    [0.44, 0.36, 0.26, 0.28],
    [0.72, 0.36, 0.28, 0.28],
    [0.00, 0.60, 0.28, 0.40],
    [0.30, 0.60, 0.70, 0.40],
  ];

  // 旧四格卡片的比例：左高图 / 右上两小卡 / 右下宽字卡，40px 缝。
  const QUAD = [
    [0.00, 0.000, 0.44, 1.000],
    [0.46, 0.000, 0.25, 0.478],
    [0.73, 0.000, 0.27, 0.478],
    [0.46, 0.522, 0.54, 0.478],
  ];

  /** 网格 / 卡片墙 / 拼贴 / 斜版。cell 可带 image / video / color / text / label。 */
  function panelRects(box, layout, cells, cols, rows, gap) {
    const preset = layout === 'quad' ? QUAD : layout === 'collage' ? COLLAGE : null;
    const cellsToDraw = preset && !cells.length
      ? preset.map(([x, y, w, h]) => ({ x, y, w, h }))
      : cells;
    const count = preset ? Math.max(cellsToDraw.length, preset.length) : cols * rows;
    const cellRects = [];
    for (let i = 0; i < count; i += 1) {
      const cell = cellsToDraw[i] || null;
      if (cell && finite(cell.x) && finite(cell.y) && finite(cell.w) && finite(cell.h)) {
        cellRects.push({
          x: box.x + cell.x * box.w,
          y: box.y + cell.y * box.h,
          w: cell.w * box.w,
          h: cell.h * box.h,
        });
      } else if (preset) {
        const [x, y, w, h] = preset[i % preset.length];
        cellRects.push({ x: box.x + x * box.w, y: box.y + y * box.h, w: w * box.w, h: h * box.h });
      } else {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cw = (box.w - gap * (cols - 1)) / cols;
        const ch = (box.h - gap * (rows - 1)) / rows;
        cellRects.push({
          x: box.x + col * (cw + gap),
          y: box.y + row * (ch + gap),
          w: cw,
          h: ch,
        });
      }
    }
    return { rects: cellRects, cellsToDraw };
  }

  function panels(ctx, api, o = {}) {
    if (!ctx || !api) return;
    const box = rectOf(o.rect, { x: 0, y: 0, w: api.W || 0, h: api.H || 0 });
    const layout = o.layout || 'grid';
    const gap = Math.max(0, num(o.gap, 20));
    const radius = Math.max(0, num(o.radius, 22));
    const slant = num(o.slant, 0);
    const cells = Array.isArray(o.cells) ? o.cells : [];
    const cols = Math.max(1, Math.floor(num(o.cols, 3)));
    const rows = Math.max(1, Math.floor(num(o.rows, 1)));
    const t = finite(o.t) ? o.t : Infinity;
    const dur = Math.max(0.001, num(o.dur, 0.36));
    const stagger = num(o.stagger, 0.06);
    const baseAlpha = finite(o.alpha) ? clamp01(o.alpha) : 1;
    const fill = colorOf(o.fill, mutedColor());
    // 旧卡片没有描边；蓝色边框会让整面变得像 UI 控件，所以只在显式要边框时画。
    const border = o.border === true ? colorOf(o.borderColor, lineColor()) : null;
    const borderWidth = Math.max(0, num(o.borderWidth, 2));
    const { rects: cellRects, cellsToDraw } = panelRects(box, layout, cells, cols, rows, gap);

    ctx.save();
    if (slant) {
      ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
      ctx.transform(1, 0, slant, 1, 0, 0);
      ctx.translate(-(box.x + box.w / 2), -(box.y + box.h / 2));
    }
    for (let i = 0; i < cellRects.length; i += 1) {
      const cellRect = cellRects[i];
      const cell = cellsToDraw[i] || {};
      const p = clamp01((t - i * stagger) / dur);
      if (p <= 0) continue;
      const e = easeOf(o.ease, p);
      // 快切里格子要“砸”进来，不要长时间半透明；否则白底上会出现单帧亮度尖峰。
      const alpha = baseAlpha * Math.min(1, p * 3.4);
      // 每格可以自带 from：双向格子墙让图片从左边、文字从右边各走各的，
      // 不必整面同向滑入。`from:'alternate'` 是横向左右交替的快捷写法。
      const from = cell.from || (o.from === 'alternate'
        ? (i % 2 ? 'right' : 'left')
        : o.from === 'alternateY' ? (i % 2 ? 'top' : 'bottom') : o.from) || 'bottom';
      let dx = 0;
      let dy = 0;
      const offset = num(cell.offset, num(o.offset, 34));
      if (from === 'bottom') dy = offset * (1 - e);
      else if (from === 'top') dy = -offset * (1 - e);
      else if (from === 'left') dx = offset * (1 - e);
      else if (from === 'right') dx = -offset * (1 - e);
      const scale = (num(o.fromScale, 0.92) + (1 - num(o.fromScale, 0.92)) * e);
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.translate(cellRect.x + cellRect.w / 2 + dx, cellRect.y + cellRect.h / 2 + dy);
      ctx.scale(scale, scale);
      ctx.translate(-(cellRect.x + cellRect.w / 2), -(cellRect.y + cellRect.h / 2));
      ctx.beginPath();
      roundRect(ctx, cellRect.x, cellRect.y, cellRect.w, cellRect.h, radius);
      ctx.clip();

      const cellFill = colorOf(cell.color, colorOf(o.fill, paletteColor(i)));
      ctx.fillStyle = cellFill || fill;
      ctx.fillRect(cellRect.x, cellRect.y, cellRect.w, cellRect.h);
      const media = resolveCellMedia(api, cell);
      if (media) {
        drawFitted(ctx, media, cellRect, {
          fit: cell.fit || 'cover', focus: cell.focus, zoom: cell.zoom,
        });
      }
      if (cell.tint) {
        ctx.save();
        ctx.globalAlpha *= num(cell.tintAlpha, 0.45);
        ctx.fillStyle = colorOf(cell.tint, accentColor());
        ctx.fillRect(cellRect.x, cellRect.y, cellRect.w, cellRect.h);
        ctx.restore();
      }
      if (cell.text) {
        const textSize = Math.max(10, num(cell.textSize, Math.min(cellRect.h * 0.24, 96)));
        const textOpts = {
          color: colorOf(cell.textColor, inkColor()),
          align: cell.align || 'center',
          baseline: 'middle',
          role: cell.role || 'display',
        };
        const tx = cellRect.x + cellRect.w / 2;
        const ty = cellRect.y + cellRect.h / 2;
        if (o.textInternal) drawRawText(ctx, cell.text, tx, ty, textSize, textOpts);
        else TT.text(ctx, cell.text, tx, ty, textSize, textOpts);
      }
      if (cell.label) {
        const labelSize = Math.max(9, num(cell.labelSize, Math.min(cellRect.h * 0.08, 28)));
        const labelOpts = {
          color: colorOf(cell.labelColor, mutedColor()),
          align: 'left',
          baseline: 'alphabetic',
          role: 'num',
        };
        const lx = cellRect.x + 14;
        const ly = cellRect.y + 14 + labelSize * 0.8;
        if (o.textInternal) drawRawText(ctx, cell.label, lx, ly, labelSize, labelOpts);
        else TT.text(ctx, cell.label, lx, ly, labelSize, labelOpts);
      }
      ctx.restore();
      if (border && borderWidth > 0) {
        ctx.save();
        ctx.globalAlpha *= alpha;
        ctx.strokeStyle = border;
        ctx.lineWidth = borderWidth;
        ctx.beginPath();
        roundRect(ctx, cellRect.x, cellRect.y, cellRect.w, cellRect.h, radius);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
    return { rects: cellRects };
  }

  /**
   * 内容卡片墙的焦点巡览：相机贴着三张卡做三角移动，最后拉远到整面全景。
   * 卡片本身仍由 `panels` 画，这里只生成一个以卡片中心为关键帧的镜头。
   * 镜头运动中的卡片文字是构图纹理，不逐条记回执；正文请放在镜头外或用 micro。
   */
  function tour(ctx, api, o = {}) {
    if (!ctx || !api) return null;
    const box = rectOf(o.rect, { x: 0, y: 0, w: api.W || 0, h: api.H || 0 });
    const layout = o.layout || 'quad';
    const gap = Math.max(0, num(o.gap, 20));
    const cells = Array.isArray(o.cells) ? o.cells : [];
    const cols = Math.max(1, Math.floor(num(o.cols, 3)));
    const rows = Math.max(1, Math.floor(num(o.rows, 1)));
    const { rects } = panelRects(box, layout, cells, cols, rows, gap);
    const spec = o.tour && typeof o.tour === 'object' ? o.tour : {};
    const points = Array.isArray(spec.points) && spec.points.length ? spec.points : [0, 1, 2];
    const closeZoom = Math.max(1, num(spec.zoom, 1.7));
    const farZoom = Math.max(1, num(spec.finalZoom, 1));
    const targets = [];
    for (const point of points) {
      if (Array.isArray(point) && point.length >= 2) {
        targets.push({
          x: num(Number(point[0]), box.x + box.w / 2),
          y: num(Number(point[1]), box.y + box.h / 2),
          zoom: Math.max(1, num(Number(point[2]), closeZoom)),
        });
      } else {
        const index = Math.floor(num(Number(point), 0));
        const rect = rects[((index % rects.length) + rects.length) % rects.length];
        if (rect) targets.push({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, zoom: closeZoom });
      }
    }
    targets.push({ x: box.x + box.w / 2, y: box.y + box.h / 2, zoom: farZoom });
    if (!targets.length) return null;
    const total = Math.max(0.001, num(spec.dur, num(o.dur, num(api.d, 1))));
    const t = num(o.t, num(api.t, 0));
    const segCount = Math.max(1, targets.length - 1);
    const seg = clamp(t / total, 0, 1) * segCount;
    const index = Math.min(segCount - 1, Math.floor(seg));
    const e = easeOf(spec.ease || 'inOutCubic', clamp01(seg - index));
    const a = targets[index];
    const b = targets[index + 1] || a;
    const cam = {
      x: a.x + (b.x - a.x) * e,
      y: a.y + (b.y - a.y) * e,
      zoom: a.zoom + (b.zoom - a.zoom) * e,
    };

    ctx.save();
    ctx.translate(api.W / 2, api.H / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);
    const prevInternal = ctx.__ttTextInternal;
    ctx.__ttTextInternal = true;
    panels(ctx, api, {
      ...o,
      layout,
      rect: box,
      gap,
      t: finite(o.cellT) ? o.cellT : Infinity,
      textInternal: true,
      tour: undefined,
    });
    ctx.__ttTextInternal = prevInternal;
    ctx.restore();
    return { x: cam.x, y: cam.y, zoom: cam.zoom, rects };
  }

  /**
   * 数据卡。默认 columns：卡片底 + 标题 + 四根竖柱，最后一根用 accent，
   * 这是旧组件的画法；layout:'rows' 才画横向进度条。
   */
  function bars(ctx, o = {}) {
    if (!ctx) return;
    const rect = rectOf(o.rect, { x: 0, y: 0, w: ctx.canvas ? ctx.canvas.width : 0, h: ctx.canvas ? ctx.canvas.height : 0 });
    const rows = Array.isArray(o.rows) ? o.rows : [];
    if (!rows.length) return;
    const layout = o.layout === 'rows' ? 'rows' : 'columns';
    const t = finite(o.t) ? o.t : Infinity;
    const dur = Math.max(0.001, num(o.dur, 0.42));
    const stagger = num(o.stagger, 0.08);
    const radius = Math.max(0, num(o.radius, 22));
    const cardColor = o.card === false ? null : colorOf(o.cardColor, inkColor());
    const onCard = cardColor ? readableOn(cardColor) : inkColor();
    const pad = Math.max(12, num(o.pad, Math.min(rect.w, rect.h) * 0.06));

    if (cardColor) {
      ctx.save();
      ctx.fillStyle = cardColor;
      ctx.beginPath();
      roundRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
      ctx.fill();
      ctx.restore();
    }

    const label = str(o.label);
    const labelSize = Math.max(8, num(o.labelSize, Math.min(42, rect.w * 0.085)));
    if (label) {
      TT.text(ctx, label, rect.x + pad, rect.y + pad + labelSize / 2, labelSize, {
        color: colorOf(o.labelColor, onCard), align: 'left', baseline: 'middle', role: 'body',
      });
    }

    const maxValue = Math.max(1, num(o.max, Math.max(...rows.map((row) => num(row.max, num(row.value, 0))))));

    if (layout === 'rows') {
      const rowGap = num(o.gap, rect.h / (rows.length + 1));
      const barH = Math.max(4, num(o.barH, Math.min(rowGap * 0.42, 42)));
      const labelColor = colorOf(o.labelColor, onCard);
      const valueColor = colorOf(o.valueColor, accentColor());
      const trackColor = colorOf(o.trackColor, mutedColor());
      const valueSize = Math.max(8, num(o.valueSize, Math.min(barH * 0.72, 24)));
      const labelW = Math.max(0, num(o.labelW, rect.w * 0.26));
      const trackX = rect.x + pad + labelW + 12;
      const trackW = Math.max(1, rect.w - pad * 2 - labelW - 12);
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i] || {};
        const p = easeOf(o.ease, clamp01((t - i * stagger) / dur));
        const y = rect.y + pad + i * rowGap;
        const value = Math.max(0, num(row.value, 0));
        const ratio = clamp01(value / Math.max(1, num(row.max, maxValue)));
        TT.text(ctx, str(row.label), rect.x + pad, y + barH / 2, labelSize, {
          color: labelColor, align: 'left', baseline: 'middle', role: 'body',
        });
        ctx.save();
        ctx.fillStyle = trackColor;
        ctx.globalAlpha *= 0.28;
        ctx.fillRect(trackX, y, trackW, barH);
        ctx.restore();
        ctx.save();
        ctx.fillStyle = colorOf(row.color, i === rows.length - 1 ? accentColor() : onCard);
        ctx.fillRect(trackX, y, trackW * ratio * p, barH);
        ctx.restore();
        TT.text(ctx, str(row.valueText == null ? TT.num.fmt(value, num(row.digits, 0)) : row.valueText), trackX + trackW, y + barH / 2, valueSize, {
          color: valueColor, align: 'right', baseline: 'middle', role: 'num',
        });
      }
    } else {
      const barGap = Math.max(4, num(o.gap, 26));
      const innerW = Math.max(1, rect.w - pad * 2);
      let barW = Math.max(6, num(o.barW, Math.min(72, (innerW - barGap * (rows.length - 1)) * 0.6 / rows.length)));
      const totalW = barW * rows.length + barGap * (rows.length - 1);
      if (totalW > innerW) barW = Math.max(4, (innerW - barGap * (rows.length - 1)) / rows.length);
      const startX = rect.x + pad;
      const top = rect.y + pad + (label ? labelSize * 1.8 : 0);
      const bottom = rect.y + rect.h - pad;
      const areaH = Math.max(12, bottom - top);
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i] || {};
        const p = easeOf(o.ease, clamp01((t - i * stagger) / dur));
        const value = Math.max(0, num(row.value, 0));
        const ratio = clamp01(value / Math.max(1, num(row.max, maxValue)));
        const hh = areaH * ratio * p;
        ctx.save();
        ctx.fillStyle = colorOf(row.color, i === rows.length - 1 ? accentColor() : onCard);
        ctx.fillRect(startX + i * (barW + barGap), bottom - hh, barW, hh);
        ctx.restore();
      }
    }

    if (o.big && str(o.big.text)) {
      TT.text(ctx, str(o.big.text), num(o.big.x, rect.x + pad), num(o.big.y, rect.y - 10), num(o.big.size, 220), {
        color: colorOf(o.big.color, cardColor ? readableOn(cardColor) : inkColor()),
        align: o.big.align || 'left',
        baseline: o.big.baseline || 'alphabetic',
        role: o.big.role || 'display',
      });
    }
  }

  /** 波形条：位置、振幅、相位都是 i / seed / t 的纯函数。 */
  function wave(ctx, o = {}) {
    if (!ctx) return;
    const rect = rectOf(o.rect, { x: 0, y: 0, w: ctx.canvas ? ctx.canvas.width : 0, h: ctx.canvas ? ctx.canvas.height : 0 });
    const count = Math.max(1, Math.min(160, Math.floor(num(o.count, 42))));
    const gap = Math.max(1, num(o.gap, rect.w / count));
    const barW = Math.max(1, num(o.barW, gap * 0.56));
    const amp = Math.max(0, num(o.amplitude, rect.h * 0.42));
    const color = colorOf(o.color, inkColor());
    const seed = num(o.seed, 0);
    const speed = num(o.speed, 1.2);
    const t = num(o.t, 0);
    const baseline = num(o.baseline, rect.y + rect.h / 2);
    const alpha = finite(o.alpha) ? clamp01(o.alpha) : 1;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = color;
    for (let i = 0; i < count; i += 1) {
      const phase = i * 0.42 + t * speed * TAU + hash(i, seed) * TAU;
      const env = 0.35 + 0.65 * hash(i + 13, seed);
      const hh = amp * env * (0.18 + 0.82 * Math.abs(Math.sin(phase)));
      const x = rect.x + i * gap;
      if (o.mirror === false) {
        ctx.fillRect(x, baseline - hh, barW, hh);
      } else {
        ctx.fillRect(x, baseline - hh, barW, hh);
        ctx.fillRect(x, baseline, barW, hh * 0.72);
      }
    }
    ctx.restore();
  }

  /** 多层文字视差：每行字按自己的 `dx / dy`（每秒位移）平移，远近感靠速度差。 */
  function layers(ctx, api, o = {}) {
    if (!ctx) return;
    const lines = Array.isArray(o.lines) ? o.lines : [];
    const t = num(o.t, num(api && api.t, 0));
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] || {};
      const dx = num(line.dx, 0) * t + num(line.offset, 0);
      const dy = num(line.dy, 0) * t;
      TT.text(ctx, str(line.text), num(line.x, api && api.W ? api.W / 2 : 0) + dx, num(line.y, 0) + dy, num(line.size, 120), {
        color: colorOf(line.color, paletteColor(i)),
        align: line.align || 'center',
        baseline: line.baseline || 'middle',
        role: line.role || 'display',
      });
    }
  }

  /** 图片出现：circle / iris / grid / bars。`progress` 优先，其次 t/dur。 */
  function reveal(ctx, api, o = {}) {
    if (!ctx || !api) return;
    const rect = rectOf(o.rect, { x: 0, y: 0, w: api.W || 0, h: api.H || 0 });
    const kind = o.kind || 'circle';
    const p = easeOf(o.ease, progressOf(o, 1));
    const media = resolveMedia(api, o.image);
    const fallback = colorOf(o.color, accentColor());
    const fit = o.fit || 'cover';
    const focus = pointOf(o.focus, [0.5, 0.5]);
    const zoom = num(o.zoom, 1);
    ctx.save();
    if (kind === 'circle' || kind === 'iris') {
      const radius = Math.min(rect.w, rect.h) * 0.5 * p;
      ctx.beginPath();
      ctx.arc(rect.x + rect.w / 2, rect.y + rect.h / 2, Math.max(0.01, radius), 0, TAU);
      ctx.clip();
      if (media) {
        drawFitted(ctx, media, rect, { fit, focus, zoom });
      } else {
        ctx.fillStyle = fallback;
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      }
      if (o.ring) {
        ctx.strokeStyle = colorOf(o.ringColor, inkColor());
        ctx.lineWidth = Math.max(1, num(o.ringWidth, 4));
        ctx.beginPath();
        ctx.arc(rect.x + rect.w / 2, rect.y + rect.h / 2, Math.max(0.01, radius), 0, TAU);
        ctx.stroke();
      }
    } else if (kind === 'grid') {
      const cols = Math.max(1, Math.floor(num(o.cols, 3)));
      const rows = Math.max(1, Math.floor(num(o.rows, 3)));
      const gap = Math.max(0, num(o.gap, 8));
      const cw = (rect.w - gap * (cols - 1)) / cols;
      const ch = (rect.h - gap * (rows - 1)) / rows;
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const i = r * cols + c;
          const cp = clamp01((p * (cols * rows) - i) / 1);
          if (cp <= 0) continue;
          const cell = {
            x: rect.x + c * (cw + gap), y: rect.y + r * (ch + gap),
            w: cw * cp, h: ch * cp,
          };
          if (media) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(cell.x, cell.y, cell.w, cell.h);
            ctx.clip();
            drawFitted(ctx, media, rect, { fit, focus, zoom });
            ctx.restore();
          }
        }
      }
    } else {
      const count = Math.max(1, Math.floor(num(o.count, 8)));
      const gap = Math.max(0, num(o.gap, 6));
      const bw = (rect.w - gap * (count - 1)) / count;
      for (let i = 0; i < count; i += 1) {
        const cp = clamp01((p * (count + 1) - i) / 1);
        if (cp <= 0) continue;
        const bx = rect.x + i * (bw + gap);
        ctx.save();
        ctx.beginPath();
        ctx.rect(bx, rect.y, bw * cp, rect.h);
        ctx.clip();
        if (media) drawFitted(ctx, media, rect, { fit, focus, zoom });
        else {
          ctx.fillStyle = fallback;
          ctx.fillRect(bx, rect.y, bw * cp, rect.h);
        }
        ctx.restore();
      }
    }
    ctx.restore();
  }

  /**
   * 格子焦点 → 原图铺屏：先用同一张图切成格子墙，选中一格放大到全幅；
   * 放大过程里从“该格切片”过渡到完整原图，单镜完成收尾。
   */
  function gridFocus(ctx, api, o = {}) {
    if (!ctx || !api) return null;
    const rect = rectOf(o.rect, { x: 0, y: 0, w: api.W || 0, h: api.H || 0 });
    const full = rectOf(o.full, rect);
    const cols = Math.max(1, Math.floor(num(o.cols, 4)));
    const rows = Math.max(1, Math.floor(num(o.rows, 3)));
    const gap = Math.max(0, num(o.gap, 10));
    const radius = Math.max(0, num(o.radius, 12));
    const p = progressOf(o, 1);
    const start = clamp(num(o.start, 0.42), 0, 0.98);
    const q = easeOf(o.ease || 'inOutCubic', p <= start ? 0 : (p - start) / (1 - start));
    const media = resolveMedia(api, o.image);
    const fallback = colorOf(o.color, accentColor());
    const focus = pointOf(o.focus, [0.5, 0.5]);
    const zoom = num(o.zoom, 1);
    const fit = o.fit || 'cover';
    const selected = clamp(Math.floor(num(o.focusCell, Math.floor(rows / 2) * cols + Math.floor(cols / 2))), 0, cols * rows - 1);
    const { rects } = panelRects(rect, 'grid', [], cols, rows, gap);
    const source = sourceSize(media);
    const hasSource = media && source.w > 0 && source.h > 0;
    ctx.save();
    for (let i = 0; i < rects.length; i += 1) {
      const cell = rects[i];
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, cell.x, cell.y, cell.w, cell.h, radius);
      ctx.clip();
      if (hasSource) {
        // 每格取原图对应区域，整面拼起来就是原图；放大时才换成完整原图。
        const sx = (cell.x - rect.x) / rect.w * source.w;
        const sy = (cell.y - rect.y) / rect.h * source.h;
        const sw = cell.w / rect.w * source.w;
        const sh = cell.h / rect.h * source.h;
        try {
          ctx.drawImage(media, sx, sy, sw, sh, cell.x, cell.y, cell.w, cell.h);
        } catch {
          ctx.fillStyle = fallback;
          ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
        }
      } else {
        ctx.fillStyle = fallback;
        ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
      }
      ctx.restore();
    }
    const cell = rects[selected];
    if (cell && q > 0) {
      const box = {
        x: cell.x + (full.x - cell.x) * q,
        y: cell.y + (full.y - cell.y) * q,
        w: cell.w + (full.w - cell.w) * q,
        h: cell.h + (full.h - cell.h) * q,
      };
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, box.x, box.y, box.w, box.h, radius * (1 - q));
      ctx.clip();
      if (hasSource) {
        const sx = (cell.x - rect.x) / rect.w * source.w;
        const sy = (cell.y - rect.y) / rect.h * source.h;
        const sw = cell.w / rect.w * source.w;
        const sh = cell.h / rect.h * source.h;
        try {
          ctx.drawImage(media, sx, sy, sw, sh, box.x, box.y, box.w, box.h);
        } catch {
          ctx.fillStyle = fallback;
          ctx.fillRect(box.x, box.y, box.w, box.h);
        }
        ctx.globalAlpha *= q;
        drawFitted(ctx, media, box, { fit, focus, zoom });
      } else {
        ctx.fillStyle = fallback;
        ctx.fillRect(box.x, box.y, box.w, box.h);
      }
      ctx.restore();
    }
    ctx.restore();
    return { rect: cell, q };
  }

  /** 故障切片：先快照当前帧，再按条带错位重画。必须放在本场内容之后调用。 */
  function glitch(ctx, api, o = {}) {
    if (!ctx || !api || typeof api.canvas !== 'function') return;
    const W = num(o.W, api.W || (ctx.canvas ? ctx.canvas.width : 0));
    const H = num(o.H, api.H || (ctx.canvas ? ctx.canvas.height : 0));
    if (!(W > 0 && H > 0)) return;
    const rect = rectOf(o.rect, { x: 0, y: 0, w: W, h: H });
    const count = Math.max(1, Math.min(40, Math.floor(num(o.count, 12))));
    const seed = num(o.seed, 0);
    const shift = num(o.shift, 28);
    const alpha = finite(o.alpha) ? clamp01(o.alpha) : 1;
    const off = api.canvas(W, H);
    try {
      off.ctx.drawImage(ctx.canvas, 0, 0, W, H);
    } catch {
      return;
    }
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.drawImage(off.canvas, 0, 0, W, H);
    const px = off.canvas.width / W;
    const py = off.canvas.height / H;
    for (let i = 0; i < count; i += 1) {
      const sy = rect.y + (i / count) * rect.h;
      const sh = Math.max(1, rect.h / count * (0.4 + hash(i, seed) * 0.8));
      const dx = (hash(i + 5, seed) - 0.5) * shift * 2;
      ctx.drawImage(
        off.canvas,
        rect.x * px, sy * py, rect.w * px, sh * py,
        rect.x + dx, sy, rect.w, sh,
      );
    }
    if (o.color) {
      ctx.globalAlpha *= num(o.colorAlpha, 0.14);
      ctx.fillStyle = colorOf(o.color, accentColor());
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    ctx.restore();
  }

  /**
   * 故障风超大字：整行字做成一块离屏字版，切片横向错位，其中单个字按时间跳色。
   * 只错位字版本身，不把背景一起切碎；因此比 `glitch` 更像字体效果。
   */
  function glitchType(ctx, api, o = {}) {
    if (!ctx || !api || typeof api.canvas !== 'function') return null;
    const text = str(o.text);
    if (!text) return null;
    const size = Math.max(8, num(o.size, 240));
    const font = fontOf(o, size, o.role || 'display');
    const tracking = num(o.tracking, 0);
    const align = o.align || 'center';
    const baseline = o.baseline || 'middle';
    const chars = Array.from(text);
    const widths = chars.map((ch) => textWidth(ctx, ch, font, 0));
    const total = widths.reduce((sum, w) => sum + w, 0) + Math.max(0, chars.length - 1) * tracking;
    const x = finite(o.x) ? o.x : (api.W ? api.W / 2 : 0);
    const y = finite(o.y) ? o.y : (api.H ? api.H / 2 : 0);
    const pad = Math.max(12, num(o.pad, size * 0.18));
    const w = Math.ceil(total + pad * 2);
    const h = Math.ceil(font.ascent + font.descent + pad * 2);
    let ax = w / 2;
    if (align === 'left') ax = pad;
    else if (align === 'right' || align === 'end') ax = w - pad;
    const ay = baseline === 'alphabetic' ? pad + font.ascent : h / 2;
    const baseColor = colorOf(o.color, inkColor());
    const jumpColor = colorOf(o.jumpColor, accentColor());
    const t = num(o.t, num(api && api.t, 0));
    const jumpIndex = o.jump === false
      ? -1
      : ((Math.floor(finite(o.jumpIndex) ? o.jumpIndex : t * num(o.jumpRate, 6)) % chars.length) + chars.length) % chars.length;
    // 故障按场景进度爆发：只在 `burstAt` 窗口附近切片，其余时间保持干净字面。
    const dur = Math.max(0.001, num(o.dur, api && api.d ? api.d : 1));
    const q = clamp01(t / dur);
    const weight = finite(o.weight) ? Math.max(0, o.weight) : size * 0.03;
    const type = api.canvas(w, h);
    const tctx = type.ctx;
    tctx.save();
    setFont(tctx, font);
    tctx.textAlign = 'center';
    tctx.textBaseline = baseline;
    let cursor = align === 'left' ? ax : align === 'right' || align === 'end' ? ax - total : ax - total / 2;
    for (let i = 0; i < chars.length; i += 1) {
      const ch = chars[i];
      const color = i === jumpIndex ? jumpColor : baseColor;
      tctx.fillStyle = color;
      tctx.fillText(ch, cursor + widths[i] / 2, ay);
      if (weight > 0) {
        tctx.strokeStyle = color;
        tctx.lineWidth = weight;
        tctx.lineJoin = 'round';
        tctx.miterLimit = 2;
        tctx.strokeText(ch, cursor + widths[i] / 2, ay);
      }
      cursor += widths[i] + (i < chars.length - 1 ? tracking : 0);
    }
    tctx.restore();

    let burst = 1;
    if (o.burst !== false) {
      const windows = Array.isArray(o.burstAt) ? o.burstAt : [[0.3, 0.1], [0.72, 0.08]];
      burst = 0;
      for (const win of windows) {
        const at = Array.isArray(win) ? num(win[0], 0) : num(win.at, 0);
        const width = Math.max(0.001, Array.isArray(win) ? num(win[1], 0.08) : num(win.width, 0.08));
        burst = Math.max(burst, 1 - Math.abs(q - at) / width);
      }
      burst = clamp01(burst);
    }
    if (o.slice !== false && burst > 0) {
      const snap = api.canvas(w, h);
      snap.ctx.drawImage(type.canvas, 0, 0, w, h);
      const count = Math.max(1, Math.min(32, Math.floor(num(o.count, 10))));
      const seed = num(o.seed, 0);
      const shift = num(o.shift, size * 0.14);
      const px = snap.canvas.width / w;
      const py = snap.canvas.height / h;
      tctx.clearRect(0, 0, w, h);
      for (let i = 0; i < count; i += 1) {
        const sy = (i / count) * h;
        const sh = Math.max(1, h / count * (0.4 + hash(i, seed) * 0.8));
        const dx = (hash(i + 5, seed) - 0.5) * shift * 2 * burst;
        tctx.drawImage(snap.canvas, 0, sy * py, w * px, sh * py, dx, sy, w, sh);
      }
    }

    const alpha = finite(o.alpha) ? clamp01(o.alpha) : 1;
    const drawX = x - ax;
    const drawY = y - ay;
    ctx.save();
    ctx.globalAlpha *= alpha;
    type.blit(ctx, drawX, drawY);
    ctx.restore();

    ctx.save();
    setFont(ctx, font);
    ctx.textAlign = align === 'left' ? 'left' : align === 'right' || align === 'end' ? 'right' : 'center';
    ctx.textBaseline = baseline;
    if (finite(o.alpha)) ctx.globalAlpha *= clamp01(o.alpha);
    TT.text.record(ctx, text, x, y);
    ctx.restore();
    return { x: drawX, y: drawY, w, h };
  }

  /** 四角取景框 / 十字 / REC / 进度条。 */
  function viewfinder(ctx, o = {}) {
    if (!ctx) return;
    const rect = rectOf(o.rect, { x: 0, y: 0, w: ctx.canvas ? ctx.canvas.width : 0, h: ctx.canvas ? ctx.canvas.height : 0 });
    const color = colorOf(o.color, inkColor());
    const length = Math.max(4, num(o.length, rect.w * 0.035));
    const width = Math.max(1, num(o.width, 2));
    const alpha = finite(o.alpha) ? clamp01(o.alpha) : 1;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    const corners = [
      [rect.x, rect.y, 1, 1],
      [rect.x + rect.w, rect.y, -1, 1],
      [rect.x, rect.y + rect.h, 1, -1],
      [rect.x + rect.w, rect.y + rect.h, -1, -1],
    ];
    for (const [x, y, dx, dy] of corners) {
      ctx.beginPath();
      ctx.moveTo(x + dx * length, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + dy * length);
      ctx.stroke();
    }
    if (o.crosshair) {
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + rect.h / 2;
      const r = Math.max(4, num(o.crossSize, 18));
      ctx.beginPath();
      ctx.moveTo(cx - r, cy);
      ctx.lineTo(cx + r, cy);
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx, cy + r);
      ctx.stroke();
    }
    if (o.rec) {
      const cx = rect.x + rect.w - 26;
      const cy = rect.y + 26;
      ctx.fillStyle = colorOf(o.recColor, accentColor());
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(2, num(o.recSize, 5)), 0, TAU);
      ctx.fill();
      TT.text(ctx, 'REC', cx - 12, cy, Math.max(9, num(o.recTextSize, 14)), {
        color, align: 'right', baseline: 'middle', role: 'num',
      });
    }
    if (o.progress && finite(o.progress.value)) {
      const bar = rectOf(o.progress.rect, {
        x: rect.x, y: rect.y + rect.h + 12, w: rect.w, h: 4,
      });
      ctx.fillStyle = colorOf(o.progress.track, color);
      ctx.globalAlpha *= 0.28;
      ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = colorOf(o.progress.color, accentColor());
      ctx.fillRect(bar.x, bar.y, bar.w * clamp01(o.progress.value), bar.h);
    }
    if (Array.isArray(o.labels)) {
      for (const label of o.labels) {
        if (!label || !label.text) continue;
        TT.text(ctx, str(label.text), num(label.x, rect.x), num(label.y, rect.y), num(label.size, 16), {
          color: colorOf(label.color, mutedColor()),
          align: label.align || 'left',
          baseline: label.baseline || 'middle',
          role: label.role || 'num',
        });
      }
    }
    ctx.restore();
  }

  /** 技术微标签：`01 / 06`、`129 BPM`、进度条、REC。 */
  function micro(ctx, o = {}) {
    if (!ctx) return;
    const x = num(o.x, 0);
    const y = num(o.y, 0);
    const size = Math.max(8, num(o.size, 18));
    const color = colorOf(o.color, mutedColor());
    const text = microText(o);
    if (text) {
      TT.text(ctx, text, x, y, size, {
        color, align: o.align || 'left', baseline: o.baseline || 'alphabetic',
        role: o.role || 'num', alpha: o.alpha,
      });
    }
    if (o.bar && finite(o.bar.value)) {
      const bar = o.bar;
      const bw = Math.max(1, num(bar.w, 180));
      const bh = Math.max(1, num(bar.h, 4));
      const bx = num(bar.x, x);
      const by = num(bar.y, y + size * 0.9);
      ctx.save();
      ctx.globalAlpha *= finite(o.alpha) ? clamp01(o.alpha) : 1;
      ctx.fillStyle = colorOf(bar.track, colorOf(o.color, mutedColor()));
      ctx.globalAlpha *= 0.28;
      ctx.fillRect(bx, by, bw, bh);
      ctx.globalAlpha = finite(o.alpha) ? clamp01(o.alpha) : 1;
      ctx.fillStyle = colorOf(bar.color, accentColor());
      ctx.fillRect(bx, by, bw * clamp01(bar.value), bh);
      ctx.restore();
    }
    if (o.rec) {
      ctx.save();
      ctx.fillStyle = colorOf(o.recColor, accentColor());
      ctx.beginPath();
      ctx.arc(x, y - size * 0.32, Math.max(2, num(o.recSize, 4)), 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  /** 三段式 / 多段横带，文字按各自方向移动。 */
  function bands(ctx, o = {}) {
    if (!ctx) return;
    const rect = rectOf(o.rect, { x: 0, y: 0, w: ctx.canvas ? ctx.canvas.width : 0, h: ctx.canvas ? ctx.canvas.height : 0 });
    const bandsList = Array.isArray(o.bands) && o.bands.length
      ? o.bands
      : [
        { color: accentColor(), text: str(o.text) },
        { color: bgColor(), text: '' },
        { color: lineColor(), text: '' },
      ];
    const gap = num(o.gap, 0);
    const t = num(o.t, 0);
    const alpha = finite(o.alpha) ? clamp01(o.alpha) : 1;
    const count = bandsList.length;
    const bh = (rect.h - gap * (count - 1)) / count;
    ctx.save();
    ctx.globalAlpha *= alpha;
    for (let i = 0; i < count; i += 1) {
      const band = bandsList[i] || {};
      const y = rect.y + i * (bh + gap);
      ctx.save();
      ctx.beginPath();
      ctx.rect(rect.x, y, rect.w, bh);
      ctx.clip();
      ctx.fillStyle = colorOf(band.color, paletteColor(i));
      ctx.fillRect(rect.x, y, rect.w, bh);
      const text = str(band.text);
      if (text) {
        const size = Math.max(10, num(band.size, o.size == null ? bh * 0.6 : o.size));
        const font = fontOf(band, size, band.role || 'display');
        const tw = textWidth(ctx, text, font, num(band.tracking, 0));
        const period = tw + Math.max(24, size * 0.4);
        const speed = num(band.speed, o.speed == null ? 80 : o.speed);
        const dir = band.dir === 'right' ? 1 : -1;
        const offset = (t * speed * dir + num(band.offset, 0)) % period;
        const start = rect.x - period + offset;
        for (let k = 0; k < 2; k += 1) {
          const xx = start + k * period;
          TT.text(ctx, text, xx, y + bh / 2, size, {
            font, color: colorOf(band.textColor, inkColor()),
            align: 'left', baseline: 'middle', role: band.role || 'display',
          });
        }
      }
      ctx.restore();
    }
    ctx.restore();
  }

  /** 代码录屏感：顶栏、代码行、右侧预览。纯 Canvas，不启第二个运行时。 */
  function screencast(ctx, o = {}) {
    if (!ctx) return;
    const rect = rectOf(o.rect, { x: 0, y: 0, w: ctx.canvas ? ctx.canvas.width : 0, h: ctx.canvas ? ctx.canvas.height : 0 });
    const card = colorOf(o.card, '#141414');
    const bar = colorOf(o.bar, '#232323');
    const accent = colorOf(o.accent, accentColor());
    const textColor = colorOf(o.textColor, inkColor());
    const muted = colorOf(o.muted, mutedColor());
    const lines = Array.isArray(o.lines) ? o.lines : [];
    const t = num(o.t, 0);
    const speed = num(o.speed, 36);
    const progress = progressOf(o, 1);
    const split = clamp(num(o.split, 0.58), 0.2, 0.85);
    ctx.save();
    ctx.globalAlpha *= finite(o.alpha) ? clamp01(o.alpha) : 1;
    fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, num(o.radius, 10), card);
    fillRoundRect(ctx, rect.x, rect.y, rect.w, 42, num(o.radius, 10), bar);
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = [accent, '#FFD34D', '#63D878'][i];
      ctx.beginPath();
      ctx.arc(rect.x + 20 + i * 16, rect.y + 21, 4, 0, TAU);
      ctx.fill();
    }
    if (o.title) {
      TT.text(ctx, str(o.title), rect.x + 76, rect.y + 21, 14, {
        color: textColor, align: 'left', baseline: 'middle', role: 'num',
      });
    }
    const codeRect = { x: rect.x + 18, y: rect.y + 58, w: rect.w * split - 28, h: rect.h - 76 };
    const previewRect = { x: rect.x + rect.w * split + 8, y: rect.y + 58, w: rect.w * (1 - split) - 26, h: rect.h - 76 };
    setFont(ctx, fontOf(o, 18, 'num'));
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const lineHeight = Math.max(16, num(o.lineHeight, 24));
    const visible = Math.min(lines.length, Math.floor(codeRect.h / lineHeight));
    for (let i = 0; i < visible; i += 1) {
      const line = str(lines[i]);
      const chars = Math.max(0, Math.min(line.length, Math.floor(Math.max(0, t - i * 0.16) * speed)));
      const shown = line.slice(0, chars);
      ctx.fillStyle = i % 5 === 0 ? accent : textColor;
      ctx.fillText(shown, codeRect.x, codeRect.y + i * lineHeight);
      if (chars < line.length && i === Math.floor(t * 6)) {
        ctx.fillStyle = accent;
        ctx.fillRect(codeRect.x + ctx.measureText(shown).width + 2, codeRect.y + i * lineHeight - 7, 8, 14);
      }
    }
    fillRoundRect(ctx, previewRect.x, previewRect.y, previewRect.w, previewRect.h, 6, colorOf(o.previewBg, '#0A0A0A'));
    const barCount = Math.max(4, Math.floor(previewRect.w / 18));
    for (let i = 0; i < barCount; i += 1) {
      const hh = previewRect.h * (0.08 + hash(i, num(o.seed, 0)) * 0.5) * (0.35 + 0.65 * progress);
      ctx.fillStyle = i % 3 === 0 ? accent : muted;
      ctx.fillRect(previewRect.x + 8 + i * 12, previewRect.y + previewRect.h - 8 - hh, 7, hh);
    }
    ctx.restore();
  }

  TT.flash = {
    fit,
    stagger,
    mask,
    contrastColor,
    stretch,
    speedLines,
    pattern,
    carry,
    panels,
    tour,
    bars,
    wave,
    layers,
    reveal,
    gridFocus,
    glitch,
    glitchType,
    viewfinder,
    micro,
    bands,
    screencast,
  };
})();
