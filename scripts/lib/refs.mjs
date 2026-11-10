/**
 * composition 本地引用重写（render / preview / snapshot 共用）。
 *   job:xx.mp3      → composition 所在任务目录
 *   skill:assets/xx → Skill 包内 assets/
 *   内置 BGM basename / 远程同名 key → 本地 BGM
 */
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

export function buildAssetBasenameMap({ assetsDir }) {
  const map = {};
  const bgmDir = path.join(assetsDir, 'bgm');
  if (existsSync(bgmDir)) {
    for (const file of readdirSync(bgmDir)) map[file] = `/__skill-assets__/bgm/${file}`;
  }
  return map;
}

export function rewriteLocalRefs(node, base, assetBasenameMap) {
  if (typeof node === 'string') {
    if (node.startsWith('job:')) return `${base}/__job__/${node.slice(4)}`;
    if (node.startsWith('skill:assets/')) return `${base}/__skill-assets__/${node.slice('skill:assets/'.length)}`;
    const rawBase = node.split(/[\\/]/).pop()?.split('?')[0] ?? '';
    let basename = rawBase;
    try { basename = decodeURIComponent(rawBase); } catch { /* 普通文案中的裸 % 按原名处理 */ }
    if (assetBasenameMap[basename]) return `${base}${assetBasenameMap[basename]}`;
    return node;
  }
  if (Array.isArray(node)) {
    node.forEach((value, index) => { node[index] = rewriteLocalRefs(value, base, assetBasenameMap); });
    return node;
  }
  if (node && typeof node === 'object') {
    for (const key of Object.keys(node)) node[key] = rewriteLocalRefs(node[key], base, assetBasenameMap);
  }
  return node;
}
