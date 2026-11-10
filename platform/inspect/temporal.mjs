/**
 * 时间维 QA。
 *
 * 静态 qa 只看单帧越界/碰撞；闪烁、字幕跳位、转场出框都藏在帧与帧之间。
 * 这里只吃 sampleFilm 已产出的 receipts / luminance，不重新渲染、不引入外部依赖。
 * 三类问题都是 should：它们不改变 tt qa 的退出码，只写进统一质量报告。
 */
const r2 = (v) => Number(Number(v).toFixed(2));

function luminanceAt(luminance, t) {
  if (!Array.isArray(luminance)) return null;
  for (const item of luminance) {
    if (item && Number.isFinite(Number(item.t)) && Math.abs(Number(item.t) - t) < 0.06) {
      const v = Number(item.value ?? item.luma ?? item.luminance ?? item.mean);
      if (Number.isFinite(v)) return v;
    }
  }
  return null;
}

function boxesAt(receipts, t, kind) {
  return receipts.filter((item) => item.kind === kind
    && Number.isFinite(Number(item.t)) && Math.abs(Number(item.t) - t) < 0.06
    && Array.isArray(item.ink) && Number(item.ink[2]) > 0 && Number(item.ink[3]) > 0);
}

/**
 * @returns {{ ok, frames, issues, checks }} issues 形状与 qa 一致
 */
export function scanTemporal({ receipts = [], luminance = [], planned, format, times = [] }) {
  const issues = [];
  const W = Number(format?.w) || 1920;
  const H = Number(format?.h) || 1080;
  const marginX = W * 0.055;
  const marginY = H * 0.055;
  const ts = [...new Set((times.length ? times : receipts.map((item) => Number(item.t)))
    .map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
  const push = (level, code, t, msg, scene = '') => issues.push({ level, code, t: r2(t), msg, scene });

  // 1) 单帧闪烁：只抓局部极值，且前后两帧应接近。
  //    淡入/淡出是单调推进（cur 夹在两个同向移动的邻帧之间），整段跳变则
  //    前后两帧差得远；这两种都不是闪烁。以前只拿 cur 和前后均值比较，
  //    会把开场淡入和硬切都误报成尖峰。
  for (let i = 1; i < ts.length - 1; i += 1) {
    const t = ts[i];
    const prev = luminanceAt(luminance, ts[i - 1]);
    const cur = luminanceAt(luminance, t);
    const next = luminanceAt(luminance, ts[i + 1]);
    if (prev == null || cur == null || next == null) continue;
    const rising = cur > prev && cur > next;
    const falling = cur < prev && cur < next;
    if (!rising && !falling) continue;
    if (Math.abs(prev - next) > 22) continue;
    const base = (prev + next) / 2;
    if (Math.abs(cur - base) > 22) {
      push('should', 'TEMPORAL_FLICKER', t,
        `单帧亮度尖峰 ${r2(cur)}，前后 ${r2(prev)}/${r2(next)}（差 ${r2(Math.abs(cur - base))}）；可能是空帧或转场漏画`);
    }
  }

  // 2) 字幕突跳：同一场、同一字幕样式、且框尺寸可比时，中心不应大幅位移。
  //    逐字样式（如 collage）会随字逐个出现而扩大 bbox，这不是字幕跳位。
  for (let i = 1; i < ts.length; i += 1) {
    const a = boxesAt(receipts, ts[i - 1], 'caption')[0];
    const b = boxesAt(receipts, ts[i], 'caption')[0];
    if (!a || !b || a.scene !== b.scene || a.block !== b.block) continue;
    const wRatio = Math.min(a.ink[2], b.ink[2]) / Math.max(a.ink[2], b.ink[2]);
    const hRatio = Math.min(a.ink[3], b.ink[3]) / Math.max(a.ink[3], b.ink[3]);
    if (wRatio < 0.75 || hRatio < 0.75) continue;
    const ax = a.ink[0] + a.ink[2] / 2;
    const ay = a.ink[1] + a.ink[3] / 2;
    const bx = b.ink[0] + b.ink[2] / 2;
    const by = b.ink[1] + b.ink[3] / 2;
    if (Math.abs(bx - ax) > W * 0.1 || Math.abs(by - ay) > H * 0.15) {
      push('should', 'TEMPORAL_CAPTION_JUMP', ts[i],
        `字幕中心从 (${r2(ax)},${r2(ay)}) 跳到 (${r2(bx)},${r2(by)})，跨 ${r2(ts[i] - ts[i - 1])}s`);
    }
  }

  // 3) 转场期间越界：有 in/out 的场，采样帧里的墨迹/文字框不能出安全框。
  for (const scene of planned?.scenes || []) {
    const inType = scene.transitionIn?.type;
    const outType = scene.transitionOut?.type;
    if ((!inType || inType === 'cut') && (!outType || outType === 'cut')) continue;
    for (const t of ts) {
      for (const kind of ['ink', 'text']) {
        for (const item of boxesAt(receipts, t, kind)) {
          if (item.scene !== scene.id) continue;
          const [x, y, w, h] = item.ink;
          if (x < marginX - 2 || y < marginY - 2 || x + w > W - marginX + 2 || y + h > H - marginY + 2) {
            push('should', 'TEMPORAL_TRANSITION_OUT_OF_SAFE', t,
              `${kind} 框 [${[x, y, w, h].map((v) => Math.round(v)).join(',')}] 在转场帧越过安全框`, scene.id);
          }
        }
      }
    }
  }

  const must = issues.filter((item) => item.level === 'must').length;
  return {
    ok: must === 0,
    frames: ts.length,
    issues,
    checks: {
      flicker: issues.filter((i) => i.code === 'TEMPORAL_FLICKER').length,
      captionJump: issues.filter((i) => i.code === 'TEMPORAL_CAPTION_JUMP').length,
      transitionSafe: issues.filter((i) => i.code === 'TEMPORAL_TRANSITION_OUT_OF_SAFE').length,
    },
  };
}
