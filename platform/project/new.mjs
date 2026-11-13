/**
 * 建工程：把 recipe 的骨架 storyboard 复制成工程的 storyboard.json。
 *
 * params recipe 的骨架是一份完整固定样例；code recipe 的骨架是一个最小空壳。
 * 骨架只是起点，不是要照抄的成片；code 模式的具体写法看 recipe.md 与 ref-shots/。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export function newProject({ dir, recipe, catalog }) {
  const entry = catalog.recipes.get(recipe);
  if (!entry) {
    throw new Error(`未知 recipe "${recipe}"；可用：${[...catalog.recipes.keys()].join(' / ')}`);
  }
  const skeletonPath = path.join(entry.dir, 'skeleton.storyboard.json');
  if (!existsSync(skeletonPath)) {
    throw new Error(`recipe ${recipe} 缺少 skeleton.storyboard.json（建工程与回归都用它）`);
  }

  const storyboard = JSON.parse(readFileSync(skeletonPath, 'utf-8'));
  mkdirSync(dir, { recursive: true });
  const target = path.join(dir, 'storyboard.json');
  if (existsSync(target)) {
    throw new Error(`${target} 已存在；换个目录，或先备份再删`);
  }
  writeFileSync(target, JSON.stringify(storyboard, null, 2) + '\n');
  return { target, storyboard, mode: entry.mode };
}
