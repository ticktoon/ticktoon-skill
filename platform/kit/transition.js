/**
 * TT.transition —— 场面过渡。
 *
 * 协议层没有「两场同时活着」这回事：composition.scenes 是首尾相接的序列，
 * 每场独立绘制，所以这里**没有真正的 crossfade**。能做的是：
 *   - 出场：在本场最后一小段时间里，把成品帧盖向一个颜色（dip / wipe / push / ...）
 *   - 入场：在本场最开始一小段时间里，从颜色里揭开/推入/闪入
 * 两场之间靠「同一种中间色」接起来，就是电影里的 dip-to-color；不是叠化。
 *
 * 所有效果都画在场景内容的**最后**（字幕之后），因此过渡会盖住字幕，和真实胶片一致。
 * 快照类效果（push / page / zoom-out / glitch / zoom-punch）需要把已经画好的帧读回
 * 一个离屏画布；用 drawImage 而不是 getImageData，避免像素读回在不同后端上的差异。
 *
 * 所有噪声都是 p 与切片序号的纯函数，不碰 Math.random；同一帧两次调用结果一致。
 */
(() => {
  const TAU = Math.PI * 2;
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const smooth = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const noise = (i, seed) => {
    const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
  const styleColor = (name, fallback) => {
    try {
      if (typeof STYLE !== 'undefined' && STYLE && typeof TT.color === 'function') {
        const value = TT.color(STYLE, name);
        if (typeof value === 'string' && value) return value;
      }
    } catch {
      // style 缺色时用兜底色，过渡不能因为缺一个 token 就消失。
    }
    return fallback;
  };
  const bgColorOf = (g) => {
    if (g && typeof g.bg === 'string' && g.bg) return g.bg;
    return styleColor('bg', '#000000');
  };
  const colorOf = (g, value) => {
    if (value === 'ink') return styleColor('ink', '#353b3c');
    if (value === 'accent') return styleColor('accent', '#c66b57');
    if (typeof value === 'string' && HEX.test(value)) return value;
    // 'bg'、缺省值与未知 token 都落到场景背景色；未知值由 schema 提前告警。
    return bgColorOf(g);
  };
  const dirOf = (value) => (['l', 'r', 'u', 'd'].includes(value) ? value : 'l');
  const atOf = (g, value) => (Array.isArray(value) && value.length >= 2
    && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))
    ? [clamp01(Number(value[0])) * g.W, clamp01(Number(value[1])) * g.H]
    : [g.W / 2, g.H / 2]);

  const sceneDurOf = (g, o) => {
    const fromG = g && Number.isFinite(Number(g.dur)) ? Number(g.dur) : null;
    const fromO = Number.isFinite(Number(o.sceneDur)) ? Number(o.sceneDur) : null;
    return fromG != null ? fromG : fromO;
  };

  /** out 的进度：t 走进最后 dur 秒才开始；不到起点返回 0。 */
  function outProgress(g, o) {
    const dur = Number(o.dur);
    const sceneDur = sceneDurOf(g, o);
    if (!Number.isFinite(dur) || dur <= 0 || !Number.isFinite(sceneDur) || sceneDur <= 0) return 0;
    return clamp01((Number(o.t) - (sceneDur - dur)) / dur);
  }

  /** in 的进度：t=0 时效果最强，t>=dur 时结束。 */
  function inProgress(g, o) {
    const dur = Number(o.dur);
    if (!Number.isFinite(dur) || dur <= 0) return 1;
    return clamp01(Number(o.t) / dur);
  }

  function fill(ctx, W, H, color, alpha) {
    if (!(alpha > 0)) return;
    ctx.save();
    ctx.globalAlpha *= clamp01(alpha);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /** 把当前帧复制到逻辑尺寸的离屏画布；失败返回 null。 */
  function snapshot(ctx, W, H) {
    try {
      const src = ctx.canvas;
      if (!src) return null;
      let canvas = null;
      if (typeof OffscreenCanvas === 'function') {
        canvas = new OffscreenCanvas(W, H);
      } else if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
        canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
      }
      if (!canvas) return null;
      const c2 = canvas.getContext('2d');
      if (!c2) return null;
      c2.drawImage(src, 0, 0, src.width, src.height, 0, 0, W, H);
      return canvas;
    } catch {
      return null;
    }
  }

  function drawSnap(ctx, snap, W, H, alpha, dx = 0, dy = 0, scale = 1) {
    if (!snap || !(alpha > 0)) return;
    ctx.save();
    ctx.globalAlpha *= clamp01(alpha);
    const dw = W * scale;
    const dh = H * scale;
    ctx.drawImage(snap, (W - dw) / 2 + dx, (H - dh) / 2 + dy, dw, dh);
    ctx.restore();
  }

  /** 快照不可用时退化成同色擦除，保留时长与方向语义。 */
  function coverByDir(ctx, W, H, color, p, dir) {
    const k = smooth(p);
    ctx.save();
    ctx.globalAlpha *= 1;
    ctx.fillStyle = color;
    if (dir === 'r') ctx.fillRect(0, 0, W * k, H);
    else if (dir === 'u') ctx.fillRect(0, H - H * k, W, H * k);
    else if (dir === 'd') ctx.fillRect(0, 0, W, H * k);
    else ctx.fillRect(W - W * k, 0, W * k, H);
    ctx.restore();
  }

  /** 页边阴影：在覆盖面板的推进边上压一条 26px 的暗边。 */
  function pageEdge(ctx, W, H, color, p, dir) {
    const k = smooth(p);
    const band = Math.max(16, Math.min(W, H) * 0.03);
    ctx.save();
    ctx.fillStyle = color;
    let grad = null;
    if (dir === 'r' || dir === 'l') {
      const x = dir === 'r' ? W * k : W - W * k;
      if (dir === 'r') ctx.fillRect(0, 0, x, H);
      else ctx.fillRect(x, 0, W - x, H);
      const x0 = dir === 'r' ? Math.max(0, x - band) : x;
      const x1 = dir === 'r' ? x : Math.min(W, x + band);
      grad = ctx.createLinearGradient(x0, 0, x1, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.38)');
      if (dir === 'l') {
        grad = ctx.createLinearGradient(x1, 0, x0, 0);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.38)');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(Math.min(x0, x1), 0, Math.abs(x1 - x0), H);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(dir === 'r' ? x - 1 : x, 0, 1, H);
    } else {
      const y = dir === 'd' ? H * k : H - H * k;
      if (dir === 'd') ctx.fillRect(0, 0, W, y);
      else ctx.fillRect(0, y, W, H - y);
      const y0 = dir === 'd' ? Math.max(0, y - band) : y;
      const y1 = dir === 'd' ? y : Math.min(H, y + band);
      grad = ctx.createLinearGradient(0, y0, 0, y1);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.38)');
      if (dir === 'u') {
        grad = ctx.createLinearGradient(0, y1, 0, y0);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.38)');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0));
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(0, dir === 'd' ? y - 1 : y, W, 1);
    }
    ctx.restore();
  }

  function glitch(ctx, snap, g, o, p, mode) {
    const W = g.W;
    const H = g.H;
    const color = colorOf(g, o.color);
    const e = mode === 'out' ? smooth(p) : 1 - smooth(p);
    const baseAlpha = mode === 'out' ? 1 - smooth(p) : 0.92 * (1 - smooth(p));
    fill(ctx, W, H, color, mode === 'out' ? 1 : baseAlpha);
    if (snap) {
      const slices = 11;
      const off = Math.max(2, W * 0.055) * e;
      const alpha = mode === 'out' ? Math.max(0, 1 - smooth(p)) : Math.max(0, 0.75 * (1 - smooth(p)));
      ctx.save();
      ctx.globalAlpha *= alpha;
      for (let i = 0; i < slices; i += 1) {
        const sy = Math.floor(H * i / slices);
        const sh = Math.ceil(H / slices) + 1;
        const jitter = (noise(i + 3, p * 9 + 1) - 0.5) * 2 * off;
        ctx.drawImage(snap, 0, sy, W, sh, jitter, sy + (mode === 'in' ? (noise(i + 7, p * 7) - 0.5) * 2 * off * 0.35 : 0), W, sh);
      }
      ctx.restore();
      if (mode === 'in' && p < 1) {
        ctx.save();
        ctx.globalAlpha *= Math.max(0, 1 - smooth(p));
        for (let i = 0; i < 4; i += 1) {
          const y = H * (0.12 + i * 0.22) + (noise(i + 21, p * 5) - 0.5) * H * 0.08;
          const h = 2 + noise(i + 31, p * 8) * 5;
          ctx.fillStyle = i % 2 ? 'rgba(255,45,149,0.42)' : 'rgba(0,229,255,0.42)';
          ctx.fillRect(0, y, W, h);
        }
        ctx.restore();
      }
    }
    if (mode === 'out' && p >= 0.985) fill(ctx, W, H, color, 1);
    return true;
  }

  function outEffect(g, ctx, o, p) {
    const W = g.W;
    const H = g.H;
    const color = colorOf(g, o.color);
    const dir = dirOf(o.dir);
    const type = o.type;

    if (type === 'dip-to-color') {
      fill(ctx, W, H, color, smooth(p));
      return true;
    }
    if (type === 'wipe') {
      coverByDir(ctx, W, H, color, p, dir);
      return true;
    }
    if (type === 'push' || type === 'page' || type === 'zoom-out') {
      const snap = snapshot(ctx, W, H);
      if (!snap) {
        // 没有快照能力时不假装推镜：退化成同方向的色块擦除，时长仍然成立。
        coverByDir(ctx, W, H, color, p, dir);
        return true;
      }
      if (type === 'push') {
        fill(ctx, W, H, color, 1);
        const k = smooth(p);
        let dx = 0;
        let dy = 0;
        if (dir === 'l') dx = -W * k;
        else if (dir === 'r') dx = W * k;
        else if (dir === 'u') dy = -H * k;
        else dy = H * k;
        drawSnap(ctx, snap, W, H, 1, dx, dy);
        return true;
      }
      if (type === 'page') {
        pageEdge(ctx, W, H, color, p, dir);
        return true;
      }
      // zoom-out：成品帧向中心缩，同时淡出到背景色。
      fill(ctx, W, H, color, 1);
      drawSnap(ctx, snap, W, H, 1 - smooth(p), 0, 0, 1 - 0.18 * smooth(p));
      return true;
    }
    if (type === 'glitch') {
      return glitch(ctx, snapshot(ctx, W, H), g, o, p, 'out');
    }
    return false;
  }

  function inEffect(g, ctx, o, p) {
    const W = g.W;
    const H = g.H;
    const color = colorOf(g, o.color);
    const dir = dirOf(o.dir);
    const type = o.type;

    if (type === 'fade-in') {
      fill(ctx, W, H, color, 1 - smooth(p));
      return true;
    }
    if (type === 'iris') {
      const k = smooth(p);
      const [cx, cy] = atOf(g, o.at);
      const R = Math.hypot(W, H) * 0.53;
      const r = R * k;
      if (r >= Math.hypot(W, H) * 0.52) return false;
      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.arc(cx, cy, Math.max(0.01, r), 0, TAU);
      ctx.fill('evenodd');
      ctx.restore();
      return true;
    }
    if (type === 'zoom-punch') {
      const snap = snapshot(ctx, W, H);
      if (!snap) {
        fill(ctx, W, H, color, 1 - smooth(p));
        return true;
      }
      const k = smooth(p);
      fill(ctx, W, H, color, 1);
      drawSnap(ctx, snap, W, H, 1, 0, 0, 1.14 - 0.14 * k);
      return true;
    }
    if (type === 'glitch-in') {
      return glitch(ctx, snapshot(ctx, W, H), g, o, p, 'in');
    }
    return false;
  }

  const OUT = [
    { id: 'cut', desc: '硬切：不画任何东西（严格 no-op）', when: '节奏本来就该断开时；这是默认' },
    { id: 'dip-to-color', desc: '本场淡到单色；下一场用 fade-in 从同色淡出', when: '章节、时间跳跃；两场接成一次完整的 dip' },
    { id: 'wipe', desc: '单色色块沿 dir 擦过画面', when: '需要比硬切更明确、又不想动的段落' },
    { id: 'push', desc: '整帧向 dir 滑出，后面露出单色', when: '换地点、换章节的推进感' },
    { id: 'page', desc: '像翻页一样压过画面，边缘带阴影', when: '翻页/翻章；比 wipe 更有纸张感' },
    { id: 'zoom-out', desc: '整帧缩小并淡到单色', when: '收束、抽离、结束一段观察' },
    { id: 'glitch', desc: '切片错位 + 通道色条，收束到单色', when: '故障、数据中断、强转折；别连续用' },
  ];
  const IN = [
    { id: 'cut', desc: '硬切：不画任何东西（严格 no-op）', when: '默认；上一场已经干净收尾时' },
    { id: 'fade-in', desc: '从单色淡出到本场画面', when: '接 dip-to-color；或从黑场开场' },
    { id: 'iris', desc: '圆形窗口从 at 处张开', when: '聚焦一个点、侦探式揭示；at 是归一化圆心' },
    { id: 'zoom-punch', desc: '画面从 1.14 倍落回 1.0', when: '开场冲击、强调结论；和 push 不要连用' },
    { id: 'glitch-in', desc: '切片错位 + 色条，收束到正常画面', when: '数据/故障主题开场；一场只用一次' },
  ];

  TT.transition = {
    list() {
      return {
        out: OUT.map((item) => ({ ...item })),
        in: IN.map((item) => ({ ...item })),
      };
    },

    out(g, ctx, o = {}) {
      if (!g || !ctx || !o || typeof o.type !== 'string') return null;
      if (o.type === 'cut') return null;
      const p = outProgress(g, o);
      if (!(p > 0)) return null;
      return outEffect(g, ctx, o, p) ? { p } : null;
    },

    in(g, ctx, o = {}) {
      if (!g || !ctx || !o || typeof o.type !== 'string') return null;
      if (o.type === 'cut') return null;
      const p = inProgress(g, o);
      if (p >= 1) return null;
      return inEffect(g, ctx, o, p) ? { p } : null;
    },
  };
})();
