/**
 * TT.shadow —— 叙事皮影：data 皮片、关节皮偶、道具、蛇、签条与灯光。
 *
 * 造型数据来自 figures/*.json（由 scripts/tools/extract-shadow-archetypes.mjs
 * 从 bb-video 兼容运行时提取，MIT）。kit 只负责绘制与运动，不存故事人物坐标。
 * SVG path → Path2D；evenodd → 真镂空；multiply → 灯光透过染色皮。
 * 所有运动都是 api.t 的函数；静态 Path2D 与 JSON 按内容缓存。
 */
(() => {
  const TAU = Math.PI * 2;
  const INK = '#1C130C';
  const HIDE = '#E2BF86';
  const GOLD = '#D8A457';
  const LIGHT = '#F1D59A';
  const LEATHER = {
    red: '#C0381F', deep: '#7A1E14', green: '#2E7A44', blue: '#2C5E98',
    ochre: '#C99434', yellow: '#E2AE36', black: INK, skin: '#E9C79A',
    white: '#EFE2C4', purple: '#5C3566',
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const f1 = (n) => Math.round(n * 10) / 10;
  const E = {
    lin: (t) => t,
    sine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    cubicInOut: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - ((-2 * t + 2) ** 3) / 2),
    quartOut: (t) => 1 - (1 - t) ** 4,
    quartIn: (t) => t ** 4,
    expoIn: (t) => (t === 0 ? 0 : 2 ** (10 * t - 10)),
    backOut: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  };
  const seg = (t, a, b, e = E.lin) => e(clamp(b === a ? 1 : (t - a) / (b - a), 0, 1));
  const poly = (pts) => 'M' + pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join(' L') + ' Z';
  const oval = (cx, cy, rx, ry, ang = 0, n = 12) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    return [cx + x * Math.cos(ang) - y * Math.sin(ang), cy + x * Math.sin(ang) + y * Math.cos(ang)];
  });
  const curve = (pts, closed = true, k = 6) => {
    const n = pts.length, at = (i) => pts[(i + n) % n], out = [];
    for (let i = 0; i < (closed ? n : n - 1); i += 1) {
      const p0 = closed ? at(i - 1) : pts[Math.max(0, i - 1)];
      const p1 = at(i), p2 = at(i + 1);
      const p3 = closed ? at(i + 2) : pts[Math.min(n - 1, i + 2)];
      for (let j = 0; j < k; j += 1) {
        const t = j / k, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t
          + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2
          + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
      }
    }
    if (!closed) out.push(pts[n - 1]);
    return out;
  };
  const blob = (pts, closed = true) => {
    const n = pts.length, at = (i) => pts[(i + n) % n];
    if (!n) return '';
    let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
    for (let i = 0; i < (closed ? n : n - 1); i += 1) {
      const p0 = closed ? at(i - 1) : pts[Math.max(0, i - 1)];
      const p1 = at(i), p2 = at(i + 1);
      const p3 = closed ? at(i + 2) : pts[Math.min(n - 1, i + 2)];
      d += ` C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)}`
        + ` ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
    }
    return d + (closed ? ' Z' : '');
  };
  const strip = (pts, w) => {
    const left = [], right = [];
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * w / 2, ny = (dx / len) * w / 2;
      left.push([p[0] + nx, p[1] + ny]); right.push([p[0] - nx, p[1] - ny]);
    });
    return left.concat(right.reverse());
  };
  const mixHex = (a, b, t) => {
    if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return a;
    const parse = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const x = parse(a), y = parse(b);
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
  };

  const pathCache = globalThis.__ttShadowPathCache ||= new Map();
  const P = (d) => {
    if (!d) return null;
    let path = pathCache.get(d);
    if (!path) { path = new Path2D(d); pathCache.set(d, path); }
    return path;
  };
  const dataCache = globalThis.__ttShadowDataCache ||= new Map();
  function readData(source) {
    if (source && typeof source === 'object') return source;
    if (typeof source !== 'string' || !source.trim()) throw new Error('TT.shadow 需要 data 资源文本');
    let data = dataCache.get(source);
    if (!data) { data = JSON.parse(source); dataCache.set(source, data); }
    return data;
  }
  function cast(source, sources) {
    const list = readData(source);
    const out = {};
    for (const [who, spec] of Object.entries(list)) {
      const data = readData(sources[spec.kind]);
      out[who] = { ...spec, data, who };
    }
    return out;
  }

  function transform(ctx, text) {
    if (!text) return;
    const re = /(translate|scale|rotate|skewX)\(([^)]*)\)/g;
    let m;
    while ((m = re.exec(text))) {
      const n = m[2].trim().split(/[\s,]+/).map(Number);
      if (m[1] === 'translate') ctx.translate(n[0] || 0, n[1] || 0);
      else if (m[1] === 'scale') ctx.scale(n[0] ?? 1, n[1] ?? n[0] ?? 1);
      else if (m[1] === 'rotate') {
        if (n.length >= 3) { ctx.translate(n[1], n[2]); ctx.rotate(n[0] * Math.PI / 180); ctx.translate(-n[1], -n[2]); }
        else ctx.rotate((n[0] || 0) * Math.PI / 180);
      } else if (m[1] === 'skewX') ctx.transform(1, 0, Math.tan((n[0] || 0) * Math.PI / 180), 1, 0, 0);
    }
  }
  function colorOf(value, env) {
    if (!value) return value;
    if (value.startsWith('$')) {
      const key = value.slice(1);
      const raw = env.colors[key] ?? key;
      const color = LEATHER[raw] ?? raw;
      return env.shade ? mixHex(color, INK, env.shade) : color;
    }
    const color = LEATHER[value] ?? value;
    return env.shade ? mixHex(color, INK, env.shade) : color;
  }
  function drawNode(ctx, node, env = {}) {
    if (!node) return;
    const a = { ...node.attrs, ...(env.attrs ? env.attrs(node) : null) };
    ctx.save();
    if (a.opacity !== undefined) ctx.globalAlpha *= Number(a.opacity);
    const customTransform = env.transform ? env.transform(node) : null;
    transform(ctx, customTransform ?? a.transform);
    if (node.tag === 'path') {
      const dynamicPath = env.path ? env.path(node) : undefined;
      const d = dynamicPath ?? a.d;
      if (d) {
        if (a.fill && a.fill !== 'none') {
          ctx.save();
          ctx.globalAlpha *= Number(a['fill-opacity'] ?? 1);
          ctx.fillStyle = colorOf(a.fill, env);
          ctx.fill(P(d), a['fill-rule'] || 'nonzero');
          ctx.restore();
        }
        if (a.stroke && a.stroke !== 'none' && Number(a['stroke-width'] ?? 1) > 0) {
          ctx.save();
          ctx.globalAlpha *= Number(a['stroke-opacity'] ?? 1);
          ctx.strokeStyle = colorOf(a.stroke, env);
          ctx.lineWidth = Number(a['stroke-width'] ?? 1);
          ctx.lineCap = a['stroke-linecap'] || 'butt';
          ctx.lineJoin = a['stroke-linejoin'] || 'miter';
          ctx.stroke(P(d));
          ctx.restore();
        }
      }
    }
    for (const child of node.children || []) drawNode(ctx, child, env);
    ctx.restore();
  }

  /* ---------------- 动作时间线：at 是动作到位、可读的时刻 ---------------- */
  const steps = {
    walk: (at, x, dur = 1.6, o = {}) => ({ kind: 'walk', a: at - dur, b: at, x, ...o }),
    talk: (at, dur = 1.6) => ({ kind: 'talk', a: at, b: at + dur }),
    point: (at, dur = 1.4) => ({ kind: 'point', a: at - 0.35, b: at + dur }),
    bow: (at, dur = 1.2) => ({ kind: 'bow', a: at - 0.4, b: at + dur }),
    fight: (at, dur = 1.6) => ({ kind: 'fight', a: at - 0.2, b: at + dur }),
    strike: (at) => ({ kind: 'strike', a: at }),
    fall: (at, o = {}) => ({ kind: 'fall', a: at - (o.dur ?? 0.5), b: at, ...o }),
    lie: (at, o = {}) => ({ kind: 'lie', a: at - (o.dur ?? 0.9), b: at, ...o }),
    rise: (at, dur = 0.8) => ({ kind: 'rise', a: at - dur, b: at }),
    sink: (at, dur = 1.6) => ({ kind: 'sink', a: at - dur, b: at }),
    turn: (at) => ({ kind: 'turn', a: at - 0.18, b: at }),
    faceTo: (at, otherX) => ({ kind: 'faceTo', a: at - 0.18, b: at, otherX }),
    exit: (at, x, dur = 1.6) => ({ kind: 'exit', a: at - dur, b: at, x }),
    dance: (at, dur = 2.4) => ({ kind: 'dance', a: at, b: at + dur }),
    sway: (at, dur = 2, deg = 4) => ({ kind: 'sway', a: at, b: at + dur, deg }),
    weep: (at, dur = 2) => ({ kind: 'weep', a: at - 0.3, b: at + dur }),
  };
  const handPos = (sx, a, e, sy = -444) => {
    const r1 = a * Math.PI / 180, r2 = (a + e) * Math.PI / 180;
    return [sx + Math.sin(r1) * 104 + Math.sin(r2) * 96, sy + Math.cos(r1) * 104 + Math.cos(r2) * 96];
  };
  function motion(t, tl = [], o = {}) {
    let x = o.x ?? 0, face = o.face ?? 1;
    let walking = 0, talk = 0, point = 0, bow = 0, fight = 0, dance = 0, weep = 0, swayDeg = 0;
    let strikeUp = 0, strikeDown = 0, fall = 0, sink = 0, fallA = null;
    for (const a of tl) {
      if (a.kind === 'walk' || a.kind === 'exit') {
        if (t >= a.a) {
          const from = x;
          x = lerp(from, a.x, seg(t, a.a, a.b, E.sine));
          const bk = a.backward ? -1 : 1;
          if (a.x < from) face = -bk; else if (a.x > from) face = bk;
          if (t < a.b) walking = Math.max(walking, Math.min(1, (t - a.a) / 0.3, (a.b - t) / 0.3));
        }
      } else if (a.kind === 'turn') { if (t >= a.b) face = -face; }
      else if (a.kind === 'faceTo') { if (t >= a.b && a.otherX !== undefined) face = a.otherX >= x ? 1 : -1; }
      else if (a.kind === 'strike') {
        const up = seg(t, a.a - 0.55, a.a - 0.1, E.cubicInOut) * (1 - seg(t, a.a - 0.1, a.a + 0.06, E.quartIn));
        const down = seg(t, a.a - 0.1, a.a + 0.06, E.cubicInOut) * (1 - seg(t, a.a + 0.06, a.a + 0.55, E.quartOut));
        strikeUp = Math.max(strikeUp, up); strikeDown = Math.max(strikeDown, down);
      } else if (t >= a.a && t < a.b + 0.4) {
        const q = Math.min(seg(t, a.a, a.a + 0.3), 1 - seg(t, a.b, a.b + 0.4));
        if (a.kind === 'talk') talk = Math.max(talk, q);
        if (a.kind === 'point') point = Math.max(point, q);
        if (a.kind === 'bow') bow = Math.max(bow, q);
        if (a.kind === 'fight') fight = Math.max(fight, q);
        if (a.kind === 'dance') dance = Math.max(dance, q);
        if (a.kind === 'weep') weep = Math.max(weep, q);
        if (a.kind === 'sway') swayDeg += (a.deg ?? 4) * Math.sin((t - a.a) * 2.2)
          * clamp(Math.min((t - a.a) * 2, (a.b - t) * 2), 0, 1);
      }
      if ((a.kind === 'fall' || a.kind === 'lie') && t >= a.a && (!fallA || a.a >= fallA.a)) fallA = a;
      if (a.kind === 'sink' && t >= a.a) sink = seg(t, a.a, a.b, E.cubicInOut);
    }
    if (fallA) {
      fall = seg(t, fallA.a, fallA.b, fallA.kind === 'lie' ? E.sine : fallA.stay ? E.cubicInOut : E.quartIn);
      for (const a of tl) if (a.kind === 'rise' && a.a >= fallA.b - 0.01 && t >= a.a) fall *= 1 - seg(t, a.a, a.b, E.cubicInOut);
    }
    const lying = fallA && (fallA.kind === 'lie' || fallA.stay);
    const gone = fallA && !lying && fall >= 1 && !tl.some((a) => a.kind === 'rise' && a.a >= fallA.b - 0.01);
    const seed = o.seed ?? 0;
    x += face * fight * (o.size ?? 460) * (0.035 + 0.035 * Math.sin(t * 9 + seed));
    const ph = t * 6.2 + seed, bob = walking * Math.abs(Math.sin(ph)) * 10 + weep * Math.abs(Math.sin(t * 7)) * 4;
    const swing = walking * Math.sin(ph), rest = 1 - fall, stoop = (o.stoop ?? 0) * rest;
    const bodyTilt = bow * 14 + stoop * 12 + weep * 6 + strikeDown * 4;
    const fallTilt = (fallA && fallA.back ? -1 : 1) * fall * 86;
    return {
      x, face, walking, talk, point, bow, fight, dance, weep, fall, sink, gone,
      bob, swayDeg, strike: strikeDown,
      aF: rest * 14 + walking * swing * 18 + talk * (32 + 14 * Math.sin(t * 7)) + point * 82
        + bow * 58 + fight * (60 + 50 * Math.sin(t * 9)) + dance * (70 + 50 * Math.sin(t * 3.1))
        + weep * (106 + 4 * Math.sin(t * 7)) + strikeUp * 95 + strikeDown * 25,
      eF: rest * 30 + talk * (40 + 10 * Math.sin(t * 7)) + point * 6 + bow * 70 + fight * 20
        + dance * (40 + 30 * Math.sin(t * 3.1 + 1)) + weep * 117 - strikeUp * 20 + strikeDown * 40,
      aB: -rest * 8 - walking * swing * 14 + bow * 50 + dance * (40 + 40 * Math.sin(t * 3.1 + 2)) + fight * 20,
      eB: rest * 14 + bow * 76 + dance * 50,
      tilt: bodyTilt + fallTilt,
      bodyTilt, fallTilt,
      headR: talk * 4 * Math.sin(t * 7.3) + bow * 10 + stoop * 8 + weep * (14 + 3 * Math.sin(t * 7)),
      legSwing: walking ? swing * 22 : 0,
      fade: o.until !== undefined && o.until < 1e8 ? 1 - seg(t, o.until - 0.35, o.until) : 1,
    };
  }

  function drawArm(ctx, tree, sx, angle, elbow, env) {
    // 提取树在肩关节 sh 外还有一层包装；fo 的 104px 只能在这里应用一次。
    const sh = tree.children[0], up = sh?.children[0], fo = up?.children[0];
    ctx.save(); ctx.translate(sx, -444);
    for (const child of sh.children) {
      if (child !== up) { drawNode(ctx, child, env); continue; }
      ctx.save(); ctx.rotate(-angle * Math.PI / 180);
      for (const part of up.children) {
        if (part !== fo) { drawNode(ctx, part, env); continue; }
        ctx.save(); ctx.translate(0, 104); ctx.rotate(-elbow * Math.PI / 180);
        for (const item of part.children) drawNode(ctx, item, env);
        ctx.restore();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function puppet(ctx, actorSource, pose, o = {}) {
    const actor = actorSource?.data ? actorSource : { data: readData(actorSource), colors: o.colors || {} };
    const data = actor.data;
    const t = o.t ?? 0, at = o.at ?? 0, until = o.until ?? 1e9;
    const enterDur = o.enterDur ?? 1.6;
    if (t < at - (o.enter && o.enter !== 'fade' ? enterDur : 0.7) || t >= until || pose.gone) return null;
    const size = (o.size ?? 460) * (actor.scale ?? 1) * (data.small ?? 1);
    const sc = size / 600, depth = o.depth ?? 0;
    const rise = o.enter === 'fade' ? 1 - seg(t, at - 0.7, at, E.quartOut) : 0;
    const d = depth + rise * 0.9;
    const riding = o.riding;
    const face = riding ? riding.face : pose.face;
    const rootX = riding ? riding.x : pose.x;
    const footBase = riding ? riding.y - riding.saddle + size * 0.32 : (o.y ?? 864);
    const footY = footBase + pose.sink * size * 0.9;
    const rootY = footY - pose.bob * sc + pose.fall * size * 0.05;
    const scale = sc * (1 + d * 0.25);
    const fin = o.enter === 'fade' ? seg(t, at - 0.7, at - 0.25) : 1;
    const alpha = Math.min(fin, pose.fade) * (1 - d * 0.35) * (o.alpha ?? 1);
    if (alpha <= 0.001) return null;
    const colors = actor.colors || {};
    const env = { colors, shade: 0 };

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha *= alpha;
    if (o.blur === true && d > 0.01) ctx.filter = `blur(${f1(d * 6)}px)`;
    // 操偶杆与皮片共用同一姿态，但保持在人物底层。
    if (pose.fall <= 0.5 && pose.sink <= 0.6 && o.rods !== false) {
      const fx = (u) => rootX + u * scale * face, fy = (v) => rootY + v * scale;
      ctx.save(); ctx.globalAlpha *= 0.85; ctx.strokeStyle = '#2A1A10'; ctx.lineWidth = 4 * sc * 1.6; ctx.lineCap = 'round';
      const rod = (p, dx) => { ctx.beginPath(); ctx.moveTo(fx(p[0]), fy(p[1])); ctx.lineTo(fx(p[0]) + dx, (o.bottomY ?? 1120)); ctx.stroke(); };
      rod([6, -470], -30 * face); rod(handPos(18, pose.aF, pose.eF), 60 * face); rod(handPos(-10, pose.aB, pose.eB), -20 * face);
      ctx.restore();
    }
    ctx.translate(rootX, rootY);
    ctx.rotate(pose.swayDeg * Math.PI / 180);
    ctx.scale(scale, scale);
    ctx.scale(face, 1);
    ctx.translate(0, -20); ctx.rotate(pose.tilt * Math.PI / 180); ctx.translate(0, 20);
    if (data.tree.flags) drawNode(ctx, data.tree.flags, env);
    drawArm(ctx, data.tree.backArm, -10, pose.aB, pose.eB, { ...env, shade: 0.25 });
    if (data.tree.legs) {
      ctx.save(); transform(ctx, data.tree.legs.attrs.transform);
      const back = data.tree.legs.children[0], front = data.tree.legs.children[1];
      ctx.save(); ctx.rotate(pose.legSwing * Math.PI / 180); drawNode(ctx, back, { ...env, shade: 0.3 }); ctx.restore();
      ctx.save(); ctx.rotate(-pose.legSwing * Math.PI / 180); drawNode(ctx, front, { ...env, shade: 0.12 }); ctx.restore();
      ctx.restore();
    }
    for (const boot of data.tree.boots) drawNode(ctx, boot, env);
    drawNode(ctx, data.tree.body, env);
    ctx.save(); ctx.translate(6, -472); ctx.rotate(-pose.headR * Math.PI / 180); ctx.translate(-6, 472);
    drawNode(ctx, data.tree.head, env);
    ctx.restore();
    drawArm(ctx, data.tree.frontArm, 18, pose.aF, pose.eF, env);
    ctx.restore();

    const hatTop = data.kind === 'official' ? -646 : data.kind === 'soldier' ? -586 : -628;
    const fy = (v) => rootY + v * scale;
    return { x: rootX, face, footY, top: fy(-472 + (hatTop + 472) * 1.22), size };
  }

  /* ---------------- 道具：静态皮片 + 马、芦苇、旗帜、火焰 ---------------- */
  function reedPaths(data, t) {
    let leaf = '', head = '';
    for (let i = 0; i < data.reeds.B.length; i += 1) {
      const b = data.reeds.B[i], sw = Math.sin(t * 1.1 + i * 1.7 + data.reeds.seed) * 9;
      const tip = [b.bx + b.lean + sw, -b.h], mid = [b.bx + (b.lean + sw) * 0.45, -b.h * 0.5], w = 12;
      leaf += ' ' + poly([[b.bx - w, 0], [mid[0] - w * 0.7, mid[1]], tip, [mid[0] + w * 0.7, mid[1]], [b.bx + w, 0]]);
      for (let q = 0.15; q < 0.8; q += 0.13) leaf += ' ' + poly(oval(b.bx + (b.lean + sw) * q * (q < 0.5 ? 0.9 : 1), -b.h * q, 3, 12, Math.atan2(-b.h, b.lean) + Math.PI / 2, 8));
      if (b.cat) {
        const cx = b.bx + (b.lean + sw) * 0.9, cy = -b.h * 0.86, a = Math.atan2(b.lean, b.h);
        head += ' ' + poly(oval(cx, cy, 12, 35, a, 12)) + ' ' + poly(oval(cx, cy, 3.4, 16, a, 8));
      }
    }
    return { leaf, head };
  }
  function prop(ctx, source, o = {}) {
    const data = readData(source), t = o.t ?? 0, at = o.at ?? 0, until = o.until ?? 1e9;
    if (t < at - 0.6 || t >= until) return null;
    const size = o.size ?? 300, sc = size / 400, depth = o.depth ?? 0;
    let x = o.x ?? 960, face = o.face === 'left' || o.face === -1 ? -1 : 1, moving = false;
    for (const m of o.moves || []) if (t >= m.a) {
      const from = x; x = lerp(from, m.x, seg(t, m.a, m.b, E.sine));
      if (t < m.b) { face = m.x < from ? -1 : 1; moving = true; }
    }
    for (const g of o.gallops || []) if (t >= g.a && t < g.b) moving = true;
    const rise = 1 - seg(t, at - 0.6, at, E.quartOut), fade = until < 1e8 ? 1 - seg(t, until - 0.4, until) : 1;
    let rot = o.rot ?? 0, dy = rise * size * 0.5;
    for (const f of o.falls || []) if (t >= f.at - 0.6) {
      const q = seg(t, f.at - 0.6, f.at, E.expoIn); rot += q * 18; dy += q * size * 0.6;
    }
    const scale = sc * (1 + depth * 0.25), y = (o.y ?? 864) + dy;
    const paths = data.reeds ? reedPaths(data, t) : null;
    const horseLegX = [-112, -74, 72, 108];
    const env = {
      colors: {},
      path: (node) => {
        if (node.id === 'reedsLeaf') return paths.leaf;
        if (node.id === 'reedsHead') return paths.head;
        if (node.id === 'flagCloth') return blob([[4, -510], [90, -500 + Math.sin(t * 3) * 8], [170 + Math.sin(t * 2.4) * 6, -500], [176, -430 + Math.sin(t * 3.3) * 10], [176, -360], [90, -366 + Math.sin(t * 2.8) * 8], [4, -370]]);
        return undefined;
      },
      transform: (node) => {
        if (node.id === 'horseBody') return `translate(0 ${moving ? -Math.abs(Math.sin(t * 9)) * 14 : 0})`;
        if (node.id?.startsWith('horseLeg')) {
          const i = Number(node.id.slice(8));
          const angle = moving ? Math.sin(t * 9 + (i % 2 ? Math.PI : 0) + (i > 1 ? 1 : 0)) * 26 : 0;
          return `translate(${horseLegX[i]} -184) rotate(${angle})`;
        }
        if (node.id?.startsWith('fire')) {
          const i = Number(node.id.slice(4)), x0 = [-52, 0, 50][i] ?? 0;
          return `translate(${x0} 0) scale(1 ${0.86 + 0.14 * Math.sin(t * (5 + i) + i * 1.7)}) skewX(${7 * Math.sin(t * (3.1 + i * 0.7) + i)})`;
        }
        return null;
      },
    };
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha *= (1 - rise) * fade * (1 - depth * 0.3) * (o.alpha ?? 1);
    // blur 是可选特效；默认用透明度、尺度和层次表达 depth，避免全画幅滤镜。
    if (o.blur === true && depth + rise > 0.01) ctx.filter = `blur(${f1((depth + rise) * 6)}px)`;
    ctx.translate(x, y); ctx.scale(scale * face, scale); ctx.rotate(rot * Math.PI / 180);
    drawNode(ctx, data.tree, env);
    ctx.restore();
    if (o.text) {
      const fontSize = (o.textSize ?? 74) * sc / 0.75;
      TT.text(ctx, o.text, x + 90 * scale * face, y - 435 * scale, fontSize,
        { fontKey: 'sans-900', color: o.textColor ?? '#F6E7C8', align: 'center', baseline: 'middle' });
    }
    return { x, y, face, scale, saddle: data.kind === 'horse' ? 262 * sc : 0, moving };
  }

  /* ---------------- 蛇：爬行、昂首、吐信、斩断、分离与停颤 ---------------- */
  function snake(ctx, o = {}) {
    const t = o.t ?? 0, at = o.at ?? 0, until = o.until ?? 1e9;
    if (t < at - 0.7 || t >= until) return;
    const dir = o.face === 'left' || o.face === -1 ? -1 : 1;
    const len = o.len ?? 600, w0 = o.w ?? 46, N = 64, uc = 0.52;
    const cutAt = o.cut ?? 1e9, after = Math.max(0, t - cutAt), isCut = t >= cutAt;
    const rear = (o.rear ? seg(t, o.rear[0], o.rear[1], E.backOut) : 0) * (isCut ? 1 - seg(after, 0, 0.45, E.quartIn) : 1);
    const still = o.dead ? 0 : isCut ? Math.exp(-after * 1.3) * (1 + 1.6 * Math.exp(-after * 4)) : 1;
    const amp = (o.amp ?? 16) * still, ph = t * (o.speed ?? 2.4) * (isCut ? 2.2 : 1);
    const crawl = o.crawl ? o.crawl * Math.min(Math.max(0, t - at + 0.7), o.crawlFor ?? 99) : 0;
    const raw = (u) => {
      let x = o.x + dir * ((u - 0.5) * len + crawl), y = o.y + amp * Math.sin(u * TAU * (o.waves ?? 2.2) - ph) * (0.35 + 0.65 * u);
      if (u > 0.76) {
        const q = (u - 0.76) / 0.24, e = q * q * (3 - 2 * q);
        y -= rear * (o.rearH ?? 160) * e; x -= dir * rear * len * 0.07 * e;
      }
      return [x, y];
    };
    const width = (u) => w0 * (u < 0.5 ? 0.16 + 0.84 * Math.sin((u / 0.5) * Math.PI / 2) : u > 0.9 ? 0.82 : 1);
    const sep = isCut ? (o.sep ?? 70) * seg(after, 0, 0.5, E.quartOut) : 0;
    let half = 1;
    const tf = (p) => {
      if (!isCut && !o.dead) return p;
      const s = o.dead ? (o.sep ?? 70) : sep, c = raw(uc), a = half * dir * (o.dead ? 0.1 : 0.1 * seg(after, 0, 0.5));
      const dx = p[0] - c[0], dy = p[1] - c[1];
      return [c[0] + dx * Math.cos(a) - dy * Math.sin(a) + half * dir * s * (half > 0 ? 0.25 : 1), c[1] + dx * Math.sin(a) + dy * Math.cos(a)];
    };
    const point = (u, off) => {
      const a = raw(Math.max(0, u - 0.004)), b = raw(Math.min(1, u + 0.004)), c = raw(u);
      const tx = b[0] - a[0], ty = b[1] - a[1], len2 = Math.hypot(tx, ty) || 1;
      return tf([c[0] - (ty / len2) * off, c[1] + (tx / len2) * off]);
    };
    const dia = (x, y, r, a) => poly([[x + Math.cos(a) * r * 1.4, y + Math.sin(a) * r * 1.4], [x - Math.sin(a) * r, y + Math.cos(a) * r], [x - Math.cos(a) * r * 1.4, y - Math.sin(a) * r * 1.4], [x + Math.sin(a) * r, y - Math.cos(a) * r]]);
    let body = '', spine = '';
    for (const [u0, u1] of isCut || o.dead ? [[0, uc], [uc, 1]] : [[0, 1]]) {
      half = u1 <= uc ? -1 : 1;
      const nu = Math.round(N * (u1 - u0)) + 1, us = Array.from({ length: nu }, (_, i) => u0 + ((u1 - u0) * i) / (nu - 1));
      body += ' ' + poly(us.map((u) => point(u, width(u) / 2)).concat(us.map((u) => point(u, -width(u) / 2)).reverse()));
      for (let u = u0 + 0.03; u < u1 - 0.02; u += 0.028) {
        const a = raw(u - 0.004), b = raw(u + 0.004), angle = Math.atan2(b[1] - a[1], b[0] - a[0]), r = width(u) * 0.09;
        for (const k of [-0.24, 0, 0.24]) { const p = point(u + (k ? 0.014 : 0), width(u) * k); body += ' ' + dia(p[0], p[1], r, angle); }
      }
      const sp = us.filter((u) => u > 0.06);
      if (sp.length > 2) spine += ' ' + poly(sp.map((u) => point(u, -width(u) * 0.36)).concat(sp.map((u) => point(u, -width(u) * 0.46)).reverse()));
    }
    const hb = raw(0.985), hc = raw(1), angle = Math.atan2(hc[1] - hb[1], hc[0] - hb[0]); half = 1;
    const hp = tf([hc[0] + Math.cos(angle) * w0 * 0.55, hc[1] + Math.sin(angle) * w0 * 0.55]);
    body += ' ' + poly(oval(hp[0], hp[1], w0 * 0.95, w0 * 0.6, angle, 14));
    const ep = [hp[0] + Math.cos(angle) * w0 * 0.25 + Math.sin(angle) * w0 * 0.2, hp[1] + Math.sin(angle) * w0 * 0.25 - Math.cos(angle) * w0 * 0.2];
    const fin = seg(t, at - 0.7, at, E.quartOut), out = until < 1e8 ? 1 - seg(t, until - 0.4, until) : 1;
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha *= Math.min(fin, out) * (1 - (o.depth ?? 0) * 0.35);
    ctx.fillStyle = o.color ? LEATHER[o.color] ?? o.color : LEATHER.white; ctx.fill(P(body), 'evenodd');
    ctx.strokeStyle = INK; ctx.lineWidth = 2.8; ctx.lineJoin = 'round'; ctx.stroke(P(body));
    ctx.fillStyle = INK; ctx.globalAlpha *= 0.85; ctx.fill(P(spine)); ctx.globalAlpha /= 0.85;
    ctx.fillStyle = LEATHER.red; ctx.fill(P(poly(oval(ep[0], ep[1], w0 * 0.14, w0 * 0.11, angle, 10))));
    const tq = rear > 0.3 && !isCut ? Math.max(0, Math.sin(t * 9)) : 0;
    if (tq > 0.05) {
      const p0 = [hp[0] + Math.cos(angle) * w0 * 0.95, hp[1] + Math.sin(angle) * w0 * 0.95];
      const p1 = [p0[0] + Math.cos(angle) * w0 * 0.9 * tq, p0[1] + Math.sin(angle) * w0 * 0.9 * tq];
      const d = `M${f1(p0[0])} ${f1(p0[1])} L${f1(p1[0])} ${f1(p1[1])} M${f1(p1[0])} ${f1(p1[1])} l${f1(Math.cos(angle + 0.5) * w0 * 0.3)} ${f1(Math.sin(angle + 0.5) * w0 * 0.3)} M${f1(p1[0])} ${f1(p1[1])} l${f1(Math.cos(angle - 0.5) * w0 * 0.3)} ${f1(Math.sin(angle - 0.5) * w0 * 0.3)}`;
      ctx.strokeStyle = LEATHER.red; ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.stroke(P(d));
    }
    const sq = o.cut !== undefined ? seg(t, o.cut - 0.12, o.cut + 0.08) : 0, sf = o.cut !== undefined ? 1 - seg(t, o.cut + 0.1, o.cut + 0.45) : 0;
    if (sq > 0 && sf > 0) {
      const c = raw(uc), r = 170, a0 = -Math.PI * 0.85, a1 = a0 + Math.PI * 0.75 * sq;
      const pts = Array.from({ length: 13 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / 12; return [c[0] - dir * 40 + Math.cos(a) * r * dir, c[1] - 10 + Math.sin(a) * r + r * 0.5]; });
      ctx.strokeStyle = LEATHER.red; ctx.lineWidth = 12 * sf; ctx.globalAlpha *= sf; ctx.lineCap = 'round';
      ctx.stroke(P('M' + pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join(' L')));
    }
    ctx.restore();
  }

  /* ---------------- 幕布光场：冷 / 红整幅叠色，压暗留给文字之前 ---------------- */
  const SCREEN = { white: ['#FCF9F1', '#ECE2CE', '#8F7D64'], oil: ['#FFF0CF', '#EFC583', '#9E5E28'] };
  const GLOW = { red: ['#F9C8AE', '#D0634A', '#5E1E14'], cold: ['#E6E4DC', '#AEB0AA', '#4A4C4A'] };
  function lampAt(t, lamps = [], base = 1) {
    let v = base, col = 'warm', mix = { warm: 1, red: 0, cold: 0 };
    for (const L of lamps.slice().sort((a, b) => a.at - b.at)) {
      if (t < L.at - L.dur) break;
      const q = seg(t, L.at - L.dur, L.at, E.cubicInOut);
      v = lerp(v, L.to, q);
      if (L.color) { for (const k in mix) mix[k] = lerp(mix[k], k === L.color ? 1 : 0, q); if (q > 0.5) col = L.color; }
    }
    return { v, col, mix };
  }
  function light(ctx, W, H, o = {}) {
    const t = o.t ?? 0, L = lampAt(t, o.lamps || [], o.base ?? 1), v = o.variant ?? 0;
    const cx = [50, 42, 58, 50][v % 4] / 100, cy = [44, 40, 46, 38][v % 4] / 100;
    const rgba = (hex, alpha) => {
      const n = parseInt(hex.slice(1), 16);
      return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
    };
    ctx.save();
    for (const key of ['red', 'cold']) {
      const weight = L.mix[key]; if (weight <= 0.001) continue;
      const colors = GLOW[key];
      // 色灯先洗整幅幕布，再用超大、低对比柔光补一点灯位，不画聚焦椭圆。
      ctx.globalAlpha = weight * 0.32; ctx.fillStyle = colors[1]; ctx.fillRect(0, 0, W, H);
      const g = ctx.createRadialGradient(W * cx, H * cy, 0, W * cx, H * cy, Math.hypot(W, H) * 0.85);
      g.addColorStop(0, rgba(colors[0], 0.20)); g.addColorStop(0.6, rgba(colors[1], 0.07)); g.addColorStop(1, rgba(colors[2], 0));
      ctx.globalAlpha = weight; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
    const flick = 0.025 * Math.sin(t * 2.1) + 0.015 * Math.sin(t * 5.3 + 1.7);
    return { ...L, dark: clamp(1 - L.v + flick, 0, 0.92) };
  }
  function dim(ctx, W, H, dark) {
    if (!(dark > 0.001)) return;
    ctx.save(); ctx.fillStyle = `rgba(14,8,5,${clamp(dark, 0, 0.92).toFixed(4)})`; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  function lamp(lamps, at, o = {}) { lamps.push({ at, to: o.to ?? 1, dur: o.dur ?? 0.8, color: o.color }); }
  function change(lamps, at, dur = 0.9, o = {}) {
    lamp(lamps, at, { to: 0.08, dur: dur / 2 });
    lamp(lamps, at + dur / 2, { to: o.to ?? 1, dur: dur / 2, color: o.color });
  }

  /* ---------------- 签条与标题（底部两种字幕在下方单独冻结） ---------------- */
  function textWidth(ctx, text, size, fontKey) {
    ctx.save();
    if (typeof FONTS !== 'undefined') ctx.font = TT.font(FONTS, size, fontKey).css;
    const width = ctx.measureText(text).width;
    ctx.restore(); return width;
  }
  function placard(ctx, o = {}) {
    const t = o.t ?? 0, at = o.at ?? 0, until = o.until ?? 1e9;
    if (t < at - 0.4 || t >= until) return;
    const size = o.size ?? 54, vertical = !!o.vertical, fontKey = o.fontKey || 'sans-900';
    const q = seg(t, at - 0.4, at, E.backOut), out = until < 1e8 ? 1 - seg(t, until - 0.3, until) : 1;
    const hanging = o.hanging ?? (o.color !== 'black');
    const sw = hanging && o.swing !== false ? Math.sin((t - at) * 6) * 5 * Math.exp(-Math.max(0, t - at) * 2.2) : 0;
    const chars = [...o.text];
    const w = vertical ? size * 1.44 : textWidth(ctx, o.text, size, fontKey) + size * 0.9 + 6;
    const h = vertical ? chars.length * size * 1.15 + size * 0.8 : size * 1.15 + size * 0.36 + 6;
    const now = o.over;
    const x = (now ? now.x : (o.x ?? 960)) - (o.align === 'left' && !now ? 0 : w / 2);
    const y = now ? Math.max(36, now.top - 26 - h) : (o.y ?? 160) - h / 2;
    ctx.save(); ctx.globalAlpha *= Math.min(1, q * 1.4) * out;
    ctx.translate(x + w / 2, y + h / 2 - (1 - q) * 60); ctx.rotate(sw * Math.PI / 180);
    if (hanging) { ctx.strokeStyle = '#2A170C'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -h / 2 - 70); ctx.lineTo(0, -h / 2); ctx.stroke(); }
    ctx.shadowColor = 'rgba(30,10,4,.35)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
    ctx.fillStyle = o.color ? LEATHER[o.color] ?? o.color : '#B5321F'; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.shadowColor = 'transparent'; ctx.strokeStyle = '#3A140C'; ctx.lineWidth = 3; ctx.strokeRect(-w / 2, -h / 2, w, h);
    if (vertical) {
      chars.forEach((ch, i) => TT.text(ctx, ch, 0, -h / 2 + size * 0.4 + i * size * 1.15 + size * 0.5, size,
        { fontKey, color: '#F8E9C8', align: 'center', baseline: 'middle' }));
    } else {
      TT.text(ctx, o.text, 0, 1, size, { fontKey, color: '#F8E9C8', align: 'center', baseline: 'middle', maxWidth: w - size * 0.5 });
    }
    ctx.restore();
  }
  function title(ctx, o = {}) {
    const t = o.t ?? 0, at = o.at ?? 0, until = o.until ?? 1e9;
    if (t < at - 0.5 || t >= until) return;
    const q = seg(t, at - 0.5, at, E.cubicInOut), out = until < 1e8 ? 1 - seg(t, until - 0.4, until) : 1;
    const size = o.size ?? 120;
    ctx.save(); ctx.globalAlpha *= q * out; ctx.translate(o.x ?? 960, o.y ?? 420); ctx.scale(1.06 - 0.06 * q, 1.06 - 0.06 * q);
    if (q < 1) ctx.filter = `blur(${f1((1 - q) * 10)}px)`;
    TT.text(ctx, o.text, 0, 0, size, { fontKey: 'sans-900', color: '#22140B', align: o.align || 'center', baseline: 'middle' });
    ctx.restore();
  }
  function endcard(ctx, o = {}) {
    title(ctx, { text: o.title, at: o.at + 0.5, y: 450, size: 160, t: o.t });
    if (o.sub) placard(ctx, { text: o.sub, at: o.at + 1.4, y: 670, size: 46, swing: false, hanging: false, t: o.t });
    if (o.seal) {
      const q = seg(o.t, o.at + 2, o.at + 2.25, E.quartOut);
      if (q > 0) {
        ctx.save(); ctx.globalAlpha *= q; ctx.translate(1344, 280); ctx.scale(1.6 - 0.6 * q, 1.6 - 0.6 * q); ctx.rotate(-6 * Math.PI / 180);
        ctx.fillStyle = '#B5321F'; ctx.beginPath(); ctx.roundRect(-55, -55, 110, 110, 10); ctx.fill();
        TT.text(ctx, o.seal, 0, 0, 40, { fontKey: 'sans-900', color: '#F8E9C8', align: 'center', baseline: 'middle' });
        ctx.restore();
      }
    }
  }

  /* ---------------- 冻结的两种底部文字层：只换 cue / speaker ---------------- */
  function rounded(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function systemCaption(ctx, cue, o = {}) {
    if (!cue) return;
    const t = o.t ?? 0, k = seg(t, cue.start, cue.start + 0.25, E.cubicInOut);
    const W = o.W ?? 1920, H = o.H ?? 1080, bx = W * 0.14, by = H * 0.84, bw = W * 0.72, bh = 92;
    ctx.save(); ctx.globalAlpha *= k; ctx.translate(0, (1 - k) * 12);
    ctx.fillStyle = 'rgba(50,23,15,0.82)'; ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.strokeRect(bx, by, bw, bh);
    TT.text(ctx, cue.text, W * 0.5, by + bh * 0.5, 58 * RULES.scale.narration,
      { fontKey: 'sans-400', color: LIGHT, align: 'center', baseline: 'middle', maxWidth: bw - 40 });
    ctx.restore();
  }
  function dialogueCaption(ctx, cue, speaker, o = {}) {
    if (!cue) return;
    const t = o.t ?? 0, k = seg(t, cue.start, cue.start + 0.28, E.cubicInOut);
    const W = o.W ?? 1920, H = o.H ?? 1080, x = W * 0.10, y = H * 0.835, w = W * 0.80, h = 104;
    ctx.save(); ctx.globalAlpha *= k; ctx.translate(0, (1 - k) * 18);
    ctx.shadowColor = 'rgba(50,23,15,0.30)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 7;
    rounded(ctx, x, y, w, h, 12); ctx.fillStyle = 'rgba(247,226,181,0.96)'; ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.strokeStyle = '#7C472A'; ctx.lineWidth = 4; ctx.stroke();
    rounded(ctx, x + 10, y + 10, w - 20, h - 20, 7); ctx.strokeStyle = GOLD; ctx.lineWidth = 1.8; ctx.stroke();
    rounded(ctx, x + 30, y + 17, 214, 70, 7); ctx.fillStyle = '#9E3D2C'; ctx.fill();
    ctx.strokeStyle = '#32170F'; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 258, y + 24); ctx.lineTo(x + 258, y + 80); ctx.stroke();
    TT.text(ctx, speaker, x + 137, y + 54, 72 * RULES.scale.speaker,
      { fontKey: 'sans-900', color: LIGHT, align: 'center', baseline: 'middle', maxWidth: 176 });
    TT.text(ctx, cue.text, x + 292, y + 54, 72 * RULES.scale.dialogue,
      { fontKey: 'sans-400', color: '#32170F', align: 'left', baseline: 'middle', maxWidth: w - 340 });
    for (const dx of [18, w - 18]) {
      ctx.fillStyle = GOLD; ctx.beginPath(); ctx.moveTo(x + dx, y + h / 2 - 8); ctx.lineTo(x + dx + 7, y + h / 2); ctx.lineTo(x + dx, y + h / 2 + 8); ctx.lineTo(x + dx - 7, y + h / 2); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  TT.shadow = {
    TAU, clamp, lerp, f1, E, seg, poly, oval, curve, blob, strip, mixHex,
    colors: LEATHER, INK, HIDE, GOLD, LIGHT, SCREEN,
    P, readData, cast, drawNode, transform,
    steps, motion, handPos, puppet,
    prop, snake,
    lampAt, lamp, change, light, dim,
    placard, title, endcard,
    systemCaption, dialogueCaption,
  };
})();
