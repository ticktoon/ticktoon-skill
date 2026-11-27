/**
 * Ticktoon 本地静态服务（render / preview / snapshot 共用）。
 *   /                      → engine/export-page.html
 *   其他静态路径            → engine dist
 *   /__job__/*             → 任务目录
 *   /__skill-assets__/*    → Skill 包内 assets/（SVG 必须给对 MIME：Chrome 不嗅探它，
 *                            给成 octet-stream 时 <img> 直接拒载，表现为静默黑帧）
 *   /__skill-recipes__/*   → Skill 包内 recipes/（ref-shot 私有的 data 等素材）
 * onRequest(req, res, urlPath) 返回 true 表示 API 已接管。
 */
import http from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.gif': 'image/gif', '.jpg': 'image/jpeg',
  '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ico': 'image/x-icon', '.txt': 'text/plain', '.ttf': 'font/ttf',
  '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

export function createStaticServer({ ENGINE_DIR, ASSETS_DIR, JOB_DIR, port = 0, onRequest }) {
  const RECIPES_DIR = path.join(path.dirname(ASSETS_DIR), 'recipes');
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (onRequest?.(req, res, urlPath)) return;
      let root = ENGINE_DIR;
      let relative = urlPath === '/' ? 'export-page.html' : urlPath;
      if (urlPath.startsWith('/__skill-assets__/')) {
        root = ASSETS_DIR;
        relative = urlPath.slice('/__skill-assets__/'.length);
      } else if (urlPath.startsWith('/__skill-recipes__/')) {
        root = RECIPES_DIR;
        relative = urlPath.slice('/__skill-recipes__/'.length);
      } else if (urlPath.startsWith('/__job__/')) {
        root = typeof JOB_DIR === 'function' ? JOB_DIR() : JOB_DIR;
        relative = urlPath.slice('/__job__/'.length);
      }
      const file = path.resolve(root, `.${path.sep}${relative.replace(/^[/\\]+/, '')}`);
      if (!file.startsWith(path.resolve(root) + path.sep) || !existsSync(file) || !statSync(file).isFile()) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(readFileSync(file));
    });
    const onError = (error) => reject(error);
    server.once('error', onError);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', onError);
      resolve({ server, port: server.address().port });
    });
  });
}
