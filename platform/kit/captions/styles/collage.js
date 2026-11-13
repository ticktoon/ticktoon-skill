/**
 * collage：逐字剪报色块。色板、错位、旋转与弹出共用 cue 的逐字时间轴。
 *
 * 与其它样式不同，每个字的视觉单元是「旋转后的色块」，普通行盒装不下，
 * 因此本样式不走 model() 的文字行排版，而是直接用 kit 的 cue / place / noise：
 * 先把每个色块的旋转外接盒（AABB）加抖动余量算成保留槽位，再按
 * 槽位宽 + tracking 推进、超宽折行。任意两个槽位互不相交，
 * 抖动被约束在槽位内，所以任意两个色块（含中英数）在稳定态绝不重叠。
 */
(() => {
  const PALETTE = ['#F4E7C5', '#D8AE72', '#203C4E', '#E9DDBB', '#C96A4D', '#F5ECD4'];
  const PAD_X = 30;
  const PAD_Y = 26;
  const JITTER_X_EM = 0.05;
  const JITTER_Y_EM = 0.06;
  const LINE_GAP_EM = 0.24;
  const dimension = (value, total, fallback) => (value == null ? fallback : value <= 1 ? value * total : value);

  CAPTIONS.collage = (c) => {
    const cue = TT.captionKit.activeCue(c);
    if (!cue) return;
    const { ctx } = c;
    const o = c.options || {};
    const base = c.metrics?.baseSize ?? 46;
    const family = c.metrics?.fontFamily || null;
    const f = TT.font(c.fonts, Math.round(base * (o.size || 1)), family || 'sans-400', family);
    const em = f.size;
    const palette = o.palette || PALETTE;
    const seed = o.seed || 17;
    const maxRotation = o.rotation == null ? 6 : o.rotation;
    const tracking = em * (o.tracking == null ? 0.12 : o.tracking);
    const jitterX = em * JITTER_X_EM;
    const jitterY = em * JITTER_Y_EM;
    const lineGap = em * LINE_GAP_EM;

    ctx.save();
    ctx.font = f.css;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const alpha = TT.env.fade(c.sceneT - cue.start, cue.end - cue.start, 0.06, 0.1);
    ctx.globalAlpha = alpha;

    // 1) 逐字几何：色块尺寸 → 旋转 AABB → 含抖动余量的保留槽位
    const items = [];
    let index = 0;
    for (const src of TT.captionKit.timeline(cue)) {
      if (src.text === '\n') { items.push({ forcedBreak: true }); continue; }
      if (/^\s$/.test(src.text)) continue;
      const n = (channel) => TT.captionKit.noise(seed, index, channel);
      const chW = ctx.measureText(src.text).width;
      const tileW = Math.max(chW, em * 0.54) + em * (0.24 + n(3) * 0.12);
      const tileH = em * (1.02 + n(4) * 0.12);
      const angle = (n(5) - 0.5) * 2 * maxRotation * Math.PI / 180;
      const cos = Math.abs(Math.cos(angle));
      const sin = Math.abs(Math.sin(angle));
      const aabbW = tileW * cos + tileH * sin;
      const aabbH = tileW * sin + tileH * cos;
      items.push({
        ...src,
        index,
        tileW,
        tileH,
        angle,
        cellW: aabbW + jitterX * 2,
        cellH: aabbH + jitterY * 2,
        jx: (n(1) - 0.5) * 2 * jitterX,
        jy: (n(2) - 0.5) * 2 * jitterY,
        bg: palette[(index + seed) % palette.length],
      });
      index += 1;
    }

    // 2) 按格子流式折行：推进量 = 格子宽 + tracking，超 maxWidth 就换行，不挤压
    const safeWidth = c.W * (1 - 2 * (c.metrics?.margin ?? 0.055));
    const maxWidth = Math.min(safeWidth, dimension(o.maxWidth, c.W, safeWidth)) - PAD_X * 2;
    const rows = [[]];
    let rowW = 0;
    // 收尾标点不另起一行：中文行首标点比撑破几像素更难读。
    const noLineStart = /^[，。！？；：、,.!?;:）】》」』…—]/;
    for (const it of items) {
      if (it.forcedBreak) { rows.push([]); rowW = 0; continue; }
      const advance = it.cellW + (rows[rows.length - 1].length ? tracking : 0);
      if (rows[rows.length - 1].length && rowW + advance > maxWidth && !noLineStart.test(it.text)) {
        rows.push([]);
        rowW = 0;
      }
      const row = rows[rows.length - 1];
      row.push(it);
      rowW += row.length === 1 ? it.cellW : it.cellW + tracking;
    }
    const rowInfo = rows.map((row) => ({
      w: row.reduce((sum, it, i) => sum + it.cellW + (i ? tracking : 0), 0),
      h: Math.max(0, ...row.map((it) => it.cellH)),
    }));
    const contentW = Math.max(1, ...rowInfo.map((info) => info.w));
    const contentH = rowInfo.reduce((sum, info) => sum + info.h, 0) + lineGap * Math.max(0, rows.length - 1);

    // 3) 盒型位置仍交给 kit：安全区、at、auto 避障规则与其它样式一致
    const rect = TT.captionKit.place(c, contentW + PAD_X * 2, contentH + PAD_Y * 2);

    // 4) 逐字弹出；格子之间恒有 tracking / lineGap 间隙，back(1.4) 的过冲也填不满
    let rowTop = rect.y + PAD_Y;
    rows.forEach((row, rowIndex) => {
      const info = rowInfo[rowIndex];
      let cursor = rect.x + (rect.w - info.w) / 2;
      const centerY = rowTop + info.h / 2;
      for (const it of row) {
        const cx = cursor + it.cellW / 2;
        cursor += it.cellW + tracking;
        const p = TT.captionKit.clamp((c.sceneT - it.start) / 0.24, 0, 1);
        if (p <= 0) continue;
        const pop = TT.ease.back(1.4)(p);
        const fg = palette.length === 1 && o.color ? o.color : TT.captionKit.inkFor(it.bg);
        ctx.save();
        ctx.globalAlpha = alpha * Math.min(1, p * 2.5);
        ctx.translate(cx + it.jx, centerY + it.jy + (1 - p) * em * 0.55);
        ctx.rotate(it.angle);
        ctx.scale(pop, pop);
        ctx.shadowColor = 'rgba(20,34,42,0.25)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 6;
        ctx.fillStyle = it.bg;
        ctx.fillRect(-it.tileW / 2, -it.tileH / 2, it.tileW, it.tileH);
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = 'rgba(255,255,255,0.20)';
        ctx.fillRect(-it.tileW / 2 + 4, -it.tileH / 2 + 4, Math.max(0, it.tileW - 8), 3);
        ctx.fillStyle = fg;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(it.text, 0, em * 0.035);
        ctx.restore();
      }
      rowTop += info.h + lineGap;
    });
    ctx.restore();
  };
})();
