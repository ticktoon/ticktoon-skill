/**
 * Ticktoon 只读预览服务：本地端口 + preview-page + 场景/音频泳道。
 *
 * 用法: node scripts/preview.mjs <composition.json> [--port N]
 * 改完 storyboard 重新 `tt build` 后，页面按 composition mtime 自动刷新。
 * 常驻服务：圈注与导出都不停止；仅显式 POST /shutdown 或 Ctrl+C 关闭。
 *
 * `/api/track` 这个路由名是引擎 preview-page 的既有契约，不要跟着改名。
 * 圈注闭环: 页面「发送圈注」POST /api/annotations → <工程>/annotations/<batch>/request.json + 每条三张 PNG + 全局批次索引；
 *           发送后显示 2 秒提示并落盘，后续由对话驱动修改；预览服务保持运行。
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStaticServer } from './lib/serve.mjs';
import { buildAssetBasenameMap, rewriteLocalRefs } from './lib/refs.mjs';
import { registerPreview, unregisterPreview } from './lib/preview-lifecycle.mjs';
import { stopAnnotationWait } from './lib/annotation-wait.mjs';
import { publishAnnotationBatch } from './lib/annotation-inbox.mjs';
import { getEngineDir } from './lib/engine-runtime.mjs';
import { assertComposition } from './lib/protocol.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(__dirname, '..');
const ENGINE_DIR = getEngineDir(SKILL_ROOT);
const ASSETS_DIR = path.join(SKILL_ROOT, 'assets');
const PREVIEW_PAGE = path.join(ENGINE_DIR, 'preview-page.html');
const ANNOTATION_MODULE = path.join(SKILL_ROOT, 'platform', 'preview', 'annotation.mjs');

const args = process.argv.slice(2);
if (!args.length || args.includes('--help')) {
  console.log('用法: node scripts/preview.mjs <composition.json> [--port N]');
  process.exit(args.length ? 0 : 1);
}
let compositionFile = path.resolve(args[0]);
if (!existsSync(compositionFile)) {
  console.error('✗ 找不到 composition: ' + compositionFile);
  process.exit(1);
}
const portIdx = args.indexOf('--port');
const wantPort = portIdx >= 0 ? Number(args[portIdx + 1]) || 0 : 0;
let JOB_DIR = path.dirname(compositionFile);
const projectRootOf = (file) => path.basename(path.dirname(file)) === 'out' ? path.dirname(path.dirname(file)) : path.dirname(file);
/** 圈注落盘到工程根；切换工程时这些路径随 composition 一起更新。 */
let PROJECT_DIR = projectRootOf(compositionFile);
let ANNOTATIONS_DIR = path.join(PROJECT_DIR, 'annotations');
let annotationSequence = 0;
const assetBasenameMap = buildAssetBasenameMap({ assetsDir: ASSETS_DIR });
/** 每次请求重读：build 落盘后页面刷新就能拿到新 composition。非法产物在这里就拦住。 */
const readComposition = () => {
  let data;
  try {
    data = JSON.parse(readFileSync(compositionFile, 'utf-8'));
  } catch (error) {
    throw new Error(`读取 composition 失败: ${error.message}`);
  }
  return assertComposition(data);
};

function readJsonBody(req, limit = 100 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        req.destroy();
        reject(new Error('圈注数据过大（上限 100MB）'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(new Error(`圈注 JSON 解析失败: ${error.message}`));
      }
    });
    req.on('error', reject);
  });
}

const PNG_DATA_URL = /^data:image\/png;base64,(.+)$/s;

function decodePng(value, label) {
  const match = typeof value === 'string' ? PNG_DATA_URL.exec(value) : null;
  if (!match) throw new Error(`${label} 必须是 data:image/png;base64 数据`);
  return Buffer.from(match[1], 'base64');
}

/**
 * 圈注闭环：页面点「发送圈注」后 POST 到这里，整批落盘。
 * 一批 = 一个目录 <工程>/annotations/<batch>/，里面是 request.json + 每条三项 PNG；
 * request.json 最后写，保证 `tt annotations` 永远看不到缺图的半成品。
 */
function saveBatch(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('圈注 payload 必须是对象');
  const items = payload.items;
  if (!Array.isArray(items) || !items.length) throw new Error('圈注批次缺少 items');
  const normalized = items.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`第 ${index + 1} 条圈注不是对象`);
    const t = Number(item.t);
    if (!Number.isFinite(t) || t < 0) throw new Error(`第 ${index + 1} 条圈注缺少合法时间 t`);
    if (!Array.isArray(item.strokes) || !item.strokes.length) throw new Error(`第 ${index + 1} 条圈注缺少笔迹 strokes`);
    const images = item.images;
    if (!images || typeof images !== 'object') throw new Error(`第 ${index + 1} 条圈注缺少 images`);
    return {
      t,
      desc: String(item.desc ?? ''),
      strokes: item.strokes,
      clip: item.clip ?? null,
      images,
    };
  });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 23);
  const id = `batch-${stamp}-${++annotationSequence}`;
  const batchDir = path.join(ANNOTATIONS_DIR, id);
  mkdirSync(batchDir, { recursive: true });

  const records = normalized.map((item, index) => {
    const prefix = String(index + 1).padStart(2, '0');
    const imageFiles = {
      annotatedFrame: `${prefix}.annotated.png`,
      frame: `${prefix}.frame.png`,
      ink: `${prefix}.ink.png`,
    };
    const buffers = {
      annotatedFrame: decodePng(item.images.annotatedFrame, `${prefix}.annotatedFrame`),
      frame: decodePng(item.images.frame, `${prefix}.frame`),
      ink: decodePng(item.images.ink, `${prefix}.ink`),
    };
    for (const key of Object.keys(imageFiles)) {
      writeFileSync(path.join(batchDir, imageFiles[key]), buffers[key]);
    }
    return {
      t: item.t,
      desc: item.desc,
      strokes: item.strokes,
      clip: item.clip,
      images: imageFiles,
    };
  });

  const record = {
    id,
    createdAt: new Date().toISOString(),
    composition: path.relative(PROJECT_DIR, compositionFile).split(path.sep).join('/'),
    items: records,
  };
  writeFileSync(path.join(batchDir, 'request.json'), JSON.stringify(record, null, 2));
  publishAnnotationBatch({
    projectDir: PROJECT_DIR,
    compositionFile,
    batch: { id, dir: batchDir, json: path.join(batchDir, 'request.json') },
    createdAt: record.createdAt,
  });
  const relativeDir = path.relative(PROJECT_DIR, ANNOTATIONS_DIR).split(path.sep).join('/') || 'annotations';
  return {
    id,
    dir: `${relativeDir}/${id}`,
    json: `${relativeDir}/${id}/request.json`,
    count: records.length,
  };
}

