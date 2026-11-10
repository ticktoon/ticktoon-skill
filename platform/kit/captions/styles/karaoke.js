/** karaoke：已读点亮、当前字高亮并轻微放大，高亮色可配。 */
(() => {
  CAPTIONS.karaoke = (c) => TT.captionKit.render(c, { padX: 34, padY: 18 }, (m) => {
    const { ctx, o, f, rect } = m;
    if (o.band !== false) {
      ctx.fillStyle = o.background || 'rgba(10,12,16,0.86)';
      TT.captionKit.rounded(ctx, rect.x, rect.y, rect.w, rect.h, Math.min(12, f.size * 0.22));
    }
    const highlight = o.highlight || '#FFD166';
    TT.captionKit.eachChar(m, (ch) => {
      const current = c.sceneT >= ch.start && c.sceneT < ch.end;
      ctx.fillStyle = current ? highlight : c.sceneT >= ch.start ? (o.color || '#FFFFFF') : 'rgba(255,255,255,0.58)';
      ctx.fillText(ch.text, ch.x, ch.baseline);
    });
    TT.captionKit.eachChar(m, (ch) => {
      if (!(c.sceneT >= ch.start && c.sceneT < ch.end)) return;
      const k = 1.12;
      ctx.save();
      ctx.fillStyle = highlight;
      ctx.translate(ch.x + ch.w / 2, ch.baseline);
      ctx.scale(k, k);
      ctx.fillText(ch.text, -ch.w / 2, 0);
      ctx.restore();
    });
  });
})();
