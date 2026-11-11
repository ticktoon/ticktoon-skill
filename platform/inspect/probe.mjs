/**
 * tt probe —— 渲染一个时刻，把该帧的全部布局凭据摊开。
 *
 * 目的不是"再出一张静帧"，而是让人和 LLM 在改图时能直接问：
 * "这一秒画面里到底有哪些东西、各自离安全框多远、挤不挤"。
 * 因此输出保留 kind / unit / source / bbox / 四边距离 / 字幕带判定，
 * 与 QA 共用同一套 caption-zone 几何，不另算一份。
 */
import { buildProject } from '../project/build.mjs';
import { sampleFilm } from './sample.mjs';
import {
  activeCueAt,
  bandFromCaptionInk,
  captionInkAt,
  captionPlacement,
  estimatedCaptionBand,
  overlapsBand,
} from './caption-zone.mjs';

const KIND_ORDER = ['ink', 'text', 'caption'];
const hasBox = (item) => Array.isArray(item.ink) && item.ink[2] > 0 && item.ink[3] > 0;

export async function probeFrame({ root, dir, t, tts = null, captionOverride = null, log = () => {} }) {
  const built = await buildProject({ root, dir, tts, captionOverride, write: false, receipts: true });
  if (!built.ok) return { ok: false, report: built.report, error: '构建失败' };

  const duration = Number(built.composition?.duration) || 0;
  if (duration && t > duration) {
    return { ok: false, report: built.report, error: `t=${t}s 超出片长 ${duration.toFixed(2)}s` };
  }

  const sampled = await sampleFilm({
    root,
    dir,
    planned: built.planned,
    composition: built.composition,
    report: built.report,
    times: [t],
    log,
  });
  if (sampled.pageErrors.length) {
    return { ok: false, report: built.report, error: sampled.pageErrors[0], pageErrors: sampled.pageErrors };
  }

  const format = built.storyboard.format;
  const safeMargin = built.recipe?.rules?.safeMargin ?? 0.055;
  const W = format.w;
  const H = format.h;
  const marginX = safeMargin * W;
  const marginY = safeMargin * H;
  const captionReceipts = sampled.receipts.filter((item) => item.kind === 'caption' && hasBox(item));
  const captionScenes = new Set(built.planned.scenes.filter((scene) => (scene.cues || []).length > 0).map((scene) => scene.id));
  const placement = captionPlacement(built.caption);

  const entries = sampled.receipts.map((item) => {
    const ink = hasBox(item) ? item.ink : null;
    let safe = null;
    let captionBand = null;
    if (ink) {
      const [x, y, w, h] = ink;
      safe = {
        left: Math.round(x - marginX),
        top: Math.round(y - marginY),
        right: Math.round(W - marginX - (x + w)),
        bottom: Math.round(H - marginY - (y + h)),
      };
    }
    // 字幕自己的凭据不再拿自己判"压字幕带"；其余主体按与 qa 相同的规则判。
    if (item.kind !== 'caption' && captionScenes.has(item.scene)) {
      const cue = activeCueAt(built.planned, item.scene, item.t);
      if (cue) {
        const capInk = captionInkAt(captionReceipts, item.scene, item.t);
        const band = capInk
          ? bandFromCaptionInk(capInk, placement, H)
          : estimatedCaptionBand({ format, caption: built.caption, cue });
        captionBand = {
          placement: band.placement,
          y0: Math.round(band.y0),
          y1: Math.round(band.y1),
          source: band.source,
          overlap: ink ? overlapsBand(ink, band) : false,
        };
      }
    }
    return {
      kind: item.kind,
      scene: item.scene,
      unit: item.unit,
      source: item.source,
      label: item.label ?? null,
      idx: item.idx ?? null,
      aggregate: item.aggregate === true,
      ink,
      safe,
      captionBand,
    };
  });

  const rank = (item) => (KIND_ORDER.includes(item.kind) ? KIND_ORDER.indexOf(item.kind) : KIND_ORDER.length) * 10
    + (item.kind === 'text' && item.aggregate ? 1 : 0);
  entries.sort((a, b) => rank(a) - rank(b) || (a.idx ?? -1) - (b.idx ?? -1));

  return {
    ok: true,
    t,
    duration,
    format: { w: W, h: H },
    safe: { marginX: Math.round(marginX), marginY: Math.round(marginY) },
    receipts: entries,
    coverage: sampled.coverage,
    report: built.report,
  };
}
