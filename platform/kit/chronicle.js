/**
 * TT.chronicle —— 纸上剧场：舆图、路线、印章、文书、岔路推演、纸偶、门阙、旗幡、年表与固定叙事外壳。
 * 只画代码友好的图形，不包含人物立绘或骨骼。所有动画都是 api.t 的函数。
 */
(() => {
  const INK = '#2A170C', RED = '#B5321F', GOLD = '#D8A457', LIGHT = '#F1D59A';
  const COLORS = { red: RED, deep: '#7A1E14', green: '#486B54', blue: '#486581', ochre: '#B78635', black: INK };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dataCache = globalThis.__ttChronicleDataCache ||= new Map();
  function readData(source) {
    if (source && typeof source === 'object') return source;
    if (typeof source !== 'string' || !source.trim()) throw new Error('TT.chronicle 需要 data 资源文本');
    let data = dataCache.get(source);
    if (!data) { data = JSON.parse(source); dataCache.set(source, data); }
    return data;
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const E = {
    sine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    cubic: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - ((-2 * t + 2) ** 3) / 2),
    out: (t) => 1 - (1 - t) ** 3,
    back: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  };
  const seg = (t, a, b, e = (x) => x) => e(clamp(b === a ? 1 : (t - a) / (b - a), 0, 1));
  const color = (value, fallback = INK) => COLORS[value] || value || fallback;
  function rounded(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h, x + r, y + h - r);
    ctx.lineTo(x, y + h - r); ctx.lineTo(x, y + r); ctx.lineTo(x, y, x + r, y); ctx.closePath();
  }
  function frameRect(o = {}) {
    return { x: o.x ?? 150, y: o.y ?? 150, w: o.w ?? 1620, h: o.h ?? 650 };
  }
  function point(frame, p, normalized = true) {
    return normalized ? [frame.x + p[0] * frame.w, frame.y + p[1] * frame.h] : p;
  }
  function pathPoints(ctx, points, close = false) {
    ctx.beginPath();
    points.forEach((p, i) => { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
    if (close) ctx.closePath();
  }
  function smoothPath(ctx, points, close = false) {
    if (points.length < 3) { pathPoints(ctx, points, close); return; }
    ctx.beginPath();
    if (!close) {
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length - 1; i += 1) {
        const mx = (points[i][0] + points[i + 1][0]) / 2, my = (points[i][1] + points[i + 1][1]) / 2;
        ctx.quadraticCurveTo(points[i][0], points[i][1], mx, my);
      }
      const last = points[points.length - 1]; ctx.lineTo(last[0], last[1]); return;
    }
    const first = points[0], last = points[points.length - 1];
    ctx.moveTo((last[0] + first[0]) / 2, (last[1] + first[1]) / 2);
    for (let i = 0; i < points.length; i += 1) {
      const p = points[i], next = points[(i + 1) % points.length];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + next[0]) / 2, (p[1] + next[1]) / 2);
    }
    ctx.closePath();
  }
  function panel(ctx, frame, alpha = 1) {
    ctx.save(); ctx.globalAlpha *= alpha;
    ctx.shadowColor = 'rgba(52,30,15,.16)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
    rounded(ctx, frame.x, frame.y, frame.w, frame.h, 10);
    ctx.fillStyle = 'rgba(248,238,215,.70)'; ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.strokeStyle = 'rgba(74,45,25,.72)'; ctx.lineWidth = 3; ctx.stroke();
    rounded(ctx, frame.x + 14, frame.y + 14, frame.w - 28, frame.h - 28, 5);
    ctx.strokeStyle = 'rgba(184,134,53,.60)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }

  function icon(ctx, source, o = {}) {
    if (!source) return null;
    const t = o.t ?? 0, at = o.at ?? 0, q = seg(t, at - 0.35, at, E.out);
    const sw = source.naturalWidth || source.width || 0, sh = source.naturalHeight || source.height || 0;
    if (q <= 0 || !sw || !sh) return null;
    const size = o.size ?? 64, w = o.w ?? size, h = o.h ?? size, scale = Math.min(w / sw, h / sh);
    const dw = sw * scale, dh = sh * scale, x = o.x ?? 0, y = o.y ?? 0;
    ctx.save(); ctx.globalAlpha *= q * (o.alpha ?? 1); ctx.translate(x, y); ctx.scale(0.85 + 0.15 * q, 0.85 + 0.15 * q);
    ctx.drawImage(source, -dw / 2, -dh / 2, dw, dh); ctx.restore();
    return { x, y, w: dw, h: dh };
  }

  function map(ctx, source, o = {}) {
    const data = readData(source);
    const t = o.t ?? 0, at = o.at ?? 0, q = seg(t, at, at + 0.7, E.out), antique = o.style === 'antique';
    if (q <= 0) return null;
    const f = frameRect(o); panel(ctx, f, q);
    ctx.save(); ctx.globalAlpha *= q;
    rounded(ctx, f.x + 22, f.y + 22, f.w - 44, f.h - 44, 4); ctx.clip();
    if (antique) { ctx.fillStyle = 'rgba(166,124,65,.055)'; ctx.fillRect(f.x, f.y, f.w, f.h); }
    ctx.strokeStyle = antique ? 'rgba(78,58,38,.065)' : 'rgba(78,58,38,.08)'; ctx.lineWidth = 1;
    if (antique) ctx.setLineDash([2, 7]);
    for (let i = 1; i < 8; i += 1) {
      ctx.beginPath(); ctx.moveTo(f.x + f.w * i / 8, f.y); ctx.lineTo(f.x + f.w * i / 8, f.y + f.h); ctx.stroke();
    }
    for (let i = 1; i < 5; i += 1) {
      ctx.beginPath(); ctx.moveTo(f.x, f.y + f.h * i / 5); ctx.lineTo(f.x + f.w, f.y + f.h * i / 5); ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const region of data.regions || []) {
      const pts = region.points.map((p) => point(f, p));
      if (antique) smoothPath(ctx, pts, true); else pathPoints(ctx, pts, true);
      ctx.fillStyle = color(region.color, GOLD); ctx.globalAlpha = q * (region.alpha ?? (antique ? 0.055 : 0.12)); ctx.fill();
      ctx.globalAlpha = q * (antique ? 0.34 : 0.55); ctx.strokeStyle = color(region.color, GOLD); ctx.lineWidth = antique ? 1.6 : 2; ctx.stroke();
      ctx.globalAlpha = q;
      if (region.name && region.label) {
        const p = point(f, region.label);
        ctx.globalAlpha = q * (antique ? 0.68 : 1);
        TT.text(ctx, region.name, p[0], p[1], region.size || (antique ? 34 : 42),
          { fontKey: 'sans-900', color: antique ? '#5B4030' : color(region.color, INK), align: 'center', baseline: 'middle' });
        ctx.globalAlpha = q;
      }
    }
    for (const coast of data.coastlines || []) {
      const pts = coast.points.map((p) => point(f, p));
      if (antique) smoothPath(ctx, pts); else pathPoints(ctx, pts);
      ctx.globalAlpha = q * 0.46; ctx.strokeStyle = '#6B4B2A'; ctx.lineWidth = antique ? 2.2 : 2.8; ctx.stroke(); ctx.globalAlpha = q;
    }
    for (const river of data.rivers || []) {
      const pts = river.points.map((p) => point(f, p));
      if (antique) smoothPath(ctx, pts); else pathPoints(ctx, pts);
      ctx.strokeStyle = river.color || (antique ? 'rgba(72,92,100,.52)' : 'rgba(72,101,129,.58)');
      ctx.lineWidth = river.width || (antique ? 3.2 : 5); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
      if (antique && river.name) {
        const p = pts[Math.floor(pts.length / 2)];
        TT.text(ctx, river.name, p[0], p[1] - 12, 24, { fontKey: 'sans-400', color: '#53656A', align: 'center', baseline: 'bottom' });
      }
    }
    for (const m of data.mountains || []) {
      const p = point(f, [m.x, m.y]), s = m.size || 30;
      ctx.strokeStyle = antique ? 'rgba(58,43,28,.42)' : 'rgba(58,43,28,.48)'; ctx.lineWidth = antique ? 1.8 : 2.5;
      for (let i = -1; i <= 1; i += 1) {
        const px = p[0] + i * s * 0.8;
        ctx.beginPath(); ctx.moveTo(px - s * 0.5, p[1] + s * 0.35); ctx.lineTo(px, p[1] - s * 0.45); ctx.lineTo(px + s * 0.5, p[1] + s * 0.35); ctx.stroke();
        if (antique) for (let k = 1; k <= 3; k += 1) {
          ctx.beginPath(); ctx.moveTo(px - k * 2, p[1] - s * 0.25 + k * 5); ctx.lineTo(px - s * 0.28 - k * 2, p[1] + s * 0.22 + k * 3); ctx.stroke();
        }
      }
    }
    ctx.restore();
    if (antique) {
      ctx.save(); ctx.globalAlpha = q * 0.68;
      TT.text(ctx, '舆图 · 示意', f.x + 42, f.y + 42, 24, { fontKey: 'sans-400', color: '#5B4030', align: 'left', baseline: 'middle' });
      const cx = f.x + f.w - 72, cy = f.y + 72;
      ctx.strokeStyle = '#6B4B2A'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(cx, cy - 28); ctx.lineTo(cx, cy + 28); ctx.moveTo(cx - 20, cy); ctx.lineTo(cx + 20, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - 34); ctx.lineTo(cx - 6, cy - 18); ctx.lineTo(cx + 6, cy - 18); ctx.closePath(); ctx.fillStyle = '#6B4B2A'; ctx.fill();
      TT.text(ctx, '北', cx, cy - 46, 22, { fontKey: 'sans-900', color: '#5B4030', align: 'center', baseline: 'middle' });
      ctx.restore();
    }
    return f;
  }
  function place(ctx, o = {}) {
    const t = o.t ?? 0, at = o.at ?? 0, q = seg(t, at - 0.35, at, E.back);
    if (q <= 0) return null;
    const f = frameRect(o.frame || o), p = point(f, o.point || [o.x || 0, o.y || 0], o.normalized !== false);
    const r = o.radius || 10;
    ctx.save(); ctx.globalAlpha *= Math.min(1, q); ctx.translate(p[0], p[1]); ctx.scale(q, q);
    ctx.fillStyle = color(o.color, RED); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#F8E9C8'; ctx.lineWidth = 3; ctx.stroke();
    if (o.name) TT.text(ctx, o.name, 0, -r - 22, o.size || 34,
      { fontKey: 'sans-900', color: INK, align: 'center', baseline: 'bottom' });
    ctx.restore();
    return { x: p[0], y: p[1], top: p[1] - r - 48 };
  }
  function route(ctx, o = {}) {
    const t = o.t ?? 0, at = o.at ?? 0, dur = o.duration ?? 1.8;
    const q = seg(t, at, at + dur, E.sine), f = frameRect(o.frame || o);
    if (!o.frame) return null;
    const pts = (o.points || []).map((p) => point(f, p, o.normalized !== false));
    if (pts.length < 2) return null;
    ctx.save(); pathPoints(ctx, pts); ctx.setLineDash([10, 12]); ctx.strokeStyle = 'rgba(70,48,28,.24)'; ctx.lineWidth = o.width || 7; ctx.stroke();
    ctx.setLineDash([]);
    const lengths = [], total = pts.slice(1).reduce((sum, p, i) => {
      const len = Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]); lengths.push(len); return sum + len;
    }, 0);
    let remain = total * q, end = pts[0], prev = pts[0];
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i += 1) {
      const len = lengths[i - 1];
      if (remain >= len) { ctx.lineTo(pts[i][0], pts[i][1]); end = pts[i]; prev = pts[i - 1]; remain -= len; continue; }
      const u = len ? remain / len : 0;
      end = [lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u)]; prev = pts[i - 1];
      ctx.lineTo(end[0], end[1]); break;
    }
    ctx.strokeStyle = color(o.color, RED); ctx.lineWidth = o.width || 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    if (q > 0.01 && q < 0.995) {
      const a = Math.atan2(end[1] - prev[1], end[0] - prev[0]), s = 18;
      ctx.fillStyle = color(o.color, RED); ctx.beginPath(); ctx.moveTo(end[0] + Math.cos(a) * s, end[1] + Math.sin(a) * s);
      ctx.lineTo(end[0] + Math.cos(a + 2.45) * s, end[1] + Math.sin(a + 2.45) * s);
      ctx.lineTo(end[0] + Math.cos(a - 2.45) * s, end[1] + Math.sin(a - 2.45) * s); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    return { x: end[0], y: end[1], progress: q };
  }
  function seal(ctx, o = {}) {
    const t = o.t ?? 0, at = o.at ?? 0, q = seg(t, at - 0.45, at, E.back);
    if (q <= 0) return null;
    const r = o.radius || 70, active = o.active ? 1 + Math.sin(t * 5) * 0.035 : 1;
    const x = o.x ?? 960, y = o.y ?? 420, c = color(o.color, RED);
    ctx.save(); ctx.globalAlpha *= Math.min(1, q); ctx.translate(x, y); ctx.scale(q * active, q * active);
    if (o.active) {
      ctx.strokeStyle = GOLD; ctx.globalAlpha *= 0.45; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, r + 16 + Math.sin(t * 4) * 4, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha /= 0.45;
    }
    ctx.shadowColor = 'rgba(40,20,8,.28)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 9;
    if (o.shape === 'square') { rounded(ctx, -r, -r, r * 2, r * 2, 10); ctx.fillStyle = c; ctx.fill(); }
    else { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); }
    ctx.shadowColor = 'transparent'; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r - 10, 0, Math.PI * 2); ctx.stroke();
    TT.text(ctx, o.text || '', 0, 2, o.fontSize || r * 0.86,
      { fontKey: 'sans-900', color: '#F8E9C8', align: 'center', baseline: 'middle', maxWidth: r * 1.45 });
    if (o.sub) TT.text(ctx, o.sub, 0, r + 30, o.subSize || 32,
      { fontKey: 'sans-900', color: INK, align: 'center', baseline: 'top' });
    ctx.restore();
    return { x, y, top: y - r - 16 };
  }
  function document(ctx, o = {}) {
    const t = o.t ?? 0, at = o.at ?? 0, q = seg(t, at, at + 0.65, E.out);
    if (q <= 0) return;
    const x = o.x ?? 360, y = o.y ?? 180, w = o.w ?? 1200, h = o.h ?? 560;
    ctx.save(); ctx.globalAlpha *= q; ctx.translate(0, (1 - q) * 36);
    panel(ctx, { x, y, w, h }, 1);
    const titleX = x + (o.icon ? 126 : 54);
    if (o.icon) icon(ctx, o.icon, { t, at, x: x + 76, y: y + 58, size: 48 });
    TT.text(ctx, o.title || '史册', titleX, y + 58, o.titleSize || 48,
      { fontKey: 'sans-900', color: INK, align: 'left', baseline: 'middle' });
    ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 52, y + 98); ctx.lineTo(x + w - 52, y + 98); ctx.stroke();
    const lines = o.lines || [], size = o.fontSize || 38, lineH = o.lineHeight || 66;
    lines.forEach((line, i) => {
      const lineAt = at + (o.lineStart ?? 0.55) + i * (o.lineDelay ?? 0.55);
      const lq = o.reveal === false ? 1 : seg(t, lineAt, lineAt + (o.lineDuration ?? 0.75), E.out);
      if (lq <= 0) return;
      const ty = y + 150 + i * lineH;
      ctx.save(); ctx.globalAlpha *= Math.min(1, lq * 1.6);
      ctx.beginPath(); ctx.rect(x + 48, ty - lineH * 0.55, (w - 96) * lq, lineH * 1.1); ctx.clip();
      TT.text(ctx, line, x + 64, ty, size,
        { fontKey: 'sans-400', color: '#3B2819', align: 'left', baseline: 'middle', maxWidth: w - 128 });
      ctx.restore();
    });
    if (o.seal) {
      ctx.save(); ctx.translate(x + w - 100, y + 72); ctx.rotate(-7 * Math.PI / 180);
      ctx.fillStyle = RED; rounded(ctx, -42, -42, 84, 84, 8); ctx.fill();
      TT.text(ctx, o.seal, 0, 0, 30, { fontKey: 'sans-900', color: '#F8E9C8', align: 'center', baseline: 'middle' }); ctx.restore();
    }
    ctx.restore();
  }
  function partialPoints(points, q) {
    if (!points || points.length < 2) return (points || []).slice();
    const qq = clamp(q, 0, 1);
    if (qq <= 0) return [[points[0][0], points[0][1]]];
    if (qq >= 1) return points.map((p) => [p[0], p[1]]);
    let total = 0;
    const lengths = [];
    for (let i = 1; i < points.length; i += 1) {
      const len = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
      lengths.push(len); total += len;
    }
    let remain = total * qq;
    const out = [[points[0][0], points[0][1]]];
    for (let i = 1; i < points.length; i += 1) {
      const len = lengths[i - 1];
      if (remain >= len) { out.push([points[i][0], points[i][1]]); remain -= len; continue; }
      const u = len ? remain / len : 0;
      out.push([lerp(points[i - 1][0], points[i][0], u), lerp(points[i - 1][1], points[i][1], u)]);
      break;
    }
    return out;
  }
  function pointOnPath(points, q) {
    const part = partialPoints(points, q);
    const end = part[part.length - 1] || [0, 0];
    const prev = part[part.length - 2] || end;
    return { x: end[0], y: end[1], angle: Math.atan2(end[1] - prev[1], end[0] - prev[0]) };
  }
  function curvePoints(a, b, bend = 0, steps = 26) {
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const cx = mx - dy * bend, cy = my + dx * bend;
    const out = [];
    for (let i = 0; i <= steps; i += 1) {
      const u = i / steps, v = 1 - u;
      out.push([v * v * a[0] + 2 * v * u * cx + u * u * b[0], v * v * a[1] + 2 * v * u * cy + u * u * b[1]]);
    }
    return out;
  }
  /** 纸面道路：宽底边 + 浅赭填充 + 虚线中心。q 控制画到哪里。 */
  function paperRoad(ctx, points, q, o = {}) {
    const part = partialPoints(points, q);
    if (part.length < 2) return part;
    const width = o.width || 18;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = o.edge || 'rgba(96,66,32,.18)'; ctx.lineWidth = width + 12;
    pathPoints(ctx, part); ctx.stroke();
    ctx.strokeStyle = o.fill || 'rgba(222,190,136,.55)'; ctx.lineWidth = width;
    pathPoints(ctx, part); ctx.stroke();
    ctx.strokeStyle = o.dash || 'rgba(74,45,25,.42)'; ctx.lineWidth = 2.6;
    ctx.setLineDash([1, 11]);
    pathPoints(ctx, part); ctx.stroke();
    ctx.restore();
    return part;
  }

  /** 岔路推演：一条来路分成两条去路，选中一条后另一条压暗。 */
  function fork(ctx, o = {}) {
    const t = o.t ?? 0, at = o.at ?? 0, q = seg(t, at, at + 0.6, E.out);
    if (q <= 0) return null;
    const f = frameRect(o), selected = o.selected ?? -1;
    panel(ctx, f, q);
    ctx.save(); ctx.globalAlpha *= q;
    rounded(ctx, f.x + 16, f.y + 16, f.w - 32, f.h - 32, 4); ctx.clip();
    ctx.strokeStyle = 'rgba(74,45,25,.13)'; ctx.lineWidth = 2;
    for (const [mx, my, s] of [[0.16, 0.20, 30], [0.72, 0.13, 26], [0.66, 0.90, 30], [0.90, 0.58, 24]]) {
      const p = point(f, [mx, my]);
      for (let i = -1; i <= 1; i += 1) {
        ctx.beginPath(); ctx.moveTo(p[0] + i * s * 0.8 - s * 0.45, p[1] + s * 0.3);
        ctx.lineTo(p[0] + i * s * 0.8, p[1] - s * 0.35); ctx.lineTo(p[0] + i * s * 0.8 + s * 0.45, p[1] + s * 0.3); ctx.stroke();
      }
    }
    const from = point(f, o.from || [0.06, 0.66]);
    const hub = point(f, o.fork || [0.42, 0.56]);
    const stemQ = seg(t, at + 0.2, at + 1.0, E.sine);
    paperRoad(ctx, curvePoints(from, hub, o.stemBend ?? -0.10), stemQ, { width: o.width || 18 });
    if (o.fromLabel && stemQ > 0.9) TT.text(ctx, o.fromLabel, from[0] + 14, from[1] + 34, 26,
      { fontKey: 'sans-400', color: '#6B5B4A', align: 'left', baseline: 'top' });
    const result = { frame: f, fork: { x: hub[0], y: hub[1] }, branches: [] };
    const forkY = (o.fork || [0.42, 0.56])[1];
    (o.branches || []).forEach((b, i) => {
      const to = point(f, b.to || [0.86, i ? 0.80 : 0.24]);
      const bAt = b.at ?? (at + 1.0 + i * 0.5);
      const bq = seg(t, bAt, bAt + 1.0, E.sine);
      const pts = curvePoints(hub, to, b.bend ?? (i ? 0.16 : -0.16));
      const active = selected === i, dim = selected >= 0 && !active;
      if (bq > 0) {
        paperRoad(ctx, pts, bq, {
          width: 20,
          edge: dim ? 'rgba(96,66,32,.08)' : active ? 'rgba(181,50,31,.24)' : 'rgba(96,66,32,.18)',
          fill: dim ? 'rgba(168,148,122,.18)' : active ? 'rgba(181,50,31,.22)' : 'rgba(222,190,136,.55)',
          dash: dim ? 'rgba(74,45,25,.16)' : active ? 'rgba(122,30,20,.55)' : 'rgba(74,45,25,.42)',
        });
      }
      if (b.icon) icon(ctx, b.icon, { t, at: bAt + 0.95, x: to[0], y: to[1], size: b.iconSize || 60, alpha: dim ? 0.26 : 0.9 });
      const lq = seg(t, bAt + 0.9, bAt + 1.2, E.out);
      if (lq > 0) {
        const dir = (b.to?.[1] ?? 0) < forkY ? -1 : 1;
        ctx.save(); ctx.globalAlpha *= lq * (dim ? 0.36 : 1);
        TT.text(ctx, b.label || '', to[0], to[1] + dir * 58, 34,
          { fontKey: 'sans-900', color: dim ? '#6B5B4A' : active ? RED : INK, align: 'center', baseline: dir < 0 ? 'bottom' : 'top', maxWidth: 300 });
        if (b.note) TT.text(ctx, b.note, to[0], to[1] + dir * 96, 26,
          { fontKey: 'sans-400', color: dim ? '#7A6A58' : '#5B4030', align: 'center', baseline: dir < 0 ? 'bottom' : 'top', maxWidth: 310 });
        ctx.restore();
      }
      result.branches.push({ points: pts, end: { x: to[0], y: to[1] }, progress: bq, label: b.label || '' });
    });
    const hubQ = seg(t, at + 0.9, at + 1.2, E.back);
    if (hubQ > 0) {
      ctx.save(); ctx.globalAlpha *= Math.min(1, hubQ);
      ctx.strokeStyle = 'rgba(181,50,31,.55)'; ctx.lineWidth = 3; ctx.setLineDash([6, 8]);
      ctx.beginPath(); ctx.arc(hub[0], hub[1], 42 * Math.min(1, hubQ), 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
      if (o.hubLabel) TT.text(ctx, o.hubLabel, hub[0], hub[1] - 66, 32,
        { fontKey: 'sans-900', color: '#7A1E14', align: 'center', baseline: 'bottom' });
    }
    if (o.title) TT.text(ctx, o.title, f.x + 44, f.y + 48, 34,
      { fontKey: 'sans-900', color: '#5B4030', align: 'left', baseline: 'middle' });
    ctx.restore();
    return result;
  }

  /** 纸偶人物：脚点为原点，style 决定冠帽与披风，位移和步态由场景计算。 */
  function figure(ctx, o = {}) {
    const t = o.t ?? 0, at = o.at ?? 0, p = seg(t, at - 0.3, at, E.out);
    if (p <= 0) return null;
    const x = o.x ?? 960, y = o.y ?? 800, h = o.h ?? 80, dir = o.dir ?? 1;
    const style = o.style || 'commoner';
    const robe = color(o.color, style === 'leader' ? RED : style === 'official' ? '#5E6B5A' : '#7A6A4F');
    const skin = o.skin || '#F0D9B2';
    const lw = clamp(h * 0.028, 1.5, 3.4);
    const headR = h * 0.115, headY = -h + headR * 1.35;
    const shoulderY = -h * 0.70, hemW = h * 0.30, shW = h * 0.19;
    const yOff = (1 - p) * h * 0.08;
    ctx.save(); ctx.globalAlpha *= p * (o.alpha ?? 1);
    ctx.translate(x, y + yOff + (o.bob || 0)); ctx.rotate(o.lean || 0); ctx.scale(dir, 1);
    ctx.fillStyle = 'rgba(52,30,15,.13)';
    ctx.beginPath(); ctx.ellipse(0, h * 0.015, h * 0.23, h * 0.04, 0, 0, Math.PI * 2); ctx.fill();
    if (style === 'leader' || o.cape) {
      ctx.beginPath();
      ctx.moveTo(-shW * 0.45, shoulderY - h * 0.01);
      ctx.quadraticCurveTo(-hemW * 0.8, -h * 0.2, -hemW * 0.64, 0);
      ctx.lineTo(hemW * 0.64, 0);
      ctx.quadraticCurveTo(hemW * 0.8, -h * 0.2, shW * 0.45, shoulderY - h * 0.01);
      ctx.closePath();
      ctx.fillStyle = o.capeColor || '#8E2B1E'; ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-hemW / 2, 0);
    ctx.quadraticCurveTo(-hemW * 0.42, shoulderY + h * 0.1, -shW / 2, shoulderY);
    ctx.quadraticCurveTo(0, shoulderY - h * 0.055, shW / 2, shoulderY);
    ctx.quadraticCurveTo(hemW * 0.42, shoulderY + h * 0.1, hemW / 2, 0);
    ctx.closePath();
    ctx.fillStyle = robe; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.stroke();
    ctx.strokeStyle = 'rgba(42,23,12,.72)'; ctx.lineWidth = Math.max(2, lw * 1.1);
    ctx.beginPath(); ctx.moveTo(-shW * 0.56, -h * 0.30); ctx.lineTo(shW * 0.56, -h * 0.30); ctx.stroke();
    ctx.strokeStyle = 'rgba(241,213,154,.7)'; ctx.lineWidth = Math.max(1.4, lw * 0.65);
    ctx.beginPath(); ctx.moveTo(-shW * 0.34, shoulderY + h * 0.015); ctx.lineTo(0, shoulderY + h * 0.11);
    ctx.lineTo(shW * 0.34, shoulderY + h * 0.015); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, headY, headR, 0, Math.PI * 2);
    ctx.fillStyle = skin; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, headY, headR, Math.PI * 1.04, Math.PI * 1.96, false);
    ctx.quadraticCurveTo(headR * 0.5, headY - headR * 0.1, headR * 0.7, headY + headR * 0.02);
    ctx.quadraticCurveTo(0, headY + headR * 0.16, -headR * 0.7, headY + headR * 0.02);
    ctx.quadraticCurveTo(-headR * 0.5, headY - headR * 0.1, -headR * 1.0, headY - headR * 0.08);
    ctx.closePath(); ctx.fillStyle = INK; ctx.fill();
    const eyeY = headY + headR * 0.42, eyeX = headR * 0.32, eyeR = Math.max(1.1, headR * 0.11);
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
    if (headR > 9) { ctx.beginPath(); ctx.arc(-eyeX, eyeY, eyeR, 0, Math.PI * 2); ctx.fill(); }
    if (style === 'official') {
      rounded(ctx, -headR * 1.12, headY - headR * 1.62, headR * 2.24, headR * 0.52, headR * 0.1);
      ctx.fillStyle = INK; ctx.fill();
      ctx.strokeStyle = GOLD; ctx.lineWidth = Math.max(1, lw * 0.6);
      ctx.beginPath(); ctx.moveTo(-headR * 1.08, headY - headR * 1.1); ctx.lineTo(headR * 1.08, headY - headR * 1.1); ctx.stroke();
    } else if (style === 'soldier') {
      ctx.beginPath(); ctx.arc(0, headY - headR * 0.15, headR * 1.1, Math.PI, 0);
      ctx.fillStyle = '#4A3B2A'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.stroke();
    } else if (style === 'elder') {
      ctx.beginPath();
      ctx.moveTo(-headR * 0.3, headY + headR * 0.72); ctx.lineTo(0, headY + headR * 1.35); ctx.lineTo(headR * 0.3, headY + headR * 0.72);
      ctx.closePath(); ctx.fillStyle = '#E8E0CF'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, lw * 0.6); ctx.stroke();
    }
    ctx.restore();
    return { x, y, top: y + yOff - h, h };
  }

  /** 中式门阙：城台 + 拱门 + 起翘屋檐，用于官府、城门、关卡。 */
  function gate(ctx, o = {}) {
    const t = o.t ?? 0, at = o.at ?? 0, q = seg(t, at - 0.4, at, E.out);
    if (q <= 0) return null;
    const x = o.x ?? 340, y = o.y ?? 600, w = o.w ?? 300, h = o.h ?? 320;
    const ink = color(o.color, '#5B4030');
    const fill = o.fill || '#E6CCA0';
    const roof = o.roof || '#6B4B2A';
    const eaveY = -h * 0.56, ridgeY = -h * 0.84, rw = w * 0.64;
    const wallTop = eaveY + 2;
    ctx.save(); ctx.globalAlpha *= Math.min(1, q) * (o.alpha ?? 1);
    ctx.translate(x, y + (1 - q) * 12);
    ctx.beginPath(); ctx.rect(-w / 2, wallTop, w, -wallTop);
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = 'rgba(91,64,48,.20)';
    ctx.fillRect(-w / 2 - 12, -10, w + 24, 10);
    const aw = w * 0.31, ah = h * 0.38;
    ctx.beginPath();
    ctx.moveTo(-aw / 2, 0); ctx.lineTo(-aw / 2, -ah * 0.55);
    ctx.arc(0, -ah * 0.55, aw / 2, Math.PI, 0);
    ctx.lineTo(aw / 2, 0); ctx.closePath();
    ctx.fillStyle = 'rgba(46,27,16,.72)'; ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = 'rgba(216,164,87,.34)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -ah * 0.9); ctx.lineTo(0, 0); ctx.stroke();
    ctx.fillStyle = '#D8A457';
    ctx.fillRect(-w * 0.14, wallTop + 16, w * 0.28, h * 0.07);
    ctx.strokeStyle = ink; ctx.lineWidth = 2.4;
    ctx.strokeRect(-w * 0.14, wallTop + 16, w * 0.28, h * 0.07);
    ctx.beginPath();
    ctx.moveTo(-rw * 0.52, ridgeY);
    ctx.quadraticCurveTo(-rw * 0.86, ridgeY + 50, -rw, eaveY - 12);
    ctx.quadraticCurveTo(-rw * 0.86, eaveY + 8, -rw * 0.80, eaveY + 6);
    ctx.lineTo(rw * 0.80, eaveY + 6);
    ctx.quadraticCurveTo(rw * 0.86, eaveY + 8, rw, eaveY - 12);
    ctx.quadraticCurveTo(rw * 0.86, ridgeY + 50, rw * 0.52, ridgeY);
    ctx.closePath();
    ctx.fillStyle = roof; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = roof;
    ctx.fillRect(-rw * 0.56, ridgeY - 10, rw * 1.12, 10);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.4;
    ctx.strokeRect(-rw * 0.56, ridgeY - 10, rw * 1.12, 10);
    ctx.strokeStyle = 'rgba(241,213,154,.18)'; ctx.lineWidth = 2;
    for (const k of [-0.36, 0, 0.36]) {
      ctx.beginPath();
      ctx.moveTo(rw * k * 0.55, ridgeY + 4);
      ctx.quadraticCurveTo(rw * k * 0.9, (ridgeY + eaveY) / 2, rw * k * 1.12, eaveY - 4);
      ctx.stroke();
    }
    ctx.restore();
    return { x, y, w, h, top: y - h * 0.9 };
  }

  /** 竖幡：旗杆 + 从横臂垂下的布幡，文字逐字竖排，展开后轻微摆动。 */
  function banner(ctx, o = {}) {
    const t = o.t ?? 0, at = o.at ?? 0, q = seg(t, at, at + 0.45, E.out);
    if (q <= 0) return null;
    const x = o.x ?? 1500, y = o.y ?? 840, h = o.h ?? 430;
    const w = o.w ?? 112, ch = o.ch ?? 300;
    const up = seg(t, at + 0.15, at + 0.95, E.out);
    const sway = Math.sin(t * 1.7 + (o.phase || 0)) * (o.still ? 0 : 0.028) * up;
    ctx.save(); ctx.globalAlpha *= q;
    ctx.strokeStyle = '#5B4030'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke();
    ctx.fillStyle = '#5B4030'; ctx.beginPath(); ctx.ellipse(x, y, 26, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y - h - 6, 8, 0, Math.PI * 2); ctx.fillStyle = GOLD; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = '#5B4030'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(x - 6, y - h + 12); ctx.lineTo(x + w + 18, y - h + 12); ctx.stroke();
    ctx.translate(x + 2, y - h + 16); ctx.rotate(sway);
    const chh = ch * up;
    if (chh > 6) {
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, chh - 10);
      ctx.quadraticCurveTo(w - 8, chh, w * 0.5, chh);
      ctx.quadraticCurveTo(w * 0.12, chh, 0, chh - 16);
      ctx.closePath();
      ctx.fillStyle = color(o.color, RED); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = 'rgba(241,213,154,.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(7, 8); ctx.lineTo(w - 7, 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(7, chh - 22); ctx.lineTo(w - 7, chh - 22); ctx.stroke();
    }
    const tq = seg(t, at + 0.6, at + 1.05, E.out);
    if (tq > 0) {
      const chars = Array.from(o.text || '');
      const gap = Math.min(w * 0.78, (chh - 30) / Math.max(1, chars.length));
      const size = Math.min(w * 0.62, gap * 0.82);
      ctx.save(); ctx.globalAlpha *= tq;
      chars.forEach((chr, i) => TT.text(ctx, chr, w / 2, 22 + gap * (i + 0.5), size,
        { fontKey: 'sans-900', color: '#F8E9C8', align: 'center', baseline: 'middle' }));
      ctx.restore();
    }
    ctx.restore();
    return { x, y: y - h, w, h: chh };
  }
  function timeline(ctx, o = {}) {
    const t = o.t ?? 0, at = o.at ?? 0, q = seg(t, at, at + 0.8, E.out);
    if (q <= 0) return;
    const x = o.x ?? 240, y = o.y ?? 480, w = o.w ?? 1440, events = o.events || [];
    ctx.save(); ctx.globalAlpha *= q;
    ctx.strokeStyle = 'rgba(50,30,16,.24)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke();
    ctx.strokeStyle = RED; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * q, y); ctx.stroke();
    events.forEach((event, i) => {
      const ex = x + w * (event.position ?? (events.length === 1 ? 0.5 : i / (events.length - 1)));
      const eq = seg(t, event.at ?? at + 0.5 + i * 0.45, (event.at ?? at + 0.5 + i * 0.45) + 0.4, E.back);
      if (eq <= 0) return;
      ctx.save(); ctx.translate(ex, y); ctx.scale(eq, eq);
      ctx.fillStyle = event.active ? RED : '#F3E4C6'; ctx.beginPath(); ctx.arc(0, 0, event.active ? 18 : 13, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
      const above = event.above ?? i % 2 === 0, dir = above ? -1 : 1;
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, dir * 18); ctx.lineTo(0, dir * 70); ctx.stroke();
      TT.text(ctx, event.year || '', 0, dir * 92, 34, { fontKey: 'sans-900', color: RED, align: 'center', baseline: 'middle' });
      TT.text(ctx, event.label || '', 0, dir * 136, 34, { fontKey: 'sans-900', color: INK, align: 'center', baseline: 'middle', maxWidth: 240 });
      if (event.icon) icon(ctx, event.icon, { t, at: 0, x: 0, y: dir * 188, size: 44, alpha: 0.8 });
      ctx.restore();
    });
    ctx.restore();
  }

  function title(ctx, o = {}) {
    const t = o.t ?? 0, at = o.at ?? 0, until = o.until ?? 1e9;
    if (t < at - 0.5 || t >= until) return;
    const q = seg(t, at - 0.5, at, E.cubic), out = until < 1e8 ? 1 - seg(t, until - 0.4, until) : 1;
    const size = o.size ?? 120;
    ctx.save(); ctx.globalAlpha *= q * out; ctx.translate(o.x ?? 960, o.y ?? 420); ctx.scale(1.06 - 0.06 * q, 1.06 - 0.06 * q);
    TT.text(ctx, o.text, 0, 0, size, { fontKey: 'sans-900', color: '#22140B', align: o.align || 'center', baseline: 'middle' }); ctx.restore();
  }
  function endcard(ctx, o = {}) {
    title(ctx, { text: o.title, at: o.at + 0.5, y: 430, size: 150, t: o.t });
    const subQ = seg(o.t, o.at + 1.4, o.at + 1.8, E.out);
    if (o.sub && subQ > 0) {
      ctx.save(); ctx.globalAlpha *= subQ;
      TT.text(ctx, o.sub, 960, 650, 42, { fontKey: 'sans-400', color: '#5B4030', align: 'center', baseline: 'middle' });
      ctx.restore();
    }
    if (o.seal) seal(ctx, { t: o.t, at: o.at + 2, x: 1344, y: 280, text: o.seal, shape: 'square', radius: 55, fontSize: 36 });
  }
  function systemCaption(ctx, cue, o = {}) {
    if (!cue) return;
    const t = o.t ?? 0, k = seg(t, cue.start, cue.start + 0.25, E.cubic);
    const W = o.W ?? 1920, H = o.H ?? 1080, bx = W * 0.14, by = H * 0.84, bw = W * 0.72, bh = 92;
    ctx.save(); ctx.globalAlpha *= k; ctx.translate(0, (1 - k) * 12);
    ctx.fillStyle = 'rgba(50,23,15,0.82)'; ctx.fillRect(bx, by, bw, bh); ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.strokeRect(bx, by, bw, bh);
    TT.text(ctx, cue.text, W * 0.5, by + bh * 0.5, 58 * 0.58,
      { fontKey: 'sans-400', color: LIGHT, align: 'center', baseline: 'middle', maxWidth: bw - 40 }); ctx.restore();
  }
  function dialogueCaption(ctx, cue, speaker, o = {}) {
    if (!cue) return;
    const t = o.t ?? 0, k = seg(t, cue.start, cue.start + 0.28, E.cubic);
    const W = o.W ?? 1920, H = o.H ?? 1080, x = W * 0.10, y = H * 0.835, w = W * 0.80, h = 104;
    ctx.save(); ctx.globalAlpha *= k; ctx.translate(0, (1 - k) * 18);
    ctx.shadowColor = 'rgba(50,23,15,0.30)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 7;
    rounded(ctx, x, y, w, h, 12); ctx.fillStyle = 'rgba(247,226,181,0.96)'; ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.strokeStyle = '#7C472A'; ctx.lineWidth = 4; ctx.stroke();
    rounded(ctx, x + 10, y + 10, w - 20, h - 20, 7); ctx.strokeStyle = GOLD; ctx.lineWidth = 1.8; ctx.stroke();
    rounded(ctx, x + 30, y + 17, 214, 70, 7); ctx.fillStyle = '#9E3D2C'; ctx.fill(); ctx.strokeStyle = '#32170F'; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 258, y + 24); ctx.lineTo(x + 258, y + 80); ctx.stroke();
    TT.text(ctx, speaker, x + 137, y + 54, 72 * 0.62, { fontKey: 'sans-900', color: LIGHT, align: 'center', baseline: 'middle', maxWidth: 176 });
    TT.text(ctx, cue.text, x + 292, y + 54, 72 * 0.58, { fontKey: 'sans-400', color: '#32170F', align: 'left', baseline: 'middle', maxWidth: w - 340 });
    for (const dx of [18, w - 18]) {
      ctx.fillStyle = GOLD; ctx.beginPath(); ctx.moveTo(x + dx, y + h / 2 - 8); ctx.lineTo(x + dx + 7, y + h / 2); ctx.lineTo(x + dx, y + h / 2 + 8); ctx.lineTo(x + dx - 7, y + h / 2); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  TT.chronicle = {
    E, seg, colors: COLORS, readData, icon, map, route, place, seal, document,
    fork, figure, gate, banner, pointOnPath, timeline,
    title, endcard, systemCaption, dialogueCaption,
  };
})();
