/**
 * L2 像素级检查：只看墨迹、文字与亮度，不猜意图。
 *
 * 输入是抽帧采样带回的真实 receipts（每个元素/字幕在这一帧画到了哪里）与帧平均亮度。
 * 因此这里的每一条都能指到"第几场、哪个元素、哪一帧"，而不是"整体感觉有点挤"。
 *
 * 与 check.mjs 的分工：check 是编译期、看声明值、秒级；qa 是渲染后、看真实像素、要起浏览器。
 * 两者都在各自能确定的范围里下判断，谁也不替谁猜。
 */
import {
  activeCueAt,
  bandFromCaptionInk,
  captionInkAt,
  captionPlacement,
  estimatedCaptionBand,
  overlapsBand,
} from './caption-zone.mjs';

export function runQa({ planned, receipts, luminance, format, safeMargin = 0.055, inkless = new Set(), caption = null }) {
  const W = format.w;
  const H = format.h;
  // 边距按轴各自取比例：竖直方向用 H。用 W 算竖直边距会把 1080p 的上边距抬到 105px，
  // 顶栏版位（0.05H）全部误报——safeMargin 声明的是"占比"，不是"像素"。
  const marginX = safeMargin * W;
  const marginY = safeMargin * H;
  const issues = [];

  const add = (level, code, at, msg) => issues.push({ level, code, ...at, msg });

  const hasBox = (item) => item.ink && item.ink[2] > 0 && item.ink[3] > 0;
  // 三类凭据分工：ink = 笔迹，text = code 场文字，caption = 字幕自身文字框。
  const inkReceipts = receipts.filter((item) => item.kind !== 'text' && item.kind !== 'caption');
  const textReceipts = receipts.filter((item) => item.kind === 'text');
  const captionReceipts = receipts.filter((item) => item.kind === 'caption');
  // 文字并集凭据（aggregate）只用于安全框/字幕带这类"整体在哪里"的断言；
  // 逐条凭据（idx）只用于 text-text 碰撞。旧调用路径没有逐条信息，也认不出
  // aggregate 标记——此时把每条文字凭据当并集用，行为与改造前一致。
  const textAggregates = textReceipts.filter((item) => item.aggregate === true);
  const textForSafe = textAggregates.length
    ? textAggregates
    : textReceipts.filter((item) => item.idx == null);
  const textItems = textReceipts.filter((item) => item.aggregate !== true && item.idx != null);
  const safeTextSet = new Set(textForSafe);
  const subjectReceipts = receipts.filter((item) => item.kind !== 'caption' && hasBox(item)
    && (item.kind !== 'text' || safeTextSet.has(item)));

  // 1. 墨迹为空：block 画了，但什么都没留下（字体没加载 / 颜色透明 / 文本为空）
  // inkless 的 block（scene.crayon 这类整幅底图）按契约就不留墨迹，不在此列
  for (const item of inkReceipts) {
    if (inkless.has(item.block)) continue;
    if (!item.ink || item.ink[2] <= 0 || item.ink[3] <= 0) {
      add('must', 'QA_INK_EMPTY', { scene: item.scene, element: item.element, t: item.t },
        `${item.block} 在这一帧没有任何墨迹（画布上画了但不可见）`);
    }
  }

  // 2. 出界：墨迹越过安全边距 >2px 记 should；文字框越界是硬错误（文字不产生笔迹回执，
  //    这是它唯一能被自动抓住的地方）。
  for (const item of inkReceipts) {
    if (!item.ink) continue;
    const [x, y, w, h] = item.ink;
    const over = [];
    if (x < marginX - 2) over.push(`左 ${Math.round(marginX - x)}px`);
    if (y < marginY - 2) over.push(`上 ${Math.round(marginY - y)}px`);
    if (x + w > W - marginX + 2) over.push(`右 ${Math.round(x + w - (W - marginX))}px`);
    if (y + h > H - marginY + 2) over.push(`下 ${Math.round(y + h - (H - marginY))}px`);
    if (over.length) {
      add('should', 'QA_OUT_OF_SAFE', { scene: item.scene, element: item.element, t: item.t },
        `${item.block} 墨迹越过安全边距：${over.join('，')}`);
    }
  }
  for (const item of textForSafe) {
    if (!item.ink) continue;
    const [x, y, w, h] = item.ink;
    const over = [];
    if (x < marginX - 2) over.push(`左 ${Math.round(marginX - x)}px`);
    if (y < marginY - 2) over.push(`上 ${Math.round(marginY - y)}px`);
    if (x + w > W - marginX + 2) over.push(`右 ${Math.round(x + w - (W - marginX))}px`);
    if (y + h > H - marginY + 2) over.push(`下 ${Math.round(y + h - (H - marginY))}px`);
    if (over.length) {
      add('must', 'QA_TEXT_OUT_OF_SAFE', { scene: item.scene, element: item.element, t: item.t },
        `${item.block} 文字框越过安全边距：${over.join('，')}`);
    }
  }

  // 3. 碰撞：同一帧两个元素墨迹交叠 >8%（按较小者面积算）。
  //    text-ink 不参与：白板标注本来就写在场景墨迹上，没有"必须分开"的正当性判据；
  //    text-text 参与（见 3b）：两个文字互相压住没有任何正当理由。
  //    caption 不参与：字幕是刻意叠放层，与文字的关系由第 4 节的字幕带规则管。
  const measureOverlap = (a, b) => {
    const ix = Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]));
    const iy = Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));
    const smaller = Math.min(a[2] * a[3], b[2] * b[3]);
    return smaller > 0 ? (ix * iy) / smaller : 0;
  };
  const byT = new Map();
  for (const item of inkReceipts) {
    if (!item.ink) continue;
    const key = `${item.t}`;
    if (!byT.has(key)) byT.set(key, []);
    byT.get(key).push(item);
  }
  for (const [t, list] of byT) {
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        const ratio = measureOverlap(a.ink, b.ink);
        if (ratio > 0.08) {
          add('should', 'QA_COLLISION', { scene: a.scene, element: b.element, t: Number(t) },
            `${a.block} 与 ${b.block} 墨迹交叠 ${(ratio * 100).toFixed(0)}%`);
        }
      }
    }
  }

  // 3b. 同场文字碰撞：同一帧、同一场内的逐条文字两两比，交叠率 = 交叠面积 / 较小者面积。
  //     并集凭据不参与（它必然包含每一条）。>12% 是 must（正常排版不该压住），
  //     5–12% 是 should（少量相交通常是字号/行距没调好）。
  const textOverlapRatio = (ratio) => (ratio > 0.12 ? 'must' : ratio >= 0.05 ? 'should' : null);
  const labelOf = (item) => String(item.label ?? '（未记录文字）').replace(/\s+/g, ' ').trim() || '（未记录文字）';
  const textByFrame = new Map();
  for (const item of textItems) {
    if (!item.ink) continue;
    const key = `${item.scene}|${Number(item.t).toFixed(3)}`;
    if (!textByFrame.has(key)) textByFrame.set(key, new Map());
    const list = textByFrame.get(key);
    // 同一帧重绘会送来同一批逐条凭据；idx 是绘制顺序，重绘稳定。
    // 没有 idx 的旧凭据才退回 label + 整数框。
    const dedupe = item.idx != null
      ? `i${item.idx}`
      : `${labelOf(item)}|${item.ink.map((v) => Math.round(v)).join(',')}`;
    if (!list.has(dedupe)) list.set(dedupe, item);
  }
  for (const [key, map] of textByFrame) {
    const list = [...map.values()];
    const t = Number(key.split('|').pop());
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        const ratio = measureOverlap(a.ink, b.ink);
        const level = textOverlapRatio(ratio);
        if (!level) continue;
        add(level, 'QA_TEXT_OVERLAP', { scene: a.scene, element: 'code', t },
          `文字「${labelOf(a)}」与「${labelOf(b)}」重叠 ${(ratio * 100).toFixed(0)}%`);
      }
    }
  }

  // 4. 字幕区：主体（笔迹 + 文字）压进字幕带。位置感知 uses.captions.at：
  //    top 看上带、bottom 看下带、center/{x,y} 看字幕框上下沿；code 场用实拍字幕框定边界。
  const captionScenes = new Set(planned.scenes.filter((scene) => (scene.cues || []).length > 0).map((scene) => scene.id));
  const placement = captionPlacement(caption);
  for (const item of subjectReceipts) {
    if (!captionScenes.has(item.scene)) continue;
    const cue = activeCueAt(planned, item.scene, item.t);
    if (!cue) continue;
    const capInk = captionInkAt(captionReceipts, item.scene, item.t);
    const band = capInk
      ? bandFromCaptionInk(capInk, placement, H)
      : estimatedCaptionBand({ format, caption, cue });
    if (!overlapsBand(item.ink, band)) continue;
    add('should', 'QA_CAPTION_ZONE', { scene: item.scene, element: item.element, t: item.t },
      `${item.block} ${item.kind === 'text' ? '文字框' : '墨迹框'} [${item.ink.join(', ')}] 压进` +
      `${band.placement === 'top' ? '顶部' : '底部'}字幕带 ${Math.round(band.y0)}–${Math.round(band.y1)}px`);
  }

  // 5. 空帧：整帧平均亮度 <6/255，且那一帧确实在放（不是片头片尾的黑场）
  for (const frame of luminance) {
    if (frame.mean < 6) {
      add('should', 'QA_EMPTY_FRAME', { t: frame.t }, `t=${frame.t}s 平均亮度 ${frame.mean}，接近全黑`);
    }
  }

  // 6. 声明了却从未出现在任何采样帧：不是渲染错，是这一场太短或元素被挡住
  const seen = new Set(receipts.map((item) => `${item.scene}/${item.element}`));
  for (const scene of planned.scenes) {
    for (const el of scene.elements) {
      if (!seen.has(`${scene.id}/${el.id}`)) {
        add('nice', 'QA_UNSEEN', { scene: scene.id, element: el.id },
          `${el.block} 在所有采样帧里都没出现（可能是采样点没落在它的可见区间）`);
      }
    }
  }

  const must = issues.filter((item) => item.level === 'must');
  return {
    ok: must.length === 0,
    issues,
    summary: {
      must: must.length,
      should: issues.filter((item) => item.level === 'should').length,
      nice: issues.filter((item) => item.level === 'nice').length,
    },
  };
}
