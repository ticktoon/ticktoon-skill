/**
 * news-broadcast 模板 —— 固定突发新闻模板。
 *
 * 版面来自已审阅的旧模板：径向蓝底、世界地图、120px 网格与十条种子流动线；
 * 文字只保留 title / content / source / brand（可选）四个动态字段。背景画法
 * 收在 TT.newsBg，其他新闻配方声明同一张地图资源即可复用。
 */
  const { font, clamp01, ease } = TT;

  // 旧模板的 1080×1920 坐标；其他画幅按比例换算，版式关系不变。
  const BOX = {
    title: [143, 238, 794, 225],
    content: [102, 581, 877, 1003],
    source: [586.9737537870242, 489.43637893130784, 326.97583978172065, 55.93007785739958],
    brand: [413.81835649386016, 1704.36503782544, 252.36328701227967, 70.30120138199219],
  };
  const TITLE_SIZE = 89;
  const CONTENT_SIZE = 65;
  const SOURCE_SIZE = 40;
  const BRAND_SIZE = 90;
  const LINE_GAP = 30;
  const CONTENT_TRACKING = 5;
  // 正文可见行的视觉重心固定在设计稿 y=1040；行数变化只改顶边，不改主体位置。
  const CONTENT_ANCHOR_Y = 1040;
  const SHADOW = { color: 'rgb(28,27,27)', blur: 15, x: 4, y: 4 };
  const SOURCE_BG = 'rgb(141,7,7)';
  // 行首 * 表示该行重点色；星号只做标记，不进入版面与打字时间戳。
  const HIGHLIGHT_PREFIX = '*';
  const HIGHLIGHT_COLOR = 'rgb(247,255,5)';
  const WHITE = '#FFFFFF';
  const TYPE_START = 0.9;
  const TYPE_CPS = 10;
  const TYPE_LINE_GAP = 0.16;
  const ENTER_DUR = 0.42;

  function boxOf([x, y, w, h], W, H) {
    return {
      x: x / 1080 * W,
      y: y / 1920 * H,
      w: w / 1080 * W,
      h: h / 1920 * H,
    };
  }

  function lineWidth(ctx, text, tracking = 0) {
    const chars = [...String(text)];
    if (!chars.length) return 0;
    let width = 0;
    for (const ch of chars) width += ctx.measureText(ch).width;
    return width + tracking * (chars.length - 1);
  }

  /**
   * 在固定框内缩字号：宽度和高度同时满足，绝不自动折行。
   * `lineGap` 是旧模板的固定行间距（像素，已按画幅换算）。
   */
  function fitBox(ctx, lines, fontKey, desired, maxWidth, maxHeight, fonts, minSize, tracking, lineGap) {
    let size = Math.max(minSize, Math.round(desired));
    let f = font(fonts, size, fontKey);
    ctx.font = f.css;
    for (let guard = 0; guard < 24; guard += 1) {
      const widest = Math.max(0, ...lines.map((line) => lineWidth(ctx, line, tracking)));
      const totalH = lines.length ? (lines.length - 1) * (f.size + lineGap) + f.size : 0;
      if (widest <= maxWidth && totalH <= maxHeight) break;
      const scale = Math.min(
        widest > 0 ? maxWidth / widest : 1,
        totalH > 0 ? maxHeight / totalH : 1,
      );
      const next = Math.max(minSize, Math.floor(size * scale));
      if (next === size) break;
      size = next;
      f = font(fonts, size, fontKey);
      ctx.font = f.css;
    }
    return f;
  }

  function parseLine(raw) {
    const text = String(raw);
    return text.startsWith(HIGHLIGHT_PREFIX)
      ? { text: text.slice(HIGHLIGHT_PREFIX.length), color: HIGHLIGHT_COLOR }
      : { text, color: WHITE };
  }

  function inkBaseline(ctx, text, centerY, fallbackFont) {
    const m = ctx.measureText(text);
    const ascent = typeof m.actualBoundingBoxAscent === 'number'
      ? m.actualBoundingBoxAscent : fallbackFont.ascent;
    const descent = typeof m.actualBoundingBoxDescent === 'number'
      ? m.actualBoundingBoxDescent : fallbackFont.descent;
    return centerY + (ascent - descent) / 2;
  }

  function setShadow(ctx, S, on) {
    ctx.shadowColor = on ? SHADOW.color : 'transparent';
    ctx.shadowBlur = on ? SHADOW.blur * S : 0;
    ctx.shadowOffsetX = on ? SHADOW.x * S : 0;
    ctx.shadowOffsetY = on ? SHADOW.y * S : 0;
  }

  function fallbackTyping(lines) {
    let cursor = TYPE_START;
    return lines.map((line) => {
      const times = [...line].map((_, i) => cursor + i / TYPE_CPS);
      cursor += [...line].length / TYPE_CPS + TYPE_LINE_GAP;
      return times;
    });
  }

  function sourceText(raw) {
    const value = String(raw || '').trim();
    if (!value) return '';
    return value.startsWith('消息来源：') ? value : `消息来源：${value}`;
  }

