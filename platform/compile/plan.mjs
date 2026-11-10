/**
 * ③ plan —— 时间链上唯一的权威。
 *
 * 三件事，顺序不能换：
 *   1. 定每场时长与起点（旁白场 = leadIn + speech + hold，静默场用作者给的 duration）
 *   2. 把 element 的 `at` 解析成场景相对秒（秒直通，beat 名查表）
 *   3. 切字幕 cue，并把逐字时间摊进去
 *
 * 第 2 步的 beat 只允许指向本场：允许跨场之后，改一场的时长会让另一场的元素悄悄消失，
 * 而画面上只表现为"少了一行字"。报错逼人把 beat 写进正确的场，是唯一能在编译期暴露它的时机。
 */
import { round3 } from './diag.mjs';

const CJK = /[\u2e80-\u303f\u3040-\u9fff\uac00-\ud7af\uf900-\ufaff\ufe30-\ufe4f\uff00-\uffef]/;
const SILENT = /[，。！？；：、,.!?;:…—\s"'（）()《》「」【】]/;
const SENTENCE_END = /[。！？；!?;]/;

/** 按标点与宽度把一句旁白切成若干"显示单元"。 */
function splitToPieces(text, maxWidth, captionPx) {
  const charWidth = (ch) => (CJK.test(ch) ? captionPx : captionPx * 0.55);
  const width = (s) => [...s].reduce((sum, ch) => sum + charWidth(ch), 0);

  const sentences = String(text).match(/[^。！？；!?;]+[。！？；!?;]?/g) || [String(text)];
  const pieces = [];

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    if (width(trimmed) <= maxWidth) {
      pieces.push(trimmed);
      continue;
    }
    // 超宽：先按次级标点断，再按字数硬断
    const chunks = trimmed.split(/(?<=[，、,])/g).filter(Boolean);
    for (const chunk of chunks) {
      if (width(chunk) <= maxWidth) {
        pieces.push(chunk.trim());
        continue;
      }
      let line = '';
      for (const ch of chunk) {
        if (line && width(line + ch) > maxWidth) {
          pieces.push(line.trim());
          line = ch;
        } else {
          line += ch;
        }
      }
      if (line.trim()) pieces.push(line.trim());
    }
  }
  return pieces.length ? pieces : [String(text).trim()];
}

const weightOf = (s) => Math.max(1, [...s].filter((ch) => !SILENT.test(ch)).length);

/**
 * 把词级时间对齐到原文：返回每个 word 覆盖的字符区间与实测时间。
 * 对齐是 indexOf 前进式匹配（与 boundariesToWebvtt 同一做法），失败的词直接丢弃。
 */
function alignWords(text, words) {
  const spans = [];
  let cursor = 0;
  for (const w of words) {
    if (!w || typeof w.text !== 'string' || !w.text || !(w.end > w.start)) continue;
    const idx = text.indexOf(w.text, cursor);
    if (idx === -1) continue;
    spans.push({ charStart: idx, charEnd: idx + [...w.text].length, start: w.start, end: w.end });
    cursor = idx + w.text.length;
  }
  return spans;
}

/** 找覆盖某个全局字符位的 span。spans 按字符区间递增，线性扫即可。 */
function spanAt(spans, from, g) {
  for (let k = from; k < spans.length; k += 1) {
    if (spans[k].charEnd <= g) continue;
    if (spans[k].charStart > g) return null;
    return { span: spans[k], at: k };
  }
  return null;
}

/**
 * 生成 cues。`speechStart` 是旁白在场内的起点（= leadIn），cue 的时间轴以场景起点为 0。
 *
 * `words` 是 TTS 实测词级时间（[{text,start,end}]，秒，相对语音起点）：
 *   - 能对齐的 cue 用实测时间（source: "words"），逐字时间不再假设语速恒定；
 *   - 对不齐（覆盖可发音字符 < 50%、words 缺失）→ 降级字符等比摊（source: "estimated"），
 *     对每场 warn 一次，不抛异常。
 */
