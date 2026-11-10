/**
 * ⑥ check —— L1 静态检查。
 *
 * 只报能在一秒内算出来的东西：停留、版位重叠、字幕区、对比度、能量曲线。
 * 真正需要看图的（溢出、碰撞、空帧）留给 L2 receipts——这里不猜像素。
 *
 * 分级的意义：`must` 是"必须改"，`should` 是"应该改"，`nice` 只进 report 不给 agent。
 * 全量 warning 会让 agent 麻木，这是 v4 已经踩过的坑。
 */
const LEVEL = { low: 0, mid: 1, high: 2 };

function linearize(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex) {
  const value = String(hex).replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function overlapRatio(a, b) {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = x * y;
  const smaller = Math.min(a.w * a.h, b.w * b.h);
  return smaller > 0 ? inter / smaller : 0;
}

// 文字类 block 的集合从 group 推导，不再手工列名单——加一个 text.* 不用回来改这里
const TEXT_GROUPS = new Set(['text', 'chart', 'stage']);
const isTextBlock = (meta) => TEXT_GROUPS.has(meta?.group);

export function check({ scenes, style, format, bag, catalog, caption, recipe }) {
  // 没有字幕时不存在"字幕带"这回事，不再用旧默认值制造一条无意义的告警。
  const captionTop = caption?.metrics ? caption.metrics.top * format.h : null;
  const stageRect = (scene) => scene.elements.map((el) => ({
    el,
    rect: el.rect
      ? { x: el.rect[0] * format.w, y: el.rect[1] * format.h, w: el.rect[2] * format.w, h: el.rect[3] * format.h }
      : (() => {
          const box = el.meta.layout?.[el.slot] || [0, 0, 1, 1];
          return { x: box[0] * format.w, y: box[1] * format.h, w: box[2] * format.w, h: box[3] * format.h };
        })(),
  }));

  scenes.forEach((scene, si) => {
    const path = `scenes[${si}]`;

    // 1. 停留不足
    for (const el of scene.elements) {
      const chars = el.params.text ? [...String(el.params.text).replace(/\s/g, '')].length : 0;
      const hold = el.meta?.motion?.hold || { min: 1.0, perChar: 0.03 };
      const need = Math.max(hold.min, hold.perChar * chars);
      if (el.dur < need - 1e-3) {
        bag.warn('should', 'HOLD_SHORT', `${path}.${el.id}`,
          `可见 ${el.dur.toFixed(2)}s，低于 ${need.toFixed(2)}s（${chars} 字）；观众还没读完就切走了`);
      }
    }

    // 2. 版位重叠（声明值，不看实际墨迹）
    const staged = stageRect(scene);
    for (let i = 0; i < staged.length; i += 1) {
      for (let j = i + 1; j < staged.length; j += 1) {
        const ratio = overlapRatio(staged[i].rect, staged[j].rect);
        if (ratio > 0.08) {
          bag.warn('should', 'SLOT_OVERLAP', `${path}.${staged[j].el.id}`,
            `${staged[i].el.block}(${staged[i].el.slot}) 与 ${staged[j].el.block}(${staged[j].el.slot}) 版位重叠 ${(ratio * 100).toFixed(0)}%`);
        }
      }
    }

    // 3. 字幕区被占
    for (const { el, rect } of staged) {
      if (!isTextBlock(catalog.blocks.get(el.block))) continue;
      if (captionTop != null && el.slot === 'bottom' && rect.y + rect.h > captionTop) {
        bag.warn('should', 'CAPTION_ZONE', `${path}.${el.id}`,
          `${el.block} 下缘 ${(rect.y + rect.h).toFixed(0)}px 越过字幕区 ${captionTop.toFixed(0)}px`);
      }
    }

    // 4. 对比度（只查文字块，且只查能确定颜色的参数）
    // 阈值按字号分档：WCAG 对 ≥24px 的大字只要求 3:1。1080p 片子里几乎全是大字，
    // 一律套 4.5:1 会把合法的强调色判死，agent 学会忽略这条 warning 之后就再也不看检查了。
    const bg = (scene.bg ? (style?.backgrounds?.[scene.bg] || style?.colors?.[scene.bg]) : null)
      || style?.colors?.bg || '#000000';
    // 名字写错时 emit 会用 colors.bg 兜底，画面不是黑的但也不是作者想要的——
    // 这类"悄悄降级"必须有个抓手，否则只有看图才能发现。
    if (scene.bg && !style?.backgrounds?.[scene.bg] && !style?.colors?.[scene.bg]) {
      bag.warn('should', 'BG_UNKNOWN', `${path}.bg`,
        `bg "${scene.bg}" 在 recipe ${recipe?.id} 的 style 里不存在（有：${Object.keys(style?.backgrounds || {}).join(' / ')}），已退回 colors.bg`);
    }
    for (const el of scene.elements) {
      if (!isTextBlock(catalog.blocks.get(el.block))) continue;
      const key = el.params.color || 'ink';
      const fg = style?.colors?.[key];
      if (!fg) continue;
      const sizePx = el.meta?.sizes?.[el.params.size] ?? el.meta?.sizes?.default ?? 60;
      const need = sizePx >= 24 ? 3 : 4.5;
      const ratio = contrast(fg, bg);
      if (ratio < need) {
        bag.warn('should', 'CONTRAST_LOW', `${path}.${el.id}`,
          `${el.block} 用 ${key}(${fg}) 画在 ${bg} 上，对比度 ${ratio.toFixed(2)}:1 < ${need}:1（${sizePx}px）`);
      }
    }
  });

  // 5. 能量连用三场
  const energyOf = (scene) => {
    let best = -1;
    for (const el of scene.elements) {
      const level = LEVEL[el.meta.energy?.level];
      if (level !== undefined && level > best) best = level;
    }
    return best;
  };
  const energies = scenes.map(energyOf);
  for (let i = 2; i < energies.length; i += 1) {
    if (energies[i] >= 0 && energies[i] === energies[i - 1] && energies[i] === energies[i - 2]) {
      bag.warn('nice', 'ENERGY_FLAT', `scenes[${i}]`,
        `连续三场能量都是 ${Object.keys(LEVEL).find((k) => LEVEL[k] === energies[i])}，片子会像 PPT`);
    }
  }

  // 6. 声明与实际对账（词法级）
  const seenBlocks = new Set();
  for (const scene of scenes) {
    for (const el of scene.elements) seenBlocks.add(el.block);
  }
  for (const id of seenBlocks) {
    const meta = catalog.blocks.get(id);
    if (meta.usesFont && !(meta.needs?.font || []).length) {
      bag.error('FONT_UNDECLARED', `block:${id}`,
        `${id} 的 draw.js 调了 font()，但 block.json 的 needs.font 是空的——本场不会声明任何字体，画面会掉到系统字体`);
    }
    if (meta.hasSetup && !meta.needs?.cache) {
      bag.error('CACHE_UNDECLARED', `block:${id}`,
        `${id} 注册了 SETUP（建缓存画布），但 block.json 的 needs.cache 是 false——缓存会绕过配额统计`);
    }
    if (meta.resources !== undefined && !Array.isArray(meta.resources)) {
      bag.error('BLOCK_RESOURCES_TYPE', `block:${id}`,
        `${id} 的 block.json resources 必须是 {type, name, src} 数组`);
    }
    for (const [index, res] of (Array.isArray(meta.resources) ? meta.resources : []).entries()) {
      const path = `block:${id}.resources[${index}]`;
      if (!res || typeof res !== 'object'
        || !['image', 'video', 'font'].includes(res.type)
        || typeof res.name !== 'string' || !res.name.trim()
        || typeof res.src !== 'string' || !res.src.trim()) {
        bag.error('BLOCK_RESOURCE_INVALID', path,
          'block 自带资源必须是 {type: image|video|font, name: 非空字符串, src: 非空字符串}');
      }
    }
  }

  return bag;
}
