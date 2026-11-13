/**
 * TT.font —— 场景字体资源的唯一查询。
 *
 * fonts 是该场声明的字体键映射（manifest 键 → 同名键）；它对应本场
 * `resources` 里的 font 条目，是资源加载与授权契约，不是配色板。
 * 颜色由 kit 自带默认值，或由 scene.code 直接写 hex。
 * 字号、行高、字重、版位一律由调用方显式给，这里不做隐式查表。
 *
 * font 返回的 `css` 里那个族名字符串**必须**等于 `resources[].name`。
 * 引擎注册字体走 `new FontFace(name, bytes)`，族名就是资源名；
 * 写成 "Source Han Sans" 而资源叫 "sans-400" 时不会报错，只会静默回落到系统字体——
 * 画面照常出，字全错了。字体键一律从 manifest 取，不手写 family。
 */
(() => {
  TT.font = (fonts, size, fontKey, familyOverride) => {
    if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) {
      throw new Error('Font size must be a positive number: ' + size);
    }
    const family = familyOverride || fonts?.[fontKey || 'sans-900'];
    if (!family) throw new Error('Unknown font key: ' + fontKey);
    return {
      css: size + 'px "' + family + '"',
      size,
      family,
      lineHeight: size * 1.24,
      ascent: size * 0.78,
      descent: size * 0.22,
    };
  };
})();
