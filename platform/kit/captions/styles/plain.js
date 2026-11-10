/** plain：无底色白字，描边与柔和阴影保证复杂画面上的可读性。 */
(() => {
  CAPTIONS.plain = (c) => TT.captionKit.render(c, { padX: 8, padY: 8 }, (m) => {
    const { ctx, o, f, rect } = m;
    if (o.band) {
      ctx.fillStyle = o.background || 'rgba(10,12,16,0.48)';
      TT.captionKit.rounded(ctx, rect.x, rect.y, rect.w, rect.h, f.size * 0.18);
    }
    ctx.lineJoin = 'round';
    ctx.strokeStyle = o.stroke || 'rgba(10,15,20,0.86)';
    ctx.lineWidth = Math.max(2, f.size * 0.075);
    ctx.shadowColor = o.shadow || 'rgba(0,0,0,0.42)';
    ctx.shadowBlur = f.size * 0.16;
    ctx.shadowOffsetY = f.size * 0.06;
    ctx.fillStyle = o.color || '#FFFFFF';
    TT.captionKit.eachChar(m, (ch) => {
      if (o.stroke !== 'none') ctx.strokeText(ch.text, ch.x, ch.baseline);
      ctx.fillText(ch.text, ch.x, ch.baseline);
    });
  });
})();
