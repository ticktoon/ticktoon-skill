/**
 * TT.chart —— 图表几何，只算不画。
 *
 * 画笔留在调用方：不同图表对"好看"的要求不同，
 * 但"最大值取整到好看的数"和"条形的几何"必须全片同一套，否则两个图表
 * 放在同一部片里坐标轴对不上。这里的所有函数都是纯函数，无 ctx。
 */
(() => {
  const STEPS = [1, 2, 2.5, 5, 10];

  /** 把任意最大值抬到"好看的"整数上限：173 → 200，0.7 → 1。轴上出现 173 这种数就输了。 */
  function niceMax(max) {
    if (!(max > 0)) return 1;
    const base = Math.pow(10, Math.floor(Math.log10(max)));
    for (const step of STEPS) {
      if (max <= step * base) return step * base;
    }
    return 10 * base;
  }

  TT.chart = {
    niceMax,

    /** 轴刻度：ticks(200, 4) → [0, 50, 100, 150, 200]（含 0 与上限）。 */
    ticks(max, count = 4) {
      const out = [];
      for (let i = 0; i <= count; i += 1) out.push((max / count) * i);
      return out;
    },

    /**
     * 横向条形的几何：每行的 y / h 与满值像素宽。动画进度由调用方乘在 w 上——
     * 这里给出的 `full` 是"这个值占满时的像素"，缩放交给调用方，几何不掺时间。
     */
    bars(rect, rows, opts = {}) {
      const gap = opts.gap ?? 0.32;
      const rowH = rect.h / rows.length;
      const barH = rowH * (1 - gap);
      const labelW = opts.labelW ?? 0.2;
      return rows.map((row, i) => ({
        row,
        index: i,
        y: rect.y + i * rowH + (rowH - barH) / 2,
        h: barH,
        labelX: rect.x,
        barX: rect.x + rect.w * labelW,
        full: rect.w * (1 - labelW) - (opts.valueW ?? 0.12) * rect.w,
      }));
    },
  };
})();
