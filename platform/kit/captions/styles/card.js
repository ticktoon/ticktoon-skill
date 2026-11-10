/** card：背衬跟随实际文本宽度；兼容旧 broadcast。 */
(() => {
  CAPTIONS.card = (c) => TT.captionKit.render(c, { padX: 34, padY: 14 }, (m) => {
    const { ctx, o, f, rect } = m;
    if (o.band !== false) {
      ctx.fillStyle = o.background || 'rgba(10,12,16,0.88)';
      TT.captionKit.rounded(ctx, rect.x, rect.y, rect.w, rect.h, Math.min(12, f.size * 0.22));
    }
    const spoken = o.color || '#FFFFFF';
    TT.captionKit.eachChar(m, (ch) => {
      ctx.fillStyle = c.sceneT >= ch.start ? spoken : 'rgba(255,255,255,0.60)';
      ctx.fillText(ch.text, ch.x, ch.baseline);
    });
  });
})();
