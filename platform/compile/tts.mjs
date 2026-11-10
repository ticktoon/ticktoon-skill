/**
 * TTS 适配器：把 scripts/providers/tts.mjs 包成 resolve 认识的形状。
 *
 * resolve 需要三样：语音时长、音频路径、词级时间（可空）。
 * edge 走 WordBoundary 实测时间；volc 不产出时间戳，words 为 null，
 * plan 侧会对 cue 降级为字符等比摊并 warn，不抛异常。
 */
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export function createTts({ provider = 'edge-tts', voice, outDir }) {
  // 短别名与文档口径一致（SKILL.md 写的是 --tts edge / volc），这里归一成 provider 全名。
  const aliases = { edge: 'edge-tts', volc: 'volc-tts' };
  const full = aliases[provider] ?? provider;
  let module = null;
  const load = async () => {
    if (!module) module = await import('../../scripts/providers/tts.mjs');
    return module;
  };

  return {
    provider: full,
    async synthesize(text) {
      const { synthesizeSpeech } = await load();
      mkdirSync(outDir, { recursive: true });
      const key = createHash('sha1').update(`${full}|${voice || ''}|${text}`).digest('hex').slice(0, 12);
      const outFile = path.join(outDir, `${key}.mp3`);
      const result = await synthesizeSpeech({ script: text, provider: full, voice, outFile });
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
