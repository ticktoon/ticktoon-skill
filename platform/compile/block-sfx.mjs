/**
 * block 声明的编译期音效轨。
 *
 * 画面与声音共用同一份字符时间戳：emit 把时间戳注入 block 参数，同时把音效
 * 展开成 protocol audio[]。运行时不再尝试跨 canvas / audio 发消息。
 *
 * 两种出声方式：
 *   - 离散事件（默认）：每 N 个可见字符一声短音效，events 里逐条列出。
 *   - 循环片段（track.loop）：实录环境声（如 1s 键盘声）从首字符铺到末字符，
 *     block-sfx 只给起止与时长，铺瓦成连续事件由 assemble 负责，保证引擎的
 *     单次触发 sfx 模型也能无缝循环。
 *
 * track.linePrefix 用于剥离行首排版标记（例如新闻重点行的 *），剥离发生在
 * 计时之前，保证音效窗口与画面上真正出现的字符数一致。
 */
import { round3 } from './diag.mjs';

export function buildBlockSfxTrack(track, params) {
  if (!track || track.type !== 'typing') return null;

  const text = String(params[track.textParam || 'text'] ?? '');
  // 固定模板可以不暴露 cps 参数：track.cps 作为 block 契约的固定节拍。
  const cps = Number(params[track.cpsParam || 'cps'] ?? track.cps ?? 12);
  const rate = Number.isFinite(cps) && cps > 0 ? cps : 12;
  const step = 1 / rate;
  const start = Number(track.start ?? 0);
  const lineGap = Number(track.lineGap ?? 0);
  const every = Math.max(1, Math.floor(Number(track.every ?? 1)));
  // 行首标记只做版式提示（例如新闻重点行），不占字符时间戳。
  const linePrefix = typeof track.linePrefix === 'string' ? track.linePrefix : '';

  let cursor = start;
  let visible = 0;
  const lines = String(text).split('\n').map((rawLine, lineIndex, all) => {
    const line = linePrefix && rawLine.startsWith(linePrefix)
      ? rawLine.slice(linePrefix.length) : rawLine;
    const chars = [...line].map((ch) => {
      const at = round3(cursor);
      cursor += step;
      let sound = false;
      if (!/\s/.test(ch)) {
        visible += 1;
        sound = visible % every === 0;
      }
      return { ch, at, sound };
    });
    if (lineIndex < all.length - 1) cursor += lineGap;
    return chars;
  });

  const events = [];
  // 循环轨不再发离散敲击；只保留 loop 描述符。
  if (!track.loop) {
    for (const line of lines) {
      for (const ch of line) {
        if (ch.sound && track.sfx) events.push({ sfx: track.sfx, at: ch.at });
      }
    }
  }

  let loop = null;
  if (track.loop?.sfx) {
    const first = lines[0]?.[0]?.at;
    const lastLine = lines[lines.length - 1];
    const last = lastLine?.[lastLine.length - 1]?.at;
    if (Number.isFinite(first) && Number.isFinite(last) && last > first) {
      loop = {
        sfx: track.loop.sfx,
        // 首字符出现 → 末字符出现，与画面打字窗口完全对齐
        at: first,
        duration: round3(last - first),
        fadeOut: Number.isFinite(Number(track.loop.fadeOut)) ? Number(track.loop.fadeOut) : 0.06,
      };
    }
  }

  return { lines, events, end: round3(cursor), loop };
}
