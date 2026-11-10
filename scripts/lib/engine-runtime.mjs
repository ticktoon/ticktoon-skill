/**
 * Ticktoon 唯一引擎产物目录。
 * 优先使用 TICKTOON_ENGINE_DIR，其次分发包内 ticktoon-dist，最后相邻 ticktoon/dist。
 */
import { existsSync } from 'node:fs';
import path from 'node:path';

export function getEngineDir(skillRoot, env = process.env) {
  if (env.TICKTOON_ENGINE_DIR) return path.resolve(env.TICKTOON_ENGINE_DIR);
  const bundled = path.join(skillRoot, 'ticktoon-dist');
  if (existsSync(path.join(bundled, 'export-page.html'))) return bundled;
  return path.resolve(skillRoot, '../ticktoon/dist');
}
