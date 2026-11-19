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

  function assertRect(rect) {
    if (!rect || !(rect.w > 0 && rect.h > 0)) throw new Error('chart rect 必须包含正数 w / h');
  }
  const valueOf = (value) => Math.max(0, Number(value) || 0);
  const polar = (cx, cy, radius, angle) => ({
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  });
  const alignFor = (cos) => Math.abs(cos) < 0.2 ? 'center' : cos > 0 ? 'left' : 'right';
  const baselineFor = (sin) => Math.abs(sin) < 0.2 ? 'middle' : sin > 0 ? 'top' : 'bottom';

  /** 纵向分类柱：返回从共同基线生长的几何；标签字体与截断由调用方决定。 */
  function columns(rect, rows, opts = {}) {
    assertRect(rect);
    const input = Array.isArray(rows) ? rows : [];
    if (input.length > 12) throw new Error('columns 最多 12 列；更多类别请拆图或合并为 Other');
    const max = opts.max > 0 ? Number(opts.max) : niceMax(Math.max(0, ...input.map((row) => valueOf(row.value))));
    const count = Math.max(1, input.length);
    let gap = opts.gap ?? 26;
    let width = Math.max(opts.minWidth ?? 44, Math.min(opts.maxWidth ?? 126, (rect.w - (count - 1) * gap) / count));
    let groupWidth = count * width + (count - 1) * gap;
    if (groupWidth > rect.w) {
      const scale = rect.w / groupWidth;
      width *= scale;
      gap *= scale;
      groupWidth = rect.w;
    }
    const startX = rect.x + (rect.w - groupWidth) / 2;
    const baselineY = rect.y + rect.h;
    const bars = input.map((row, index) => {
      const w = width;
      const x = startX + index * (width + gap);
      const h = Math.min(rect.h, valueOf(row.value) / max * rect.h);
      const centerX = x + w / 2;
      return {
        row, index, x, y: baselineY - h, w, h, centerX, baselineY,
        valueX: centerX, valueY: baselineY - h - (opts.valueGap ?? 12),
        labelX: centerX, labelY: baselineY + (opts.labelGap ?? 18),
      };
    });
    return { max, baselineY, bars };
  }

  /** 多维雷达：网格、辐条、轴标签和每系列顶点共用同一量程。 */
  function radar(rect, opts = {}) {
    assertRect(rect);
    const labels = Array.isArray(opts.labels) ? opts.labels.map(String) : [];
    if (labels.length < 3 || labels.length > 8) throw new Error('radar 需要 3–8 个轴');
    const seriesInput = Array.isArray(opts.series) ? opts.series : [];
    const maxValue = Math.max(0, ...seriesInput.flatMap((series) => (
      Array.isArray(series.values) ? series.values.map(valueOf) : [0]
    )));
    const max = opts.max > 0 ? Number(opts.max) : niceMax(maxValue);
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const radius = Math.min(rect.w, rect.h) / 2 * (opts.radiusRatio ?? 0.72);
    const rings = Math.max(2, Math.min(6, Math.round(opts.rings || 4)));
    const angles = labels.map((_, i) => -Math.PI / 2 + Math.PI * 2 * i / labels.length);
    const grid = [];
    for (let ring = 1; ring <= rings; ring += 1) {
      const r = radius * ring / rings;
      grid.push({ ring, ratio: ring / rings, points: angles.map((angle) => polar(cx, cy, r, angle)) });
    }
    const spokes = angles.map((angle) => ({
      angle,
      from: { x: cx, y: cy },
      to: polar(cx, cy, radius, angle),
    }));
    const labelRadius = radius + (opts.labelOffset ?? Math.max(16, radius * 0.11));
    const axisLabels = labels.map((text, i) => {
      const angle = angles[i];
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return {
        text, angle, ...polar(cx, cy, labelRadius, angle),
        align: alignFor(cos), baseline: baselineFor(sin),
      };
    });
    const series = seriesInput.map((entry) => {
      if (!Array.isArray(entry.values) || entry.values.length !== labels.length) {
        throw new Error(`radar 系列 "${entry.name || ''}" 的 values 数量必须等于轴数`);
      }
      return {
        name: String(entry.name || ''),
        color: entry.color,
        points: entry.values.map((value, i) => {
          const ratio = Math.min(1, valueOf(value) / max);
          const angle = angles[i];
          return { value: valueOf(value), ratio, angle, ...polar(cx, cy, radius * ratio, angle) };
        }),
      };
    });
    return { center: { x: cx, y: cy }, radius, max, grid, spokes, labels: axisLabels, series };
  }

  /** 饼图/环图：innerRadius 为外半径比例，0 是饼图，>0 是环图。 */
  function pie(rect, rows, opts = {}) {
    assertRect(rect);
    const input = Array.isArray(rows) ? rows : [];
    if (input.length > 8) throw new Error('pie 最多 8 个扇区；更多类别请合并为 Other');
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const outer = Math.min(rect.w, rect.h) / 2 * (opts.radiusRatio ?? 0.72);
    const inner = outer * Math.max(0, Math.min(0.9, opts.innerRadius || 0));
    const total = input.reduce((sum, row) => sum + valueOf(row.value), 0);
    const gap = Math.max(0, opts.gapPx ?? 6);
    const progress = Math.max(0, Math.min(1, opts.progress ?? 1));
    const overlap = Math.max(0.01, opts.overlap ?? 1.25);
    const span = Math.min(1, overlap / Math.max(1, input.length));
    const step = input.length > 1 ? (1 - span) / (input.length - 1) : 0;
    const startAngle = opts.startAngle ?? -Math.PI / 2;
    let cursor = startAngle;
    const slices = total > 0 ? input.map((row, index) => {
      const value = valueOf(row.value);
      const sweep = value / total * Math.PI * 2;
      const local = Math.max(0, Math.min(1, (progress - index * step) / span));
      const a0 = cursor;
      const a1 = a0 + sweep * local;
      const midAngle = a0 + sweep / 2;
      cursor += sweep;
      const room = Math.max(0, (a1 - a0) / 2 - 0.0005);
      const outerInset = Math.min(Math.asin(Math.min(1, gap / 2 / outer)), room);
      const innerInset = inner > 0
        ? Math.min(Math.asin(Math.min(1, gap / 2 / inner)), room)
        : outerInset;
      const cos = Math.cos(midAngle);
      const isLeft = cos < 0;
      const side = isLeft ? -1 : 1;
      const tip = polar(cx, cy, outer + 22, midAngle);
      const breakPoint = polar(cx, cy, outer + 36, midAngle);
      const endX = breakPoint.x + side * 22;
      return {
        row, index, value, pct: value / total * 100, midAngle,
        outerStart: a0 + outerInset, outerEnd: a1 - outerInset,
        innerStart: a0 + innerInset, innerEnd: a1 - innerInset,
        label: value > 0 ? {
          text: String(row.label ?? ''), pct: value / total * 100,
          tipX: tip.x, tipY: tip.y,
          breakX: breakPoint.x, breakY: breakPoint.y,
          endX, endY: breakPoint.y,
          textX: endX + side * 8,
          nameY: breakPoint.y - 16,
          pctY: breakPoint.y + 18,
          align: isLeft ? 'right' : 'left',
        } : null,
      };
    }) : [];
    return { center: { x: cx, y: cy }, outerRadius: outer, innerRadius: inner, total, slices };
  }

  TT.chart = {
    niceMax,
    columns,
    radar,
    pie,

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
