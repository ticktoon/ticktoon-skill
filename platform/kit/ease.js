/**
 * TT.ease —— 缓动曲线集合。
 *
 * 这里只放"能对到一条明确数学式"的曲线，不放可调参数的自由曲线：
 * 每场各自发明 bezier 的结果是整片节奏碎裂，而这类问题在静帧上看不出来。
 * 需要回弹时用 `back(o)`，o 由调用方给具体数字，不用默认值蒙。
 */
(() => {
  TT.ease = {
    linear: (p) => p,
    outCubic: (p) => 1 - Math.pow(1 - p, 3),
    outQuart: (p) => 1 - Math.pow(1 - p, 4),
    outExpo: (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
    inOutCubic: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    /** 工厂：`ease.back(1.7)(p)`，o 越大回弹越狠。 */
    back: (o) => (p) => 1 + (o + 1) * Math.pow(p - 1, 3) + o * Math.pow(p - 1, 2),
  };
})();
