/** footage 模板 —— 实拍铺满画布，暗渐层与短句只在底部让出阅读区。 */
  const { font, clamp01 } = TT;

function draw(g, p) {
    const { ctx, W, H, fonts } = g;
    const rect = g.rect;
    const frame = g.api.video(p.src);
    // 实拍卡的调色板属于模板本身：暗底、米白字、暗红强调。
    const accent = '#C0392B';
    const ink = '#F0ECE4';
    const muted = '#c5cbd4';

    ctx.save();
    ctx.globalAlpha = g.a;
    ctx.fillStyle = '#090d12';
    ctx.fillRect(0, 0, W, H);
    if (frame) {
      const w = frame.videoWidth || frame.width || 1;
      const h = frame.videoHeight || frame.height || 1;
      const zoom = 1.015 + 0.018 * clamp01(g.t / Math.max(0.001, g.dur));
      const k = Math.max(rect.w / w, rect.h / h) * zoom;
      const dw = w * k;
      const dh = h * k;
      ctx.save();
      ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
      ctx.drawImage(frame, rect.x + (rect.w - dw) / 2, rect.y + (rect.h - dh) / 2, dw, dh);
      ctx.restore();
    }

    const shade = ctx.createLinearGradient(0, H * 0.28, 0, H);
    shade.addColorStop(0, 'rgba(5,8,12,0)');
    shade.addColorStop(0.52, 'rgba(5,8,12,0.24)');
    shade.addColorStop(0.82, 'rgba(5,8,12,0.86)');
    shade.addColorStop(1, 'rgba(5,8,12,0.96)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, H * 0.28, W, H * 0.72);
    const topShade = ctx.createLinearGradient(0, 0, 0, H * 0.24);
    topShade.addColorStop(0, 'rgba(5,8,12,0.52)');
    topShade.addColorStop(1, 'rgba(5,8,12,0)');
    ctx.fillStyle = topShade;
    ctx.fillRect(0, 0, W, H * 0.24);

    const margin = W * 0.072;
    // 红色竖装饰线固定占左侧 6% 起的一条窄带；所有左侧文案都从竖线右侧起步，
    // 与竖线右缘至少留 0.6 个字号的安全间距，绝不回压。
    const gutterX = W * 0.06;
    const lineW = Math.max(6, Math.round(W * 0.0042));
    const lineRight = gutterX + lineW;
    const enter = clamp01(g.reveal * 1.25);
    const body = font(fonts, Math.round(W * 0.014), 'sans-400');
    ctx.font = body.css;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = accent;
    ctx.fillRect(gutterX, H * 0.105 - body.ascent, lineW, body.ascent + body.descent);
    ctx.fillStyle = ink;
    TT.text(ctx, String(p.kicker || ''), lineRight + 22, H * 0.105, Math.round(W * 0.014), { font: body.css, color: ink, fontKey: 'sans-400' });
    ctx.textAlign = 'right';
    ctx.fillStyle = muted;
    ctx.fillText('REAL FOOTAGE  /  PEXELS', W - margin, H * 0.105);

    // 文案可用宽 = 竖线右缘 + 0.6em 安全间距 → 右边距；按剩余宽度 CJK 感知折行，
    // 三行放不下就缩字号重排（下限 44px），而不是把字压到竖线上。
    const paragraphs = String(p.title || '').split('\n');
    const minSize = 44;
    let size = Math.round(W * 0.046);
    let display = font(fonts, size, 'sans-900');
    let lines = paragraphs;
    let textX = 0;
    for (;;) {
      display = font(fonts, size, 'sans-900');
      ctx.font = display.css;
      textX = lineRight + display.size * 0.6;
      const availW = W - margin - textX;
      lines = paragraphs.flatMap((line) => TT.text.wrap(ctx, line, availW));
      if (lines.length <= 3 || size <= minSize) break;
      size = Math.max(minSize, size - 4);
    }
    display = font(fonts, size, 'sans-900');
    ctx.font = display.css;
    textX = lineRight + display.size * 0.6;
    const top = H * (lines.length > 1 ? 0.465 : 0.565);

    const masks = lines.map((line) => {
      const chars = [...line];
      const mask = chars.map(() => false);
      for (const word of p.keywords || []) {
        const part = [...word];
        for (let i = 0; i <= chars.length - part.length; i += 1) {
          if (part.every((ch, j) => chars[i + j] === ch)) {
            for (let j = 0; j < part.length; j += 1) mask[i + j] = true;
          }
        }
      }
      return mask;
    });

    ctx.save();
    ctx.globalAlpha = g.a * enter;
    ctx.translate(0, (1 - enter) * 24);
    // 显式回到 left：上方 REAL FOOTAGE 把 textAlign 改成了 right，泄漏会让整组文案右对齐压上竖线。
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = accent;
    ctx.fillRect(gutterX, top + display.ascent * 0.15, lineW, lines.length * display.lineHeight - display.descent);
    lines.forEach((line, li) => {
      let x = textX;
      [...line].forEach((ch, ci) => {
        ctx.fillStyle = masks[li][ci] ? accent : ink;
        TT.text(ctx, ch, x, top + li * display.lineHeight + display.ascent, display.size || 76, { font: display.css, color: masks[li][ci] ? accent : ink, fontKey: 'sans-900' });
        x += ctx.measureText(ch).width;
      });
    });
    ctx.restore();

    ctx.font = body.css;
    ctx.textAlign = 'left';
    ctx.fillStyle = muted;
    ctx.fillText(String(p.credit || 'Pexels'), margin, H * 0.745);
    ctx.textAlign = 'right';
    ctx.fillText('真实影像，自有力量', W - margin, H * 0.745);
    ctx.fillStyle = accent;
    ctx.fillRect(margin, H * 0.77, W - margin * 2, 2);

    // 满幅实拍是背景，不是墨迹；recipe.template 已声明 inkless，别把整幅画报成 ink，
    // 否则 qa 会把「视频铺满」误判成越界与压字幕带。
    g.ink = null;
    ctx.restore();

    // 全片章节进度不参与单场景淡入淡出；kicker 同时作为该场章节名。
    if (g.film?.chapters?.length) {
      TT.progress.chapters(ctx, {
        x: 0, y: H - 56, w: W, h: 56,
        time: g.film.start + g.t,
        duration: g.film.duration,
        chapters: g.film.chapters,
        fg: accent,
        bg: '#444752b3',
        textColor: ink,
      });
    }
}
