/**
 * Ticktoon 本地静态服务（render / preview / snapshot 共用）。
 *   /                      → engine/export-page.html
 *   其他静态路径            → engine dist
 *   /__job__/*             → 任务目录
 *   /__skill-assets__/*    → Skill 包内 assets/（SVG 必须给对 MIME：Chrome 不嗅探它，
 *                            给成 octet-stream 时 <img> 直接拒载，表现为静默黑帧）
 * onRequest(req, res, urlPath) 返回 true 表示 API 已接管。
 */
import http from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.gif': 'image/gif', '.jpg': 'image/jpeg',
  '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon', '.txt': 'text/plain', '.ttf': 'font/ttf',
  '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

export function createStaticServer({ ENGINE_DIR, ASSETS_DIR, JOB_DIR, port = 0, onRequest }) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (onRequest?.(req, res, urlPath)) return;
      let root = ENGINE_DIR;
      let relative = urlPath === '/' ? 'export-page.html' : urlPath;
      if (urlPath.startsWith('/__skill-assets__/')) {
        root = ASSETS_DIR;
        relative = urlPath.slice('/__skill-assets__/'.length);
      } else if (urlPath.startsWith('/__job__/')) {
        root = JOB_DIR;
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
    server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}
