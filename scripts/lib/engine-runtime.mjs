/**
 * Ticktoon 引擎来自 npm dependencies 的 ticktoon 包。
 * TICKTOON_ENGINE_DIR 仅用于显式开发覆盖；默认读取 node_modules/ticktoon/dist。
 */
import path from 'node:path';

export function getEngineDir(skillRoot, env = process.env) {
  if (env.TICKTOON_ENGINE_DIR) return path.resolve(env.TICKTOON_ENGINE_DIR);
  return path.join(skillRoot, 'node_modules', 'ticktoon', 'dist');
}
