import { round3 } from './diag.mjs';
import { hashSeed } from './emit.mjs';
import { TRANSITION_PRESETS } from './transitions.mjs';

const indent = (text, pad) => String(text).split('\n')
  .map((line) => (line ? pad + line : line)).join('\n');

function mergeResources(a, b, bag, transitionId) {
  const resources = [];
  const seen = new Map();
  for (const res of [...(a.resources || []), ...(b.resources || [])]) {
    const key = `${res.type}:${res.name}`;
    const previous = seen.get(key);
    if (previous) {
      if (previous.src !== res.src) {
        bag?.error('TRANSITION_RESOURCE_CONFLICT', transitionId,
          `前后场的 ${key} 指向不同资源；转场需要同时加载两场，请改用不同的资源名`);
      }
      continue;
    }
    seen.set(key, res);
    resources.push(res);
  }
  return resources;
}

/** 正常场被首尾借走一段时间后，用包装器恢复原始场景时钟。 */
function wrapNormalScene(source, { duration, timeOffset, logicalStart }) {
  const trimmed = timeOffset > 0 || duration !== source.duration;
  const node = { ...source, duration };
  if (!trimmed) return node;
  const lines = [
    '/* 正常画面段：只改变视觉窗口，原始场景时钟与声音不变 */',
    'const __TT_SCENE_DRAW = (() => {',
    indent(source.code, '  '),
    '})();',
    `const __TT_SCENE_CUES = ${JSON.stringify(source.cues || [])};`,
    'return (ctx, api) => {',
    `  const __TT_LOGICAL_T = api.t + ${timeOffset};`,
    '  __TT_SCENE_DRAW(ctx, Object.assign({}, api, {',
    '    t: __TT_LOGICAL_T,',
    `    d: ${source.duration},`,
    `    abs: ${logicalStart} + __TT_LOGICAL_T,`,
    '    cues: __TT_SCENE_CUES,',
    '  }));',
    '};',
  ];
  // 外层只承担视觉窗口；原始 cues 已由包装器交给完整场景。
  node.code = lines.join('\n');
  node.cues = [];
  return node;
}

function makeTransitionScene({ a, b, plannedA, plannedB, type, format, kitCode, bag }) {
  const preset = TRANSITION_PRESETS[type];
  const dur = preset.dur;
  const half = dur / 2;
  const id = `__transition_${a.id}_${b.id}`;
  const lines = [
    '/* 双帧转场场：两个完整场景各自绘制，再由 TT.transition 合成 */',
    'const TT = {};',
    kitCode.trim(),
    'const __TT_DRAW_A = (() => {',
    indent(a.code, '  '),
    '})();',
    'const __TT_DRAW_B = (() => {',
    indent(b.code, '  '),
    '})();',
    `const __TT_A_CUES = ${JSON.stringify(a.cues || [])};`,
    `const __TT_B_CUES = ${JSON.stringify(b.cues || [])};`,
    '// 与引擎 createSeededRng 相同：转场内 api.rng 必须使用原场景种子。',
    'const __TT_RNG = (seed) => {',
    '  let state = seed >>> 0;',
    '  return () => {',
    '    state = (state * 1664525 + 1013904223) >>> 0;',
    '    return state / 4294967296;',
    '  };',
    '};',
    `const __TT_TRANSITION = TT.transition.create(${JSON.stringify({
      W: format.w, H: format.h, type, dur, color: preset.color,
    })});`,
    'return (ctx, api) => {',
    `  const __TT_U = Math.max(0, Math.min(${dur}, api.t));`,
    `  const __TT_TIME_A = Math.min(${plannedA.duration} - ${half} + __TT_U, ${plannedA.duration});`,
    `  const __TT_TIME_B = Math.max(0, __TT_U - ${half});`,
    '  __TT_TRANSITION(ctx, {',
    '    t: __TT_U,',
    '    a: { draw: __TT_DRAW_A, api: Object.assign({}, api, {',
    `      t: __TT_TIME_A, d: ${plannedA.duration}, abs: ${plannedA.start} + __TT_TIME_A, cues: __TT_A_CUES,
      seed: ${a.seed}, rng: () => __TT_RNG(${a.seed}),`,
    '    }) },',
    '    b: { draw: __TT_DRAW_B, api: Object.assign({}, api, {',
    `      t: __TT_TIME_B, d: ${plannedB.duration}, abs: ${plannedB.start} + __TT_TIME_B, cues: __TT_B_CUES,
      seed: ${b.seed}, rng: () => __TT_RNG(${b.seed}),`,
    '    }) },',
    '  });',
    '};',
  ];
  return {
    id,
    duration: dur,
    width: format.w,
    height: format.h,
    background: '#000000',
    seed: hashSeed(id, plannedA.index),
    code: lines.join('\n'),
    cues: [],
    resources: mergeResources(a, b, bag, id),
    needs: [...new Set([...(a.needs || []), ...(b.needs || [])])],
    meta: {
      index: plannedA.index,
      camera: null,
      paramsScene: null,
      units: [],
      sfx: null,
      transition: { from: a.id, to: b.id, type },
    },
  };
}

/**
 * 原始逻辑场 A + B → 视觉场 (A-D/2) + T(D) + (B-D/2)。
 * 输入的 emittedScenes 始终保持原始时长，供声音/SFX继续使用；这里只返回视觉节点。
 */
export function createVisualScenes({ plannedScenes, emittedScenes, format, transitionKitCode, bag }) {
  const scenes = [];
  let cursor = 0;
  const push = (scene) => {
    scene.start = round3(cursor);
    scenes.push(scene);
    cursor = round3(cursor + scene.duration);
  };

  plannedScenes.forEach((planned, index) => {
    const source = emittedScenes[index];
    const incomingType = plannedScenes[index - 1]?.transition || null;
    const outgoingType = planned.transition || null;
    const incoming = incomingType ? TRANSITION_PRESETS[incomingType].dur / 2 : 0;
    const outgoing = outgoingType ? TRANSITION_PRESETS[outgoingType].dur / 2 : 0;
    const normalDuration = round3(planned.duration - incoming - outgoing);
    if (!(normalDuration > 0)) {
      bag?.error('TRANSITION_SCENE_TOO_SHORT', `scenes[${index}]`,
        `场景 ${planned.id} 扣除相邻转场后没有正常画面`);
    }
    push(wrapNormalScene(source, {
      duration: Math.max(0.001, normalDuration),
      timeOffset: incoming,
      logicalStart: planned.start,
    }));

    if (outgoingType && emittedScenes[index + 1]) {
      push(makeTransitionScene({
        a: source,
        b: emittedScenes[index + 1],
        plannedA: planned,
        plannedB: plannedScenes[index + 1],
        type: outgoingType,
        format,
        kitCode: transitionKitCode,
        bag,
      }));
    }
  });

  return { scenes, duration: cursor };
}
