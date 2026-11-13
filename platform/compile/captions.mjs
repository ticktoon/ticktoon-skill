/** 字幕 kit 的配置契约：recipe 写参数，样式文件只负责绘制。 */

/**
 * 字幕字体只收 manifest 键，没有角色层。
 * 字幕是独立资源：emit 会单独加载 captions.font 指向的字体文件。
 */
export const CAPTION_STYLE_DEFAULTS = {
  plain: { font: 'sans-900', at: 'bottom', band: false },
  perchar: { font: 'sans-900', at: 'bottom', band: true },
  karaoke: { font: 'sans-900', at: 'bottom', band: true, highlight: '#FFD166' },
  collage: { font: 'sans-900', at: 'auto', band: true, rotation: 6 },
  handnote: { font: 'ZTZiYouTi', at: 'bottom', band: true, highlight: '#F4D35E' },
  vertical: { font: 'WenYuanSerifSC-Bold', at: 'auto', band: false },
  tornpaper: { font: 'JiangChengYuanTi', at: 'bottom', band: true },
};

const COMMON_KEYS = new Set([
  'style', 'font', 'band', 'at', 'size', 'color', 'background', 'accent', 'highlight',
  'palette', 'avoid', 'maxWidth', 'maxHeight', 'align', 'lineHeight', 'seed', 'rotation',
  'tracking', 'padding', 'shadow', 'stroke',
  'baseSize', 'top',
]);
const OPTION_KEYS = new Set([...COMMON_KEYS].filter((key) => !['style', 'baseSize', 'top', 'lineHeight', 'font'].includes(key)));
const POSITIONS = new Set(['bottom', 'top', 'center', 'auto']);
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const DEFAULT_METRICS = { baseSize: 46, lineHeight: 1.24, top: 0.78, margin: 0.055 };

/**
 * @param {object|string} raw      recipe.captions 或 CLI --captions
 * @param {object} catalog         静态目录（caption styles / fonts）
 * @param {object} bag             诊断收集器
 * @param {{ margin?: number }} options  recipe.rules.safeMargin
 * @returns {{ name, style, options, metrics, fontName, code } | null}
 */
