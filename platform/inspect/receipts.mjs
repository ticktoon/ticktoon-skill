/**
 * 帧凭据去重：同一单元可能有 ink / text / caption 多条回执。
 * 文字逐条回执按 idx 配对（同一帧重绘的绘制顺序稳定）；并集凭据单独占一个槽。
 */
export function mergeFrameReceipts(frame, time) {
  const textTag = (item) => (item.kind === 'text'
    ? (item.aggregate === true || item.idx == null ? 'agg' : `i${item.idx}`)
    : '');
  const merged = new Map();
  for (const item of frame) {
    merged.set(`${item.scene}/${item.unit}/${item.kind || 'ink'}/${textTag(item)}`, item);
  }
  return [...merged.values()].map((item) => ({
    t: time,
    scene: item.scene,
    unit: item.unit,
    source: item.source,
    kind: item.kind || 'ink',
    rect: item.rect ? [item.rect.x, item.rect.y, item.rect.w, item.rect.h].map((value) => Math.round(value)) : null,
    ink: item.ink ? [item.ink.x, item.ink.y, item.ink.w, item.ink.h].map((value) => Math.round(value)) : null,
    ...(item.kind === 'text'
      ? { idx: item.idx ?? null, label: item.label ?? null, aggregate: item.aggregate === true }
      : {}),
  }));
}