const { server, port } = await createStaticServer({
  ENGINE_DIR, ASSETS_DIR, JOB_DIR: () => JOB_DIR, port: wantPort,
  onRequest(req, res, urlPath) {
    const json = (data, code = 200) => {
      res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(data));
      return true;
    };
    if (urlPath === '/' && req.method === 'GET') {
      const html = readFileSync(PREVIEW_PAGE, 'utf8').replace(
        '</body>',
        '<script type="module" src="/__skill-preview__/annotation.mjs"></script>\n</body>',
      );
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(html);
      return true;
    }
    if (urlPath === '/__skill-preview__/annotation.mjs' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(readFileSync(ANNOTATION_MODULE));
      return true;
    }
    if (urlPath === '/api/track' && req.method === 'GET') {
      let composition;
      try {
        composition = readComposition();
      } catch (error) {
        return json({ error: error.message }, 422);
      }
      if (new URL(req.url, 'http://x').searchParams.get('for') === 'panel') {
        const base = `http://127.0.0.1:${port}`;
        return json({
          ...composition,
          scenes: rewriteLocalRefs(structuredClone(composition.scenes), base, assetBasenameMap),
          audio: rewriteLocalRefs(structuredClone(composition.audio), base, assetBasenameMap),
        });
      }
      return json(composition);
    }
    if (urlPath === '/api/track' && req.method === 'POST') {
      return json({ error: 'Ticktoon 预览只读；请改 storyboard 后重新 `tt build`' }, 405);
    }
    if (urlPath === '/api/board-download' && req.method === 'GET') {
      try {
        readComposition();
        const bytes = readFileSync(compositionFile);
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': 'attachment; filename="board.json"',
          'Content-Length': bytes.length,
          'Cache-Control': 'no-store',
        });
        res.end(bytes);
      } catch (error) {
        return json({ error: error.message }, 422);
      }
      return true;
    }
    if (urlPath === '/api/annotations' && req.method === 'POST') {
      readJsonBody(req)
        .then((payload) => json({ ok: true, ...saveBatch(payload) }))
        .catch((error) => json({ error: error instanceof Error ? error.message : String(error) }, 400));
      return true;
    }
    if (urlPath === '/api/project' && req.method === 'POST') {
      readJsonBody(req, 1024 * 1024)
        .then((payload) => {
          switchProject(payload?.compositionFile);
          json({ ok: true, trackFile: compositionFile, port });
        })
        .catch((error) => json({ error: error instanceof Error ? error.message : String(error) }, 400));
      return true;
    }
    if (urlPath === '/api/track-meta' && req.method === 'GET') {
      return json({ mtimeMs: statSync(compositionFile).mtimeMs, trackFile: compositionFile });
    }
    // 键名 trackFile 是 preview-lifecycle 的既有契约，值是 composition 路径。
    if (urlPath === '/api/preview-info' && req.method === 'GET') return json({ trackFile: compositionFile, pid: process.pid });
    if (urlPath === '/shutdown' && req.method === 'POST') {
      json({ ok: true });
      setTimeout(shutdownPreview, 200);
      return true;
    }
    return false;
  },
});

function switchProject(nextFile) {
  const resolved = path.resolve(String(nextFile || ''));
  if (!existsSync(resolved)) throw new Error(`找不到 composition: ${resolved}`);
  assertComposition(JSON.parse(readFileSync(resolved, 'utf-8')));
  if (resolved === compositionFile) return;
  unregisterPreview(compositionFile);
  compositionFile = resolved;
  JOB_DIR = path.dirname(compositionFile);
  PROJECT_DIR = projectRootOf(compositionFile);
  ANNOTATIONS_DIR = path.join(PROJECT_DIR, 'annotations');
  annotationSequence = 0;
  registerPreview(compositionFile, port);
  console.log(`[preview] 已切换工程: ${compositionFile}`);
}

registerPreview(compositionFile, port);
let shuttingDown = false;
function shutdownPreview() {
  if (shuttingDown) return;
  shuttingDown = true;
  unregisterPreview(compositionFile);
  stopAnnotationWait();
  server.close();
  process.exit(0);
}
process.once('SIGINT', shutdownPreview);
process.once('SIGTERM', shutdownPreview);
process.once('exit', () => unregisterPreview(compositionFile));

const previewUrl = `http://127.0.0.1:${port}`;
console.log(`[preview] 只读预览页: ${previewUrl}`);
console.log(`[preview] composition: ${compositionFile}`);
console.log(`[preview] 圈注落盘: ${ANNOTATIONS_DIR}（用 tt annotations 读取）`);
console.log('[preview] 常驻服务: 圈注和导出均不停止；仅显式 POST /shutdown 或 Ctrl+C 关闭。');