export function buildCues(narration, speech, { captionPx = 46, width, speechStart, words = null, bag = null, scenePath = '' }) {
  if (!narration) return [];
  const pieces = splitToPieces(narration, width * 0.84, captionPx);
  let groups = pieces.map((text) => ({ text, weight: weightOf(text) }));
  const total = groups.reduce((sum, g) => sum + g.weight, 0);

  // 最短 0.5s 可见：不足就与相邻合并，直到都够长或只剩一组
  const durationOf = (g) => (g.weight / total) * speech;
  for (;;) {
    if (groups.length < 2) break;
    const index = groups.findIndex((g) => durationOf(g) < 0.5);
    if (index < 0) break;
    const other = index + 1 < groups.length ? index + 1 : index - 1;
    const a = Math.min(index, other);
    groups.splice(a, 2, {
      text: groups[a].text + groups[other].text,
      weight: groups[a].weight + groups[other].weight,
    });
  }

  const spans = Array.isArray(words) && words.length ? alignWords(narration, words) : [];
  const wordsProvided = Array.isArray(words) && words.length > 0;
  let warnedSkip = false;

  const cues = [];
  let cursor = speechStart;
  // group.text 是原文连续切片（trim 过），用前进式 indexOf 找到它在原文里的区间。
  let textCursor = 0;
  for (const group of groups) {
    const span = (group.weight / total) * speech;
    const start = cursor;
    const end = cursor + span;
    cursor = end;

    const list = [...group.text];
    const globalStart = narration.indexOf(group.text, textCursor);
    textCursor = globalStart >= 0 ? globalStart + group.text.length : textCursor;

    // 先按等比摊算一遍；有词级对齐且覆盖过半时改用实测时间。
    let chars = [];
    let source = 'estimated';
    const speakableIdx = list.map((ch, i) => (SILENT.test(ch) ? -1 : i)).filter((i) => i >= 0);
    if (spans.length && globalStart >= 0) {
      const measured = new Map(); // 显示序号 → {start,end}（相对语音起点）
      let covered = 0;
      let scanFrom = 0;
      for (const i of speakableIdx) {
        const hit = spanAt(spans, scanFrom, globalStart + i);
        if (!hit) continue;
        scanFrom = hit.at;
        const { span: sp } = hit;
        const unit = (sp.end - sp.start) / (sp.charEnd - sp.charStart);
        measured.set(i, {
          start: sp.start + unit * (globalStart + i - sp.charStart),
          end: sp.start + unit * (globalStart + i + 1 - sp.charStart),
        });
        covered += 1;
      }
      if (covered * 2 >= speakableIdx.length) {
        source = 'words';
        let prevEnd = null;
        chars = list.map((ch, i) => {
          const m = measured.get(i);
          let t0 = m ? m.start : prevEnd;
          let t1 = m ? m.end : (measured.get(i + 1) ? measured.get(i + 1).start : null);
          if (t0 == null) t0 = Math.max(start, speechStart);
          if (t1 == null) t1 = t0;
          // 标点/未覆盖字符夹在相邻实测时间之间；全部 clamp 进 cue 区间，
          // 不然逐字动画会越过 cue 切换点亮到下一行去。
          t0 = Math.max(start, Math.min(end, speechStart + t0));
          t1 = Math.max(t0, Math.min(end, speechStart + t1));
          prevEnd = t1;
          return { text: ch, start: round3(t0), end: round3(t1) };
        });
      }
    }
    if (source !== 'words') {
      const per = span / Math.max(1, list.length);
      chars = list.map((ch, i) => ({ text: ch, start: round3(start + i * per), end: round3(start + (i + 1) * per) }));
      if (wordsProvided && !warnedSkip && bag) {
        warnedSkip = true;
        bag.warn('nice', 'CUE_WORDS_SKIPPED', scenePath,
          '词级时间与旁白文本对不齐（字数或标点差异），该场字幕降级为字符等比摊；时间仍随 cue 走，不会漂出场景');
      }
    }

    cues.push({ text: group.text, start: round3(start), end: round3(end), source, chars });
  }
  return cues;
}

