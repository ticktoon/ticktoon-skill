/** vertical：字从上到下、列从右到左，整组在指定位置右对齐。 */
(() => {
  CAPTIONS.vertical = (c) => TT.captionKit.render(c, {
    vertical: true, padX: 12, padY: 12, lineHeight: 1.28, align: 'right', fadeIn: 0.16,
  }, (m) => {
    const { ctx, o, f, rect } = m;
    if (o.band) {
      ctx.fillStyle = o.background || 'rgba(245,240,227,0.80)';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    TT.captionKit.eachChar(m, (ch) => {
      const p = TT.captionKit.clamp((c.sceneT - ch.start) / 0.18, 0, 1);
      if (p <= 0) return;
      ctx.save();
      ctx.globalAlpha = m.alpha * p;
      ctx.fillStyle = o.color || '#343C36';
      ctx.translate(ch.x + f.size * 0.5, ch.y + f.size * 0.52 + (1 - p) * 5);
      ctx.fillText(ch.text, 0, 0);
      ctx.restore();
    });
  });
})();
