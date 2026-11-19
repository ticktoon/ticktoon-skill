/**
 * 素材 Provider：配片检索统一接口
 *
 *   pickSegments({ tags, totalSeconds, provider, queriesEn?, durations?, orientation?, strict? })
 *     → [{ remotePath, image, startTime, duration, originalDuration, ...attribution }]
 *
 * provider 只支持 'pexels'：检索需要 PEXELS_API_KEY，只检索，不在这里下载；
 * scripts/providers/asset-fetch.mjs 负责落盘、缓存与 storyboard 回写。
 * 无 key、无候选、下载失败都直接报错，不用内置素材替换查询结果。
 *
 * durations 可给每个查询独立的窗口秒数；缺省仍按总时长相等切分。strict=true 时，
 * 无候选或源片不够长都会报错，由调用方决定如何向用户呈现失败。
 */
import { getCredential } from '../config.mjs';

const PEXELS_API = 'https://api.pexels.com/videos/search';

export const ASSETS_PROVIDERS = ['pexels'];
export const PEXELS_LICENSE = {
  name: 'Pexels License',
  url: 'https://www.pexels.com/license/',
  attribution: 'Video by {author} on Pexels',
};

export async function pickSegments({
  tags, totalSeconds, provider = 'pexels', queriesEn,
  durations, orientation = 'landscape', strict = true,
}) {
  if (!tags?.length) return [];
  if (provider === 'pexels') {
    return pickPexels(queriesEn?.length ? queriesEn : tags, totalSeconds, { durations, orientation, strict });
  }
  throw new Error(`未知素材 provider: ${provider}（可选 ${ASSETS_PROVIDERS.join('/')}）`);
}

function windowsFor(total, count, durations) {
  if (durations) {
    if (!Array.isArray(durations) || durations.length !== count || durations.some((v) => !(Number(v) > 0))) {
      throw new Error(`durations 必须是 ${count} 个正数，与查询一一对应`);
    }
    return durations.map(Number);
  }
  return Array.from({ length: count }, () => total / count);
}

function startTimes(windows) {
  let cursor = 0;
  return windows.map((duration) => {
    const at = cursor;
    cursor += duration;
    return +at.toFixed(3);
  });
}

// ---------------- pexels ----------------
async function pickPexels(queries, total, { durations, orientation, strict }) {
  const key = getCredential('PEXELS_API_KEY');
  if (!key) throw new Error('pexels provider 需要 PEXELS_API_KEY（node scripts/auth.mjs set PEXELS_API_KEY <key>）');
  if (!['landscape', 'portrait', 'square'].includes(orientation)) {
    throw new Error(`Pexels orientation 只支持 landscape / portrait / square，收到 ${orientation}`);
  }

  const used = new Set();
  const segs = [];
  const windows = windowsFor(total, queries.length, durations);
  const starts = startTimes(windows);
  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    const win = windows[i];
    let res;
    try {
      res = await fetch(`${PEXELS_API}?query=${encodeURIComponent(q)}&per_page=15&orientation=${orientation}`, {
        headers: { Authorization: key },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new Error(`Pexels 检索「${q}」网络失败：${error?.cause?.code || error.message}`);
    }
    if (!res.ok) throw new Error(`Pexels 检索「${q}」HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const videos = (await res.json()).videos ?? [];
    const cands = [];
    for (const v of videos) {
      if (used.has(v.id)) continue;
      const files = (v.video_files ?? []).filter((f) => {
        if (!f.link) return false;
        const w = f.width ?? 0;
        const h = f.height ?? 0;
        if (orientation === 'portrait') return h > w;
        if (orientation === 'square') return w === h;
        return w >= h;
      });
      const target = orientation === 'portrait' ? 1080 : 1920;
      const file = files.sort((a, b) => Math.abs((a.width ?? 0) - target) - Math.abs((b.width ?? 0) - target))[0];
      if (file) {
        cands.push({
          provider: 'pexels',
          id: v.id,
          query: q,
          duration: v.duration,
          link: file.link,
          image: v.image ?? '',
          width: file.width ?? null,
          height: file.height ?? null,
          fps: file.fps ?? null,
          fileType: file.file_type ?? null,
          author: v.user?.name || 'Unknown',
          authorUrl: v.user?.url || '',
          sourceUrl: v.url || `https://www.pexels.com/video/${v.id}/`,
        });
      }
    }
    if (cands.length === 0) {
      if (strict) throw new Error(`Pexels 查询「${q}」没有符合 ${orientation} 的候选`);
      console.warn(`  查询「${q}」无候选`);
      continue;
    }
    const enough = cands.filter((c) => c.duration >= win).sort((a, b) => a.duration - b.duration);
    const rest = cands.filter((c) => c.duration < win).sort((a, b) => b.duration - a.duration);
    const pick = [...enough, ...rest][0];
    if (strict && pick.duration < win) {
      throw new Error(`Pexels 查询「${q}」最长候选仅 ${pick.duration}s，不足窗口 ${win}s`);
    }
    used.add(pick.id);
    segs.push({
      ...pick,
      remotePath: pick.link,
      startTime: starts[i],
      duration: +Math.min(pick.duration, win).toFixed(3),
      originalDuration: pick.duration,
      license: PEXELS_LICENSE.name,
      licenseUrl: PEXELS_LICENSE.url,
      attribution: PEXELS_LICENSE.attribution.replace('{author}', pick.author),
    });
    console.log(`  窗口[${starts[i].toFixed(1)}s +${win.toFixed(1)}s] 查询「${q}」→ pexels#${pick.id}（${pick.duration}s，${pick.author}）`);
  }
  if (strict && segs.length !== queries.length) throw new Error(`Pexels 只命中 ${segs.length}/${queries.length} 段`);
  return segs;
}
