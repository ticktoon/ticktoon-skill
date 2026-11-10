/**
 * TT.clamp01 / TT.num / TT.env / TT.rng —— 数值与包络。
 *
 * `env` 与 `rng` 放在这里而不是散在 block 里，是因为它们必须**全片同一条公式**：
 * 入场包络一旦各写一份，同一片子里的元素就会有不同的淡入手感；
 * rng 一旦各写一份，同一帧两次渲染就可能不一致，确定性直接失效。
 */
(() => {
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  TT.clamp01 = clamp01;

  TT.num = {
    /** 千分位 + 定点小数；非有限值返回空串，避免画面上出现 NaN。 */
    fmt(v, digits = 0) {
      const n = Number(v);
      if (!Number.isFinite(n)) return '';
      const fixed = Math.abs(n).toFixed(digits);
      const dot = fixed.indexOf('.');
      const intPart = dot < 0 ? fixed : fixed.slice(0, dot);
      const frac = dot < 0 ? '' : fixed.slice(dot);
      return (n < 0 ? '-' : '') + intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + frac;
    },
  };

  TT.env = {
    /** 入场淡入 + 出场淡出的最小值。`dur` 是本 element 的可见时长。 */
    fade(t, dur, inDur, outDur) {
      const a = inDur > 0 ? clamp01(t / inDur) : 1;
      const b = outDur > 0 ? clamp01((dur - t) / outDur) : 1;
      return a < b ? a : b;
    },
    /** 0…1 的线性入场进度；曲线由 block 自己从 TT.ease 里选。 */
    reveal(t, inDur) {
      return inDur > 0 ? clamp01(t / inDur) : 1;
    },
  };

  /** mulberry32：定长状态、无外部依赖，每帧从同一 seed 重开即是同一数列。 */
  TT.rng = (seed) => {
    let a = (seed >>> 0) || 1;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
})();
