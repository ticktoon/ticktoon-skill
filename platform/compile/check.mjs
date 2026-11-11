/**
 * ⑥ check —— 编译期轻校验。
 *
 * 只做"声明与实现是否一致"的静态对账：模板用了字体但没声明、模板资源形状、
 * 必需的媒体参数是否为空。构图、安全框、对比度、停留时长、能量曲线都不在这里判断——
 * 画面好坏由抽帧联系表交给人或 agent 看图，机器只保证"能正确编译、能画出来"。
 */
export function check({ scenes, bag, recipe }) {
  if (recipe?.mode !== 'params') return bag;
  const template = recipe.template;
  const source = template?.drawSource || '';

  if (/\bfont\s*\(/.test(source) && !(template?.needs?.font || []).length) {
    bag.error('FONT_UNDECLARED', `recipe:${recipe.id}`,
      `${recipe.id} 的模板调了 font()，但 template.needs.font 是空的——本场不会声明任何字体，画面会掉到系统字体`);
  }

  for (const [index, res] of (template?.resources || []).entries()) {
    if (!res || typeof res !== 'object'
      || !['image', 'video', 'font'].includes(res.type)
      || typeof res.name !== 'string' || !res.name.trim()
      || typeof res.src !== 'string' || !res.src.trim()) {
      bag.error('TEMPLATE_RESOURCE_INVALID', `recipe:${recipe.id}.resources[${index}]`,
        '模板自带资源必须是 {type: image|video|font, name: 非空字符串, src: 非空字符串}');
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