function draw(g, p) {
    const { ctx, W, H, fonts } = g;
    const t = g.t;
    const S = Math.min(W, H) / 1080;
    const titleBox = boxOf(BOX.title, W, H);
    const contentBox = boxOf(BOX.content, W, H);
    const sourceAnchor = boxOf(BOX.source, W, H);
    const sourceBox = {
      x: sourceAnchor.x,
      y: sourceAnchor.y + sourceAnchor.h / 2 - 30 * S,
      w: sourceAnchor.w,
      h: 60 * S,
    };
    const brandBox = boxOf(BOX.brand, W, H);
    const lineGap = LINE_GAP * S;
    const tracking = CONTENT_TRACKING * S;
    const map = g.api.img('news-world-map');

    // 背景：固定公共 kit。地图未就绪时只少一层，不影响文字。
    // 首帧直接满亮，避免开场露出画布黑底；场景末端仍随 g.a 淡出。
    const bgAlpha = t < ENTER_DUR ? 1 : g.a;
    ctx.save();
    TT.newsBg.paint(ctx, {
      W,
      H,
      image: map,
      time: g.sceneT,
      alpha: bgAlpha,
      mapAlpha: 0.3,
      grid: 120,
      seed: 7,
    });
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = g.a;
    ctx.textBaseline = 'alphabetic';

    // 标题：白色文源宋体，scaleUp；行首 * 的行改重点黄。box 只决定可用空间，不自动换行。
    const titleLines = String(p.title || '').split('\n').map(parseLine)
      .filter((line) => line.text.trim());
    const titleTexts = titleLines.map((line) => line.text);
    let titleSpanH = 0;
    if (titleLines.length) {
      const title = fitBox(ctx, titleTexts, 'WenYuanSerifSC-Bold', TITLE_SIZE * S,
        titleBox.w, titleBox.h, fonts, 40, 0, lineGap);
      titleSpanH = (titleLines.length - 1) * (title.size + lineGap) + title.size;
      const progress = clamp01(t / ENTER_DUR);
      const scale = 0.84 + 0.16 * ease.outCubic(progress);
      const cx = titleBox.x + titleBox.w / 2;
      const cy = titleBox.y + titleSpanH / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);
      ctx.font = title.css;
      ctx.textAlign = 'center';
      setShadow(ctx, S, true);
      titleLines.forEach((line, index) => {
        ctx.fillStyle = line.color;
        ctx.fillText(line.text, cx, titleBox.y + index * (title.size + lineGap) + title.ascent);
      });
      ctx.restore();
    }

    // 来源：红底徽标，右缘不动，按字号向左扩宽；文字按真实墨迹上下居中。
    const sourceLabel = sourceText(p.source);
    let sourceBadge = null;
    if (sourceLabel) {
      const padX = 12 * S;
      const padY = 6 * S;
      const maxBadgeW = sourceBox.x + sourceBox.w - 0.055 * W;
      const sourceFont = fitBox(ctx, [sourceLabel], 'WenYuanSerifSC-Bold', SOURCE_SIZE * S,
        maxBadgeW - padX * 2, sourceBox.h - padY * 2, fonts, 16, 0, 0);
      const sourceTextW = lineWidth(ctx, sourceLabel);
      sourceBadge = {
        x: sourceBox.x + sourceBox.w - Math.max(sourceBox.w, sourceTextW + padX * 2),
        w: Math.max(sourceBox.w, sourceTextW + padX * 2),
      };
      ctx.save();
      ctx.font = sourceFont.css;
      ctx.textAlign = 'center';
      ctx.fillStyle = SOURCE_BG;
      ctx.fillRect(sourceBadge.x, sourceBox.y, sourceBadge.w, sourceBox.h);
      ctx.fillStyle = WHITE;
      setShadow(ctx, S, false);
      ctx.fillText(sourceLabel, sourceBadge.x + sourceBadge.w / 2,
        inkBaseline(ctx, sourceLabel, sourceBox.y + sourceBox.h / 2, sourceFont));
      ctx.restore();
    }

    // 正文：文源宋体、显式分行、逐字打出；行首 * 的行改重点黄。
    // 视觉重心固定在 CONTENT_ANCHOR_Y：行少时顶边更低，行多时顶边更高。
    // 空行不参与行数限制（schema），但会作为段落间距进入总高度。
    const bodyLines = String(p.content || '').split('\n').map(parseLine);
    const bodyTexts = bodyLines.map((line) => line.text);
    const fallback = fallbackTyping(bodyTexts);
    const typed = Array.isArray(p.__typing) ? p.__typing : fallback;
    const body = fitBox(ctx, bodyTexts, 'WenYuanSerifSC-Bold', CONTENT_SIZE * S,
      contentBox.w, contentBox.h, fonts, 30, tracking, lineGap);
    const bodyLineH = body.size + lineGap;
    const bodySpanH = bodyLines.length
      ? (bodyLines.length - 1) * bodyLineH + body.size : 0;
    const anchorY = H * CONTENT_ANCHOR_Y / 1920;
    const bodyTop = Math.max(contentBox.y, Math.min(
      contentBox.y + contentBox.h - bodySpanH,
      anchorY - bodySpanH / 2,
    ));
    const linesLayout = bodyLines.map((line) => {
      const chars = [...line.text];
      const widths = chars.map((ch) => ctx.measureText(ch).width);
      const width = widths.reduce((sum, w) => sum + w, 0) + tracking * Math.max(0, chars.length - 1);
      return {
        chars,
        widths,
        x: contentBox.x + (contentBox.w - width) / 2,
      };
    });
    const bodyBottom = bodyTop + bodySpanH;
    const allTimes = typed.flat().filter((at) => Number.isFinite(at));
    const firstAt = allTimes.length ? Math.min(...allTimes) : TYPE_START;
    const lastAt = allTimes.length ? Math.max(...allTimes) : TYPE_START;
    const typingDone = allTimes.length > 0 && t >= lastAt;
    let active = null;

    ctx.save();
    ctx.font = body.css;
    ctx.textAlign = 'left';
    setShadow(ctx, S, true);
    bodyLines.forEach((line, lineIndex) => {
      const layout = linesLayout[lineIndex];
      const baseline = bodyTop + lineIndex * bodyLineH + body.ascent;
      let x = layout.x;
      ctx.fillStyle = line.color;
      layout.chars.forEach((ch, charIndex) => {
        const at = typed[lineIndex]?.[charIndex] ?? fallback[lineIndex]?.[charIndex] ?? firstAt;
        const charW = layout.widths[charIndex];
        if (t + 1e-6 >= at) {
          ctx.fillText(ch, x, baseline);
          active = { x: x + charW + tracking, y: baseline, color: line.color };
        }
        x += charW + tracking;
      });
    });
    ctx.restore();

    // 光标：打字前停在首行起点，最后一个字出现后消失。
    if (bodyLines.length && !typingDone) {
      let cursorX = null;
      let cursorY = null;
      if (active) {
        cursorX = active.x;
        cursorY = active.y;
      } else if (t >= 0) {
        cursorX = linesLayout[0].x;
        cursorY = bodyTop + body.ascent;
      }
      if (cursorX !== null) {
        ctx.save();
        ctx.globalAlpha = g.a;
        ctx.fillStyle = active?.color || WHITE;
        setShadow(ctx, S, false);
        ctx.fillRect(cursorX + 2 * S, cursorY - body.ascent, 20 * S, body.ascent + body.descent);
        ctx.restore();
      }
    }

    // 品牌：可选，默认空字符串不显示；底部居中，80% 不透明度，逐字轻起。
    const brand = String(p.brand || '').trim();
    let brandSpanH = 0;
    if (brand) {
      const brandFont = fitBox(ctx, [brand], 'sans-900', BRAND_SIZE * S,
        brandBox.w, brandBox.h, fonts, 18, 0, 0);
      brandSpanH = brandFont.size;
      const chars = [...brand];
      const widths = chars.map((ch) => ctx.measureText(ch).width);
      const width = widths.reduce((sum, w) => sum + w, 0);
      let x = brandBox.x + (brandBox.w - width) / 2;
      const baseline = brandBox.y + brandBox.h / 2 + (brandFont.ascent - brandFont.descent) / 2;
      ctx.save();
      ctx.font = brandFont.css;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#FFFFFF';
      setShadow(ctx, S, false);
      chars.forEach((ch, index) => {
        const at = 0.35 + index * 0.035;
        const progress = ease.outCubic(clamp01((t - at) / 0.32));
        ctx.globalAlpha = g.a * 0.8 * progress;
        ctx.fillText(ch, x, baseline + (1 - progress) * 8 * S);
        x += widths[index];
      });
      ctx.restore();
    }

    // 版面墨迹框：只覆盖真正会落字的区域，供 QA 的墨迹判定使用。
    const inkLeft = Math.min(contentBox.x, titleLines.length ? titleBox.x : Infinity,
      sourceBadge ? sourceBadge.x : Infinity);
    const inkRight = Math.max(contentBox.x + contentBox.w,
      titleLines.length ? titleBox.x + titleBox.w : -Infinity,
      sourceBadge ? sourceBadge.x + sourceBadge.w : -Infinity,
      brand ? brandBox.x + brandBox.w : -Infinity);
    const inkTop = Math.min(bodyTop, titleLines.length ? titleBox.y : Infinity,
      sourceLabel ? sourceBox.y : Infinity);
    const inkBottom = Math.max(
      sourceLabel ? sourceBox.y + sourceBox.h : -Infinity,
      bodyBottom,
      titleLines.length ? titleBox.y + titleSpanH : -Infinity,
      brand ? brandBox.y + brandBox.h : -Infinity,
    );
    if (Number.isFinite(inkLeft) && Number.isFinite(inkBottom) && inkRight > inkLeft) {
      g.ink = { x: inkLeft, y: inkTop, w: inkRight - inkLeft, h: inkBottom - inkTop };
    }

    ctx.restore();
}
