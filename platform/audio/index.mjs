/**
 * Generative audio adapter: Ticktoon plan → upstream DSP → cached WAV events.
 *
 * score mode: music.mjs renders one accompaniment track (music + effects + voice duck).
 * bgm mode: bgm.mjs renders a music bed, sound.mjs renders a separate effects track.
 * No input audio assets and no manifest entries are involved.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { compose, writeWav as writeBgmWav } from './upstream/bgm.mjs';
import { renderPlan, writeWav as writeMusicWav } from './upstream/music.mjs';
import { renderSfx } from './upstream/sound.mjs';
import chronicleScore from './presets/chronicle-score.mjs';
import chronicleSound from './presets/chronicle-sound.mjs';

const ADAPTER_VERSION = 1;
process.env.BV_LANG ||= 'zh';
const PRESETS = {
  chronicle: { score: chronicleScore, sound: chronicleSound },
};

function narrationLines(planned) {
  const lines = [];
  for (const scene of planned.scenes) {
    for (const cue of scene.cues || []) {
      if (!(cue.end > cue.start)) continue;
      lines.push({ start: scene.start + cue.start, end: scene.start + cue.end, silence: false });
    }
  }
  return lines.sort((a, b) => a.start - b.start);
}

function sceneEnergy(scene) {
  if (Number.isFinite(scene.audio?.energy)) return scene.audio.energy;
  const text = `${scene.note || ''} ${scene.id || ''}`;
  if (/夜哭|悲|冷|grief/i.test(text)) return 1;
  if (/斩|高潮|斩击|clash|cut/i.test(text)) return 3;
  return 2;
}

function audioPlan(recipe, planned, emitted, resolved) {
  const audio = recipe?.audio || {};
  const duration = planned.duration;
  const sections = planned.scenes.map((scene) => ({
    at: scene.start,
    energy: sceneEnergy(scene),
    name: scene.note || scene.id,
    hit: scene.audio?.hit ?? /斩|高潮|斩击|clash/i.test(`${scene.note || ''} ${scene.id || ''}`),
  }));
  if (!sections.length) sections.push({ at: 0, energy: 2, name: 'main' });
  const moments = [];
  for (const scene of planned.scenes) {
    if (scene.transition) moments.push({ kind: 'cut', t: scene.start + scene.duration });
  }
  const sfx = [];
  for (const scene of emitted) {
    const events = scene.meta?.sfx?.sfxEvents || [];
    for (const event of events) {
      if (!event.type) continue;
      if (event.type === 'impact') moments.push({ kind: 'hit', t: scene.start + event.at });
      sfx.push({
        t: scene.start + event.at,
        type: event.type,
        gain: event.gain ?? 1,
        ...(event.dur !== undefined ? { dur: event.dur } : {}),
        ...(event.dir !== undefined ? { dir: event.dir } : {}),
        ...(event.size !== undefined ? { size: event.size } : {}),
        ...(event.pan !== undefined ? { pan: event.pan } : {}),
        ...(event.keep !== undefined ? { keep: event.keep } : {}),
      });
    }
  }
  const last = planned.scenes.at(-1);
  const logoAt = last && /结尾|endcard/i.test(`${last.note || ''} ${last.id || ''}`)
    ? last.start + 2.6
    : Math.max(0, duration - 1.6);
  const seed = audio.seed || planned.storyboard?.meta?.title || recipe.id;
  const voice = {
    lines: narrationLines(planned),
    rms: audio.voiceRms ?? 0.07,
    duckDb: audio.duckDb ?? 8,
    gapDb: audio.gapDb ?? 11,
  };
  return {
    duration,
    bpm: audio.bpm ?? 84,
    offset: audio.offset ?? 0.5,
    music: { seed },
    sections,
    moments,
    sfx,
    logoAt,
    voice,
    chapters: planned.scenes.map((scene) => ({ start: scene.start, end: scene.start + scene.duration })),
  };
}

function keyOf(mode, recipe, plan) {
  const audio = recipe.audio || {};
  return createHash('sha256').update(JSON.stringify({
    version: ADAPTER_VERSION, mode, style: audio.style || 'history',
    score: audio.scorePreset || 'chronicle', sound: audio.soundPreset || 'chronicle', plan,
  })).digest('hex').slice(0, 16);
}

function event(src, duration, role) {
  return { src, at: 0, duration, role, volume: 1, fadeIn: 0, fadeOut: 0 };
}

/** Returns null for recipes that still use static assets. */
export async function generateProjectAudio({ recipe, planned, emitted, audioDir }) {
  const audio = recipe?.audio || {};
  const mode = audio.generator;
  if (!mode) return null;
  if (!['score', 'bgm'].includes(mode)) throw new Error(`未知音频生成器 "${mode}"（可用 score / bgm）`);
  const plan = audioPlan(recipe, planned, emitted);
  const key = keyOf(mode, recipe, plan);
  const seed = Number.parseInt(key.slice(0, 8), 16);
  mkdirSync(audioDir, { recursive: true });

  if (mode === 'score') {
    const preset = PRESETS[audio.scorePreset || 'chronicle'];
    const palette = PRESETS[audio.soundPreset || 'chronicle'];
    if (!preset || !palette) throw new Error('score / sound 预设不存在');
    const filename = `accompaniment-${key}.wav`;
    const file = path.join(audioDir, filename);
    const src = `job:audio/${filename}`;
    if (existsSync(file)) return { events: [event(src, plan.duration, 'bgm')], info: { cached: true, mode } };
    const rendered = renderPlan(plan, { score: preset.score, palette: palette.sound, voice: plan.voice });
    writeMusicWav(file, rendered.L, rendered.R);
    return {
      events: [event(src, plan.duration, 'bgm')],
      info: { cached: false, mode, ...rendered.info },
    };
  }

  const filename = `bgm-${key}.wav`;
  const file = path.join(audioDir, filename);
  const src = `job:audio/${filename}`;
  const events = [];
  let cached = existsSync(file);
  if (!cached) {
    const rendered = compose({
      style: audio.style || 'history',
      duration: plan.duration,
      lines: plan.voice.lines,
      chapters: plan.chapters,
      voiceRms: plan.voice.rms,
      seed: plan.music.seed,
      gapDb: plan.voice.gapDb,
      duckDb: plan.voice.duckDb,
      volume: audio.level ?? 1,
    });
    writeBgmWav(file, rendered.L, rendered.R);
  }
  events.push(event(src, plan.duration, 'bgm'));

  const effectName = `effects-${key}.wav`;
  const effectFile = path.join(audioDir, effectName);
  const effectSrc = `job:audio/${effectName}`;
  if (!existsSync(effectFile)) {
    const palette = PRESETS[audio.soundPreset || 'chronicle']?.sound;
    const rendered = renderSfx(plan, palette, plan.duration, seed);
    writeMusicWav(effectFile, rendered.L, rendered.R);
    cached = false;
  }
  events.push(event(effectSrc, plan.duration, 'sfx'));
  return { events, info: { cached, mode, style: audio.style || 'history' } };
}
