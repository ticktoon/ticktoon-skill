/**
 * abi 8 only —— 执行 recipe.verify 的可机器断言，并在 qa 阶段守住 forbid。
 *
 * 数据源与 tt stills 同源：sampleFilm 带回的 receipts —— 每个元素在该帧的真实墨迹框
 * `[x, y, w, h]`（逻辑像素）。没有墨迹框的元素降级为 skip + warn，不静默通过也不误报。
 *
 * 本期只认三条断言；其余 assert 名一律 warn + skip。新增断言时在这里加一个分支，
 * 不改 runQa 的像素规则。
 */
import { recipeForbidViolations } from '../compile/recipe.mjs';
import {
  activeCueAt,
  bandFromCaptionInk,
  captionInkAt,
  captionPlacement,
  estimatedCaptionBand,
  overlapsBand,
} from './caption-zone.mjs';

const KNOWN_ASSERTS = new Set([
  'ink.insideSafe',
  'element.count.gte',
  'caption.noOverlapSubject',
]);

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

/**
 * @returns {{ issues: Array, results: Array }}
 *   issues 复用 runQa 的形状（level / code / scene / element / t / msg），must 计入 qa.ok。
 *   results 是逐条断言的机器可读结论：pass / fail / skip。
 */
export function runRecipeVerify({ recipe, planned, receipts, format, caption = null }) {
  const issues = [];
  const results = [];
  if (!recipe || recipe.abi !== '8') return { issues, results };

  const W = format.w;
  const H = format.h;
  const verify = Array.isArray(recipe.verify) ? recipe.verify : [];
  const hasBox = (item) => Array.isArray(item.ink) && item.ink[2] > 0 && item.ink[3] > 0;
  // caption 是字幕自身的凭据，不是"主体"；主体 = 笔迹 + 文字。
  // 文字逐条凭据（idx）只服务 text-text 碰撞；安全框/字幕带断言用并集凭据，
  // 与改造前"每帧一条 union"的口径一致，避免同一处越界被逐条重复报。
  // 旧调用路径没有 aggregate 标记时，退回没有 idx 的文字凭据。
  const textReceipts = receipts.filter((item) => item.kind === 'text' && hasBox(item));
  const textAggregates = textReceipts.filter((item) => item.aggregate === true);
  const withText = textAggregates.length
    ? textAggregates
    : textReceipts.filter((item) => item.idx == null);
  const withInk = receipts.filter((item) => item.kind !== 'text' && item.kind !== 'caption' && hasBox(item));
  const subjects = [...withInk, ...withText];
  const captionReceipts = receipts.filter((item) => item.kind === 'caption' && hasBox(item));
  // code 场没有 block element，但它本身就是一整个内容单元；element.count.gte 数的是内容，不是 block 数。
  const totalElements = planned.scenes.reduce(
    (sum, scene) => sum + scene.elements.length + (typeof scene.code === 'string' && scene.code.trim() ? 1 : 0),
    0,
  );
  const captionScenes = new Set(planned.scenes.filter((scene) => (scene.cues || []).length > 0).map((scene) => scene.id));

  const result = (assert, at, status, detail = {}) => results.push({ assert, at, status, ...detail });

  for (const item of verify) {
    const at = isFiniteNumber(item.at) ? item.at : 0;
    const name = item.assert;
    const args = item.args && typeof item.args === 'object' && !Array.isArray(item.args) ? item.args : {};

    if (!KNOWN_ASSERTS.has(name)) {
      issues.push({
        level: 'should', code: 'VERIFY_ASSERT_UNKNOWN', t: at,
        msg: `[${name}] @${at}s 本期未实现，已跳过（不静默通过）`,
      });
      result(name, at, 'skip', { reason: 'unknown assert' });
      continue;
    }

    if (name === 'ink.insideSafe') {
      const margin = Number(args.margin);
      if (!(margin >= 0 && margin <= 0.5)) {
        issues.push({
          level: 'must', code: 'VERIFY_ARGS_INVALID', t: at,
          msg: `[ink.insideSafe] @${at}s 需要 args.margin ∈ [0, 0.5]，收到 ${JSON.stringify(args.margin)}`,
        });
        result(name, at, 'fail', { reason: 'invalid args' });
        continue;
      }
      if (!subjects.length) {
        issues.push({
          level: 'info', code: 'VERIFY_SKIP', t: at,
          msg: `[ink.insideSafe] @${at}s 没有任何元素带回墨迹框或文字框（scene.* 块可能为 inkless），已跳过`,
        });
        result(name, at, 'skip', { reason: 'no receipts' });
        continue;
      }

      const mx = margin * W;
      const my = margin * H;
      const bad = [];
      for (const entry of subjects) {
        const [x, y, w, h] = entry.ink;
        const over = [];
        if (x < mx) over.push(`左越界 ${Math.round(mx - x)}px`);
        if (y < my) over.push(`上越界 ${Math.round(my - y)}px`);
        if (x + w > W - mx) over.push(`右越界 ${Math.round(x + w - (W - mx))}px`);
        if (y + h > H - my) over.push(`下越界 ${Math.round(y + h - (H - my))}px`);
        if (over.length) bad.push({ entry, over });
      }
      for (const { entry, over } of bad) {
        const text = entry.kind === 'text';
        issues.push({
          level: 'must', code: text ? 'VERIFY_TEXT_OUTSIDE_SAFE' : 'VERIFY_INK_OUTSIDE_SAFE',
          scene: entry.scene, element: entry.element, t: entry.t,
          msg: `[ink.insideSafe] ${entry.block} ${text ? '文字框' : '墨迹框'} [${entry.ink.join(', ')}] @${entry.t}s 越出 safeMargin ${margin}：${over.join('，')}`,
        });
      }
      result(name, at, bad.length ? 'fail' : 'pass', {
        checked: subjects.length,
        inkChecked: withInk.length,
        textChecked: withText.length,
        failed: bad.length,
      });
      continue;
    }

    if (name === 'element.count.gte') {
      const n = Number(args.n);
      if (!isFiniteNumber(n) || n < 0) {
        issues.push({
          level: 'must', code: 'VERIFY_ARGS_INVALID', t: at,
          msg: `[element.count.gte] @${at}s 需要 args.n 是 ≥0 的数字，收到 ${JSON.stringify(args.n)}`,
        });
        result(name, at, 'fail', { reason: 'invalid args' });
        continue;
      }
      if (totalElements < n) {
        issues.push({
          level: 'must', code: 'VERIFY_ELEMENT_COUNT', t: at,
          msg: `[element.count.gte] @${at}s 全片 element 总数 ${totalElements} < n ${n}`,
        });
        result(name, at, 'fail', { total: totalElements, n });
      } else {
        result(name, at, 'pass', { total: totalElements, n });
      }
      continue;
    }

    // caption.noOverlapSubject
    if (!captionScenes.size) {
      issues.push({
        level: 'info', code: 'VERIFY_SKIP', t: at,
        msg: `[caption.noOverlapSubject] @${at}s 全片没有字幕 cue，已跳过`,
      });
      result(name, at, 'skip', { reason: 'no captions' });
      continue;
    }
    const captionSubjects = subjects.filter((entry) => captionScenes.has(entry.scene));
    if (!captionSubjects.length) {
      issues.push({
        level: 'info', code: 'VERIFY_SKIP', t: at,
        msg: `[caption.noOverlapSubject] @${at}s 有字幕的场里没有任何元素带回墨迹框或文字框，已跳过`,
      });
      result(name, at, 'skip', { reason: 'no receipts' });
      continue;
    }

    // 只在字幕 cue 真正在场的帧上判；顶部字幕看屏幕上带，底部看屏幕下带，
    // code 场优先用 emit 记下的真实字幕文字框来定带边界。
    const placement = captionPlacement(caption);
    const bad = [];
    let checked = 0;
    for (const entry of captionSubjects) {
      const cue = activeCueAt(planned, entry.scene, entry.t);
      if (!cue) continue;
      const capInk = captionInkAt(captionReceipts, entry.scene, entry.t);
      const band = capInk
        ? bandFromCaptionInk(capInk, placement, H)
        : estimatedCaptionBand({ format, caption, cue });
      if (!band) continue;
      checked += 1;
      if (overlapsBand(entry.ink, band)) bad.push({ entry, band, capInk });
    }
    if (!checked) {
      issues.push({
        level: 'info', code: 'VERIFY_SKIP', t: at,
        msg: `[caption.noOverlapSubject] @${at}s 采样帧里没有字幕在场的帧，已跳过`,
      });
      result(name, at, 'skip', { reason: 'no active caption' });
      continue;
    }
    for (const { entry, band, capInk } of bad) {
      issues.push({
        level: 'must', code: 'VERIFY_CAPTION_OVERLAP',
        scene: entry.scene, element: entry.element, t: entry.t,
        msg: `[caption.noOverlapSubject] ${entry.block} ${entry.kind === 'text' ? '文字框' : '墨迹框'} ` +
          `[${entry.ink.join(', ')}] 压进${band.placement === 'top' ? '顶部' : '底部'}字幕带 ` +
          `${Math.round(band.y0)}–${Math.round(band.y1)}px` +
          `（${capInk ? '实拍字幕框' : '配方估算'}）`,
      });
    }
    result(name, at, bad.length ? 'fail' : 'pass', {
      checked,
      inkChecked: captionSubjects.filter((entry) => entry.kind !== 'text').length,
      textChecked: captionSubjects.filter((entry) => entry.kind === 'text').length,
      failed: bad.length,
    });
  }

  return { issues, results };
}

/** abi 8 only：forbid 的机器可判子集——元素必须使用 recipe 声明的 block。 */
export function runRecipeForbid({ recipe, planned }) {
  return recipeForbidViolations({ recipe, planned });
}
