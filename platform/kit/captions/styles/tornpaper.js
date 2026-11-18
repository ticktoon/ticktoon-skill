/**
 * tornpaper：手撕纸背衬 + 左上角斜置色块。
 * 撕边和纸纤维都由 seed 哈希得到，同一参数每帧完全一致，不会闪烁。
 *
 * 纸面、纤维、胶布和文字先作为一整块画进离屏层，最后只按 m.alpha 合成一次。
 * 如果逐元素套 globalAlpha，重叠处会各自半透明叠加，胶布/纸面/文字在淡出时
 * 的视觉节奏就会不一致。
 */
(() => {
  const paperPath = (ctx, pts) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  };

  const tornRect = (m, seed) => {
    const { rect } = m;
    const horizontal = Math.max(1.2, Math.min(2, rect.h * 0.04));
    const vertical = Math.max(3, Math.min(5, rect.h * 0.12));
    const edgeNoise = (i, channel) => (TT.captionKit.noise(seed, i, channel) - 0.5) * horizontal;
    const sideNoise = (i, channel) => {
      const base = (TT.captionKit.noise(seed, i, channel) - 0.5) * vertical;
      const notch = TT.captionKit.noise(seed, i, channel + 30) > 0.74
        ? (TT.captionKit.noise(seed, i, channel + 31) - 0.5) * vertical * 0.9
        : 0;
      return base + notch;
    };
    const pts = [];
    const nx = Math.max(16, Math.round(rect.w / 36));
    const ny = Math.max(10, Math.round(rect.h / 18));
    for (let i = 0; i <= nx; i += 1) {
      pts.push([rect.x + rect.w * i / nx, rect.y + edgeNoise(i, 1)]);
    }
    for (let i = 1; i <= ny; i += 1) {
      pts.push([rect.x + rect.w + sideNoise(i + nx, 2) * 0.8, rect.y + rect.h * i / ny]);
    }
    for (let i = nx - 1; i >= 0; i -= 1) {
      pts.push([rect.x + rect.w * i / nx, rect.y + rect.h + edgeNoise(i + nx + ny, 3)]);
    }
    for (let i = ny - 1; i >= 1; i -= 1) {
      pts.push([rect.x + sideNoise(i + nx * 2 + ny, 4) * 0.8, rect.y + rect.h * i / ny]);
    }
    return pts;
  };

  let surface = null;
  const surfaceFor = (w, h) => {
    if (typeof OffscreenCanvas !== 'function') return null;
    const cw = Math.ceil(w);
    const ch = Math.ceil(h);
    if (!surface || surface.width < cw || surface.height < ch) surface = new OffscreenCanvas(cw, ch);
    return surface;
  };

  CAPTIONS.tornpaper = (c) => TT.captionKit.render(c, {
    padX: 30,
    padY: 18,
    fadeIn: 0.14,
    fadeOut: 0.14,
  }, (m) => {
    const { ctx, o, f, rect } = m;
    const seed = Number.isFinite(Number(o.seed)) ? Number(o.seed) : 17;
    const paper = o.background || '#FFFFFF';
    const accent = o.accent || '#9FD4BD';
    const ink = o.color || '#0A0A0A';
    const highlight = o.highlight || '#1F6F54';

    const paint = (g) => {
      g.font = m.f.css;
      g.textAlign = 'left';
      g.textBaseline = 'alphabetic';

      if (o.band !== false) {
        const pts = tornRect(m, seed);
        g.save();
        g.shadowColor = 'rgba(20,18,14,0.36)';
        g.shadowBlur = f.size * 0.38;
        g.shadowOffsetY = f.size * 0.12;
        g.fillStyle = paper;
        paperPath(g, pts);
        g.fill();
        g.restore();

        // 纸纤维只落在撕纸内部，边缘之外保持干净。
        g.save();
        paperPath(g, pts);
        g.clip();
        g.strokeStyle = 'rgba(118,102,76,0.16)';
        g.lineWidth = Math.max(1, f.size * 0.016);
        for (let i = 0; i < 18; i += 1) {
          const x = rect.x + 10 + TT.captionKit.noise(seed, i, 5) * Math.max(1, rect.w - 20);
          const y = rect.y + 8 + TT.captionKit.noise(seed, i, 6) * Math.max(1, rect.h - 16);
          const len = 5 + TT.captionKit.noise(seed, i, 7) * Math.min(42, f.size * 0.7);
          const angle = (TT.captionKit.noise(seed, i, 8) - 0.5) * 0.55;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
          g.stroke();
        }
        g.fillStyle = 'rgba(112,94,66,0.20)';
        for (let i = 0; i < 12; i += 1) {
          const x = rect.x + 8 + TT.captionKit.noise(seed, i, 9) * Math.max(1, rect.w - 16);
          const y = rect.y + 7 + TT.captionKit.noise(seed, i, 10) * Math.max(1, rect.h - 14);
          g.fillRect(x, y, Math.max(1, f.size * 0.035), Math.max(1, f.size * 0.026));
        }
        g.restore();

        // 左上角斜置色块：短胶布，两端做不规则撕口。
        g.save();
        g.translate(rect.x + f.size * 0.10, rect.y + f.size * 0.26);
        g.rotate(-0.56);
        const bw = Math.min(rect.w * 0.14, f.size * 1.9);
        const bh = f.size * 0.62;
        const hw = bw * 0.5;
        const hh = bh * 0.5;
        const rip = (i) => (TT.captionKit.noise(seed, i, 21) - 0.5) * Math.max(4.5, f.size * 0.13);
        const edge = (i) => (TT.captionKit.noise(seed, i, 22) - 0.5) * Math.max(1.2, f.size * 0.03) * 2;
        g.fillStyle = accent;
        g.beginPath();
        g.moveTo(-hw, -hh + edge(0));
        g.lineTo(-hw * 0.45, -hh + edge(1));
        g.lineTo(0, -hh + edge(2));
        g.lineTo(hw * 0.45, -hh + edge(3));
        g.lineTo(hw, -hh + edge(4));
        // 右端撕口
        g.lineTo(hw + rip(5), -hh * 0.40);
        g.lineTo(hw - rip(6), -hh * 0.10);
        g.lineTo(hw + rip(7), hh * 0.22);
        g.lineTo(hw - rip(8), hh * 0.42);
        g.lineTo(hw, hh + edge(9));
        g.lineTo(hw * 0.45, hh + edge(10));
        g.lineTo(0, hh + edge(11));
        g.lineTo(-hw * 0.45, hh + edge(12));
        g.lineTo(-hw, hh + edge(13));
        // 左端撕口
        g.lineTo(-hw - rip(14), hh * 0.40);
        g.lineTo(-hw + rip(15), hh * 0.12);
        g.lineTo(-hw - rip(16), -hh * 0.18);
        g.lineTo(-hw + rip(17), -hh * 0.40);
        g.closePath();
        g.fill();
        g.restore();
      }

      // 未读字弱化，随 cue 时间逐字点亮；纸和胶布仍共享整体透明度包络。
      TT.captionKit.eachChar(m, (ch) => {
        g.save();
        g.globalAlpha = 1;
        g.fillStyle = c.sceneT >= ch.start ? highlight : ink;
        g.fillText(ch.text, ch.x, ch.baseline);
        g.restore();
      });
    };

    if (o.band === false) {
      paint(ctx);
      return;
    }

    // 离屏层按整块内容合成：文字、纸面和胶布共享同一个透明度包络。
    const mx = Math.max(12, f.size * 2.2);
    const top = Math.max(12, f.size * 1.5);
    const bottom = Math.max(12, f.size * 1.2);
    const lw = rect.w + mx * 2;
    const lh = rect.h + top + bottom;
    const layer = surfaceFor(lw, lh);
    if (!layer) {
      paint(ctx);
      return;
    }
    const g = layer.getContext('2d');
    if (!g) {
      paint(ctx);
      return;
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.clearRect(0, 0, Math.ceil(lw), Math.ceil(lh));
    g.setTransform(1, 0, 0, 1, mx - rect.x, top - rect.y);
    paint(g);
    g.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layer, 0, 0, Math.ceil(lw), Math.ceil(lh),
      rect.x - mx, rect.y - top, Math.ceil(lw), Math.ceil(lh));
  });
})();
