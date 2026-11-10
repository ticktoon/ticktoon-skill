/**
 * TT.color / TT.font —— 配方 style 的两种查询。
 *
 * style 只承载跨子系统共用的机器契约：字体角色与颜色 token。
 * 字号、行高、字重、版位一律由调用方显式给，这里不做隐式查表。
 *
 * font 返回的 `css` 里那个族名字符串**必须**等于 `resources[].name`。
 * 引擎注册字体走 `new FontFace(name, bytes)`，族名就是资源名；
 * 写成 "Source Han Sans" 而资源叫 "sans-900" 时不会报错，只会静默回落到系统字体——
 * 画面照常出，字全错了。所以 family 一律从 style.fonts 取，不手写。
 */
(() => {
  TT.color = (style, key) => {
    const value = style?.colors?.[key];
    if (!value) throw new Error('Unknown color key: ' + key);
    return value;
  };

  TT.font = (style, size, role, familyOverride) => {
    if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) {
      throw new Error('Font size must be a positive number: ' + size);
    }
    const family = familyOverride || style?.fonts?.[role || 'display'];
    if (!family) throw new Error('Unknown font role: ' + role);
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
