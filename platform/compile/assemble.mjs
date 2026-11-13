/**
 * ⑤ assemble —— 把 scenes 与 audio 拼成最终 composition，并在本地先跑一遍引擎的不变量。
 *
 * 为什么要在本地重跑：引擎的报错是给宿主看的（`scene=s03`），对 LLM 没有修复指引。
 * 编译器先拦一遍，才能说"第 3 场时长 0，因为 narration 为空且没有 duration"。
 */
import { round3 } from './diag.mjs';

const ROLE_VOLUME = { narration: 1.0, bgm: 0.12, sfx: 0.6 };

function srtTime(t) {
  const ms = Math.round(t * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const rest = ms % 1000;
  const pad = (v, n = 2) => String(v).padStart(n, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(rest, 3)}`;
}

export function buildSrt(scenes) {
  const chunks = [];
  let index = 1;
  for (const scene of scenes) {
    for (const cue of scene.cues || []) {
      chunks.push(
        `${index}\n${srtTime(scene.start + cue.start)} --> ${srtTime(scene.start + cue.end)}\n${cue.text}\n`,
      );
      index += 1;
    }
  }
  return chunks.join('\n');
}

/**
 * @returns {{ composition, events, bag }}
 */
export function assemble({ scenes, audioScenes = scenes, resolved, format, bag }) {
  const duration = round3(scenes.reduce((sum, s) => sum + s.duration, 0));
  if (scenes.length === 0) {
    bag.error('ASM_NO_SCENES', '', '没有场景');
  }
  if (!(duration > 0)) {
    bag.error('ASM_ZERO_DURATION', '', '总时长必须为正');
  }

  const events = [];

  // --- 旁白：绑定原始逻辑场，不使用插入转场后的视觉场起点或索引 ---
  audioScenes.forEach((scene, i) => {
    const speech = resolved.scenes[i];
    if (!speech?.src) return;
    events.push({
      src: speech.src,
      at: round3(scene.start + scene.speechStart),
      duration: round3(speech.speech),
      role: 'narration',
      volume: ROLE_VOLUME.narration,
      fadeIn: 0.02,
      fadeOut: 0.04,
    });
  });

  // --- BGM：按旁白分段，旁白压电平（ducking），无旁白处给满电平 ---
  // 单事件 + 静态电平在"全程有旁白"的片子里是对的；一旦有纯画面场，
  // 那几秒的 BGM 也被压着就浪费了。分段让 BGM 在呼吸处抬起来。
  // 相邻段各留 edge 的淡入淡出，交叉处电平相加 ≈ 目标值，不会爆。
  if (resolved.bgm) {
    const duck = resolved.bgm.duck;
    const narrations = events.filter((event) => event.role === 'narration');
    const canDuck = duck && narrations.length > 0;
    if (!canDuck) {
      events.push({
        src: resolved.bgm.src,
        at: 0,
        duration,
        role: 'bgm',
        volume: resolved.bgm.volume,
        fadeIn: resolved.bgm.fadeIn,
        fadeOut: Math.min(resolved.bgm.fadeOut, duration / 2),
      });
    } else {
      const level = duck.level ?? resolved.bgm.volume * 0.45;
      const edge = duck.edge ?? 0.15;
      const bounds = narrations.map((event) => [event.at, event.at + event.duration]);
      let cursor = 0;
      const segments = [];
      for (const [start, end] of bounds) {
        if (start > cursor + 1e-3) segments.push({ from: cursor, to: start, volume: resolved.bgm.volume });
        segments.push({ from: Math.max(cursor, start), to: Math.min(end, duration), volume: level, ducked: true });
        cursor = Math.max(cursor, end);
      }
      if (cursor < duration - 1e-3) segments.push({ from: cursor, to: duration, volume: resolved.bgm.volume });

      for (const [i, seg] of segments.entries()) {
        const span = seg.to - seg.from;
        if (!(span > 0.05)) continue;
        events.push({
          src: resolved.bgm.src,
          at: round3(seg.from),
          duration: round3(span),
          role: 'bgm',
          volume: seg.volume,
          // 首段用 recipe 的长淡入，段间用短边缘，末段用长淡出
          fadeIn: i === 0 ? resolved.bgm.fadeIn : Math.min(edge, span / 2),
          fadeOut: i === segments.length - 1 ? Math.min(resolved.bgm.fadeOut, span / 2) : Math.min(edge, span / 2),
        });
      }
    }
  }

  // --- SFX：模板落地声 + 模板编译期展开的多次事件，运行时不再产生事件 ---
  const pushSfxEvent = (entry, at, length, { fadeIn = 0.005, fadeOut = 0.06, where } = {}) => {
    const safeLength = round3(Math.min(length, duration - at));
    if (!(safeLength > 0)) {
      bag.error('ASM_SFX_OVERFLOW', where,
        `音效 ${entry.src.split('/').pop()} 的起点 ${at}s 已超出片长 ${duration}s；请延长场景或缩短打字时间`);
      return;
    }
    events.push({
      src: entry.src,
      at,
      duration: safeLength,
      role: 'sfx',
      volume: entry.volume ?? ROLE_VOLUME.sfx,
      fadeIn,
      fadeOut: Math.min(fadeOut, safeLength / 2),
    });
  };

  audioScenes.forEach((scene) => {
    const sfxMeta = scene.meta.sfx;
    if (!sfxMeta) return;
    const cues = [
      ...(sfxMeta.sfx ? [{ sfx: sfxMeta.sfx, at: sfxMeta.sfxAt }] : []),
      ...(sfxMeta.sfxEvents || []),
    ];
    for (const cue of cues) {
      const entry = resolved.sfx.get(cue.sfx);
      if (!entry) continue;
      const at = round3(scene.start + cue.at);
      pushSfxEvent(entry, at, entry.duration || 0.3, {
        where: `scenes.${scene.id}.template`,
      });
    }

    // 循环音频片段：引擎 sfx 只支持单次触发，按素材时长铺成首尾相接的瓦片。
    // 实录素材本身在零电平处接缝（首段静音、末尾淡出），内部瓦片不加淡入淡出，
    // 避免每秒一次的周期性电平凹陷；只有首瓦 5ms 淡入、末瓦按声明 60ms 淡出。
    if (sfxMeta.sfxLoop) {
      const entry = resolved.sfx.get(sfxMeta.sfxLoop.sfx);
      if (entry) {
        const tileDur = entry.duration || 1;
        const span = sfxMeta.sfxLoop.duration;
        const origin = round3(scene.start + sfxMeta.sfxLoop.at);
        const tiles = Math.max(1, Math.ceil(span / tileDur));
        for (let k = 0; k < tiles; k += 1) {
          const at = round3(origin + k * tileDur);
          const length = round3(Math.min(tileDur, origin + span - at));
          if (!(length > 0)) continue;
          pushSfxEvent(entry, at, length, {
            fadeIn: k === 0 ? 0.005 : 0,
            fadeOut: k === tiles - 1 ? sfxMeta.sfxLoop.fadeOut : 0,
            where: `scenes.${scene.id}.template`,
          });
        }
      }
    }
  });

  // --- 引擎同款不变量 ---
  let cursor = 0;
  scenes.forEach((scene, i) => {
    if (Math.abs(scene.start - cursor) > 1e-3) {
      bag.error('ASM_START_DRIFT', `scenes[${i}]`,
        `场景 ${scene.id} 的起点 ${scene.start} 与累加值 ${round3(cursor)} 不一致`);
    }
    cursor = round3(cursor + scene.duration);
    for (const cue of scene.cues || []) {
      if (cue.end > scene.duration + 1e-6) {
        bag.error('ASM_CUE_OVERFLOW', `scenes[${i}]`,
          `cue "${cue.text}" 结束于 ${cue.end}s，超出本场时长 ${scene.duration}s`);
      }
    }
  });

  events.forEach((event, i) => {
    if (event.at + event.duration > duration + 1e-6) {
      bag.error('ASM_AUDIO_OVERFLOW', `audio[${i}]`,
        `音频事件 ${event.src} 结束于 ${round3(event.at + event.duration)}s，超出片长 ${duration}s`);
    }
  });

  const composition = {
    version: '1.0',
    width: format.w,
    height: format.h,
    fps: format.fps,
    duration,
    scenes: scenes.map((scene) => ({
      id: scene.id,
      start: scene.start,
      duration: scene.duration,
      width: format.w,
      height: format.h,
      background: scene.background,
      seed: scene.seed,
      code: scene.code,
      cues: scene.cues,
      resources: scene.resources,
      needs: scene.needs,
    })),
    audio: events.map((event, i) => ({ id: `a${i}-${event.role}`, ...event })),
  };

  return { composition, events, bag };
}
