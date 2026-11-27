import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ICONIFY = 'https://api.iconify.design';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const safeName = (value) => {
  const name = String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!name) throw new Error('素材 name 只能包含字母、数字和连字符');
  return name;
};
async function getJson(url, timeout = 45_000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout), headers: { 'User-Agent': 'ticktoon-skill/1.0 asset research' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 160)}`);
  return response.json();
}
function iconifyItem(id, collections = {}) {
  const [prefix, name] = id.split(':');
  const meta = collections[prefix] || {};
  return {
    provider: 'iconify', id, title: id, collection: meta.name || prefix,
    author: meta.author?.name || '', authorUrl: meta.author?.url || '',
    license: meta.license?.title || '', licenseUrl: meta.license?.url || '',
    downloadUrl: `${ICONIFY}/${prefix}/${name}.svg`, format: 'svg',
  };
}
export async function searchWebAssets({ query, provider = 'iconify', limit = 8, prefix = null }) {
  if (!query?.trim()) throw new Error('搜索词不能为空');
  if (provider === 'iconify') {
    const params = new URLSearchParams({ query: query.trim(), limit: String(Math.max(1, Math.min(64, limit))) });
    if (prefix) params.set('prefixes', prefix);
    const data = await getJson(`${ICONIFY}/search?${params}`);
    return (data.icons || []).slice(0, limit).map((id) => iconifyItem(id, data.collections));
  }
  if (provider === 'commons') {
    const params = new URLSearchParams({
      action: 'query', generator: 'search', gsrsearch: query.trim(), gsrnamespace: '6',
      gsrlimit: String(Math.max(1, Math.min(30, limit))), prop: 'imageinfo',
      iiprop: 'url|extmetadata', iiurlwidth: '1024', format: 'json',
    });
    const data = await getJson(`${COMMONS}?${params}`);
    return Object.values(data.query?.pages || {}).map((page) => {
      const info = page.imageinfo?.[0] || {}, meta = info.extmetadata || {};
      return {
        provider: 'commons', id: page.title, title: page.title,
        author: meta.Artist?.value?.replace(/<[^>]+>/g, ' ')?.replace(/\s+/g, ' ').trim() || '',
        license: meta.LicenseShortName?.value || '逐素材核对',
        licenseUrl: meta.LicenseUrl?.value || '', sourceUrl: info.descriptionurl,
        downloadUrl: info.thumburl || info.url, format: 'image',
      };
    });
  }
  throw new Error(`未知素材 provider：${provider}`);
}
async function commonsInfo(id) {
  const params = new URLSearchParams({
    action: 'query', titles: id, prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '1024', format: 'json',
  });
  const data = await getJson(`${COMMONS}?${params}`);
  const page = Object.values(data.query?.pages || {})[0];
  if (!page?.imageinfo?.[0]) throw new Error(`Commons 找不到 ${id}`);
  const info = page.imageinfo[0], meta = info.extmetadata || {};
  return {
    provider: 'commons', id, title: page.title,
    author: meta.Artist?.value?.replace(/<[^>]+>/g, ' ')?.replace(/\s+/g, ' ').trim() || '',
    license: meta.LicenseShortName?.value || '逐素材核对', licenseUrl: meta.LicenseUrl?.value || '',
    sourceUrl: info.descriptionurl, downloadUrl: info.thumburl || info.url, format: 'image',
  };
}
function readManifest(file) {
  if (!existsSync(file)) return { version: 1, items: [] };
  return JSON.parse(readFileSync(file, 'utf8'));
}
export async function downloadWebAsset({ projectDir, provider = 'iconify', id, name }) {
  if (!projectDir) throw new Error('下载必须显式指定 --project，避免写进 skill');
  if (!id) throw new Error('缺少素材 id');
  let item;
  if (provider === 'iconify') {
    if (!/^[a-z0-9-]+:[a-z0-9-]+$/.test(id)) throw new Error(`Iconify id 不合法：${id}`);
    const prefix = id.split(':')[0];
    const collections = await getJson(`${ICONIFY}/collections?prefixes=${encodeURIComponent(prefix)}`);
    item = iconifyItem(id, collections);
  } else if (provider === 'commons') item = await commonsInfo(id);
  else throw new Error(`未知素材 provider：${provider}`);
  const response = await fetch(item.downloadUrl, { signal: AbortSignal.timeout(90_000) });
  if (!response.ok) throw new Error(`下载 HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > 12 * 1024 * 1024) throw new Error('素材为空或超过 12MB 限制');
  const assetName = safeName(name || id.split(':').pop());
  let extension = 'png', contentType = response.headers.get('content-type') || '';
  if (provider === 'iconify') {
    const text = buffer.toString('utf8');
    if (!/^\s*<svg[\s>]/i.test(text) || /<script|<foreignObject|\son\w+\s*=|href\s*=\s*["']https?:/i.test(text)) {
      throw new Error('SVG 未通过安全限制：只允许无脚本、无外部引用的静态图标');
    }
    extension = 'svg'; contentType = 'image/svg+xml';
  } else {
    if (/image\/jpeg/i.test(contentType)) extension = 'jpg';
    else if (/image\/png/i.test(contentType)) extension = 'png';
    else if (/image\/webp/i.test(contentType)) extension = 'webp';
    else throw new Error(`Commons 返回了不支持的 ${contentType}；请选 PNG/JPEG/WebP 缩略图`);
  }
  const mediaDir = path.join(path.resolve(projectDir), 'out', 'media');
  mkdirSync(mediaDir, { recursive: true });
  const filename = `${assetName}.${extension}`, target = path.join(mediaDir, filename);
  writeFileSync(target, buffer);
  const manifestPath = path.join(mediaDir, 'web-assets-manifest.json');
  const manifest = readManifest(manifestPath);
  const record = {
    ...item, name: assetName, file: `job:media/${filename}`, bytes: statSync(target).size,
    contentType, downloadedAt: new Date().toISOString(),
  };
  const index = manifest.items.findIndex((entry) => entry.name === assetName);
  if (index >= 0) manifest.items[index] = record; else manifest.items.push(record);
  manifest.updatedAt = new Date().toISOString();
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  return { ok: true, ...record, manifestPath, resource: { type: 'image', name: assetName, src: record.file } };
}
