/**
 * 协议版本的唯一来源。
 *
 * 必须与引擎 `src/protocol.ts` 的 `PROTOCOL_VERSION` 保持一致；
 * 引擎 validate 会在版本不符时直接抛错，这里写错会让所有编译产物无法预览/导出。
 */
export const PROTOCOL_VERSION = '1.0';

/**
 * 预览/导出前的最后一道门。只判「能不能交给引擎」，不补字段——
 * 形状由 platform/compile/assemble.mjs 负责，这里再猜一遍只会掩盖编译期 bug。
 */
export function assertComposition(composition) {
  if (Array.isArray(composition?.tracks)) {
    throw new Error(
      'composition 含 tracks：引擎 1.0 只有 scenes[] + audio[]。请用 `tt build` 重新编译 storyboard，不要手写产物',
    );
  }
  if (composition?.version !== PROTOCOL_VERSION) {
    throw new Error(
      `composition.version 必须是 "${PROTOCOL_VERSION}"，实际为 ${JSON.stringify(composition?.version)}；请用 \`tt build\` 重新编译`,
    );
  }
  if (!Array.isArray(composition.scenes) || composition.scenes.length === 0) {
    throw new Error('composition.scenes 必须是非空数组；请用 `tt build` 重新编译');
  }
  if (!Array.isArray(composition.audio)) {
    throw new Error('composition.audio 必须是数组（没有音频就写 []）');
  }
  for (const [i, scene] of composition.scenes.entries()) {
    if (typeof scene?.id !== 'string' || typeof scene?.duration !== 'number') {
      throw new Error(`composition.scenes[${i}] 缺少 id 或 duration`);
    }
    if (typeof scene?.code !== 'string') {
      throw new Error(`composition.scenes[${i}] (${scene.id}) 缺少 code`);
    }
  }
  return composition;
}
