/**
 * ⑥ check —— 编译期轻校验。
 *
 * 只做"声明与实现是否一致"的静态对账：字体 / 缓存 / block 自带资源。
 * 构图、安全框、对比度、停留时长、能量曲线都不在这里判断——
 * 画面好坏由抽帧联系表交给人或 agent 看图，机器只保证"能正确编译、能画出来"。
 */
export function check({ scenes, bag, catalog }) {
  const seenBlocks = new Set();
  for (const scene of scenes) {
    for (const el of scene.elements) seenBlocks.add(el.block);
  }
  for (const id of seenBlocks) {
    const meta = catalog.blocks.get(id);
    if (!meta) continue;
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
