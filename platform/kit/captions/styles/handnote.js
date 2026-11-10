/** handnote：手写字、灰色纸带与荧光笔高亮；抖动由字序决定，不逐帧闪烁。 */
(() => {
  const luminance = (hex) => {
    const m = /^#([\da-f]{6})$/i.exec(hex || '');
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114;
  };
  CAPTIONS.handnote = (c) => TT.captionKit.render(c, { padX: 22, padY: 14, lineHeight: 1.34 }, (m) => {
    const { ctx, o, f, rect } = m;
    // 黑板变体：作者给了深色背衬而不指定文字色时，默认切成粉笔白字 + 粉彩荧光笔。
    const dark = (luminance(o.background) ?? 240) < 90;
    if (o.band !== false) {
      ctx.fillStyle = o.background || 'rgba(229,230,224,0.88)';
      TT.captionKit.rounded(ctx, rect.x, rect.y, rect.w, rect.h, 4);
    }
    const highlight = dark && (!o.highlight || o.highlight === '#F4D35E') ? '#EBC98B' : (o.highlight || '#F4D35E');
    for (const line of m.lines) {
      const y = line.y + f.size * 0.48;
      const wobble = (TT.captionKit.noise(31, line.index, 2) - 0.5) * 5;
      ctx.save();
      ctx.globalAlpha = m.alpha * 0.42;
      ctx.fillStyle = highlight;
      ctx.beginPath();
      ctx.moveTo(line.x - 5, y - f.size * 0.22);
      ctx.lineTo(line.x + line.width + 7, y - f.size * 0.25 + wobble);
      ctx.lineTo(line.x + line.width + 4, y + f.size * 0.24);
      ctx.lineTo(line.x - 7, y + f.size * 0.20 - wobble);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = o.color || (dark ? '#F4F1E4' : '#343A3B');
    TT.captionKit.eachChar(m, (ch) => {
      const dx = (TT.captionKit.noise(23, ch.index, 1) - 0.5) * 1.8;
      const dy = (TT.captionKit.noise(23, ch.index, 2) - 0.5) * 2.2;
      const r = (TT.captionKit.noise(23, ch.index, 3) - 0.5) * 0.018;
      ctx.save();
      ctx.translate(ch.x + dx, ch.baseline + dy);
      ctx.rotate(r);
      ctx.fillText(ch.text, 0, 0);
      ctx.restore();
    });
  });
})();
