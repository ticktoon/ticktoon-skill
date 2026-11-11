/** scene.pen-demo —— 同一组路径只换 pen，所有差异都来自公共 TT.pen。 */
(() => {
  const { font } = TT;
  const TAU = Math.PI * 2;
  const NAMES = {
    marker: ['MARKER', '马克笔 · 圆头粗线'],
    pencil: ['PENCIL', '铅笔 · 石墨颗粒'],
    brush: ['BRUSH', '毛笔 · 竹杆白毫'],
    inkbrush: ['INKBRUSH', '水墨笔 · 软毫墨晕'],
    chalk: ['CHALK', '粉笔 · 连续粉粒'],
    fineliner: ['FINELINER', '细线笔 · 细而均匀'],
  };
  const SPECS = {
    marker: { color: '#34444a', width: 11 },
    pencil: { color: '#55575a', width: 11 },
    brush: { color: '#263b36', width: 15 },
    inkbrush: { color: '#202923', width: 16 },
    chalk: { color: '#f5f0dc', width: 12 },
    fineliner: { color: '#315e78', width: 8 },
  };
  const circle = (x, y, r) => Array.from({ length: 81 }, (_, i) => {
    const a = -Math.PI / 2 + TAU * i / 80;
    return [x + Math.cos(a) * r, y + Math.sin(a) * r];
  });

  BLOCKS['scene.pen-demo'] = (g, p) => {
    const { ctx, W, H, fonts } = g;
    const chalk = p.pen === 'chalk';
    const spec = SPECS[p.pen] || SPECS.marker;
    const name = NAMES[p.pen] || NAMES.marker;
    ctx.save();
    // 对照片需要清楚硬切，不能让每个 1.5s 段落都被 recipe 的出入场淡化。
    ctx.fillStyle = chalk ? '#263d38' : '#f8f5ec';
    ctx.fillRect(0, 0, W, H);
    ctx.font = font(fonts, 52, 'body').css;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = chalk ? '#f5f0dc' : '#303b3e';
    ctx.fillText(name[0], 100, 118);
    ctx.font = font(fonts, 30, 'body').css;
    ctx.fillStyle = chalk ? '#b9cbc2' : '#7a7d76';
    ctx.fillText(name[1], 102, 166);
    ctx.textAlign = 'right';
    ctx.fillText('TT.pen / 公共笔库', W - 100, 116);

    const strokes = [
      { pts: [[310, 420], [480, 405], [650, 426], [760, 412]], at: 0.08, dur: 0.26 },
      { pts: circle(1030, 500, 150), at: 0.48, dur: 0.40 },
      { pts: [[1320, 500], [1430, 615], [1640, 350]], at: 1.02, dur: 0.34 },
    ].map((item, i) => ({ ...item, ...spec, pen: p.pen, seed: i + 1 }));
    TT.pen.track(ctx, strokes, g.sceneT);
    g.ink = null;
    ctx.restore();
  };
})();
