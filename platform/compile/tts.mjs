/**
 * TTS 适配器：把 scripts/providers/tts.mjs 包成 resolve 认识的形状。
 *
 * resolve 需要三样：语音时长、音频路径、词级时间（可空）。
 * edge 走 WordBoundary 实测时间；volc 不产出时间戳，words 为 null，
 * plan 侧会对 cue 降级为字符等比摊并 warn，不抛异常。
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { hasVolcTts } from '../../scripts/config.mjs';

export function createTts({ provider, voice, outDir }) {
  // provider 是内部选择：配置完整的火山凭证时优先火山，否则零密钥 Edge。
  const aliases = { edge: 'edge-tts', volc: 'volc-tts' };
  const selected = provider || (hasVolcTts() ? 'volc-tts' : 'edge-tts');
  const full = aliases[selected] ?? selected;
  let module = null;
  const load = async () => {
    if (!module) module = await import('../../scripts/providers/tts.mjs');
    return module;
  };

  return {
    provider: full,
    async synthesize(text) {
      mkdirSync(outDir, { recursive: true });
      const key = createHash('sha1').update(`${full}|${voice || ''}|${text}`).digest('hex').slice(0, 12);
      const outFile = path.join(outDir, `${key}.mp3`);
      const cacheFile = path.join(outDir, `${key}.json`);
      let result = null;
      if (existsSync(outFile) && existsSync(cacheFile)) {
        try {
          const cached = JSON.parse(readFileSync(cacheFile, 'utf8'));
          if (cached && typeof cached === 'object') result = cached;
        } catch { /* 缓存损坏时重新合成 */ }
      }
      if (!result) {
        const { synthesizeSpeech } = await load();
        result = await synthesizeSpeech({ script: text, provider: full, voice, outFile });
        const temp = `${cacheFile}.${process.pid}.tmp`;
        writeFileSync(temp, JSON.stringify({
          durationSec: result.durationSec ?? null,
          boundaries: result.boundaries ?? [],
        }));
        renameSync(temp, cacheFile);
      }
      const words = Array.isArray(result.boundaries) && result.boundaries.length
        ? result.boundaries.map((b) => ({ text: b.text, start: b.offset, end: b.end }))
        : null;
      return {
        duration: result.durationSec ?? null,
        // `job:` 由宿主重写成任务目录下的静态 URL，和 composition 放在同一个 out/ 里
        src: `job:${path.relative(path.dirname(outDir), outFile).split(path.sep).join('/')}`,
        words,
      };
    },
  };
}
