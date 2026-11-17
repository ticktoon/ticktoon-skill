/**
 * ② resolve —— 把"作者写的东西"换成"编译需要的东西"。
 *
 * 三件事，彼此独立：
 *   旁白 → 语音时长（有 TTS 用 TTS，没有就估，并标记 estimated）
 *   音效 → 名字 → 文件 + 时长 + 电平
 *   BGM  → recipe.audio 的文件 / key → 文件
 *
 * 字体不在这里解析：scene.resources / template.resources 的 font 条目在 schema 阶段
 * 已按 manifest 键补好 src，emit 直接进本场 resources。
 *
 * P0 没有 TTS：`tts` 传 null 即走估算。估算与 TTS 的产物形状完全一样（一个秒数），
 * 所以 P1 接上 TTS 时 plan / emit / assemble 一行都不用改。
 */
/** 播报语速。中文按字算，标点不发音只制造停顿。 */
export const CHARS_PER_SECOND = 4.6;
/** 旁白场的首尾留白。leadIn 让画面先出现再开口，hold 让最后一句不被切断。 */
export const PACING = { leadIn: 0.28, hold: 0.55 };

const SILENT = /[，。！？；：、,.!?;:…—\s"'（）()《》「」【】]/;

export function speakableChars(text) {
  return [...String(text)].filter((ch) => !SILENT.test(ch)).length;
}

export function estimateSpeech(text) {
  const chars = speakableChars(text);
  const sentences = (String(text).match(/[。！？!?]/g) || []).length;
  return Math.max(1.0, chars / CHARS_PER_SECOND + 0.14 * sentences);
}

/**
 * @returns {{ scenes, bgm, sfx, warnings, ttsUsed }}
 */
export async function resolveStoryboard({ storyboard, recipe, catalog, tts }) {
  const warnings = [];
  const ttsUsed = !!tts;

  const scenes = [];
  for (const scene of storyboard.scenes) {
    if (!scene.narration) {
      scenes.push({ speech: null, estimated: false });
      continue;
    }
    if (tts) {
      const result = await tts.synthesize(scene.narration);
      let speech = result.duration;
      let estimated = false;
      if (!(speech > 0)) {
        // provider 没给实测时长（如 volc 流式未带回传）：按语速估算兜底，
        // 不能让 null 落到 plan 里炸 PLAN_ZERO_DURATION。
        speech = estimateSpeech(scene.narration);
        estimated = true;
        warnings.push({
          level: 'should', code: 'TTS_DURATION_ESTIMATED', path: `scenes.${scene.id}`,
          msg: `provider "${tts.provider || 'tts'}" 未返回语音时长，scenes.${scene.id} 按 ${CHARS_PER_SECOND} 字/秒估算为 ${speech.toFixed(2)}s；写 scene.duration 可显式覆盖`,
        });
      }
      scenes.push({ speech, estimated, words: result.words || null, src: result.src || null });
    } else {
      scenes.push({ speech: estimateSpeech(scene.narration), estimated: true });
    }
  }
  if (!tts && scenes.some((s) => s.speech != null)) {
    warnings.push({
      level: 'nice', code: 'NARRATION_ESTIMATED', path: '',
      msg: 'P0 无 TTS，旁白时长按 4.6 字/秒估算；P1 接上 TTS 后同名配方会自动改用实测时长',
    });
  }

  // --- 音效：params 场的模板音效（defaultSfx / sfxTrack）；code 场不自带门禁音效 ---
  const sfx = new Map();
  const templateSfx = recipe?.mode === 'params' ? recipe.template : null;
  if (templateSfx) {
    const names = new Set([
      templateSfx.defaultSfx,
      templateSfx.sfxTrack?.sfx,
      templateSfx.sfxTrack?.loop?.sfx,
    ]);
    for (const name of names) {
      if (!name) continue;
      const entry = catalog.sfx[name];
      if (!entry) {
        warnings.push({
          level: 'should', code: 'SFX_MISSING', path: 'recipe.template',
          msg: `音效 "${name}" 不在 assets/sfx/manifest.json 里，这一下会被静默跳过`,
        });
        continue;
      }
      sfx.set(name, entry);
    }
  }

  // --- BGM：只按情绪选，不让 storyboard 点名文件 ---
  const audio = recipe?.audio || {};
  const mood = audio.mood;
  const bgmEntry = mood ? catalog.bgm[mood] : null;
  if (mood && !bgmEntry) {
    warnings.push({
      level: 'should', code: 'BGM_MISSING', path: 'recipe.audio.mood',
      msg: `recipe 要求的 BGM 情绪 "${mood}" 不在 assets/bgm/manifest.json 里，成片将无背景音`,
    });
  }
  const bgm = bgmEntry
    ? {
        src: bgmEntry.src,
        volume: audio.volume ?? bgmEntry.volume ?? 0.12,
        fadeIn: audio.fadeIn ?? 1.2,
        fadeOut: audio.fadeOut ?? 2.0,
        mood,
        duck: audio.duck || null,
      }
    : null;

  return { scenes, bgm, sfx, warnings, ttsUsed, pacing: { ...PACING, ...(recipe?.pacing || {}) } };
}
