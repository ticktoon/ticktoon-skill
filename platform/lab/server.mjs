/**
 * Code Lab —— 浏览、预览、调试 code recipe 的 ref-shots/ 与 kit。
 *
 * 镜头参考页的数据源是 `recipes/<id>/ref-shots/*.js`，由 `refShotStoryboard()`
 * 包成一场 storyboard 后走真实 `buildProject`。Kit 实验台刻意不经过 recipe：
 * 页面给一段 scene.code，`kit-build.mjs` 把 kit 源码、字幕核心、推导出的 FONTS /
 * RULES 拼成 composition；转场模式复用正式展开器生成独立双帧转场视觉节点，
 * 再交给同一个引擎 preview-panel 播放。
 *
 * 缩略图在服务端用一次 CDP 会话批量渲染；点击卡片后的播放走页面里的
 * `/preview-panel.html` iframe，和 `tt preview` 是同一个引擎面板。
 */
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStaticServer } from '../../scripts/lib/serve.mjs';
import { buildAssetBasenameMap, rewriteLocalRefs } from '../../scripts/lib/refs.mjs';
import { getEngineDir } from '../../scripts/lib/engine-runtime.mjs';
import { loadCatalog } from '../compile/schema.mjs';
import { CAPTION_STYLE_DEFAULTS } from '../compile/captions.mjs';
import { refShotStoryboard, readRecipeRefShots } from '../project/ref-shots.mjs';
import { buildProject } from '../project/build.mjs';
import { openPreviewSession } from '../inspect/preview-session.mjs';
import { buildKitComposition } from './kit-build.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE_FILE = path.join(HERE, 'page.html');
const KIT_PAGE_FILE = path.join(HERE, 'kit.html');
const ORIENTATIONS = ['landscape', 'portrait'];
const MAX_CODE_BYTES = 1024 * 1024;
const MAX_BODY_BYTES = 2 * 1024 * 1024;

const json = (res, value, code = 200) => {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(value));
};

const fail = (code, msg) => Object.assign(new Error(msg), { code });

function readJsonBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        req.destroy();
        reject(fail('BODY_TOO_LARGE', `请求体超过 ${Math.round(limit / 1024)}KB`));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(fail('BODY_BAD_JSON', `JSON 解析失败：${error.message}`));
      }
    });
    req.on('error', reject);
  });
}

function slug(value) {
  return String(value).replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'ref-shot';
}

/** 只做语法解析，不执行代码；真正的绘制仍在引擎面板里发生。 */
function syntaxError(code) {
  try {
    new Function(code);
    return null;
  } catch (error) {
    return error?.message || String(error);
  }
}

