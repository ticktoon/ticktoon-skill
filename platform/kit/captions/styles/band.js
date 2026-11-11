/** band：满宽深色带 + 逐字点亮；兼容旧 bar。 */
(() => {
  CAPTIONS.band = (c) => TT.captionKit.render(c, { fullWidth: true, padX: 0, padY: 13 }, (m) => {
    const { ctx, o, f, rect } = m;
    if (o.band !== false) {
      ctx.fillStyle = o.background || 'rgba(10,12,16,0.88)';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = o.accent || '#E2574C';
      ctx.fillRect(0, rect.y, Math.max(4, f.size * 0.12), rect.h);
    }
    const spoken = o.color || '#FFFFFF';
    TT.captionKit.eachChar(m, (ch) => {
      const said = c.sceneT >= ch.start;
      ctx.fillStyle = said ? spoken : 'rgba(255,255,255,0.58)';
      ctx.fillText(ch.text, ch.x, ch.baseline);
    });
  });
})();
