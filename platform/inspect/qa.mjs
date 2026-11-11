/**
 * L2 轻校验：只抓"画了但什么都没留下"。
 *
 * 输入是抽帧采样带回的真实 receipts。这里不再判断安全框、碰撞、文字互压、
 * 字幕带、空帧、亮度——这些都是构图与审美，交给 12 格联系表和人 / agent 看图。
 * 机器只兜底一种真 bug：单元在画布上执行了，却没有产生任何可见墨迹
 * （字体没加载、颜色透明、资源丢失）。
 *
 * template.inkless 的模板（整幅底图类）按契约就不留墨迹，跳过。
 */
export function runQa({ receipts = [], inkless = new Set() }) {
  const issues = [];
  for (const item of receipts) {
    if (item.kind === 'text' || item.kind === 'caption') continue;
    if (inkless.has(item.source)) continue;
    if (!item.ink || item.ink[2] <= 0 || item.ink[3] <= 0) {
      issues.push({
        level: 'must',
        code: 'QA_INK_EMPTY',
        scene: item.scene,
        unit: item.unit,
        t: item.t,
        msg: `${item.source} 在这一帧没有任何墨迹（画布上画了但不可见）`,
      });
    }
  }

  const must = issues.filter((item) => item.level === 'must').length;
  return {
    ok: must === 0,
    issues,
    summary: {
      must,
      should: issues.filter((item) => item.level === 'should').length,
      nice: issues.filter((item) => item.level === 'nice').length,
    },
  };
}
