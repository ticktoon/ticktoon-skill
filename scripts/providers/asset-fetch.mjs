/**
 * 工程素材闭环：storyboard 查询 → provider 选片 → out/media 缓存 → src 回写。
 *
 * 查询写法（推荐）：
 *   { "params": { "src": "pexels:night city traffic", ... } }
 * 也可在 meta.assets.queriesEn 中按带 src 的 params 场顺序给出英文查询。
 *
 * 下载后的 src 是 `job:media/pexels-<id>.mp4`，以 composition 所在 out/ 为根；
 * 同目录的 pexels-manifest.json 永久保留作者、原页、授权与下载地址。
 */
import { createWriteStream, existsSync, readFileSync, statSync } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pickSegments } from './assets.mjs';

function requestsFrom(storyboard) {
  const requests = [];
  const configured = storyboard.meta?.assets?.queriesEn || storyboard.meta?.assets?.tags || [];
  let configuredIndex = 0;
  storyboard.scenes?.forEach((scene, sceneIndex) => {
    const params = scene.params;
    if (!params || typeof params !== 'object') return;
    const src = typeof params.src === 'string' ? params.src : '';
    if (!src) return;
    const inline = src.startsWith('pexels:') ? src.slice('pexels:'.length).trim() : '';
    const useConfigured = !inline && configured.length > 0;
    if (!inline && !useConfigured) return;
    const query = inline || configured[configuredIndex++];
    if (!query) return;
    const fallbackDuration = storyboard.meta?.assets?.segmentDuration || 6;
    const duration = Number(params.dur || scene.duration || fallbackDuration);
    if (!(duration > 0)) throw new Error(`${scene.id}.template 的素材窗口不是正数`);
    requests.push({ sceneIndex, sceneId: scene.id, query: String(query), duration });
  });
  if (configured.length > configuredIndex) {
    throw new Error(`meta.assets 声明了 ${configured.length} 个查询，但只匹配到 ${configuredIndex} 个带 src 的 params 场`);
  }
  return requests;
}

async function download(url, target) {
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  } catch (error) {
    throw new Error(`下载网络失败：${error?.cause?.code || error.message}`);
  }
  if (!response.ok) throw new Error(`下载 HTTP ${response.status}: ${(await response.text()).slice(0, 160)}`);
  const contentType = response.headers.get('content-type') || '';
  if (/text\/html|application\/json/i.test(contentType)) throw new Error(`下载返回了 ${contentType}，不是视频`);
  if (!response.body) throw new Error('下载响应没有 body');

  const partial = `${target}.part-${process.pid}`;
  try {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
    if (statSync(partial).size < 1024) throw new Error('下载文件小于 1KB，拒绝作为视频使用');
    await rename(partial, target);
  } catch (error) {
    await rm(partial, { force: true });
    throw error;
  }
}

function readManifest(file) {
  if (!existsSync(file)) return { version: 1, license: 'Pexels License', licenseUrl: 'https://www.pexels.com/license/', items: [] };
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf-8'));
    return { version: 1, ...parsed, items: Array.isArray(parsed.items) ? parsed.items : [] };
  } catch (error) {
    throw new Error(`素材 manifest 损坏：${file}（${error.message}）`);
  }
}

export async function fetchProjectAssets({
  projectDir, provider = 'pexels', orientation = 'landscape', log = console.log,
}) {
  const dir = path.resolve(projectDir);
  const storyboardPath = path.join(dir, 'storyboard.json');
  if (!existsSync(storyboardPath)) throw new Error(`找不到工程 storyboard：${storyboardPath}`);
  const storyboard = JSON.parse(readFileSync(storyboardPath, 'utf-8'));
  const requests = requestsFrom(storyboard);
  const mediaDir = path.join(dir, 'out', 'media');
  const manifestPath = path.join(mediaDir, 'pexels-manifest.json');
  const manifest = readManifest(manifestPath);

  if (!requests.length) {
    return {
      ok: true, projectDir: dir, changed: false, provider: null, downloads: 0, cacheHits: 0,
      items: manifest.items, manifestPath, message: '没有待获取的 pexels: 查询；已有本地引用保持不变',
    };
  }
  if (provider === 'pexels' && !requests.every((item) => item.query)) throw new Error('存在空 Pexels 查询');

  const segments = await pickSegments({
    tags: requests.map((item) => item.query),
    queriesEn: requests.map((item) => item.query),
    totalSeconds: requests.reduce((sum, item) => sum + item.duration, 0),
    durations: requests.map((item) => item.duration),
    provider,
    orientation: storyboard.meta?.assets?.orientation || orientation,
    strict: true,
  });
  if (segments.length !== requests.length) {
    throw new Error(`素材命中 ${segments.length}/${requests.length}，拒绝生成缺画面的 composition`);
  }

  await mkdir(mediaDir, { recursive: true });
  const records = [];
  let downloads = 0;
  let cacheHits = 0;
  for (let i = 0; i < requests.length; i += 1) {
    const request = requests[i];
    const segment = segments[i];
    const params = storyboard.scenes[request.sceneIndex].params;
    const filename = `pexels-${segment.id}.mp4`;
    const target = path.join(mediaDir, filename);
    const previous = manifest.items.find((item) => String(item.id) === String(segment.id));
    let cache = 'downloaded';
    if (existsSync(target) && statSync(target).size >= 1024) {
      cacheHits += 1;
      cache = 'hit';
      log(`  缓存命中 pexels#${segment.id} → ${filename}`);
    } else {
      try {
        await download(segment.remotePath, target);
      } catch (error) {
        throw new Error(`Pexels#${segment.id}（${request.query}）${error.message}；storyboard 尚未回写`);
      }
      downloads += 1;
      log(`  已下载 pexels#${segment.id} → ${filename}（${(statSync(target).size / 1048576).toFixed(1)}MB）`);
    }

    const src = `job:media/${filename}`;
    params.src = src;
    params.start = 0;
    if (params.credit === 'auto') params.credit = `PEXELS / ${segment.author}`;
    const record = {
      id: segment.id,
      query: request.query,
      provider: 'pexels',
      file: src,
      cache,
      width: segment.width,
      height: segment.height,
      fps: segment.fps,
      duration: segment.originalDuration,
      selectedDuration: segment.duration,
      author: segment.author,
      authorUrl: segment.authorUrl,
      sourceUrl: segment.sourceUrl,
      attribution: segment.attribution,
      license: segment.license,
      licenseUrl: segment.licenseUrl,
      downloadUrl: segment.remotePath,
      previewImage: segment.image,
      downloadedAt: previous?.downloadedAt || new Date().toISOString(),
    };
    records.push(record);
    const oldIndex = manifest.items.findIndex((item) => String(item.id) === String(segment.id));
    if (oldIndex >= 0) manifest.items[oldIndex] = { ...manifest.items[oldIndex], ...record, downloadedAt: record.downloadedAt };
    else manifest.items.push(record);
  }

  manifest.updatedAt = new Date().toISOString();
  manifest.lastRun = {
    provider: provider,
    requestedProvider: provider,
    orientation: storyboard.meta?.assets?.orientation || orientation,
    records,
  };
  if (provider === 'pexels') {
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  const temporary = `${storyboardPath}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(storyboard, null, 2)}\n`);
  await rename(temporary, storyboardPath);

  return {
    ok: true,
    projectDir: dir,
    changed: true,
    provider: provider,
    requestedProvider: provider,
    downloads,
    cacheHits,
    items: records,
    storyboardPath,
    manifestPath: provider === 'pexels' ? manifestPath : null,
  };
}