function mtimeOf(file) {
  try {
    return statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

function compileErrors(report) {
  return (report?.errors || []).map((item) => ({
    code: item.code,
    path: item.path || '',
    msg: item.msg,
  }));
}

function summarizeReport(report) {
  return {
    duration: report?.duration ?? 0,
    scenes: report?.scenes ?? 0,
    det: report?.det?.hash || '',
    warnings: (report?.warnings || []).filter((item) => item.level !== 'nice').map((item) => ({
      code: item.code,
      path: item.path || '',
      msg: item.msg,
      level: item.level,
    })),
  };
}

/**
 * @param {{ root: string, port?: number, recipe?: string|null, log?: (line: string) => void }} options
 */
export async function startLab({ root, port = 5125, recipe: onlyRecipe = null, log = console.log }) {
  const catalog = loadCatalog(root);
  const engineDir = getEngineDir(root);
  const assetsDir = path.join(root, 'assets');
  const jobDir = path.join(root, 'output', 'lab');
  const tmpDir = path.join(jobDir, 'tmp');
  const kitIndex = JSON.parse(readFileSync(path.join(root, 'platform', 'kit', 'index.json'), 'utf-8'));
  // Kit 实验台不经过 recipe：所有 kit 源码在这里一次读盘，按 index 顺序拼进 composition。
  const kitBundles = Object.entries(kitIndex).map(([id, entry]) => ({
    id,
    code: readFileSync(path.join(root, 'platform', 'kit', entry.file), 'utf-8'),
    payload: (entry.payload || []).map((file) => readFileSync(path.join(root, 'platform', 'kit', file), 'utf-8')),
    provides: entry.provides || [],
    requires: entry.requires || [],
  }));
  mkdirSync(tmpDir, { recursive: true });

  const assetBasenameMap = buildAssetBasenameMap({ assetsDir });
  let base = '';
  let requestSequence = 0;

  const codeRecipes = [...catalog.recipes.values()]
    .filter((entry) => entry.mode === 'code')
    .filter((entry) => !onlyRecipe || entry.id === onlyRecipe)
    .sort((a, b) => a.id.localeCompare(b.id));

  if (!codeRecipes.length) {
    const hint = onlyRecipe ? `，recipe "${onlyRecipe}" 不是 code 模式或不存在` : '';
    throw new Error(`没有可用的 code recipe${hint}`);
  }

  function getRecipe(id) {
    const entry = catalog.recipes.get(id);
    if (!entry || entry.mode !== 'code') throw fail('RECIPE_UNKNOWN', `未知 code recipe：${id}`);
    return entry;
  }

  function refShotIndex(entry) {
    const { refShots, errors } = readRecipeRefShots(entry.dir);
    return {
      refShots,
      errors: errors.map((item) => ({ code: item.code, msg: item.msg, file: item.file || '' })),
    };
  }

  function getRefShot(recipeId, file) {
    const entry = getRecipe(recipeId);
    const index = refShotIndex(entry);
    const refShot = index.refShots.find((item) => item.file === file);
    if (!refShot) throw fail('REF_SHOT_UNKNOWN', `recipe ${recipeId} 下没有镜头参考 ${file}`);
    return { recipe: entry, refShot, errors: index.errors };
  }

  function writeTempStoryboard(entry, refShot, storyboard) {
    const dir = path.join(tmpDir, entry.id.replaceAll('/', '-'));
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${slug(refShot.file)}-${++requestSequence}.storyboard.json`);
    writeFileSync(file, JSON.stringify(storyboard, null, 2) + '\n');
    return file;
  }

  /** 单场镜头参考 / kit 实验场 → 真实编译产物；播放与缩略图都走这里。 */
  async function buildRefShot({
    entry, refShot, code, duration, orientation,
    narration = '', speech = null, captions = null,
  }) {
    const source = typeof code === 'string' ? code : refShot.code;
    const invalid = syntaxError(source);
    if (invalid) {
      return { ok: false, errors: [{ code: 'LAB_CODE_SYNTAX', path: 'scene.code', msg: invalid }] };
    }
    const storyboard = refShotStoryboard({
      recipe: entry,
      refShot,
      code,
      duration,
      orientation,
      narration,
    });
    // 字幕要的是稳定的语音时长；实验台用固定时长的假 TTS，不请求真实语音。
    const hasNarration = typeof narration === 'string' && narration.trim().length > 0;
    const tts = hasNarration && Number.isFinite(speech) && speech > 0
      ? { provider: 'lab-fixed', synthesize: async () => ({ duration: speech, words: null, src: null }) }
      : null;
    const file = writeTempStoryboard(entry, refShot, storyboard);
    try {
      const built = await buildProject({
        root, dir: entry.dir, file, tts, write: false, receipts: false,
        audioDir: path.join(jobDir, 'audio'),
        captionOverride: captions ?? null,
      });
      if (!built.ok) {
        return { ok: false, report: built.report, errors: compileErrors(built.report) };
      }
      const composition = rewriteLocalRefs(structuredClone(built.composition), base, assetBasenameMap);
      return { ok: true, report: built.report, composition };
    } finally {
      rmSync(file, { force: true });
    }
  }

  // --- 缩略图：一次 CDP 会话串行渲染，按示例 mtime 缓存 ---
  const thumbCache = new Map();
  let thumbSession = null;
  let thumbChain = Promise.resolve();

  function enqueueThumb(task) {
    const run = thumbChain.then(task, task);
    thumbChain = run.catch(() => {});
    return run;
  }

  async function closeThumbSession() {
    const session = thumbSession;
    thumbSession = null;
    if (session) await session.close().catch(() => {});
  }

  async function renderThumb({ entry, refShot, orientation, time }) {
    const mtimeMs = mtimeOf(path.join(entry.dir, 'ref-shots', refShot.file));
    const key = `${entry.id}/${refShot.file}/${orientation}/${time}`;
    const cached = thumbCache.get(key);
    if (cached && cached.mtimeMs === mtimeMs) return cached.png;

    return enqueueThumb(async () => {
      const again = thumbCache.get(key);
      if (again && again.mtimeMs === mtimeMs) return again.png;

      const built = await buildRefShot({ entry, refShot, orientation });
      if (!built.ok) {
        throw fail('REF_SHOT_BUILD_FAILED',
          built.errors.map((item) => `[${item.code}] ${item.path ? item.path + ' — ' : ''}${item.msg}`).join('\n'));
      }

      try {
        if (!thumbSession) {
          thumbSession = await openPreviewSession({ base, composition: built.composition });
        } else {
          await thumbSession.load(built.composition);
        }
        const at = Math.min(time, Math.max(0, thumbSession.duration - 1 / 30));
        const shot = await thumbSession.captureAt(at, { image: true });
        const png = Buffer.from(shot.image.split(',')[1], 'base64');
        thumbCache.set(key, { mtimeMs, png });
        return png;
      } catch (error) {
        if (thumbSession) await closeThumbSession();
        throw error;
      }
    });
  }

  const staticOptions = {
    ENGINE_DIR: engineDir,
    ASSETS_DIR: assetsDir,
    JOB_DIR: jobDir,
    onRequest(req, res, urlPath) {
      const url = new URL(req.url, 'http://x');

      if ((urlPath === '/kit' || urlPath === '/kit.html') && req.method === 'GET') {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        res.end(readFileSync(KIT_PAGE_FILE));
        return true;
      }

      if (urlPath === '/' && req.method === 'GET') {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        res.end(readFileSync(PAGE_FILE));
        return true;
      }

      if (urlPath === '/api/kits' && req.method === 'GET') {
        json(res, {
          kits: kitBundles.map(({ id, provides, requires }) => ({
            id,
            file: kitIndex[id]?.file || '',
            provides,
            requires,
          })),
          captions: [...catalog.captions.keys()],
          captionDefaults: CAPTION_STYLE_DEFAULTS,
          captionFonts: Object.keys(catalog.fonts || {}).filter((key) => catalog.fonts[key]?.src),
          fontLibrary: Object.entries(catalog.fonts || {})
            .filter(([, entry]) => entry && typeof entry === 'object' && entry.src)
            .map(([key, entry]) => ({ key, family: entry.family || key, weight: entry.weight || 400, desc: entry.desc || '' })),
        });
        return true;
      }

      if (urlPath === '/api/recipes' && req.method === 'GET') {
        json(res, {
          recipes: codeRecipes.map((entry) => {
            const index = refShotIndex(entry);
            return {
              id: entry.id,
              name: entry.name || entry.id,
              when: (entry.when || []).join('；'),
              keywords: entry.keywords || [],
              count: index.refShots.length,
              errors: index.errors,
            };
          }),
        });
        return true;
      }

      if (urlPath === '/api/ref-shots' && req.method === 'GET') {
        let entry;
        try {
          entry = getRecipe(url.searchParams.get('recipe') || '');
        } catch (error) {
          json(res, { error: error.message, code: error.code }, 404);
          return true;
        }
        const index = refShotIndex(entry);
        json(res, {
          recipe: { id: entry.id, name: entry.name || entry.id, when: (entry.when || []).join('；') },
          errors: index.errors,
          refShots: index.refShots.map((refShot) => {
            const meta = refShot.meta;
            const duration = Number(meta.duration) || 1;
            return {
              file: refShot.file,
              title: meta.title,
              note: meta.note || '',
              duration,
              bg: meta.bg || '#10151d',
              thumbTime: Number.isFinite(meta.thumbTime) ? meta.thumbTime : Math.min(duration * 0.65, duration),
              tags: meta.tags || [],
              orientation: meta.orientation || 'landscape',
              component: meta.component || '',
              resources: meta.resources || [],
              code: refShot.code,
              mtimeMs: mtimeOf(path.join(entry.dir, 'ref-shots', refShot.file)),
            };
          }),
        });
        return true;
      }

      if (urlPath === '/api/thumb' && req.method === 'GET') {
        const recipeId = url.searchParams.get('recipe') || '';
        const file = url.searchParams.get('file') || '';
        const orientation = url.searchParams.get('orientation') || 'landscape';
        const rawTime = url.searchParams.get('t');
        const time = rawTime == null || rawTime === '' ? NaN : Number(rawTime);
        if (!ORIENTATIONS.includes(orientation)) {
          json(res, { error: `orientation 只能是 ${ORIENTATIONS.join(' / ')}` }, 400);
          return true;
        }
        let found;
        try {
          found = getRefShot(recipeId, file);
        } catch (error) {
          json(res, { error: error.message, code: error.code }, 404);
          return true;
        }
        const thumbTime = Number.isFinite(time)
          ? time
          : (Number.isFinite(found.refShot.meta.thumbTime)
            ? found.refShot.meta.thumbTime
            : Math.min(found.refShot.meta.duration * 0.65, found.refShot.meta.duration));
        renderThumb({
          entry: found.recipe,
          refShot: found.refShot,
          orientation,
          time: thumbTime,
        }).then((png) => {
          res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': png.length,
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(png);
        }).catch((error) => {
          if (res.headersSent) return;
          json(res, {
            error: error.message,
            code: error.code || 'THUMB_FAILED',
            errors: error.code === 'REF_SHOT_BUILD_FAILED' ? error.message.split('\n') : undefined,
          }, 422);
        });
        return true;
      }

      if (urlPath === '/api/kit-build' && req.method === 'POST') {
        readJsonBody(req).then(async (body) => {
          const code = body?.code;
          const nextCode = body?.nextCode ?? null;
          const transition = body?.transition ?? null;
          const duration = Number(body?.duration);
          const orientation = body?.orientation || 'landscape';
          const narration = typeof body?.narration === 'string' ? body.narration : '';
          const speechRaw = body?.speech;
          const captions = body?.captions ?? null;
          if (typeof code !== 'string' || !code.trim()) {
            json(res, { ok: false, errors: [{ code: 'LAB_CODE_EMPTY', msg: 'scene.code 不能为空' }] }, 400);
            return;
          }
          if (Buffer.byteLength(code) > MAX_CODE_BYTES) {
            json(res, { ok: false, errors: [{ code: 'LAB_CODE_TOO_LARGE', msg: 'scene.code 超过 1MB' }] }, 413);
            return;
          }
          if (nextCode !== null && (typeof nextCode !== 'string' || !nextCode.trim())) {
            json(res, { ok: false, errors: [{ code: 'LAB_NEXT_CODE_INVALID', msg: 'nextCode 必须是非空代码字符串' }] }, 400);
            return;
          }
          if (nextCode !== null && Buffer.byteLength(nextCode) > MAX_CODE_BYTES) {
            json(res, { ok: false, errors: [{ code: 'LAB_CODE_TOO_LARGE', msg: 'nextCode 超过 1MB' }] }, 413);
            return;
          }
          if (!Number.isFinite(duration) || duration <= 0 || duration > 600) {
            json(res, { ok: false, errors: [{ code: 'LAB_DURATION_INVALID', msg: 'duration 必须在 0–600 秒之间' }] }, 400);
            return;
          }
          if (!ORIENTATIONS.includes(orientation)) {
            json(res, { ok: false, errors: [{ code: 'LAB_ORIENTATION_INVALID', msg: `orientation 只能是 ${ORIENTATIONS.join(' / ')}` }] }, 400);
            return;
          }
          if (narration.length > 4000) {
            json(res, { ok: false, errors: [{ code: 'LAB_NARRATION_TOO_LONG', msg: '旁白超过 4000 字' }] }, 400);
            return;
          }
          let speech = null;
          if (narration.trim() && speechRaw !== null && speechRaw !== undefined && speechRaw !== '') {
            speech = Number(speechRaw);
            if (!(Number.isFinite(speech) && speech > 0 && speech <= 120)) {
              json(res, { ok: false, errors: [{ code: 'LAB_SPEECH_INVALID', msg: '语音时长必须在 0–120 秒之间' }] }, 400);
              return;
            }
          }
          if (captions !== null && typeof captions !== 'string'
            && (typeof captions !== 'object' || Array.isArray(captions))) {
            json(res, { ok: false, errors: [{ code: 'LAB_CAPTIONS_INVALID', msg: 'captions 必须是样式名或参数对象' }] }, 400);
            return;
          }
          const built = buildKitComposition({
            code, nextCode, transition,
            duration, orientation, narration, speech, captions,
            catalog, kits: kitBundles,
          });
          if (!built.ok) {
            json(res, { ok: false, errors: built.errors, report: summarizeReport(built.report) });
            return;
          }
          const composition = rewriteLocalRefs(structuredClone(built.composition), base, assetBasenameMap);
          json(res, { ok: true, composition, report: summarizeReport(built.report) });
        }).catch((error) => {
          if (res.headersSent) return;
          const bodyError = String(error?.code || '').startsWith('BODY_');
          json(res, {
            ok: false,
            errors: [{ code: error?.code || 'LAB_BUILD_FAILED', msg: error?.message || String(error) }],
          }, bodyError ? 400 : 500);
        });
        return true;
      }

      if (urlPath === '/api/build' && req.method === 'POST') {
        readJsonBody(req).then(async (body) => {
          const recipeId = String(body?.recipe || '');
          const file = String(body?.file || '');
          const code = body?.code;
          const duration = Number(body?.duration);
          const orientation = body?.orientation || 'landscape';
          if (typeof code !== 'string' || !code.trim()) {
            json(res, { ok: false, errors: [{ code: 'LAB_CODE_EMPTY', msg: 'scene.code 不能为空' }] }, 400);
            return;
          }
          if (Buffer.byteLength(code) > MAX_CODE_BYTES) {
            json(res, { ok: false, errors: [{ code: 'LAB_CODE_TOO_LARGE', msg: 'scene.code 超过 1MB' }] }, 413);
            return;
          }
          if (!Number.isFinite(duration) || duration <= 0 || duration > 600) {
            json(res, { ok: false, errors: [{ code: 'LAB_DURATION_INVALID', msg: 'duration 必须在 0–600 秒之间' }] }, 400);
            return;
          }
          if (!ORIENTATIONS.includes(orientation)) {
            json(res, { ok: false, errors: [{ code: 'LAB_ORIENTATION_INVALID', msg: `orientation 只能是 ${ORIENTATIONS.join(' / ')}` }] }, 400);
            return;
          }
          let found;
          try {
            found = getRefShot(recipeId, file);
          } catch (error) {
            json(res, { ok: false, errors: [{ code: error.code, msg: error.message }] }, 404);
            return;
          }
          const built = await buildRefShot({
            entry: found.recipe,
            refShot: found.refShot,
            code,
            duration,
            orientation,
          });
          if (!built.ok) {
            json(res, {
              ok: false,
              errors: built.errors,
              report: summarizeReport(built.report),
            });
            return;
          }
          json(res, {
            ok: true,
            composition: built.composition,
            report: summarizeReport(built.report),
          });
        }).catch((error) => {
          if (res.headersSent) return;
          const bodyError = String(error?.code || '').startsWith('BODY_');
          json(res, {
            ok: false,
            errors: [{ code: error?.code || 'LAB_BUILD_FAILED', msg: error?.message || String(error) }],
          }, bodyError ? 400 : 500);
        });
        return true;
      }

      if (urlPath === '/shutdown' && req.method === 'POST') {
        json(res, { ok: true });
        setTimeout(() => shutdown(), 150);
        return true;
      }

      return false;
    },
  };

  let started;
  try {
    started = await createStaticServer({ ...staticOptions, port });
  } catch (error) {
    if (error?.code !== 'EADDRINUSE' || port === 0) throw error;
    log(`[code-lab] 端口 ${port} 被占用：可能是旧的 lab 进程，它不会自动载入新增 recipe；本实例改用随机端口，请用下面打印的地址`);
    started = await createStaticServer({ ...staticOptions, port: 0 });
  }
  const { server, port: actualPort } = started;

  base = `http://127.0.0.1:${actualPort}`;
  let closing = false;

  async function shutdown() {
    if (closing) return;
    closing = true;
    server.close();
    await closeThumbSession();
    log('[code-lab] 已关闭');
    process.exit(0);
  }

  process.once('SIGINT', () => { void shutdown(); });
  process.once('SIGTERM', () => { void shutdown(); });
  process.once('exit', () => { server.close(); });

  log(`[code-lab] 镜头参考实验室: ${base}`);
  log(`[code-lab] Kit 实验台: ${base}/kit`);
  log(`[code-lab] recipe ${codeRecipes.length} 条：${codeRecipes.map((entry) => entry.id).join(' / ')}`);
  log(`[code-lab] 镜头参考：recipes/<id>/ref-shots/*.js；预览走真实 build + preview-panel`);
  log(`[code-lab] 关闭: curl -X POST ${base}/shutdown （或 Ctrl+C）`);

  return { server, port: actualPort, url: base };
}
