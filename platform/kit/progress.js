/**
 * TT.progress —— 全片播放进度组件。
 *
 * chapters：按章节起始秒划分的连续时间条；已播与当前段共用前景色。
 * 只负责 Canvas 绘制，不处理点击 seek / hover tooltip；时间由调用方按当前帧传入。
 */
(() => {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function fitText(ctx, value, budget) {
    const text = String(value ?? '');
    if (!text || budget <= 0) return '';
    if (ctx.measureText(text).width <= budget) return text;
    if (ctx.measureText('…').width > budget) return '';
    const chars = [...text];
    while (chars.length && ctx.measureText(`${chars.join('')}…`).width > budget) chars.pop();
    return chars.length ? `${chars.join('')}…` : '';
  }

  function chapters(ctx, opts = {}) {
    const input = Array.isArray(opts.chapters) ? opts.chapters : [];
    if (!input.length) return;
    const x = Number(opts.x) || 0;
    const y = Number(opts.y) || 0;
    const w = Number(opts.w) || 0;
    const h = Number(opts.h) || 56;
    const duration = Number(opts.duration);
    if (!(w > 0 && h > 0 && duration > 0)) return;

    // 保持作者给出的章节顺序；非法或倒退的起点向前一项夹齐，不暗中重排章节。
    let previous = 0;
    const list = input.map((chapter) => {
      const start = clamp(Number(chapter.start) || 0, previous, duration);
      previous = start;
      return { text: String(chapter.text ?? ''), start };
    });
    const fontSize = Number(opts.fontSize) || 26;
    const padX = opts.padX ?? 12;
    const safeX = opts.safeX ?? 70;
    const divider = opts.divider ?? 3;
    const time = clamp(Number(opts.time) || 0, 0, duration);

    ctx.save();
    ctx.fillStyle = opts.bg || '#444752b3';
    ctx.fillRect(x, y, w, h);
    const playW = w * time / duration;
    if (playW > 0) {
      ctx.fillStyle = opts.fg || '#409EFF';
      ctx.fillRect(x, y, playW, h);
    }

    ctx.fillStyle = opts.dividerColor || '#ffffff70';
    for (const chapter of list) {
      const dx = x + w * chapter.start / duration;
      if (dx <= x + 0.5 || dx >= x + w - 0.5) continue;
      ctx.fillRect(dx - divider / 2, y, divider, h);
    }

    ctx.font = TT.font(FONTS, fontSize, opts.fontKey || 'sans-400').css;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = opts.textColor || '#ffffffed';
    for (let i = 0; i < list.length; i += 1) {
      const start = list[i].start;
      const end = i + 1 < list.length ? list[i + 1].start : duration;
      const x0 = x + w * start / duration;
      const x1 = x + w * Math.max(start, end) / duration;
      let left = x0 + padX;
      let right = x1 - padX;
      if (i === 0) left = Math.max(left, x + safeX);
      if (i === list.length - 1) right = Math.min(right, x + w - safeX);
      const text = fitText(ctx, list[i].text, (right - left) / 1.08);
      if (text) ctx.fillText(text, (left + right) / 2, y + h / 2);
    }
    ctx.restore();
  }

  TT.progress = { chapters };
})();
