/**
 * ④ emit —— 每场拼一段函数体。
 *
 * 引擎执行的是 `new Function('ctx', 'api', code)`，所以这里没有模块系统：
 * 所有依赖都以**源码片段 + 注册表**的形式拼进同一个作用域。三条纪律：
 *
 *   1. 只注入本场用到的 kit 与 block。全量注入会让编译耗时和 code 体积随片长线性膨胀。
 *   2. `TT` / `BLOCKS` / `CAPTIONS` / `FONTS` 是固定名字。block 作者只认这几个。
 *   3. 每帧复用 `g` 与参数对象。31 个元素每秒新建上千个对象，是白给 GC 的压力。
 *
 * 唯一的代码形状是两段式：`return (ctx, api) => {...}`。setup 阶段的语句就写在 return 之前，
 * 引擎在 prepare 时执行一次。没有"这个 block 不支持两段式"的例外——那会让 emit 出现分支，
 * 而分支是这类代码生成器最贵的维护成本。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildBlockSfxTrack } from './block-sfx.mjs';

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

/** FNV-1a：把场景 id + 元素序号烘成一个稳定种子。 */
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
export function emitScene({ scene, fonts, format, catalog, kitIndex, kitDir, caption = null, receipts, rules = null }) {
  const W = format.w;
  const H = format.h;
  const captionName = caption?.name || null;
  const captionCode = caption?.code || null;
  const captionOptions = caption?.options || null;
  const captionMetrics = caption?.metrics || null;
  const captionFontName = caption?.fontName || null;

  // ---- 收集依赖 ----
  const blockIds = [...new Set(scene.elements.map((el) => el.block))];
  const usedNames = new Set();
  for (const id of blockIds) for (const name of ttNamesOf(catalog.blocks.get(id).draw)) usedNames.add(name);
  // code 里用到的 TT.xxx 同样要触发对应 lib 注入，否则运行时 TT.pen / TT.font 是 undefined。
  // code 场强制注入 text：raw ctx.fillText 的自动回执与 TT.text.resetBBox 都依赖它。
  if (scene.code) {
    usedNames.add('text');
    for (const name of ttNamesOf(scene.code)) usedNames.add(name);
  }
  // 过渡是编译期追加的代码，不在作者 code 的扫描范围里；显式登记才会注入 kit。
  const hasTransitionIn = !!scene.transitionIn && scene.transitionIn.type !== 'cut';
  const hasTransitionOut = !!scene.transitionOut && scene.transitionOut.type !== 'cut';
  if (hasTransitionIn || hasTransitionOut) usedNames.add('transition');
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
  // code 场景自己声明的资源（api.img/api.video 的查询名）。
  for (const res of scene.resources || []) pushRes(res);
  for (const id of blockIds) {
    const meta = catalog.blocks.get(id);
    // block 自带的固定资源（例如新闻底图）。作者不需要在 storyboard 里再写路径；
    // draw.js 直接用 g.api.img('块内声明的 name') 查询。
    for (const res of meta.resources || []) pushRes(res);
    for (const role of meta.needs?.font || []) {
      const name = fonts?.[role];
      const entry = name ? catalog.fonts[name] : null;
      if (entry) pushRes({ type: 'font', name, src: entry.src });
    }
  }
  if (captionCode && captionFontName) {
    const entry = catalog.fonts[captionFontName];
    if (entry) pushRes({ type: 'font', name: captionFontName, src: entry.src });
  }
  // code 场景没有 block 的 needs.font 可供推导，TT.font 可能取到 recipe.fonts 的任一角色，
  // 所以把 fonts 里声明的字体全部带进本场；引擎按 src 去重。
  if (scene.code) {
    for (const name of Object.values(fonts || {})) {
      const entry = name ? catalog.fonts[name] : null;
      if (entry) pushRes({ type: 'font', name, src: entry.src });
    }
  }

  const needs = new Set();
  for (const id of blockIds) {
    const meta = catalog.blocks.get(id);
    if (meta.needs?.three) needs.add('three');
    // 注意：image / video 是**资源**不是**能力**。引擎的 SceneCapability 只有 'three'，
    // 把 'video' 塞进 scene.needs 会被引擎校验直接拒绝；媒体走 resources 声明。
  }

  // ---- 场景常量 ----
  const seed = hashSeed(scene.id, scene.index);
  // 画布底色固定黑：整帧由 scene.code / block 自己铺满。recipe 不再声明背景，
  // scene 也不再选背景名；这里只是给引擎一个确定的清屏色。
  const background = '#000000';

  const lines = [];
  const push = (text) => lines.push(text);

  push('/* Ticktoon scene code — 由 tt build 生成，不要手改；改 storyboard 后重新编译 */');
  push('const TT = {};');
  for (const kit of kits) {
    push(`/* kit:${kit.key} */`);
    push(kit.code);
  }

  push('const BLOCKS = {};');
  push('const SETUP = {};');
  for (const id of blockIds) {
    push(`/* block:${id} */`);
    push(catalog.blocks.get(id).draw.trim());
  }

  const useCaptions = !!captionCode && scene.cues.length > 0;
  if (useCaptions) {
    push('const CAPTIONS = {};');
    push(`const CAPTION_OPTIONS = ${JSON.stringify(captionOptions || {})};`);
    push(`/* caption:${captionName} */`);
    push(captionCode.trim());
  }

  push(`const FONTS = ${JSON.stringify(fonts || {})};`);
  // RULES 只在 code 场注入：block 场用不到视觉规范，注进去只会让 code 体积白涨。
  if (scene.code) push(`const RULES = ${JSON.stringify(rules ?? {})};`);

  // ---- 每个 element 一份可复用的 g 与冻结参数 ----
  // 字符时间戳同时进入绘制参数与音频事件，杜绝画面打字和敲击节奏各算一遍。
  const blockTracks = scene.elements.map((el) => buildBlockSfxTrack(el.meta.sfxTrack, el.params));
  scene.elements.forEach((el, i) => {
    const box = el.rect
      ? { x: el.rect[0] * W, y: el.rect[1] * H, w: el.rect[2] * W, h: el.rect[3] * H }
      : el.meta.layout[el.slot];
    const rect = el.rect
      ? box
      : { x: box[0] * W, y: box[1] * H, w: box[2] * W, h: box[3] * H };
    const rounded = {
      x: Number(rect.x.toFixed(2)),
      y: Number(rect.y.toFixed(2)),
      w: Number(rect.w.toFixed(2)),
      h: Number(rect.h.toFixed(2)),
    };
    const abs = Number((scene.start + el.at).toFixed(3));

    // 媒体参数换名：作者写的是文件路径（skill:assets/...），运行时查的是资源名。
    // 替换发生在编译期，draw.js 里 p.src 拿到的永远是 api.img/api.video 认识的名字。
    let params = el.params;
    if (blockTracks[i]) {
      params = { ...params, __typing: blockTracks[i].lines.map((line) => line.map((ch) => ch.at)) };
    }
    const meta = catalog.blocks.get(el.block);
    if (meta.needs?.image || meta.needs?.video) {
      const kind = meta.needs.video ? 'video' : 'image';
      const name = `${kind}-${scene.id}-${el.id}`;
      const res = { type: kind, name, src: String(params.src || '') };
      if (kind === 'video' && Number.isFinite(Number(params.start))) res.start = Number(params.start);
      pushRes(res);
      params = { ...params, src: name };
    }

    push(`const G${i} = { ctx: null, W: ${W}, H: ${H}, fonts: FONTS, motion: ${JSON.stringify(el.meta.motion || {})}, sizes: ${JSON.stringify(el.meta.sizes || {})}, t: 0, sceneT: 0, at: ${el.at}, abs: ${abs}, dur: ${el.dur}, a: 1, reveal: 1, cues: api.cues,captionActive: false,`);
    push(`  rect: ${JSON.stringify(rounded)}, rng: () => TT.rng(${hashSeed(scene.id, el.id)}) };`);
    push(`const P${i} = ${JSON.stringify(params)};`);
    if (catalog.blocks.get(el.block).hasSetup) {
      push(`if (SETUP[${JSON.stringify(el.block)}]) SETUP[${JSON.stringify(el.block)}](G${i}, P${i}, api);`);
    }
  });

  // ---- draw ----
  if (useCaptions) push(`const CAPTION_AVOID = [${scene.elements.map((_, i) => `G${i}`).join(',')}];`);
  push('return (ctx, api) => {');
  push('  const T = api.t;');
  push('  const W = api.W;');
  push('  const H = api.H;');
  push('  ctx.save();');
  // 墨迹框与文字框每帧重新累计。文字对所有场上报：版式型 block 用 TT.text 画画面文字时
  // 也该有 text 回执，否则 verify 看不见满幅单 block 的标题。
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

  // code 内联在 camera 变换之后、elements 之前：code 画底色与主体，elements 作为叠加层。
  // fillText 包一层记账：作者直接写 ctx.fillText 也能进文字回执，不必改写成 TT.text。
  // TT.text 内部会把 __ttTextInternal 置真，避免同一次绘制被记两遍。
  if (scene.code) {
    push('  const __ttNativeFillText = ctx.fillText;');
    push('  ctx.fillText = function __ttFillText(value, x, y, maxWidth) {');
    push('    const __ttFillResult = maxWidth === undefined');
    push('      ? __ttNativeFillText.call(ctx, value, x, y)');
    push('      : __ttNativeFillText.call(ctx, value, x, y, maxWidth);');
    push('    if (!ctx.__ttTextInternal && TT.text && TT.text.record) TT.text.record(ctx, value, x, y);');
    push('    return __ttFillResult;');
    push('  };');
    push('  try {');
    push(indent(scene.code, '    '));
    push('  } finally {');
    push('    ctx.fillText = __ttNativeFillText;');
    push('  }');
  }

  scene.elements.forEach((el, i) => {
    const motion = el.meta.motion || {};
    const enterDur = motion.enter ?? 0.5;
    const exitDur = Number((enterDur * (motion.exitRatio ?? 0.5)).toFixed(4));
    push(`  // ${el.id}: ${el.block} @${el.at}s / ${el.dur}s`);
    push('  {');
    push(`    const t = T - ${el.at};`);
    push(`    if (t >= 0 && t <= ${el.dur}) {`);
    push('      const g = G' + String(i) + ';');
    push('      g.ctx = ctx; g.t = t; g.sceneT = T; g.api = api; g.captionActive = true;');
    push(`      g.a = TT.env.fade(t, ${el.dur}, ${enterDur}, ${exitDur});`);
    push(`      g.reveal = TT.env.reveal(t, ${enterDur});`);
    push('      ctx.save();');
    push(`      BLOCKS[${JSON.stringify(el.block)}](g, P${i});`);
    push('      ctx.restore();');
    push('      g.captionActive = false;');
    if (receipts) {
      push(`      if (typeof globalThis.__ttReceipt === 'function') globalThis.__ttReceipt({ scene: ${JSON.stringify(scene.id)}, el: ${JSON.stringify(el.id)}, block: ${JSON.stringify(el.block)}, t: T, kind: 'ink', rect: g.rect, ink: g.ink || null });`);
    }
    push('    }');
    push('  }');
  });

  push('  ctx.restore();');
  // code 场的凭据：TT.pen 累计的笔迹并集框 + TT.text 的文字（逻辑像素）。
  // 文字分两层上报：一条 `aggregate:true` 并集框供安全框/字幕带断言（旧行为），
  // 再加逐条 `idx/label/ink` 供同场 text-text 碰撞检测；某一类为 null 就不报该条，
  // 避免把"这一帧还没落笔/没字"误判成空墨迹。
  if (receipts) {
    if (scene.code) {
      push('  if (typeof globalThis.__ttReceipt === \'function\' && TT.pen && TT.pen.bbox) {');
      push('    const bb = TT.pen.bbox();');
      push(`    if (bb) globalThis.__ttReceipt({ scene: ${JSON.stringify(scene.id)}, el: 'code', block: 'scene.code', t: T, kind: 'ink', rect: { x: 0, y: 0, w: W, h: H }, ink: bb });`);
      push('  }');
    }
    push('  if (typeof globalThis.__ttReceipt === \'function\' && TT.text && TT.text.bbox) {');
    push('    const tb = TT.text.bbox();');
    push(`    if (tb) globalThis.__ttReceipt({ scene: ${JSON.stringify(scene.id)}, el: 'code', block: 'scene.code', t: T, kind: 'text', aggregate: true, rect: { x: 0, y: 0, w: W, h: H }, ink: tb });`);
    push('  }');
    push('  if (typeof globalThis.__ttReceipt === \'function\' && TT.text && TT.text.items) {');
    push('    const __ttTextItems = TT.text.items();');
    push('    for (let __ttI = 0; __ttI < __ttTextItems.length; __ttI += 1) {');
    push('      const __ttItem = __ttTextItems[__ttI];');
    push('      if (!__ttItem || !__ttItem.bbox) continue;');
    push(`      globalThis.__ttReceipt({ scene: ${JSON.stringify(scene.id)}, el: 'code', block: 'scene.code', t: T, kind: 'text', idx: __ttI, label: String(__ttItem.text == null ? '' : __ttItem.text).slice(0, 40), rect: { x: 0, y: 0, w: W, h: H }, ink: { x: __ttItem.bbox.x, y: __ttItem.bbox.y, w: __ttItem.bbox.w, h: __ttItem.bbox.h } });`);
    push('    }');
    push('  }');
  }
  if (useCaptions) {
    // 字幕避障读的是「此刻仍在场」的元素；绘制循环里的临时 true 到字幕阶段已经清掉，
    // 所以在调用字幕前按时间轴重新标记，captionAvoid / ink / rect 才会被真正计入。
    push('  for (const g of CAPTION_AVOID) { const local = T - g.at; g.captionActive = local >= 0 && local <= g.dur; }');
    push('  // 字幕永远最后画，且在 camera 变换之外');
    const callCaption = `  CAPTIONS[${JSON.stringify(captionName)}]({ ctx, W, H, fonts: FONTS, metrics: ${JSON.stringify(captionMetrics)}, sceneT: T, cues: api.cues, options: CAPTION_OPTIONS, avoid: CAPTION_AVOID });`;
    if (scene.code && receipts) {
      // code 场额外记一条字幕文字框：verify 用它判断"顶部/底部字幕带到底在哪"，
      // 不必从 recipe 的 caption 指标猜字幕高度。字幕文件本身不改（禁改清单）。
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
      push(`    globalThis.__ttReceipt({ scene: ${JSON.stringify(scene.id)}, el: 'caption', block: 'captions.${captionName}', t: T, kind: 'caption', rect: null, ink: { x: __ttCapInk.x0, y: __ttCapInk.y0, w: __ttCapInk.x1 - __ttCapInk.x0, h: __ttCapInk.y1 - __ttCapInk.y0 } });`);
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
      elements: scene.elements.map((el, elementIndex) => ({
        id: el.id,
        block: el.block,
        slot: el.slot,
        at: el.at,
        dur: el.dur,
        sfx: el.sfx || el.meta.defaultSfx || null,
        sfxAt: el.sfxAt,
        sfxEvents: (blockTracks[elementIndex]?.events || [])
          .map((event) => ({ ...event, at: Number((el.at + event.at).toFixed(3)) })),
        sfxLoop: blockTracks[elementIndex]?.loop
          ? { ...blockTracks[elementIndex].loop, at: Number((el.at + blockTracks[elementIndex].loop.at).toFixed(3)) }
          : null,
      })),
    },
  };
}
