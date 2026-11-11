/**
 * 字幕带几何：tt probe 与 QA 共用。
 *
 * 两个来源，优先级从高到低：
 *   1. caption receipt —— emit 在 code 场包住字幕绘制时记下的真实文字框（画布逻辑像素）；
 *      顶部字幕的带底就取它的下缘，不再靠字号猜；
 *   2. 估算 —— 该帧没有 caption receipt 时，用字幕 metrics（字号、行高、top、margin）
 *      与 cue 文本估一个保守带宽。
 *
 * 字幕位置走 uses.captions.at：top 看屏幕上带，bottom 看屏幕下带；
 * center / {x,y} 按字幕框中心上下展开；auto 无法预知落点，沿用下带（旧行为）。
 */

const CJK = /[⺀-〿぀-鿿가-힯豈-﫿︰-﹏＀-￯]/;

export const CAPTION_TOLERANCE = 2;
const PAD_Y = 14;

/** 'top' | 'bottom' | 'center' | 'auto' | 'object' */
export function captionPlacement(caption) {
  const at = caption?.options?.at;
  if (at && typeof at === 'object' && !Array.isArray(at)) return 'object';
  if (at === 'top' || at === 'bottom' || at === 'center' || at === 'auto') return at;
  return 'bottom';
}

/** 该帧该场是否有字幕 cue 在场（receipt.t 是绝对秒）。 */
export function activeCueAt(planned, sceneId, t) {
  const scene = planned?.scenes?.find((item) => item.id === sceneId);
  if (!scene) return null;
  const rel = Number(t) - scene.start;
  for (const cue of scene.cues || []) {
    if (rel >= cue.start && rel < cue.end) return cue;
  }
  return null;
}

/** 同一帧、同一场的一条或多条字幕文字框，合并成一个。 */
export function captionInkAt(receipts, sceneId, t) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const item of receipts) {
    if (item.kind !== 'caption' || item.scene !== sceneId) continue;
    if (Math.abs(Number(item.t) - Number(t)) > 0.05) continue;
    if (!Array.isArray(item.ink) || !(item.ink[2] > 0 && item.ink[3] > 0)) continue;
    x0 = Math.min(x0, item.ink[0]);
    y0 = Math.min(y0, item.ink[1]);
    x1 = Math.max(x1, item.ink[0] + item.ink[2]);
    y1 = Math.max(y1, item.ink[1] + item.ink[3]);
  }
  if (!Number.isFinite(x0)) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** 从真实字幕框推出检查带；top 用字幕下缘，bottom 用字幕上缘。 */
export function bandFromCaptionInk(ink, placement, H) {
  if (placement === 'top') return { y0: 0, y1: ink.y + ink.h + CAPTION_TOLERANCE, source: 'caption', placement };
  if (placement === 'bottom' || placement === 'auto') {
    return { y0: ink.y - CAPTION_TOLERANCE, y1: H, source: 'caption', placement };
  }
  const pad = CAPTION_TOLERANCE;
  return { y0: ink.y - pad, y1: ink.y + ink.h + pad, source: 'caption', placement };
}

/** 没有 caption receipt 时的保守估算（字幕未落帧）。 */
export function estimatedCaptionBand({ format, caption, cue }) {
  const placement = captionPlacement(caption);
  const metrics = caption?.metrics || {};
  const opt = caption?.options || {};
  const margin = metrics.margin ?? 0.055;
  const fSize = Math.round((metrics.baseSize ?? 46) * (Number(opt.size) > 0 ? Number(opt.size) : 1));
  const lineHeight = fSize * (Number(opt.lineHeight) > 0 ? Number(opt.lineHeight) : (metrics.lineHeight ?? 1.24));
  const marginY = margin * format.h;
  const maxWidth = Number(opt.maxWidth) > 0
    ? (opt.maxWidth <= 1 ? opt.maxWidth * format.w : opt.maxWidth)
    : format.w * (1 - 2 * margin);
  const textWidth = [...String(cue?.text || '')].reduce(
    (sum, ch) => sum + (CJK.test(ch) ? fSize : fSize * 0.55),
    0,
  );
  const lines = Math.max(1, Math.ceil(textWidth / Math.max(fSize * 4, maxWidth - 40)));
  const height = lines * lineHeight + PAD_Y * 2;

  if (placement === 'top') return { y0: 0, y1: marginY + height, source: 'estimate', placement };
  if (placement === 'bottom' || placement === 'auto') {
    return { y0: (metrics.top ?? 0.78) * format.h, y1: format.h, source: 'estimate', placement };
  }
  const centerY = placement === 'object' ? Number(opt.at?.y) * format.h : format.h / 2;
  return { y0: centerY - height / 2, y1: centerY + height / 2, source: 'estimate', placement };
}

/** 竖向带判定：subject 墨迹/文字框是否压进字幕带。 */
export function overlapsBand(rect, band) {
  if (!Array.isArray(rect) || !band) return false;
  const [, y, , h] = rect;
  return y < band.y1 && y + h > band.y0;
}