export function normalizeCaption(raw, catalog, bag, { margin = DEFAULT_METRICS.margin } = {}) {
  if (raw == null || raw === '') return null;
  const input = typeof raw === 'string' ? { style: raw } : raw;
  if (!input || Array.isArray(input) || typeof input !== 'object') {
    bag.error('CAPTION_CONFIG_TYPE', 'captions', '字幕必须是样式 id 或参数对象');
    return null;
  }
  for (const key of Object.keys(input)) {
    if (!COMMON_KEYS.has(key)) bag.error('CAPTION_PARAM_UNKNOWN', `captions.${key}`, `未知字幕参数 "${key}"`);
  }
  const requested = input.style || 'perchar';
  const styleId = requested;
  if (styleId === 'none') {
    return { name: 'none', style: null, options: null, metrics: null, fontName: null, code: null };
  }
  const source = catalog.captions.get(styleId);
  if (typeof requested !== 'string' || !source) {
    bag.error('CAPTION_UNKNOWN', 'captions.style', `caption "${requested}" 未找到；可用：${[...catalog.captions.keys()].join(' / ')} / none`);
    return null;
  }

  const defaults = { size: 1, ...(CAPTION_STYLE_DEFAULTS[styleId] || {}) };
  const options = {};
  for (const key of OPTION_KEYS) {
    if (defaults[key] !== undefined) options[key] = defaults[key];
    if (input[key] !== undefined) options[key] = input[key];
  }
  // at / band 等是样式默认值，style 与 font 不进入运行时选项。
  if (options.at === undefined) options.at = 'bottom';
  if (options.band === undefined) options.band = true;

  if (!(finite(options.size) && options.size >= 0.5 && options.size <= 2)) {
    bag.error('CAPTION_SIZE_RANGE', 'captions.size', 'size 必须是 0.5–2.0 的倍率');
  }
  if (typeof options.band !== 'boolean') bag.error('CAPTION_BAND_TYPE', 'captions.band', 'band 必须是 true/false');
  const at = options.at;
  const atObject = at && typeof at === 'object' && !Array.isArray(at)
    && finite(at.x) && finite(at.y) && at.x >= 0 && at.x <= 1 && at.y >= 0 && at.y <= 1;
  if (!(typeof at === 'string' && POSITIONS.has(at)) && !atObject) {
    bag.error('CAPTION_POSITION_INVALID', 'captions.at', 'at 只能是 bottom/top/center/auto 或 {x,y}（0–1，表示字幕中心）');
  }
  if (options.maxWidth !== undefined && !(finite(options.maxWidth) && options.maxWidth > 0)) {
    bag.error('CAPTION_WIDTH_INVALID', 'captions.maxWidth', 'maxWidth 必须是正数；<=1 为画宽比例，>1 为逻辑像素');
  }
  if (options.maxHeight !== undefined && !(finite(options.maxHeight) && options.maxHeight > 0)) {
    bag.error('CAPTION_HEIGHT_INVALID', 'captions.maxHeight', 'maxHeight 必须是正数；<=1 为画高比例，>1 为逻辑像素');
  }
  for (const key of ['color', 'background', 'accent', 'highlight', 'shadow', 'stroke']) {
    if (options[key] !== undefined && typeof options[key] !== 'string') {
      bag.error('CAPTION_COLOR_TYPE', `captions.${key}`, `${key} 必须是 CSS 颜色字符串`);
    }
  }
  if (options.palette !== undefined && (!Array.isArray(options.palette) || !options.palette.length || !options.palette.every((v) => typeof v === 'string'))) {
    bag.error('CAPTION_PALETTE_TYPE', 'captions.palette', 'palette 必须是非空 CSS 颜色字符串数组');
  }
  if (options.rotation !== undefined && !(finite(options.rotation) && options.rotation >= 0 && options.rotation <= 6)) {
    bag.error('CAPTION_ROTATION_RANGE', 'captions.rotation', 'rotation 是 0–6 的最大旋转角度');
  }
  if (options.tracking !== undefined && !(finite(options.tracking) && options.tracking >= 0 && options.tracking <= 0.5)) {
    bag.error('CAPTION_TRACKING_RANGE', 'captions.tracking', 'tracking 必须是 0–0.5 的字号倍率（建议 0.08–0.16）');
  }
  const padding = Array.isArray(options.padding) ? options.padding : [options.padding];
  if (options.padding !== undefined && (padding.length > 2 || padding.some((v) => !(finite(v) && v >= 0)))) {
    bag.error('CAPTION_PADDING_INVALID', 'captions.padding', 'padding 必须是非负数字或 [x,y]；单位是字号倍率');
  }
  if (options.avoid !== undefined && !Array.isArray(options.avoid)) {
    bag.error('CAPTION_AVOID_TYPE', 'captions.avoid', 'avoid 必须是归一化 [x,y,w,h] 矩形数组');
  }

  const baseSize = input.baseSize ?? DEFAULT_METRICS.baseSize;
  const lineHeight = input.lineHeight ?? DEFAULT_METRICS.lineHeight;
  const top = input.top ?? DEFAULT_METRICS.top;
  if (!(finite(baseSize) && baseSize >= 12 && baseSize <= 240)) {
    bag.error('CAPTION_BASE_SIZE_RANGE', 'captions.baseSize', 'baseSize 必须在 12–240 逻辑像素');
  }
  if (!(finite(lineHeight) && lineHeight >= 0.8 && lineHeight <= 2.5)) {
    bag.error('CAPTION_LINE_HEIGHT_RANGE', 'captions.lineHeight', 'lineHeight 必须在 0.8–2.5 倍字号');
  }
  if (!(finite(top) && top >= 0 && top <= 1)) {
    bag.error('CAPTION_TOP_RANGE', 'captions.top', 'top 必须是 0–1 的画面高度比例');
  }

  const requestedFont = input.font || (CAPTION_STYLE_DEFAULTS[styleId] || {}).font || 'sans-900';
  const fontName = typeof requestedFont === 'string' && catalog.fonts?.[requestedFont]
    ? requestedFont
    : null;
  if (!fontName) {
    const keys = Object.keys(catalog.fonts || {}).filter((key) => typeof catalog.fonts[key] === 'object');
    bag.error('CAPTION_FONT_UNKNOWN', 'captions.font',
      `字体 "${requestedFont}" 不在 assets/fonts/manifest.json；可用：${keys.join(' / ') || '（空）'}`);
  }

  return {
    name: requested,
    style: styleId,
    options,
    metrics: {
      baseSize, lineHeight, top, margin,
      fontFamily: fontName,
    },
    fontName,
    code: `${catalog.captionKit}\n${source}\nCAPTIONS[${JSON.stringify(requested)}] = CAPTIONS[${JSON.stringify(styleId)}];`,
  };
}
