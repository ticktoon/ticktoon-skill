/**
 * 建工程：把 recipe 的 demo 平铺成 storyboard.json。
 *
 * 预填而不是空文件：LLM 要改的东西必须先在眼前。空文件会逼它从零想象版式，
 * 而"改一个像的"永远比"写一个新的"可靠。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export function newProject({ dir, recipe, catalog }) {
  const entry = catalog.recipes.get(recipe);
  if (!entry) {
    throw new Error(`未知 recipe "${recipe}"；可用：${[...catalog.recipes.keys()].join(' / ')}`);
  }
  const demoPath = path.join(entry.dir, 'demo.storyboard.json');
  if (!existsSync(demoPath)) {
    throw new Error(`recipe ${recipe} 缺少 demo.storyboard.json（它同时是回归测试，必须有）`);
  }

  const storyboard = JSON.parse(readFileSync(demoPath, 'utf-8'));
  mkdirSync(dir, { recursive: true });
  const target = path.join(dir, 'storyboard.json');
  if (existsSync(target)) {
    throw new Error(`${target} 已存在；换个目录，或先备份再删`);
  }
  writeFileSync(target, JSON.stringify(storyboard, null, 2) + '\n');
  return { target, storyboard };
}