/**
 * @returns {{ scenes, duration, bag }}  scenes 里带 start / dur / at / rect 归一化结果
 */
export function planStoryboard({ storyboard, resolved, format, bag, captionPx = 46 }) {
  const pacing = resolved.pacing || { leadIn: 0.28, hold: 0.55 };
  const scenes = [];
  let cursor = 0;

  storyboard.scenes.forEach((scene, si) => {
    const speech = resolved.scenes[si]?.speech ?? null;
    let duration;
    if (speech != null) {
      duration = round3(pacing.leadIn + speech + pacing.hold);
    } else {
      duration = round3(scene.duration);
    }
    if (!(duration > 0)) {
      bag.error('PLAN_ZERO_DURATION', `scenes[${si}]`,
        `场景 ${scene.id} 算出来时长是 ${duration}；旁白为空且没有 duration`);
      duration = 0.6;
    }

    const speechStart = speech != null ? pacing.leadIn : 0;
    const cues = speech != null
      ? buildCues(scene.narration, speech, {
          captionPx,
          width: format.w,
          speechStart,
          words: resolved.scenes[si]?.words,
          bag,
          scenePath: `scenes[${si}]`,
        })
      : [];

    scenes.push({
      ...scene,
      index: si,
      start: round3(cursor),
      duration,
      speech,
      speechStart,
      cues,
      elements: [],
    });
    cursor = round3(cursor + duration);
  });

  // 第二遍：element 的 at / dur 依赖场景起点与时长
  storyboard.scenes.forEach((scene, si) => {
    const target = scenes[si];
    scene.elements.forEach((el, ei) => {
      const path = `scenes[${si}].elements[${ei}]`;
      let at;

      if (typeof el.at === 'number') {
        at = el.at;
      } else {
        const beat = storyboard.beats[el.at];
        if (beat === undefined) {
          bag.error('BEAT_UNKNOWN', `${path}.at`,
            `未定义的 beat "${el.at}"；可用：${Object.keys(storyboard.beats).join(' / ') || '（storyboard 没有 beats）'}`);
          at = 0;
        } else {
          const rel = beat - target.start;
          if (rel < -1e-3 || rel >= target.duration + 1e-3) {
            bag.error('BEAT_CROSS_SCENE', `${path}.at`,
              `beat "${el.at}" = ${beat}s 落在 ${target.start}–${round3(target.start + target.duration)}s（场景 ${target.id}）之外。` +
              `beats 只能指向本场；跨场引用会在改时长时让元素静默消失`);
            at = 0;
          } else if (rel < 0) {
            at = 0;
            bag.warn('should', 'BEAT_SNAPPED', `${path}.at`, `beat "${el.at}" 与场景起点相差 ${Math.abs(rel).toFixed(4)}s，已吸附到 0`);
          } else {
            at = Math.min(rel, target.duration - 1e-3);
          }
        }
      }

      if (at < 0) {
        bag.error('ELEMENT_AT_NEGATIVE', `${path}.at`, `at 不能是负数`);
        at = 0;
      }
      if (at >= target.duration) {
        bag.error('ELEMENT_OUT_OF_SCENE', `${path}.at`,
          `at=${at}s 已经到场景 ${target.id} 的末尾（时长 ${target.duration}s），这个元素永远不会出现`);
        at = 0;
      }

      const avail = round3(target.duration - at);
      const dur = el.dur == null ? avail : Math.min(round3(el.dur), avail);
      if (el.dur != null && el.dur > avail) {
        bag.warn('should', 'ELEMENT_DUR_CLIPPED', `${path}.dur`,
          `dur=${el.dur}s 超出本场剩余 ${avail}s，已截断到场景末尾`);
      }

      target.elements.push({
        ...el,
        at: round3(at),
        dur,
        // 音效的落地时刻：element 起点 + sfxAt（缺省等于入场时长，即"物件落地那一刻"）
        sfxAt: round3(at + (el.sfxAt == null ? (el.meta?.motion?.enter ?? 0.5) : el.sfxAt)),
      });
    });
  });

  return { scenes, duration: cursor };
}
