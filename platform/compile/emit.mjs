/**
 * ④ emit —— 每场拼一段函数体。
 *
 * 引擎执行的是 `new Function('ctx', 'api', code)`，所以这里没有模块系统：
 * 所有依赖都以**源码片段**的形式拼进同一个作用域。三条纪律：
 *
 *   1. 只注入本场用到的 kit。全量注入会让编译耗时和 code 体积随片长线性膨胀。
 *   2. `TT` / `CAPTIONS` / `FONTS` 是固定名字；模板只认 `draw(g, p)`。
 *   3. 每帧复用 `g` 与参数对象。params 场只有一个内部单元 template。
 *
 * 唯一的代码形状是两段式：`return (ctx, api) => {...}`。模板的 `draw(g, p)` 定义在
 * return 之前的顶层作用域，params 场每帧调用一次。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildTemplateSfxTrack } from './template-sfx.mjs';

/** 从源码片段里找出它用到了 `TT` 的哪些成员（解构 + 点号两种写法都算）。 */
function ttNamesOf(code) {
  const names = new Set();
  for (const m of code.matchAll(/\bTT\.([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of code.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}\s*=\s*TT\b/g)) {
    for (const part of m[1].split(',')) {
      const name = part.split(':').pop().split('=')[0].trim();
      if (name) names.add(name);
    }
  }
  return names;
}

/** FNV-1a：把场景 id + 单元身份烘成一个稳定种子。 */
export function hashSeed(...parts) {
  let h = 2166136261;
  const text = parts.join('|');
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function resolveKits({ kitIndex, kitDir, usedNames }) {
  const chosen = new Set();
  const visit = (key) => {
    if (chosen.has(key)) return;
    chosen.add(key);
    for (const dep of kitIndex[key].requires || []) visit(dep);
  };
  for (const [key, entry] of Object.entries(kitIndex)) {
    if (entry.provides.some((name) => usedNames.has(name))) visit(key);
  }
  return [...chosen].map((key) => ({
    key,
    code: readFileSync(path.join(kitDir, kitIndex[key].file), 'utf-8').trim(),
  }));
}

const indent = (text, pad) => text.split('\n').map((line) => (line ? pad + line : line)).join('\n');

/**
 * @returns {{ id, duration, background, seed, code, cues, resources, needs, meta }}
 */
export function emitScene({ scene, recipe, fonts, format, catalog, kitIndex, kitDir, caption = null, receipts, rules = null }) {
  const W = format.w;
  const H = format.h;
  const captionName = caption?.name || null;
  const captionCode = caption?.code || null;
  const captionOptions = caption?.options || null;
  const captionMetrics = caption?.metrics || null;
  const captionFontName = caption?.fontName || null;
  const template = recipe?.mode === 'params' ? recipe.template : null;
  const params = scene.params || null;

  // ---- 收集依赖 ----
  const usedNames = new Set();
  if (scene.code) {
    // code 场强制注入 text：raw ctx.fillText 的自动回执与 TT.text.resetBBox 都依赖它。
    usedNames.add('text');
    for (const name of ttNamesOf(scene.code)) usedNames.add(name);
  }
  if (template?.drawSource) {
    for (const name of ttNamesOf(template.drawSource)) usedNames.add(name);
  }
  // transition 是编译期追加的代码；env / rng 被 G 对象与入场淡入直接引用。
  const hasTransitionIn = !!scene.transitionIn && scene.transitionIn.type !== 'cut';
  const hasTransitionOut = !!scene.transitionOut && scene.transitionOut.type !== 'cut';
  if (hasTransitionIn || hasTransitionOut) usedNames.add('transition');
  if (template) {
    usedNames.add('env');
    usedNames.add('rng');
  }
  if (captionCode) for (const name of ttNamesOf(captionCode)) usedNames.add(name);
  const kits = resolveKits({ kitIndex, kitDir, usedNames });

  // ---- resources：字体每场都声明（懒加载只准备当前场，漏了就是拖到该场掉字体）----
  const resources = [];
  const seenRes = new Set();
  const pushRes = (res) => {
    if (seenRes.has(res.src)) return;
    seenRes.add(res.src);
    resources.push(res);
  };
  // code 场自己声明的资源（api.img/api.video 的查询名）。
  for (const res of scene.resources || []) pushRes(res);
  if (template) {
    // params 模板自带的固定资源（例如新闻底图）。draw.js 用 g.api.img(name) 查询。
    for (const res of template.resources || []) pushRes(res);
    for (const role of template.needs?.font || []) {
      const name = fonts?.[role];
      const entry = name ? catalog.fonts[name] : null;
      if (entry) pushRes({ type: 'font', name, src: entry.src });
    }
  }
  if (captionCode && captionFontName) {
    const entry = catalog.fonts[captionFontName];
    if (entry) pushRes({ type: 'font', name: captionFontName, src: entry.src });
  }
  // code 场没有模板 needs.font 可供推导，TT.font 可能取到 recipe.fonts 的任一角色，
  // 所以把 fonts 里声明的字体全部带进本场；引擎按 src 去重。
  if (scene.code) {
    for (const name of Object.values(fonts || {})) {
      const entry = name ? catalog.fonts[name] : null;
      if (entry) pushRes({ type: 'font', name, src: entry.src });
    }
  }

  const needs = new Set();
  if (template?.needs?.three) needs.add('three');
  // image / video 是资源不是能力：引擎的 SceneCapability 只有 'three'，
  // 媒体一律走 resources 声明。

  // ---- 场景常量 ----
  const seed = hashSeed(scene.id, scene.index);
  // 画布底色固定黑：整帧由 scene.code / 模板自己铺满。recipe 不再声明背景。
  const background = '#000000';

  const lines = [];
  const push = (text) => lines.push(text);

  push('/* Ticktoon scene code — 由 tt build 生成，不要手改；改 storyboard 后重新编译 */');
  push('const TT = {};');
  for (const kit of kits) {
    push(`/* kit:${kit.key} */`);
    push(kit.code);
  }

  const useCaptions = !!captionCode && scene.cues.length > 0;
  if (useCaptions) {
    push('const CAPTIONS = {};');
    push(`const CAPTION_OPTIONS = ${JSON.stringify(captionOptions || {})};`);
    push(`/* caption:${captionName} */`);
    push(captionCode.trim());
  }

  push(`const FONTS = ${JSON.stringify(fonts || {})};`);
  // RULES 只属于 code 场：params 模板通过 params 契约拿内容，不需要视觉规范对象。
  if (scene.code) push(`const RULES = ${JSON.stringify(rules ?? {})};`);

  // ---- params：模板正文 + 唯一内部单元 ----
  let track = null;
  let paramsWithMedia = params || {};
  if (template) {
    push(`/* template:${recipe.id} */`);
    push(template.drawSource.trim());

    track = buildTemplateSfxTrack(template.sfxTrack, params);
    if (track) {
      paramsWithMedia = { ...params, __typing: track.lines.map((line) => line.map((ch) => ch.at)) };
    }

    if (template.needs?.image || template.needs?.video) {
      const kind = template.needs.video ? 'video' : 'image';
      const name = `${kind}-${scene.id}`;
      const res = { type: kind, name, src: String(paramsWithMedia.src || '') };
      if (kind === 'video' && Number.isFinite(Number(paramsWithMedia.start))) {
        res.start = Number(paramsWithMedia.start);
      }
      pushRes(res);
      paramsWithMedia = { ...paramsWithMedia, src: name };
    }

    const motion = template.motion || {};
    const enterDur = motion.enter ?? 0.5;
    const exitDur = Number((enterDur * (motion.exitRatio ?? 0.5)).toFixed(4));
    push(`const G0 = { ctx: null, W: ${W}, H: ${H}, fonts: FONTS, motion: ${JSON.stringify(motion)}, sizes: {}, t: 0, sceneT: 0, at: 0, abs: ${Number(scene.start)}, dur: ${Number(scene.duration)}, a: 1, reveal: 1, cues: api.cues,`);
    push(`  rect: { x: 0, y: 0, w: ${W}, h: ${H} }, rng: () => TT.rng(${hashSeed(scene.id, 'template')}) };`);
    push(`const P0 = ${JSON.stringify(paramsWithMedia)};`);
    push(`const __TT_ENTER_DUR = ${enterDur};`);
    push(`const __TT_EXIT_DUR = ${exitDur};`);
  }

  // ---- draw ----
  push('return (ctx, api) => {');
  push('  const T = api.t;');
  push('  const W = api.W;');
  push('  const H = api.H;');
  push('  ctx.save();');
  push('  if (TT.pen && TT.pen.resetBBox) TT.pen.resetBBox();');
  push('  if (TT.text && TT.text.resetBBox) TT.text.resetBBox();');

  if (scene.camera) {
    const { from, to } = scene.camera;
    push(`  const cam = ${from} + (${Number(to)} - ${from}) * (T / ${scene.duration});`);
    push('  if (cam !== 1) {');
    push('    ctx.translate(W / 2, H / 2);');
    push('    ctx.scale(cam, cam);');
    push('    ctx.translate(-W / 2, -H / 2);');
    push('  }');
  }

  // fillText 包一层记账：作者直接写 ctx.fillText 也能进文字回执，不必改写成 TT.text。
  // TT.text 内部会把 __ttTextInternal 置真，避免同一次绘制被记两遍。
  push('  const __ttNativeFillText = ctx.fillText;');
  push('  ctx.fillText = function __ttFillText(value, x, y, maxWidth) {');
  push('    const __ttFillResult = maxWidth === undefined');
  push('      ? __ttNativeFillText.call(ctx, value, x, y)');
  push('      : __ttNativeFillText.call(ctx, value, x, y, maxWidth);');
  push('    if (!ctx.__ttTextInternal && TT.text && TT.text.record) TT.text.record(ctx, value, x, y);');
  push('    return __ttFillResult;');
  push('  };');

  if (scene.code) {
    push('  try {');
    push(indent(scene.code, '    '));
    push('  } finally {');
    push('    ctx.fillText = __ttNativeFillText;');
    push('  }');
  } else if (template) {
    push('  {');
    push('    const g = G0;');
    push('    g.ctx = ctx; g.t = T; g.sceneT = T; g.api = api;');
    push('    g.a = TT.env.fade(T, ' + Number(scene.duration) + ', __TT_ENTER_DUR, __TT_EXIT_DUR);');
    push('    g.reveal = TT.env.reveal(T, __TT_ENTER_DUR);');
    push('    ctx.save();');
    push('    draw(g, P0);');
    push('    ctx.restore();');
    if (receipts) {
      push(`    if (typeof globalThis.__ttReceipt === 'function') globalThis.__ttReceipt({ scene: ${JSON.stringify(scene.id)}, unit: 'template', source: ${JSON.stringify(recipe.id)}, t: T, kind: 'ink', rect: g.rect, ink: g.ink || null });`);
    }
    push('  }');
  }
  push('  ctx.fillText = __ttNativeFillText;');

  push('  ctx.restore();');
  // 凭据：code 场的 TT.pen 笔迹并集框；所有场的 TT.text 文字并集与逐条文字框。
  // 某一类为 null 就不报该条，避免把"这一帧还没落笔/没字"误判成空墨迹。
  const receiptIdentity = scene.code
    ? `unit: 'code', source: 'scene.code'`
    : `unit: 'template', source: ${JSON.stringify(recipe?.id || '')}`;
  if (receipts) {
    if (scene.code) {
      push('  if (typeof globalThis.__ttReceipt === \'function\' && TT.pen && TT.pen.bbox) {');
      push('    const bb = TT.pen.bbox();');
      push(`    if (bb) globalThis.__ttReceipt({ scene: ${JSON.stringify(scene.id)}, ${receiptIdentity}, t: T, kind: 'ink', rect: { x: 0, y: 0, w: W, h: H }, ink: bb });`);
      push('  }');
    }
    push('  if (typeof globalThis.__ttReceipt === \'function\' && TT.text && TT.text.bbox) {');
    push('    const tb = TT.text.bbox();');
    push(`    if (tb) globalThis.__ttReceipt({ scene: ${JSON.stringify(scene.id)}, ${receiptIdentity}, t: T, kind: 'text', aggregate: true, rect: { x: 0, y: 0, w: W, h: H }, ink: tb });`);
    push('  }');
    push('  if (typeof globalThis.__ttReceipt === \'function\' && TT.text && TT.text.items) {');
    push('    const __ttTextItems = TT.text.items();');
    push('    for (let __ttI = 0; __ttI < __ttTextItems.length; __ttI += 1) {');
    push('      const __ttItem = __ttTextItems[__ttI];');
    push('      if (!__ttItem || !__ttItem.bbox) continue;');
    push(`      globalThis.__ttReceipt({ scene: ${JSON.stringify(scene.id)}, ${receiptIdentity}, t: T, kind: 'text', idx: __ttI, label: String(__ttItem.text == null ? '' : __ttItem.text).slice(0, 40), rect: { x: 0, y: 0, w: W, h: H }, ink: { x: __ttItem.bbox.x, y: __ttItem.bbox.y, w: __ttItem.bbox.w, h: __ttItem.bbox.h } });`);
    push('    }');
    push('  }');
  }
  if (useCaptions) {
    push('  // 字幕永远最后画，且在 camera 变换之外');
    const callCaption = `  CAPTIONS[${JSON.stringify(captionName)}]({ ctx, W, H, fonts: FONTS, metrics: ${JSON.stringify(captionMetrics)}, sceneT: T, cues: api.cues, options: CAPTION_OPTIONS });`;
    if (scene.code && receipts) {
      // code 场额外记一条字幕文字框：联系表与凭据能直接看到字幕带在哪，
      // 不必从 recipe 的 caption 指标猜字幕高度。
      push('  const __ttCapNativeFillText = ctx.fillText;');
      push('  const __ttCapInk = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };');
      push('  ctx.fillText = function __ttCapFillText(value, x, y, maxWidth) {');
      push('    const __ttFillResult = maxWidth === undefined');
      push('      ? __ttCapNativeFillText.call(ctx, value, x, y)');
      push('      : __ttCapNativeFillText.call(ctx, value, x, y, maxWidth);');
      push('    if (TT.text && TT.text.measureBox) {');
      push('      const __ttBox = TT.text.measureBox(ctx, value, x, y);');
      push('      if (__ttBox) {');
      push('        __ttCapInk.x0 = Math.min(__ttCapInk.x0, __ttBox.x);');
      push('        __ttCapInk.y0 = Math.min(__ttCapInk.y0, __ttBox.y);');
      push('        __ttCapInk.x1 = Math.max(__ttCapInk.x1, __ttBox.x + __ttBox.w);');
      push('        __ttCapInk.y1 = Math.max(__ttCapInk.y1, __ttBox.y + __ttBox.h);');
      push('      }');
      push('    }');
      push('    return __ttFillResult;');
      push('  };');
      push('  try {');
      push(callCaption.replace(/^  /, '    '));
      push('  } finally {');
      push('    ctx.fillText = __ttCapNativeFillText;');
      push('  }');
      push('  if (typeof globalThis.__ttReceipt === \'function\' && Number.isFinite(__ttCapInk.x0)) {');
      push(`    globalThis.__ttReceipt({ scene: ${JSON.stringify(scene.id)}, unit: 'caption', source: 'captions.${captionName}', t: T, kind: 'caption', rect: null, ink: { x: __ttCapInk.x0, y: __ttCapInk.y0, w: __ttCapInk.x1 - __ttCapInk.x0, h: __ttCapInk.y1 - __ttCapInk.y0 } });`);
      push('  }');
    } else {
      push(callCaption);
    }
  }

  // 过渡永远在最后：它要盖住已经完成的画面（包括字幕），也只有在尾帧才拿得到
  // 完整的帧快照。入场先画、出场后画，两者同时存在时出场压住入场。
  if (hasTransitionIn || hasTransitionOut) {
    push(`  const __TT_TRANS_G = { W, H, fonts: FONTS, bg: ${JSON.stringify(background)}, dur: ${Number(scene.duration)} };`);
    const transitionArgs = (tr) => `{ type: ${JSON.stringify(tr.type)}, dur: ${Number(tr.dur)}, `
      + `dir: ${JSON.stringify(tr.dir)}, color: ${JSON.stringify(tr.color)}, at: ${JSON.stringify(tr.at)}, t: T }`;
    if (hasTransitionIn) {
      push(`  TT.transition.in(__TT_TRANS_G, ctx, ${transitionArgs(scene.transitionIn)});`);
    }
    if (hasTransitionOut) {
      push(`  TT.transition.out(__TT_TRANS_G, ctx, ${transitionArgs(scene.transitionOut)});`);
    }
  }
  push('};');

  return {
    id: scene.id,
    duration: scene.duration,
    background,
    seed,
    code: lines.join('\n'),
    cues: scene.cues,
    resources,
    needs: [...needs],
    meta: {
      index: scene.index,
      camera: scene.camera,
      paramsScene: template ? {
        id: 'template',
        at: 0,
        dur: scene.duration,
        params: paramsWithMedia,
      } : null,
      units: scene.unit ? [scene.unit] : [],
      sfx: template ? {
        sfx: template.defaultSfx || null,
        sfxAt: Number((template.motion?.enter ?? 0.5).toFixed(3)),
        sfxEvents: (track?.events || []).map((event) => ({ ...event, at: Number(event.at.toFixed(3)) })),
        sfxLoop: track?.loop ? { ...track.loop, at: Number(track.loop.at.toFixed(3)) } : null,
      } : null,
    },
  };
}
