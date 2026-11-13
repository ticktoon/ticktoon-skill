/**
 * TT.transition —— 双帧场间合成。
 *
 * 编译器把 A + B 展开为 (A-D/2) + T(D) + (B-D/2)。T 是独立的 composition
 * code scene，持有前后场的完整 draw 函数；本 kit 只负责把两张完整 Canvas 合成，
 * 不认识字幕、人物或场景内容。声音仍使用原始 A/B 时间轴。
 *
 * create() 在场景初始化时创建两张离屏画布；每帧完全清屏重绘，不保留帧间历史。
 * 使用 drawImage / clip / Path2D / globalAlpha，不做像素回读，不碰 Math.random。
 * 图案转场参考 GL Transitions，以确定性的 Canvas 路径和切片实现，不执行 GLSL。
 */
(() => {
  const TAU = Math.PI * 2;
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const smooth = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const smoothstep = (edge0, edge1, value) => {
    const t = clamp01((value - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
  };
  const noise = (i, p) => {
    const x = Math.sin(i * 127.1 + p * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  const PRESETS = [
    { id: 'dip-fade', dur: 0.35, desc: '前后场直接交叉淡化，不经过黑屏或暗场', when: '柔和衔接、连续叙事、章节切换' },
    { id: 'wipe-left', dur: 0.5, desc: '后场从右向左擦入，前场保留在底层', when: '利落的横向段落切换' },
    { id: 'wipe-up', dur: 0.5, desc: '后场从下向上擦入，前场保留在底层', when: '榜单上升、层级递进' },
    { id: 'push-left', dur: 0.55, desc: '前后场同步向左推移，画面始终拼接', when: '换地点、横向推进' },
    { id: 'push-up', dur: 0.55, desc: '前后场同步向上推移，画面始终拼接', when: '上升、升级、纵向推进' },
    { id: 'zoom-pop', dur: 0.55, desc: '前场缩小淡出，后场推近落定', when: '强调新结论、节奏转折' },
    { id: 'glitch', dur: 0.45, desc: '前场故障切片消散，后场恢复', when: '数据中断、强转折；不要连续使用' },
    { id: 'iris', dur: 0.65, desc: '圆形窗口直接揭示后场', when: '聚焦、揭示、观察对象切换' },
    { id: 'page-turn', dur: 0.8, desc: '自适应画幅方向，连续圆柱弧面与透视镜像纸背，无高光', when: '章节翻篇、文档、书本、故事推进' },
    { id: 'squares-wire', dur: 0.6, desc: '10×10 圆角方格按原 shader 的 smoothness 从左上向右下逐渐填满，最终无空隙', when: '科技、模块化内容、界面切换' },
    { id: 'morph', dur: 0.7, desc: '双帧分条错位、波形扭曲并交叉淡化', when: '形态变化、柔和变形、概念转化' },
  ];

  function makeCanvas(W, H) {
    if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(W, H);
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      return canvas;
    }
    return null;
  }

  function renderFrame(canvas, frame) {
    const c = canvas.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.save();
    try {
      frame.draw(c, frame.api);
    } finally {
      c.restore();
    }
    return canvas;
  }

  function paint(ctx, image, W, H, {
    alpha = 1, dx = 0, dy = 0, scale = 1, clip = null,
  } = {}) {
    if (!(alpha > 0)) return;
    ctx.save();
    ctx.globalAlpha *= clamp01(alpha);
    if (clip) {
      ctx.beginPath();
      const path = clip(ctx);
      if (path) ctx.clip(path);
      else ctx.clip();
    }
    const dw = W * scale;
    const dh = H * scale;
    ctx.drawImage(image, (W - dw) / 2 + dx, (H - dh) / 2 + dy, dw, dh);
    ctx.restore();
  }

 /**
 * page-turn：斜向圆柱卷曲，纸背沿折线镜像前场。
 * 固定从右下角卷向左上；无方向参数。
 */
function pageTurn(ctx, a, b, W, H, progress) {
  const MIN_AMOUNT = -0.16;
  const MAX_AMOUNT = 1.5;
  const cylinderRadius = 1 / (2 * Math.PI);
  const amount = progress * (MAX_AMOUNT - MIN_AMOUNT) + MIN_AMOUNT;
  const angle = 100 * Math.PI / 180;
  const ax = -Math.sin(angle);
  const ay = Math.cos(angle);

  const rawMin = 1 + ax + ay;
  const rawRange = 1 - rawMin;
  const front = (amount - MIN_AMOUNT) / (MAX_AMOUNT - MIN_AMOUNT);
  const curlWidth = cylinderRadius / (MAX_AMOUNT - MIN_AMOUNT);
  const back = front - curlWidth;
  const lineX = (position, y) => {
    const raw = rawMin + position * rawRange;
    return W * (raw - 1 - ay * y / H) / ax;
  };
  const bandPath = (high, low) => {
    const path = new Path2D();
    path.moveTo(lineX(high, 0), 0);
    path.lineTo(lineX(high, H), H);
    path.lineTo(lineX(low, H), H);
    path.lineTo(lineX(low, 0), 0);
    path.closePath();
    return path;
  };

  // B 是被纸张覆盖的下层；A 只保留圆柱折线前方尚未翻起的平面。
  paint(ctx, b, W, H);
  paint(ctx, a, W, H, { clip: () => bandPath(1.2, front) });

  const energy = Math.sin(Math.PI * progress);
  const middle = H / 2;
  ctx.save();

  // 卷边在后场上的柔和投影（加宽到 0.09，减少窄折角感）。
  const shadowWidth = 0.09;
  const shadow = ctx.createLinearGradient(lineX(back, middle), 0, lineX(back - shadowWidth, middle), 0);
  shadow.addColorStop(0, `rgba(0,0,0,${0.34 * energy})`);
  shadow.addColorStop(0.45, `rgba(0,0,0,${0.13 * energy})`);
  shadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadow;
  ctx.fill(bandPath(back, back - shadowWidth));

  // 纸背沿斜向折线完整镜像 A。仿射反射替代分条复制。
  const foldTop = lineX(front, 0);
  const foldSkew = (lineX(front, H) - foldTop) / H;
  ctx.save();
  ctx.clip(bandPath(front, back));
  ctx.transform(-1, 0, 2 * foldSkew, 1, 2 * foldTop, 0);
  // 后段折线移出左缘后延展左缘，禁止底层 B 透进纸背。
  ctx.drawImage(a, 0, 0, 1, H, -W, 0, W, H);
  ctx.drawImage(a, 0, 0, W, H);
  ctx.restore();

  // 薄纸色 + 圆柱明暗叠加在镜像上，沿卷带连续渐变。
  ctx.fillStyle = 'rgba(255,249,235,0.07)';
  ctx.fill(bandPath(front, back));
  const curlShade = ctx.createLinearGradient(lineX(front, middle), 0, lineX(back, middle), 0);
  curlShade.addColorStop(0, 'rgba(15,14,13,0.46)');
  curlShade.addColorStop(0.16, 'rgba(20,19,17,0.12)');
  curlShade.addColorStop(0.5, 'rgba(20,19,17,0)');
  curlShade.addColorStop(1, 'rgba(15,14,13,0.34)');
  ctx.fillStyle = curlShade;
  ctx.fill(bandPath(front, back));

  // 前场靠近折线处变暗，模拟纸面离开底层的遮蔽。
  const frontShadeWidth = 0.06;
  const frontShade = ctx.createLinearGradient(
    lineX(front + frontShadeWidth, middle), 0, lineX(front, middle), 0,
  );
  frontShade.addColorStop(0, 'rgba(0,0,0,0)');
  frontShade.addColorStop(1, `rgba(0,0,0,${0.24 * energy})`);
  ctx.fillStyle = frontShade;
  ctx.fill(bandPath(front + frontShadeWidth, front));

  // 折线暗边。
  ctx.lineWidth = Math.max(1, W / 1600);
  ctx.strokeStyle = `rgba(0,0,0,${0.18 * energy})`;
  ctx.beginPath();
  ctx.moveTo(lineX(front, 0), 0);
  ctx.lineTo(lineX(front, H), H);
  ctx.stroke();
  ctx.restore();
}


  /** squares-wire：按原 shader 的单元格 inset 从左上向右下填满，结束时不留空隙。 */
  function squaresWire(ctx, a, b, W, H, p) {
    if (p <= 0) {
      paint(ctx, a, W, H);
      return;
    }
    if (p >= 1) {
      paint(ctx, b, W, H);
      return;
    }
    paint(ctx, a, W, H);
    const path = new Path2D();
    const cols = 10;
    const rows = 10;
    const cw = W / cols;
    const ch = H / rows;
    // normalize(vec2(1, -0.5)) 后再做 L1 归一化，得到 (2/3, -1/3)。
    const vx = 2 / 3;
    const vy = -1 / 3;
    const d = 0.5 * (vx + vy);
    const smoothness = 1.6;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        // GLSL 的 y 向上，Canvas 的 y 向下；翻转 y 后波前从 Canvas 左上角开始。
        const px = (col + 0.5) / cols;
        const py = 1 - (row + 0.5) / rows;
        const wave = vx * px + vy * py - (d - 0.5 + p * (1 + smoothness));
        const pr = smoothstep(-smoothness, 0, wave);
        const w = cw * (1 - pr);
        const h = ch * (1 - pr);
        if (!(w > 0) || !(h > 0)) continue;
        // 小方块保持柔和圆角；随着 inset 归零，圆角也归零，填满后不留角部空隙。
        const radius = Math.min(w, h) * 0.18 * pr;
        path.roundRect((col + 0.5) * cw - w / 2, (row + 0.5) * ch - h / 2,
          w, h, radius);
      }
    }
    paint(ctx, b, W, H, { clip: () => path });
  }

  /** Morph.glsl 的 Canvas 等价版：不做颜色回读，以分条反向位移制造双帧形变。 */
  function morph(ctx, a, b, W, H, p, k) {
    // 完整的双帧底层负责填满所有边缘；形变层只叠加，不会让透明或单色块露出来。
    paint(ctx, a, W, H);
    paint(ctx, b, W, H, { alpha: k });
    const bands = 18;
    const energy = Math.sin(Math.PI * k);
    for (let i = 0; i < bands; i += 1) {
      const sy = Math.floor(H * i / bands);
      const sh = Math.ceil(H * (i + 1) / bands) - sy;
      const wave = Math.sin(i * 1.73 + p * 5) + Math.sin(i * 0.61 - p * 3) * 0.5;
      const shift = W * 0.024 * energy * wave;
      const clip = (c) => c.rect(0, sy, W, sh);
      // 位移越大，cover 缩放越大，确保图元平移后仍覆盖整个画布宽度。
      const scaleA = 1 + energy * 0.02 + Math.abs(shift) * 2.1 / W;
      const scaleB = 1 + energy * 0.02 + Math.abs(shift) * 1.6 / W;
      paint(ctx, a, W, H, {
        alpha: (1 - k) * energy * 0.36, dx: shift, scale: scaleA, clip,
      });
      paint(ctx, b, W, H, {
        alpha: k * energy * 0.72, dx: -shift * 0.7, scale: scaleB, clip,
      });
    }
  }

  /**
   * 创建一个转场场渲染器。
   * frame = { t, a: {draw, api}, b: {draw, api} }；api.t 已由编译器映射到原始场景时钟。
   */
  function create({ W, H, type, dur, color = '#10151d' }) {
    const canvasA = makeCanvas(W, H);
    const canvasB = makeCanvas(W, H);
    if (!canvasA || !canvasB) {
      // 无离屏画布时诚实降级为原切点硬切，不插入黑色或伪造双帧效果。
      return (ctx, { t, a, b }) => (t < dur / 2 ? a : b).draw(ctx, (t < dur / 2 ? a : b).api);
    }

    return (ctx, frame) => {
      const p = clamp01(Number(frame.t) / dur);
      const k = smooth(p);
      const a = renderFrame(canvasA, frame.a);
      const b = renderFrame(canvasB, frame.b);

      ctx.save();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, W, H);

      if (type === 'dip-fade') {
        // 前场始终不透明，后场直接交叉淡入；任何时刻都不会露出背景暗场。
        paint(ctx, a, W, H);
        paint(ctx, b, W, H, { alpha: k });
      } else if (type === 'wipe-left') {
        paint(ctx, a, W, H);
        paint(ctx, b, W, H, {
          clip: (c) => c.rect(W * (1 - k), 0, W * k, H),
        });
      } else if (type === 'wipe-up') {
        paint(ctx, a, W, H);
        paint(ctx, b, W, H, {
          clip: (c) => c.rect(0, H * (1 - k), W, H * k),
        });
      } else if (type === 'push-left') {
        paint(ctx, a, W, H, { dx: -W * k });
        paint(ctx, b, W, H, { dx: W * (1 - k) });
      } else if (type === 'push-up') {
        paint(ctx, a, W, H, { dy: -H * k });
        paint(ctx, b, W, H, { dy: H * (1 - k) });
      } else if (type === 'zoom-pop') {
        paint(ctx, a, W, H, { alpha: 1 - k, scale: 1 - 0.18 * k });
        paint(ctx, b, W, H, { alpha: k, scale: 1.14 - 0.14 * k });
      } else if (type === 'iris') {
        paint(ctx, a, W, H);
        const radius = Math.hypot(W, H) * 0.53 * k;
        paint(ctx, b, W, H, {
          clip: (c) => c.arc(W / 2, H / 2, Math.max(0.01, radius), 0, TAU),
        });
      } else if (type === 'page-turn') {
        pageTurn(ctx, a, b, W, H, p);
      } else if (type === 'glitch') {
        paint(ctx, b, W, H);
        const slices = 11;
        const off = Math.max(2, W * 0.055) * (1 - k);
        ctx.save();
        ctx.globalAlpha *= 1 - k;
        for (let i = 0; i < slices; i += 1) {
          const sy = Math.floor(H * i / slices);
          const sh = Math.ceil(H / slices) + 1;
          const jitter = (noise(i + 3, p * 9 + 1) - 0.5) * 2 * off;
          ctx.drawImage(a, 0, sy, W, sh, jitter, sy, W, sh);
        }
        ctx.restore();
        ctx.save();
        ctx.globalAlpha *= Math.max(0, 1 - k);
        for (let i = 0; i < 4; i += 1) {
          const y = H * (0.12 + i * 0.22) + (noise(i + 21, p * 5) - 0.5) * H * 0.08;
          ctx.fillStyle = i % 2 ? 'rgba(255,45,149,0.42)' : 'rgba(0,229,255,0.42)';
          ctx.fillRect(0, y, W, 2 + noise(i + 31, p * 8) * 5);
        }
        ctx.restore();
      } else if (type === 'squares-wire') {
        squaresWire(ctx, a, b, W, H, p);
      } else if (type === 'morph') {
        morph(ctx, a, b, W, H, p, k);
      } else {
        paint(ctx, a, W, H, { alpha: 1 - k });
        paint(ctx, b, W, H, { alpha: k });
      }
      ctx.restore();
    };
  }

  TT.transition = {
    create,
    list() {
      return PRESETS.map((item) => ({ ...item }));
    },
  };
})();
