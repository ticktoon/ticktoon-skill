/**
 * ⑥ check —— 编译期轻校验。
 *
 * 只做"声明与实现是否一致"的静态对账：模板用了字体但没声明、模板资源形状、
 * 必需的媒体参数是否为空。构图、安全框、对比度、停留时长、能量曲线都不在这里判断——
 * 画面好坏由抽帧联系表交给人或 agent 看图，机器只保证"能正确编译、能画出来"。
 */
export function check({ scenes, bag, recipe, catalog = null }) {
  if (recipe?.mode !== 'params') return bag;
  const template = recipe.template;
  const source = template?.drawSource || '';

  const fontResources = (template?.resources || []).filter((res) => res?.type === 'font');
  if (/\bfont\s*\(/.test(source) && !fontResources.length) {
    bag.error('TEMPLATE_FONTS_MISSING', `recipe:${recipe.id}`,
      `${recipe.id} 的模板调了 font()，但 template.resources 没有 font 条目——本场不会加载任何字体，画面会掉到系统字体`);
  }
  if (fontResources.length && catalog?.fonts) {
    const declared = new Set(fontResources.map((res) => res.name));
    for (const key of Object.keys(catalog.fonts)) {
      if (!catalog.fonts[key]?.src) continue;
      if (new RegExp(`['"\`]${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`).test(source) && !declared.has(key)) {
        bag.error('TEMPLATE_FONT_UNDECLARED', `recipe:${recipe.id}.resources`,
          `模板里用了字体键 "${key}"，但没有在 template.resources 声明——本场不会加载它，画面会掉到系统字体`);
      }
    }
  }

  for (const [index, res] of (template?.resources || []).entries()) {
    const isFont = res?.type === 'font';
    if (!res || typeof res !== 'object'
      || !['image', 'video', 'font'].includes(res.type)
      || typeof res.name !== 'string' || !res.name.trim()
      || (!isFont && (typeof res.src !== 'string' || !res.src.trim()))) {
      bag.error('TEMPLATE_RESOURCE_INVALID', `recipe:${recipe.id}.resources[${index}]`,
        '模板自带资源必须是 {type: image|video, name, src} 或 {type:"font", name: manifest 字体键}');
    }
  }

  if (template?.needs?.image || template?.needs?.video) {
    scenes.forEach((scene, index) => {
      if (scene.params === null) return;
      if (typeof scene.params.src !== 'string' || !scene.params.src.trim()) {
        bag.error('TEMPLATE_MEDIA_SRC_MISSING', `scenes[${index}].params.src`,
          `${recipe.id} 的模板声明了媒体需求，params.src 必须是非空素材路径`);
      }
    });
  }

  return bag;
}
