/**
 * 确定性哈希：同一个 storyboard，两次编译必须给出同一个指纹。
 *
 * 哈希的对象是**最终 composition**，不是 storyboard：storyboard 里缺省值没补齐、
 * 键序不同、数字写成 1.0 还是 1，都会让哈希漂移，但画面一模一样。
 * 拿产物算哈希，才等于"这一段画面没有变"。
 *
 * 规范化只做一件事：对象键排序。数组顺序有意义（场景顺序、元素顺序），不动。
 * 也不剔除任何字段——`code` 里一个光标位置的变化就意味着重新渲染过。
 */
import { createHash } from 'node:crypto';

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonicalize(value[key]);
    return out;
  }
  return value;
}

export function detHash(composition) {
  const canonical = JSON.stringify(canonicalize(composition));
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

/** 逐场哈希：改一场就能看出是哪一场改的，不用对着整片哈希猜。 */
export function sceneHashes(composition) {
  return (composition.scenes || []).map((scene) => ({
    id: scene.id,
    hash: createHash('sha256').update(JSON.stringify(canonicalize(scene))).digest('hex').slice(0, 12),
  }));
}
