/** scene.caption-demo —— 七种字幕共用的一组长留白背景。 */
(() => {
  const BG = ['#172B3A', '#376D8C', '#E7DCC4', '#17171B', '#3C78A0', '#241B1B', '#F3EDDE'];
  BLOCKS['scene.caption-demo'] = (g, p) => {
    const { ctx, W, H, fonts } = g;
    const index = Math.max(0, Math.floor(p.index || 0));
    const light = index === 2 || index === 6;
    ctx.save();
    ctx.globalAlpha = g.a;
    ctx.fillStyle = BG[index % BG.length];
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.scale(W / 1920, H / 1080);
    ctx.strokeStyle = light ? 'rgba(41,54,53,0.12)' : 'rgba(240,229,198,0.13)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 7; i += 1) {
      ctx.beginPath();
      ctx.arc(1460, 500, 110 + i * 55, -1.0, 1.9);
      ctx.stroke();
    }
    ctx.fillStyle = light ? 'rgba(172,86,61,0.13)' : 'rgba(222,174,99,0.18)';
    ctx.beginPath();
    ctx.moveTo(0, 790); ctx.lineTo(630, 510); ctx.lineTo(980, 1080); ctx.lineTo(0, 1080); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 90; i += 1) {
      ctx.fillStyle = light ? 'rgba(40,48,43,0.045)' : 'rgba(255,244,216,0.055)';
      ctx.fillRect((i * 229.7) % 1920, (i * i * 17.3) % 1080, 2, 2);
    }
    ctx.font = TT.font(fonts, 27, 'display').css;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = light ? '#35413E' : '#F4E8CE';
    ctx.fillText(`${String(index + 1).padStart(2, '0')}  /  ${p.label.toUpperCase()}`, 92, 92);
    ctx.font = TT.font(fonts, 19, 'body').css;
    ctx.globalAlpha = g.a * 0.64;
    ctx.fillText(p.note || '', 94, 128);
    ctx.restore();
    g.ink = null;
    ctx.restore();
  };
})();
