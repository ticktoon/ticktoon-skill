/**
 * TT.geom —— 相机、安全框与反像采样。
 *
 * code 场过去各自抄一套 SAFE / FRAME / ZOOM 与 256 点反像采样；符号抄错就会把
 * 内容推出安全框，而画面检查只能指出"越界"，说不出"相机算错"。这里把整条推导
 * 收成纯函数：不读写 ctx、不依赖绘制状态，所有场景拿到同一套数值。
 *
 * 坐标约定（与 whiteboard 样片的原实现逐值一致）：
 *   屏幕 = focus + (场景 - focus) * scale
 *   反像 = focus + (屏幕 - focus) / scale
 * 只有 scale > 1 的采样点参与收缩；scale <= 1 时安全框本身就是最大可行区。
 *
 * 边界行为：缺省/脏参数不抛异常。keyframes 的非法时长按 0.001s，非法 mode 按
 * 'in'，非法 focus 按 0.5；camera 的空帧表按静止 1×/中心；preimage 的 samples
 * 非正整数按 256（上限 4096），没有 safe 时按默认边距现算。
 */
(() => {
  const DEFAULT_LIMIT = 2;
  const DEFAULT_MARGIN = 0.06;
  const DEFAULT_SAMPLES = 256;
  const MAX_SAMPLES = 4096;
  const finite = (value) => typeof value === 'number' && Number.isFinite(value);
  const clamp01 = (value) => TT.clamp01(value);
  const clampScale = (value, limit) => Math.min(limit, Math.max(0.01, value));
  const clampFocus = (value, fallback) => (finite(value) ? clamp01(value) : fallback);
  const limitOf = (zoom) => (finite(zoom && zoom.limit) && zoom.limit >= 0.01 ? zoom.limit : DEFAULT_LIMIT);
  const objectOf = (value) => (value && typeof value === 'object' ? value : {});

  /** 归一化矩形：接受 {x,y,w,h} 或 {x0,y0,x1,y1}；非有限/缺字段返回 null。 */
  const rectOf = (rect) => {
    if (!rect || typeof rect !== 'object') return null;
    if (finite(rect.x) && finite(rect.y) && finite(rect.w) && finite(rect.h)) {
      return { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
    }
    if (finite(rect.x0) && finite(rect.y0) && finite(rect.x1) && finite(rect.y1)) {
      return { x: rect.x0, y: rect.y0, w: rect.x1 - rect.x0, h: rect.y1 - rect.y0 };
    }
    return null;
  };

  /** RULES 只在 code 场注入；params 模板没有 RULES 时退回样片的 0.06。 */
  const defaultMargin = () => {
    if (typeof RULES !== 'undefined' && RULES && finite(RULES.safeMargin)) return clamp01(RULES.safeMargin);
    return DEFAULT_MARGIN;
  };

  /** 安全框（屏幕坐标）。`m` 是归一化边距，缺省取 RULES.safeMargin。 */
  function safeBox(options) {
    const opts = objectOf(options);
    const W = finite(opts.W) && opts.W > 0 ? opts.W : 0;
    const H = finite(opts.H) && opts.H > 0 ? opts.H : 0;
    const m = finite(opts.m) ? clamp01(opts.m) : defaultMargin();
    const x0 = W * m;
    const y0 = H * m;
    // 与样片的 SAFE.x + SAFE.w 保持同一表达式顺序，避免最后一两个 ULP 漂移。
    const x1 = W * (m + (1 - m * 2));
    const y1 = H * (m + (1 - m * 2));
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }

  /** 把 {mode,from,to,focus,beats} 展开成关键帧；与样片的 zoomKeyframes 逐值一致。 */
  function keyframes(zoom, dur) {
    const raw = objectOf(zoom);
    const mode = ['none', 'in', 'out', 'pan'].includes(raw.mode) ? raw.mode : 'in';
    const span = finite(dur) && dur > 0 ? Math.max(0.001, dur) : 0.001;
    const limit = limitOf(raw);
    if (mode === 'none') {
      return [{ at: 0, dur: span, scale: 1, fx: 0.5, fy: 0.5 }];
    }
    const from = finite(raw.from) ? clampScale(raw.from, limit) : 1;
    const defaultTo = mode === 'out' ? 0.92 : 1.08;
    const to = finite(raw.to) ? clampScale(raw.to, limit) : defaultTo;
    const focus = Array.isArray(raw.focus) ? raw.focus : [];
    const fx0 = clampFocus(focus[0], 0.5);
    const fy0 = clampFocus(focus[1], 0.5);
    const beats = Array.isArray(raw.beats) ? raw.beats : [];
    if (!beats.length) {
      return [{
        at: 0,
        dur: span,
        from, to,
        fxFrom: mode === 'pan' ? 0.5 : fx0,
        fyFrom: mode === 'pan' ? 0.5 : fy0,
        fxTo: fx0, fyTo: fy0,
      }];
    }
    const frames = [{ at: 0, dur: 0, scale: from, fx: fx0, fy: fy0, hold: true }];
    for (const beat of beats) {
      if (!beat || !finite(beat.at) || !finite(beat.scale)) continue;
      const bf = Array.isArray(beat.focus) ? beat.focus : [];
      const prev = frames[frames.length - 1];
      frames.push({
        at: Math.max(0, beat.at),
        dur: finite(beat.dur) && beat.dur > 0 ? beat.dur : 1.2,
        scale: clampScale(beat.scale, limit),
        fx: clampFocus(bf[0], prev.fx),
        fy: clampFocus(bf[1], prev.fy),
      });
    }
    return frames;
  }

  /** 关键帧在 now 时刻的相机：返回归一化 {scale,fx,fy}；与样片的 zoomAt 逐值一致。 */
  function camera(frames, now) {
    const list = Array.isArray(frames) ? frames : [];
    if (!list.length) return { scale: 1, fx: 0.5, fy: 0.5 };
    const at = finite(now) ? now : 0;
    let cur = list[0];
    if (!cur || typeof cur !== 'object') return { scale: 1, fx: 0.5, fy: 0.5 };
    for (let i = 1; i < list.length; i += 1) {
      const frame = list[i];
      if (frame && at >= frame.at) cur = frame; else break;
    }
    const curDur = finite(cur.dur) ? cur.dur : 0;
    if (cur.hold || curDur === 0 || (list.length === 1 && cur.to === undefined)) {
      return {
        scale: finite(cur.scale) ? cur.scale : 1,
        fx: finite(cur.fx) ? cur.fx : 0.5,
        fy: finite(cur.fy) ? cur.fy : 0.5,
      };
    }
    if (cur.to !== undefined) {
      const from = finite(cur.from) ? cur.from : 1;
      const to = finite(cur.to) ? cur.to : from;
      const k = TT.ease.inOutCubic(clamp01(at / curDur));
      const fxf = finite(cur.fxFrom) ? cur.fxFrom : 0.5;
      const fxt = finite(cur.fxTo) ? cur.fxTo : fxf;
      const fyf = finite(cur.fyFrom) ? cur.fyFrom : 0.5;
      const fyt = finite(cur.fyTo) ? cur.fyTo : fyf;
      return {
        scale: from + (to - from) * k,
        fx: fxf + (fxt - fxf) * k,
        fy: fyf + (fyt - fyf) * k,
      };
    }
    const idx = list.indexOf(cur);
    const prev = list[idx - 1] || cur;
    const prevScale = finite(prev.scale) ? prev.scale : 1;
    const prevFx = finite(prev.fx) ? prev.fx : 0.5;
    const prevFy = finite(prev.fy) ? prev.fy : 0.5;
    const curScale = finite(cur.scale) ? cur.scale : 1;
    const curFx = finite(cur.fx) ? cur.fx : 0.5;
    const curFy = finite(cur.fy) ? cur.fy : 0.5;
    const curAt = finite(cur.at) ? cur.at : 0;
    const k = TT.ease.inOutCubic(clamp01((at - curAt) / curDur));
    return {
      scale: prevScale + (curScale - prevScale) * k,
      fx: prevFx + (curFx - prevFx) * k,
      fy: prevFy + (curFy - prevFy) * k,
    };
  }

  /**
   * 安全框在场景坐标里的可行矩形：沿时间采样，把每个采样点的安全框按相机反像
   * 回场景坐标，求交集。返回 {x,y,w,h,minScale,fit}——内容（frameRect）放进去
   * 后，任意时刻都不会被相机推出安全框。
   */
  function preimage(options) {
    const opts = objectOf(options);
    const list = Array.isArray(opts.frames) ? opts.frames : [];
    const pxW = finite(opts.W) && opts.W > 0 ? opts.W : 0;
    const pxH = finite(opts.H) && opts.H > 0 ? opts.H : 0;
    const duration = finite(opts.dur) && opts.dur > 0 ? opts.dur : 0;
    let safe = rectOf(opts.safe);
    if (!safe) {
      const box = safeBox({ W: pxW, H: pxH, m: opts.m });
      safe = { x: box.x0, y: box.y0, w: box.x1 - box.x0, h: box.y1 - box.y0 };
    }
    const box = { x: safe.x, y: safe.y, w: safe.w, h: safe.h };

    // 采样点顺序与样片一致：端点 → 每个关键帧的起止 → 均匀 256 点。
    const times = new Set([0, duration]);
    for (const frame of list) {
      if (!frame || !finite(frame.at)) continue;
      times.add(Math.min(duration, Math.max(0, frame.at)));
      if (finite(frame.dur) && frame.dur > 0) times.add(Math.min(duration, frame.at + frame.dur));
    }
    const n = finite(opts.samples) && opts.samples >= 1
      ? Math.min(MAX_SAMPLES, Math.floor(opts.samples))
      : DEFAULT_SAMPLES;
    for (let i = 0; i <= n; i += 1) times.add((i / n) * duration);

    let minScale = Infinity;
    for (const st of times) {
      const zz = camera(list, st);
      const zv = finite(zz.scale) ? zz.scale : 1;
      if (finite(zv)) minScale = Math.min(minScale, zv);
      if (!(zv > 1)) continue;
      const fxv = clamp01(finite(zz.fx) ? zz.fx : 0.5) * pxW;
      const fyv = clamp01(finite(zz.fy) ? zz.fy : 0.5) * pxH;
      const qx0 = fxv + (safe.x - fxv) / zv;
      const qx1 = fxv + (safe.x + safe.w - fxv) / zv;
      const qy0 = fyv + (safe.y - fyv) / zv;
      const qy1 = fyv + (safe.y + safe.h - fyv) / zv;
      const right = Math.min(box.x + box.w, qx1);
      const bottom = Math.min(box.y + box.h, qy1);
      box.x = Math.max(box.x, qx0);
      box.y = Math.max(box.y, qy0);
      box.w = right - box.x;
      box.h = bottom - box.y;
    }

    const frame = rectOf(opts.frame);
    const fit = frame && frame.w > 0 && frame.h > 0
      ? Math.min(box.w / frame.w, box.h / frame.h)
      : (pxW > 0 && pxH > 0 ? Math.min(box.w / pxW, box.h / pxH) : 1);
    return { x: box.x, y: box.y, w: box.w, h: box.h, minScale: finite(minScale) ? minScale : 1, fit };
  }

  /**
   * 把内容框等比缩放进安全框：返回 {scale,dx,dy}，按
   * `translate(dx,dy); scale(scale,scale)` 使用。两个矩形都接受
   * {x,y,w,h} 或 {x0,y0,x1,y1}；非法尺寸退化为 1×/左上对齐。
   */
  function fit(frameRect, safeRect) {
    const f = rectOf(frameRect);
    const s = rectOf(safeRect);
    const sx = s ? s.x : 0;
    const sy = s ? s.y : 0;
    if (!f || !s || !(f.w > 0) || !(f.h > 0) || !(s.w > 0) || !(s.h > 0)) {
      return { scale: 1, dx: sx, dy: sy };
    }
    let scale = Math.min(s.w / f.w, s.h / f.h);
    if (!finite(scale)) scale = 1;
    return {
      scale,
      dx: s.x + (s.w - f.w * scale) / 2 - f.x * scale,
      dy: s.y + (s.h - f.h * scale) / 2 - f.y * scale,
    };
  }

  TT.geom = { safeBox, keyframes, camera, preimage, fit };
})();
