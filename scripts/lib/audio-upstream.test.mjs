import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { renderPlan } from '../../platform/audio/upstream/music.mjs';
import { compose } from '../../platform/audio/upstream/bgm.mjs';
import score from '../../platform/audio/presets/chronicle-score.mjs';
import sound from '../../platform/audio/presets/chronicle-sound.mjs';

const hash = (array) => createHash('sha256').update(Buffer.from(array.buffer)).digest('hex');
const plan = {
  duration: 4, bpm: 84, offset: 0.5, music: { seed: 'parity' },
  sections: [{ at: 0, energy: 1 }, { at: 2, energy: 3, hit: true }],
  moments: [{ kind: 'hit', t: 2 }],
  sfx: [{ t: 1, type: 'wood' }, { t: 2, type: 'impact', gain: 1.2 }],
  logoAt: 3.4,
};
const voice = { lines: [{ start: 1, end: 3 }], rms: 0.07, duckDb: 8, gapDb: 11 };

test('完整配乐与音效保持原版 PCM（含确定性 seed）', () => {
  const a = renderPlan(plan, { score, palette: sound, voice });
  const b = renderPlan(plan, { score, palette: sound, voice });
  assert.equal(hash(a.L), 'a2143fb979cb6ba0c3e4c0ba64b33750867f192e0b7d5c8f516d885f8c0789ac');
  assert.equal(hash(a.R), '7cb4e933895d4257fd69d966ea4953dbd7365c38a9dd9c5d2b14e6223e44566f');
  assert.equal(hash(a.L), hash(b.L));
  assert.equal(hash(a.R), hash(b.R));
});

test('轻量 BGM 保持原版 PCM', () => {
  const out = compose({
    style: 'history', duration: 4, lines: voice.lines,
    chapters: [{ start: 0 }, { start: 2 }], voiceRms: 0.07, seed: 'parity',
  });
  assert.equal(hash(out.L), '1a8877dd666da4680f8ac707fd95752a340a8274197b0580a24cc73564904fb5');
  assert.equal(hash(out.R), 'd4cbd186516e7d843a794f1496d46c14cd7df6355cf5f1953a314ccc84e9849c');
});
