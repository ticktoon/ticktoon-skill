/**
 * TT.board —— 舞台底。
 *
 * 纸面纤维、绿板渐变、粉笔槽与板擦是整类片子的公共底；code 场与 params 模板都调用
 * 同一套词法，才能看起来是一部片子。这里只抽"底"，不抽内容：
 * 笔迹仍然只走 TT.pen，文本仍然由调用方画。
 *
 * 舞台是词法：纸有几种是有限的，讲什么故事是无限的。所以这一层写死，
 * 由 LLM 从 TT.board.list() 里挑，而不是让每片各画一遍底色。
 *
 * W/H 优先取 api.W/api.H（逻辑尺寸）；没有 api 时退回 ctx.canvas 的像素尺寸。
 * 所有内部扰动都是序号与固定常量的函数，不依赖墙钟或随机数。
 */
(() => {
  const TAU = Math.PI * 2;

  /**
   * 确定性伪随机：只吃整数序号与 seed，绝不读墙钟。
   * 同一个 (n, seed) 永远得同一个 [0,1) 值，`tt det` 才能两次跑出同一张图。
   */
  const rnd = (n, seed) => {
    let x = (Math.imul(n | 0, 374761393) + Math.imul(seed | 0, 668265263)) | 0;
    x = (x ^ (x >>> 13)) | 0;
    x = Math.imul(x, 1274126177) | 0;
    x = (x ^ (x >>> 16)) >>> 0;
    return x / 4294967296;
  };

  const seedOf = (opts) => {
    const s = Number(opts?.seed);
    return Number.isFinite(s) ? Math.round(s) : 0;
  };

  /**
   * 纹理尺度基准：一律按短边定量。
   * 按长边铺固定条数会在 9:16 与 1:1 之间把纹理拉成两套密度，看起来像换了张纸。
   */
  const unitOf = (W, H) => Math.min(W, H) / 1000;

  /** 整体色偏：tone ∈ [-1,1]，正暖负冷。零值严格不落笔，保证老路径零像素变化。 */
  function toneOverlay(ctx, W, H, opts) {
    const tone = Number(opts?.tone);
    if (!Number.isFinite(tone) || tone === 0) return;
    const t = Math.max(-1, Math.min(1, tone));
    ctx.save();
    ctx.fillStyle = t > 0
      ? `rgba(255,196,120,${(0.11 * t).toFixed(4)})`
      : `rgba(120,170,255,${(0.11 * -t).toFixed(4)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  const roundRect = (ctx, x, y, w, h, r) => {
    const radius = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, radius);
    else {
      ctx.moveTo(x + radius, y);
      ctx.arcTo(x + w, y, x + w, y + h, radius);
      ctx.arcTo(x + w, y + h, x, y + h, radius);
      ctx.arcTo(x, y + h, x, y, radius);
      ctx.arcTo(x, y, x + w, y, radius);
      ctx.closePath();
    }
  };

  const sizeOf = (ctx, api) => ({
    W: Number.isFinite(api?.W) ? api.W : ctx.canvas.width,
    H: Number.isFinite(api?.H) ? api.H : ctx.canvas.height,
  });

  /** 很淡的纸/板面纤维：位置是固定公式，避免每帧闪烁。满幅背景不进镜头变换。 */
  function fibers(ctx, W, H, blackboard) {
    ctx.save();
    ctx.strokeStyle = blackboard ? 'rgba(235,240,220,0.035)' : 'rgba(112,98,73,0.045)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 115; i += 1) {
      const x = (i * 167.31 + 37) % W;
      const y = (i * i * 19.17 + i * 43.7) % H;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 18 + (i % 5) * 7, y + Math.sin(i) * 3);
      ctx.stroke();
    }
    ctx.fillStyle = blackboard ? 'rgba(235,240,220,0.04)' : 'rgba(98,83,59,0.055)';
    for (let i = 0; i < 180; i += 1) {
      ctx.fillRect((i * 311.7) % W, (i * i * 7.93 + 71) % H, 1.4, 1.4);
    }
    ctx.restore();
  }

  /** 白纸底：与原 scene.whiteboard 的 paper 分支逐像素一致。 */
  function paper(ctx, api, opts = {}) {
    const { W, H } = sizeOf(ctx, api);
    ctx.fillStyle = opts.paper || '#f8f5ec';
    ctx.fillRect(0, 0, W, H);
    fibers(ctx, W, H, false);
  }

  /** 绿板底 + 粉笔槽/板擦：与原 scene.whiteboard 的 blackboard 分支逐像素一致。 */
  function blackboard(ctx, api, opts = {}) {
    const { W, H } = sizeOf(ctx, api);

    // 深绿板面：中心略亮、四周压暗，保留粉笔擦过的雾面痕迹。
    const board = ctx.createLinearGradient(0, 0, W * 0.35, H);
    board.addColorStop(0, '#38695b');
    board.addColorStop(0.48, '#2F5D50');
    board.addColorStop(1, '#274d43');
    ctx.fillStyle = board;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.fillStyle = 'rgba(230,238,220,0.028)';
    for (let i = 0; i < 9; i += 1) {
      ctx.beginPath();
      ctx.ellipse(W * (0.12 + i * 0.1), H * (0.18 + (i % 4) * 0.19), 120 + (i % 3) * 45, 48 + (i % 2) * 22, i * 0.4, 0, TAU);
      ctx.fill();
    }
    // 内框木边，固定屏幕坐标，不随镜头缩放。
    ctx.strokeStyle = 'rgba(18,32,27,0.55)';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, W - 14, H - 14);
    ctx.strokeStyle = 'rgba(220,225,205,0.10)';
    ctx.lineWidth = 2;
    ctx.strokeRect(15, 15, W - 30, H - 30);
    ctx.restore();

    fibers(ctx, W, H, true);

    if (opts.tray === false) return;

    // 粉笔槽 + 板擦/粉笔道具：屏幕底部固定，不参与墨迹安全框。
    ctx.save();
    ctx.fillStyle = '#6d4c35';
    ctx.fillRect(0, H - 38, W, 38);
    ctx.fillStyle = '#8a6748';
    ctx.fillRect(0, H - 38, W, 5);
    ctx.fillStyle = '#4b3425';
    ctx.fillRect(0, H - 10, W, 10);
    ctx.strokeStyle = 'rgba(46,30,18,0.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 24; i += 1) {
      ctx.beginPath();
      ctx.moveTo((i * 137.3) % W, H - 34);
      ctx.lineTo((i * 137.3) % W + 40, H - 31);
      ctx.stroke();
    }
    // 三根粉笔。
    for (let i = 0; i < 3; i += 1) {
      ctx.save();
      ctx.translate(96 + i * 62, H - 44);
      ctx.rotate(-0.05 + i * 0.03);
      ctx.fillStyle = ['#f1ecdb', '#e8d29a', '#a9d2bd'][i];
      roundRect(ctx, -24, -6, 48, 12, 5);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(-17, -4, 30, 2.2);
      ctx.restore();
    }
    // 板擦：木托 + 深色毡面。
    ctx.save();
    ctx.translate(W - 126, H - 47);
    ctx.rotate(-0.08);
    ctx.fillStyle = '#2e3733';
    roundRect(ctx, -58, -5, 116, 16, 5); ctx.fill();
    ctx.fillStyle = '#8b6847';
    roundRect(ctx, -58, -22, 116, 19, 6); ctx.fill();
    ctx.fillStyle = '#b48a60';
    ctx.fillRect(-48, -19, 96, 3);
    ctx.fillStyle = '#6f4f34';
    roundRect(ctx, -33, -30, 66, 10, 4); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  /* ───────────────────────── 舞台词法 ───────────────────────── */

  /**
   * 米色拼贴纸：中心略亮、四边略深，短纤维 + 不均匀浅斑。
   * 比 paper 更暖更旧，适合"手账/剪报"那种拼合感。
   */
  function cream(ctx, api, opts = {}) {
    const { W, H } = sizeOf(ctx, api);
    const seed = seedOf(opts);
    const u = unitOf(W, H);

    const g = ctx.createLinearGradient(0, 0, W * 0.3, H);
    g.addColorStop(0, '#f5ecda');
    g.addColorStop(0.5, '#f0e6d2');
    g.addColorStop(1, '#e5d7be');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    // 短纤维：长度与角度都在小范围内抖，避免看出排布规律。
    ctx.strokeStyle = 'rgba(150,128,96,0.05)';
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 150; i += 1) {
      const x = rnd(i * 3, seed) * W;
      const y = rnd(i * 3 + 1, seed) * H;
      const len = (10 + rnd(i * 3 + 2, seed) * 26) * u;
      const ang = (rnd(i * 5 + 7, seed) - 0.5) * 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }
    // 不均匀浅斑：小而淡的椭圆，模拟旧纸吸潮；太大太深会像污渍。
    ctx.fillStyle = 'rgba(203,183,150,0.05)';
    for (let i = 0; i < 34; i += 1) {
      const x = rnd(i * 4 + 11, seed) * W;
      const y = rnd(i * 4 + 13, seed) * H;
      const a = rnd(i * 4 + 17, seed);
      ctx.beginPath();
      ctx.ellipse(x, y, (12 + a * 30) * u, (8 + a * 18) * u, a * TAU, 0, TAU);
      ctx.fill();
    }
    // 边缘压深：半径按对角定量，四边同时收到。
    const rIn = Math.min(W, H) * 0.35;
    const rOut = Math.hypot(W, H) * 0.56;
    const vg = ctx.createRadialGradient(W / 2, H / 2, rIn, W / 2, H / 2, rOut);
    vg.addColorStop(0, 'rgba(120,98,68,0)');
    vg.addColorStop(1, 'rgba(120,98,68,0.15)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /**
   * 宣纸：偏白微黄，长纤维，纤维方向分布比 cream 更散、更长。
   * opts.bleed 为真时四周淡墨晕——湿画法下墨会从边缘洇进来，边界不该是干脆的直角。
   */
  function wash(ctx, api, opts = {}) {
    const { W, H } = sizeOf(ctx, api);
    const seed = seedOf(opts);
    const u = unitOf(W, H);

    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#fdfaf1');
    g.addColorStop(0.55, '#faf5e8');
    g.addColorStop(1, '#f3ecdb');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    // 长纤维：细、淡、长度 40–140，方向偏水平但不全是水平。
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 130; i += 1) {
      const x = rnd(i * 6 + 3, seed) * W;
      const y = rnd(i * 6 + 5, seed) * H;
      const len = (40 + rnd(i * 6 + 9, seed) * 100) * u;
      const ang = (rnd(i * 6 + 13, seed) - 0.5) * 0.9;
      const a = 0.045 + rnd(i * 6 + 19, seed) * 0.045;
      ctx.strokeStyle = `rgba(146,126,92,${a.toFixed(4)})`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(
        x + Math.cos(ang) * len * 0.5, y + Math.sin(ang) * len * 0.5 + (rnd(i + 31, seed) - 0.5) * 2 * u,
        x + Math.cos(ang) * len, y + Math.sin(ang) * len,
      );
      ctx.stroke();
    }
    // 少量可见的草茎点：宣纸里没化开的料。
    ctx.fillStyle = 'rgba(128,108,76,0.05)';
    for (let i = 0; i < 40; i += 1) {
      const r = (0.8 + rnd(i * 8 + 23, seed) * 1.8) * u * 1.4;
      ctx.beginPath();
      ctx.ellipse(rnd(i * 8 + 29, seed) * W, rnd(i * 8 + 37, seed) * H, r, r * 0.6, rnd(i + 41, seed) * TAU, 0, TAU);
      ctx.fill();
    }
    if (opts.bleed) {
      const rOut = Math.hypot(W, H) * 0.58;
      const bg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, rOut);
      bg.addColorStop(0, 'rgba(70,78,84,0)');
      bg.addColorStop(0.86, 'rgba(70,78,84,0.045)');
      bg.addColorStop(1, 'rgba(70,78,84,0.13)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  /**
   * 暖米纸 + 45° 蜡笔细斜纹 + 纸边毛糙。
   * 斜纹间距按短边定量，横竖屏看起来才是同一种纸；纸边用长短不一的短线咬出不齐的边。
   */
  function crayon(ctx, api, opts = {}) {
    const { W, H } = sizeOf(ctx, api);
    const seed = seedOf(opts);
    const u = unitOf(W, H);

    ctx.fillStyle = opts.paper || '#f2e8d5';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    // 45° 细斜纹：低透明度、线宽随尺度走，太粗会变成条纹布。
    const gap = 7 * u;
    const diag = Math.hypot(W, H);
    ctx.strokeStyle = 'rgba(186,162,124,0.075)';
    ctx.lineWidth = 1.5 * u;
    ctx.beginPath();
    for (let d = -diag; d < diag; d += gap) {
      ctx.moveTo(d, -diag);
      ctx.lineTo(d + diag * 2, diag);
    }
    ctx.stroke();
    // 蜡笔压过的深浅不匀：窄而淡的斜向条，太宽会像白疤。
    ctx.fillStyle = 'rgba(255,252,244,0.09)';
    for (let i = 0; i < 26; i += 1) {
      const x = rnd(i * 5 + 2, seed) * W;
      const y = rnd(i * 5 + 6, seed) * H;
      const w = (60 + rnd(i * 5 + 8, seed) * 150) * u;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-Math.PI / 4);
      ctx.fillRect(-w / 2, -3.5 * u, w, 7 * u);
      ctx.restore();
    }
    // 纸边毛糙：四边各咬一圈朝向内侧的短划线，长度随机，不出画。
    for (let edge = 0; edge < 4; edge += 1) {
      const horizontal = edge < 2;
      const span = horizontal ? W : H;
      const count = Math.round(span / (9 * u));
      for (let i = 0; i < count; i += 1) {
        const t = (i + 0.5) / count;
        const len = (3 + rnd(edge * 4096 + i * 7 + 101, seed) * 11) * u;
        const a = 0.1 + rnd(edge * 4096 + i * 11 + 211, seed) * 0.12;
        ctx.strokeStyle = `rgba(196,176,148,${a.toFixed(4)})`;
        ctx.lineWidth = (1.2 + rnd(edge * 4096 + i * 13 + 307, seed) * 2.2) * u;
        ctx.beginPath();
        if (edge === 0) { ctx.moveTo(t * span, 0); ctx.lineTo(t * span, len); }
        else if (edge === 1) { ctx.moveTo(t * span, H); ctx.lineTo(t * span, H - len); }
        else if (edge === 2) { ctx.moveTo(0, t * span); ctx.lineTo(len, t * span); }
        else { ctx.moveTo(W, t * span); ctx.lineTo(W - len, t * span); }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /**
   * 皮影幕布背景：宣纸底 + 顶部暖灯晕 + 底部操纵区压暗。
   * 四角木框由 stageFrame 在场景内容之后单独绘制。
   */
  function stage(ctx, api, opts = {}) {
    const { W, H } = sizeOf(ctx, api);
    const seed = seedOf(opts);
    const u = unitOf(W, H);

    // 幕布本体：比 wash 更亮，好透出灯影。
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#fbf4e2');
    g.addColorStop(0.55, '#f7eed9');
    g.addColorStop(1, '#efe3c9');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    // 布的经线：等距竖纹，间距按短边定量。
    const pitch = 9 * u;
    ctx.strokeStyle = 'rgba(176,152,114,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < W; x += pitch) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    ctx.stroke();

    // 顶部暖灯晕：从上方垂下来的暖光，越往下越淡。
    const lamp = ctx.createLinearGradient(0, 0, 0, H * 0.72);
    lamp.addColorStop(0, 'rgba(255,206,130,0.26)');
    lamp.addColorStop(0.45, 'rgba(255,206,130,0.09)');
    lamp.addColorStop(1, 'rgba(255,206,130,0)');
    ctx.fillStyle = lamp;
    ctx.fillRect(0, 0, W, H * 0.72);

    ctx.restore();
  }

  /**
   * 皮影固定前景：只画四角木框，其余区域保持完全透明。
   * 必须在所有场景内容之后调用，保证框角不会被山体或建筑覆盖。
   */
  function stageFrame(ctx, api) {
    const { W, H } = sizeOf(ctx, api);
    const arm = Math.min(W, H) * 0.16;
    const th = Math.max(10, Math.min(W, H) * 0.026);
    const wood = (x0, y0, x1, y1) => {
      const wg = ctx.createLinearGradient(x0, y0, x1, y1);
      wg.addColorStop(0, '#6a4a30');
      wg.addColorStop(0.5, '#4d3421');
      wg.addColorStop(1, '#3a2618');
      ctx.fillStyle = wg;
    };
    const corners = [
      [0, 0, 1, 1], [W, 0, -1, 1], [0, H, 1, -1], [W, H, -1, -1],
    ];
    ctx.save();
    for (const [cx, cy, sx, sy] of corners) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(sx, sy);
      wood(0, 0, arm, th);
      ctx.fillRect(0, 0, arm, th);
      wood(0, 0, th, arm);
      ctx.fillRect(0, 0, th, arm);
      ctx.fillStyle = 'rgba(255,222,170,0.16)';
      ctx.fillRect(0, th * 0.72, arm, th * 0.16);
      ctx.fillRect(th * 0.72, 0, th * 0.16, arm);
      ctx.fillStyle = 'rgba(236,206,150,0.35)';
      ctx.beginPath();
      ctx.arc(th * 1.6, th * 1.6, th * 0.26, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  /**
   * 新闻黑底：近黑，中心微亮，极细网格给出"编辑台"的秩序感。
   * opts.grid === false 可关网格；网格线与底色的对比压得很低，只在暗处显形。
   */
  function news(ctx, api, opts = {}) {
    const { W, H } = sizeOf(ctx, api);
    const u = unitOf(W, H);

    ctx.fillStyle = opts.paper || '#12151a';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    // 中心微亮：给主体一点呼吸，避免纯平黑。
    const cg = ctx.createRadialGradient(W / 2, H * 0.46, 0, W / 2, H * 0.46, Math.hypot(W, H) * 0.56);
    cg.addColorStop(0, 'rgba(96,120,150,0.16)');
    cg.addColorStop(0.6, 'rgba(70,90,116,0.07)');
    cg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, W, H);

    // 顶部与底部的窄光带：模拟演播室灯位，不参与内容。
    const top = ctx.createLinearGradient(0, 0, 0, H * 0.16);
    top.addColorStop(0, 'rgba(150,190,230,0.10)');
    top.addColorStop(1, 'rgba(150,190,230,0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, H * 0.16);
    const bot = ctx.createLinearGradient(0, H, 0, H * 0.84);
    bot.addColorStop(0, 'rgba(150,190,230,0.10)');
    bot.addColorStop(1, 'rgba(150,190,230,0)');
    ctx.fillStyle = bot;
    ctx.fillRect(0, H * 0.84, W, H * 0.16);

    if (opts.grid !== false) {
      const pitch = Math.min(W, H) / 22;
      ctx.strokeStyle = 'rgba(90,170,240,0.045)';
      ctx.lineWidth = Math.max(0.6, 0.9 * u);
      ctx.beginPath();
      for (let x = pitch; x < W; x += pitch) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = pitch; y < H; y += pitch) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ───────────────────────── 词表 + 导出 ───────────────────────── */

  const stages = [
    {
      kind: 'paper',
      desc: '白纸 + 淡纤维：暖白底，短纤维与细点，纸面干净',
      when: '白板讲解、板书式推导的默认底；内容多、需要最大对比度时用它',
      opts: 'opts.paper 换底色；opts.tone 整体色偏',
    },
    {
      kind: 'blackboard',
      desc: '深绿板 + 木内框 + 粉笔槽（含粉笔与板擦道具）',
      when: '课堂/讲义口吻；内容靠粉笔质感取胜时用。比 paper 暗，正文色要跟着换',
      opts: 'opts.tray=false 去掉粉笔槽；opts.tone 整体色偏',
    },
    {
      kind: 'cream',
      desc: '米色拼贴纸：中心暖亮、四边压深，短纤维与不均浅斑',
      when: '手账/剪报/拼贴感；贴纸、便签、照片块混排时用它当底',
      opts: 'opts.seed 换斑驳分布；opts.tone 整体色偏',
    },
    {
      kind: 'wash',
      desc: '宣纸：偏白微黄，长纤维与未化开的料点',
      when: '水墨/国风/湿画法；墨色有浓淡层次时用它，纸本身要够素',
      opts: 'opts.bleed=true 加四周淡墨晕；opts.tone 整体色偏',
    },
    {
      kind: 'crayon',
      desc: '暖米纸 + 45° 蜡笔细斜纹 + 四边毛糙',
      when: '蜡笔绘本、儿童向；要"手工纸上画的"那种粗颗粒感时用它',
      opts: 'opts.paper 换底色；opts.seed 换压痕与毛边',
    },
    {
      kind: 'stage',
      desc: '皮影幕布背景：宣纸底 + 顶部暖灯晕 + 底部操纵区压暗；四角木框由 stageFrame 前景绘制',
      when: '皮影/灯影戏；主体是从背后打光的剪影时用它',
      opts: 'opts.seed 换褶皱位置',
    },
    {
      kind: 'news',
      desc: '新闻黑底：近黑、中心微亮、极细网格 + 上下窄光带',
      when: '资讯播报、数据快报；主体是高亮图形或大号标题时用它',
      opts: 'opts.grid=false 去网格；opts.paper 换底色',
    },
  ];

  /**
   * 老两种一格都没动，只在外层补 tone。
   * tone 为空时包装层不落任何笔，静帧与 v7 逐像素一致。
   */
  const withTone = (fn) => (ctx, api, opts = {}) => {
    fn(ctx, api, opts);
    const { W, H } = sizeOf(ctx, api);
    toneOverlay(ctx, W, H, opts);
  };

  TT.board = {
    list() {
      return stages.map(({ kind, desc, when, opts }) => ({ kind, desc, when, opts }));
    },

    paper: withTone(paper),
    blackboard: withTone(blackboard),
    cream: withTone(cream),
    wash: withTone(wash),
    crayon: withTone(crayon),
    stage: withTone(stage),
    stageFrame,
    news: withTone(news),
  };
})();
