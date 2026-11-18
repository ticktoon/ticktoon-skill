import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createTts } from '../../platform/compile/tts.mjs';

test('火山凭证齐备时自动选择 volc，显式 edge 仍可覆盖', () => {
  const previous = {
    appId: process.env.VOLC_TTS_APP_ID,
    token: process.env.VOLC_TTS_ACCESS_TOKEN,
  };
  try {
    process.env.VOLC_TTS_APP_ID = 'provider-test-app';
    process.env.VOLC_TTS_ACCESS_TOKEN = 'provider-test-token';
    assert.equal(createTts({ outDir: 'out/tts' }).provider, 'volc-tts');
    assert.equal(createTts({ provider: 'edge', outDir: 'out/tts' }).provider, 'edge-tts');
  } finally {
    if (previous.appId === undefined) delete process.env.VOLC_TTS_APP_ID;
    else process.env.VOLC_TTS_APP_ID = previous.appId;
    if (previous.token === undefined) delete process.env.VOLC_TTS_ACCESS_TOKEN;
    else process.env.VOLC_TTS_ACCESS_TOKEN = previous.token;
  }
});

test('相同 provider、音色和文案直接读取 TTS 缓存，不重新请求 provider', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ticktoon-tts-cache-'));
  try {
    const outDir = path.join(dir, 'tts');
    mkdirSync(outDir, { recursive: true });
    const text = '同一段旁白只需要合成一次';
    const voice = 'cache-test-voice';
    const key = createHash('sha1').update(`edge-tts|${voice}|${text}`).digest('hex').slice(0, 12);
    writeFileSync(path.join(outDir, `${key}.mp3`), Buffer.from('cached-audio'));
    writeFileSync(path.join(outDir, `${key}.json`), JSON.stringify({
      durationSec: 2.75,
      boundaries: [{ text: '同一段旁白只需要合成一次', offset: 0.1, end: 2.65 }],
    }));
    const tts = createTts({ provider: 'edge', voice, outDir });
    const first = await tts.synthesize(text);
    const second = await tts.synthesize(text);
    for (const result of [first, second]) {
      assert.equal(result.duration, 2.75);
      assert.deepEqual(result.words, [{ text: '同一段旁白只需要合成一次', start: 0.1, end: 2.65 }]);
      assert.equal(result.src, `job:tts/${key}.mp3`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
