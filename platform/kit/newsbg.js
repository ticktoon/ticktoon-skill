/**
 * TT.newsBg —— 新闻公共背景：径向蓝底 + 世界地图 + 固定网格 + 种子流动线。
 *
 * 背景只负责氛围，不画任何文字。地图图片由调用方从本场资源里取好再传进来；
 * 资源未就绪时跳过地图层，其余层照常画。所有随机参数由 seed 固定，同一时刻
 * 同一画幅逐像素一致，不依赖墙钟或帧间状态。
 *
 * 其他新闻配方要复用同一套底时，在 scene.resources 里声明 world-map 图片，
 * 再把 api.img(...) 的结果作为 `image` 传进来即可。
 */
(() => {
  const FLOW_COUNT = 10;
  const FLOW_SEED = 7;
  const cache = new Map();

  function flowsFor(W, H, seed) {
    const key = `${Math.round(W)}x${Math.round(H)}:${seed}`;
    if (cache.has(key)) return cache.get(key);
    const rng = TT.rng(seed);
    const s = Math.min(W, H) / 1080;
    const pad = 200 * s;
    const lines = [];
    for (let i = 0; i < FLOW_COUNT; i += 1) {
      lines.push({
        length: (400 + rng() * 200) * s,
        speed: (80 + rng() * 300) * s,
        angle: (rng() * 2 - 1) * 0.7,
        alpha: 0.35 + rng() * 0.3,
        x: rng() * (W + pad * 2) - pad,
        y: rng() * (H + pad * 2) - pad,
      });
    }
    const entry = { s, pad, lines };
    cache.set(key, entry);
    return entry;
  }

  function wrap(value, size, pad) {
    const span = size + pad * 2;
    return ((value + pad) % span + span) % span - pad;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ W:number, H:number, image?:CanvasImageSource|null, time?:number,
   *           mapAlpha?:number, grid?:number, seed?:number, alpha?:number }} opts
   */
  function paint(ctx, {
    W, H, image = null, time = 0, mapAlpha = 0.3, grid = 120, seed = FLOW_SEED, alpha = 1,
  } = {}) {
    const { s, pad, lines } = flowsFor(W, H, seed);

    // 1. 径向蓝底：亮心在上方，四角压到近黑蓝。
    const radius = Math.hypot(W * 0.5, H * 0.85);
    const bg = ctx.createRadialGradient(W * 0.5, H * 0.15, 0, W * 0.5, H * 0.15, radius);
    bg.addColorStop(0, '#0078f2');
    bg.addColorStop(0.4, '#0048c2');
    bg.addColorStop(0.7, '#002277');
    bg.addColorStop(1, '#000f42');
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // 2. 世界地图：contain 进 0.9W × 0.45H 的框，框本身在画布正中央。
    if (image) {
      const iw = image.naturalWidth || image.width || 0;
      const ih = image.naturalHeight || image.height || 0;
      if (iw > 0 && ih > 0) {
        const bw = W * 0.9;
        const bh = H * 0.45;
        const k = Math.min(bw / iw, bh / ih);
        const dw = iw * k;
        const dh = ih * k;
        ctx.save();
        ctx.globalAlpha = mapAlpha * alpha;
        ctx.drawImage(image, (W - dw) / 2, (H - dh) / 2, dw, dh);
        ctx.restore();
      }
    }

    // 3. 120px 网格：newsroom 坐标纸，压在地图之上、文字之下。
    const step = grid * s;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = s;
    ctx.beginPath();
    for (let x = 0; x <= W; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let y = 0; y <= H; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
    ctx.restore();

    // 4. 十条种子流动线：方向、长度、速度、透明度都由 seed 固定。
    ctx.save();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.8 * s;
    for (const line of lines) {
      const x = wrap(line.x + Math.cos(line.angle) * line.speed * time, W, pad);
      const y = wrap(line.y + Math.sin(line.angle) * line.speed * time, H, pad);
      ctx.globalAlpha = line.alpha * alpha;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(line.angle) * line.length, y + Math.sin(line.angle) * line.length);
      ctx.stroke();
    }
    ctx.restore();
  }

  TT.newsBg = { paint };
})();
