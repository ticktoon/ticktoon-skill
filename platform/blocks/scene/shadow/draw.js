/**
 * scene.shadow —— 透光幕布上的关节剪影。
 *
 * 舞台（宣纸、灯晕、木框）只由 TT.board.stage 画；本 block 只画"戏"：
 * characters[] 给出骨架、姿态、位置、配色、道具，人物不是一张图，而是分层活动的纸片。
 * 保留原实现里值钱的部分：关节杆、镂空纸片纹样、灯影随动、步进整数拍。
 * 没有任何题材枚举：讲什么故事由 storyboard 的 title / subtitle / plaques 决定。
 */
(() => {
  const { font, ease, clamp01 } = TT;
  const TAU = Math.PI * 2;
  const OUTLINE = '#3a1b13';
  const GOLD = '#d69c51';

  const prog = (t, at, dur = 1) => ease.inOutCubic(clamp01((t - at) / dur));
  const back = (t, at, dur = 0.6) => ease.back(1.45)(clamp01((t - at) / dur));

  const poly = (ctx, pts, fill, stroke = OUTLINE, width = 5) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.stroke(); }
  };

  /** 关节铆钉：皮影各段能转动，接缝必须看得见。 */
  const joint = (ctx, x, y, r = 10) => {
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = '#4a2417'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r * 0.42, 0, TAU);
    ctx.fillStyle = GOLD; ctx.fill();
  };

  /** 悬挂名牌：文字来自参数，位置由序号决定。 */
  const plaque = (ctx, fonts, value, cx, y, w, k) => {
    if (k <= 0 || !value) return;
    const h = 88;
    ctx.save();
    ctx.translate(cx, y + h / 2);
    ctx.scale(k, k);
    ctx.translate(-cx, -(y + h / 2));
    ctx.strokeStyle = '#4c2a18'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx, 24); ctx.lineTo(cx, y); ctx.stroke();
    ctx.shadowColor = 'rgba(52,25,12,0.35)'; ctx.shadowBlur = 9; ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#9d3325'; ctx.fillRect(cx - w / 2, y, w, h);
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#542015'; ctx.lineWidth = 5; ctx.strokeRect(cx - w / 2, y, w, h);
    ctx.strokeStyle = '#c67b45'; ctx.lineWidth = 2; ctx.strokeRect(cx - w / 2 + 9, y + 9, w - 18, h - 18);
    ctx.font = font(fonts, 43, 'display').css;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f3d58e';
    TT.text(ctx, value, cx, y + h / 2 + 2, 43, { font: font(fonts, 43, 'display').css, color: '#f3d58e', align: 'center', baseline: 'middle', role: 'display' });
    ctx.restore();
  };

  /** 幕布下沿的草丛：通用道具，位置与抖动都是序号的固定函数。 */
  const grass = (ctx, x, y, scale, t, seed) => {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    for (let i = 0; i < 13; i += 1) {
      const dx = (i - 6) * 15;
      const h = 105 + (i * 37 + seed * 19) % 130;
      const sway = Math.sin(t * 1.25 + i * 0.7 + seed) * 5;
      ctx.beginPath();
      ctx.moveTo(dx - 8, 0);
      ctx.quadraticCurveTo(dx - 12 + sway, -h * 0.55, dx + sway, -h);
      ctx.quadraticCurveTo(dx + 13 + sway, -h * 0.48, dx + 8, 0);
      ctx.closePath();
      ctx.fillStyle = i % 3 === 0 ? '#59613a' : (i % 2 ? '#354d34' : '#49603c');
      ctx.fill();
      if (i % 4 === 0) {
        ctx.save(); ctx.translate(dx + sway, -h + 14); ctx.rotate(-0.1 + sway * 0.01);
        ctx.fillStyle = '#75653a'; ctx.beginPath(); ctx.ellipse(0, 0, 8, 25, 0, 0, TAU); ctx.fill(); ctx.restore();
      }
    }
    ctx.restore();
  };

  /** 镂空纸片纹样：半圆、菱形孔与竖线，剪影透光的关键。 */
  const cutouts = (ctx, top, bottom, halfW) => {
    ctx.save();
    ctx.strokeStyle = GOLD; ctx.fillStyle = '#edc67c'; ctx.lineWidth = 2.4;
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        const x = -halfW * 0.7 + col * (halfW * 0.35) + (row % 2) * 9;
        const y = bottom + row * 45;
        ctx.beginPath(); ctx.arc(x, y, 18, Math.PI, TAU); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y + 7, 11, Math.PI, TAU); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y - 7, 2.7, 0, TAU); ctx.fill();
      }
    }
    for (let i = 0; i < 6; i += 1) {
      const x = -halfW * 0.5 + i * (halfW * 0.2);
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + 9, top + 19); ctx.lineTo(x, top + 38); ctx.lineTo(x - 9, top + 19); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, top + 60); ctx.lineTo(x, bottom - 10); ctx.stroke();
    }
    ctx.restore();
  };

  /** 姿态 → 关节角预设。角度是弧度，只描述肢体关系，不含题材。 */
  const POSES = {
    stand: { armL: -0.12, armR: 0.12, leg: 0.02, lift: 0 },
    walk: { armL: 0.38, armR: -0.32, leg: 0.14, lift: 0 },
    wave: { armL: -0.95, armR: 0.10, leg: 0.02, lift: 0 },
    raise: { armL: -0.62, armR: -0.58, leg: 0.02, lift: 0 },
    sit: { armL: 0.18, armR: -0.18, leg: 0, lift: 62 },
  };

  /** 通用道具槽：长杆 / 扇 / 灯 / 长刃，都挂在前臂末端关节上。 */
  const drawProp = (ctx, kind, color) => {
    if (!kind || kind === 'none') return;
    ctx.save();
    if (kind === 'staff') {
      poly(ctx, [[-8, 0], [8, 0], [8, -238], [-8, -238]], '#d5c79d', '#44382b', 4);
      poly(ctx, [[-30, 8], [30, 8], [26, 20], [-26, 20]], '#b88945', OUTLINE, 4);
    } else if (kind === 'blade') {
      poly(ctx, [[-12, 8], [12, 8], [9, -218], [0, -262], [-9, -218]], '#d5c79d', '#44382b', 4);
      poly(ctx, [[-36, 6], [36, 6], [32, 20], [-32, 20]], '#b88945', OUTLINE, 4);
    } else if (kind === 'fan') {
      ctx.fillStyle = color; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 116, -2.5, -0.65); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
      for (let i = 0; i < 7; i += 1) {
        const a = -2.5 + i * 0.31;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 112, Math.sin(a) * 112); ctx.stroke();
      }
    } else if (kind === 'lantern') {
      ctx.strokeStyle = '#4b2b1c'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 46); ctx.stroke();
      ctx.fillStyle = '#e4b45d'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(0, 96, 44, 56, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i += 1) {
        ctx.beginPath(); ctx.moveTo(i * 22, 50); ctx.lineTo(i * 22, 142); ctx.stroke();
      }
    }
    ctx.restore();
  };

  /**
   * 四种骨架：成人 / 孩童 / 动物 / 器物。
   * 差别只在比例与头形；关节杆、镂空纸片、铆钉是共用的。
   */
  const figure = (ctx, t, c, pose, color) => {
    const kind = c.kind || 'adult';
    const bodyY = -145 + pose.lift;
    const halfW = kind === 'child' ? 88 : kind === 'animal' ? 150 : 108;
    const robeTop = kind === 'child' ? -250 : -337;
    const headY = kind === 'child' ? -330 : -410;

    if (kind === 'object') {
      // 器物：一块竖直镂空纸片 + 提杆，没有腿与头。
      poly(ctx, [[-96, -300], [96, -300], [120, 96], [-120, 96]], color, OUTLINE, 7);
      cutouts(ctx, -270, -60, 96);
      joint(ctx, -64, -286, 11); joint(ctx, 64, -286, 11);
      return [0, -286];
    }

    // 腿：可独立摆动，下摆仍是镂空纸片。
    const legs = kind === 'animal' ? [-1, -0.35, 0.35, 1] : [-1, 1];
    for (const side of legs) {
      ctx.save();
      ctx.translate(side * (kind === 'animal' ? 72 : 53), 92);
      ctx.rotate(side * Math.sin(t * 2.4) * pose.leg);
      poly(ctx, [[-34, 0], [32, 0], [28, 51], [-32, 51]], '#873523', OUTLINE, 5);
      poly(ctx, [[-32, 45], [30, 45], [50, 65], [-36, 65]], '#382219', OUTLINE, 4);
      ctx.restore();
    }

    // 躯干：下摆 + 上片，中间用纹样做镂空。
    poly(ctx, [[-halfW, bodyY], [halfW, bodyY], [halfW + 46, 116], [24, 116], [0, 63], [-24, 116], [-halfW - 46, 116]], color, OUTLINE, 7);
    poly(ctx, [[-halfW - 2, bodyY], [halfW + 2, bodyY], [halfW - 4, bodyY + 30], [-halfW + 4, bodyY + 30]], '#713020', OUTLINE, 4);
    cutouts(ctx, -300, -68, halfW);
    poly(ctx, [[-halfW * 0.8, robeTop], [halfW * 0.6, robeTop], [halfW, bodyY], [-halfW, bodyY]], color, OUTLINE, 7);
    joint(ctx, -halfW * 0.6, robeTop + 30, 12);
    joint(ctx, halfW * 0.55, robeTop + 33, 12);
    joint(ctx, 0, bodyY + 2, 11);

    // 前臂：姿态决定肩角；末端挂道具。
    ctx.save();
    ctx.translate(-halfW * 0.6, robeTop + 30);
    ctx.rotate(pose.armL);
    poly(ctx, [[0, 0], [-68, 14], [-124, 68], [-96, 98], [-28, 54]], color, OUTLINE, 6);
    joint(ctx, 0, 0, 11); joint(ctx, -118, 74, 9);
    ctx.save(); ctx.translate(-118, 74); ctx.rotate(-0.5);
    drawProp(ctx, c.prop, color);
    ctx.restore();
    ctx.restore();

    // 后手 + 操纵杆连接点。
    ctx.save();
    ctx.translate(halfW * 0.55, robeTop + 33);
    ctx.rotate(pose.armR);
    poly(ctx, [[0, 0], [72, 16], [124, 84], [82, 108], [22, 54]], color, OUTLINE, 6);
    joint(ctx, 0, 0, 11); joint(ctx, 80, 88, 9);
    ctx.restore();

    // 头形：成人方巾、孩童圆髻、动物尖耳，都不带具体身份特征。
    if (kind === 'animal') {
      poly(ctx, [[-70, headY + 40], [70, headY + 40], [96, headY - 24], [40, headY - 66], [-40, headY - 66], [-96, headY - 24]], color, OUTLINE, 6);
      poly(ctx, [[-92, headY - 18], [-58, headY - 96], [-30, headY - 40]], color, OUTLINE, 5);
      poly(ctx, [[92, headY - 18], [58, headY - 96], [30, headY - 40]], color, OUTLINE, 5);
      ctx.fillStyle = '#3b2118';
      ctx.beginPath(); ctx.arc(-34, headY - 6, 5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(34, headY - 6, 5, 0, TAU); ctx.fill();
    } else if (kind === 'child') {
      poly(ctx, [[-52, headY + 30], [52, headY + 30], [58, headY - 34], [0, headY - 66], [-58, headY - 34]], color, OUTLINE, 6);
      ctx.fillStyle = '#3b2118';
      ctx.beginPath(); ctx.arc(0, headY - 78, 18, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(-18, headY - 6, 5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(18, headY - 6, 5, 0, TAU); ctx.fill();
    } else {
      poly(ctx, [[-43, headY + 46], [-40, headY + 6], [28, headY], [48, headY + 54]], '#8b3725', OUTLINE, 5);
      poly(ctx, [[-56, headY + 4], [44, headY], [50, headY - 46], [-48, headY - 40]], color, OUTLINE, 6);
      poly(ctx, [[-60, headY - 42], [46, headY - 42], [40, headY - 70], [-52, headY - 70]], '#bb8a43', OUTLINE, 5);
      ctx.fillStyle = '#3b2118';
      ctx.beginPath(); ctx.arc(-22, headY - 8, 5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(22, headY - 8, 5, 0, TAU); ctx.fill();
    }
    joint(ctx, 0, headY + 54, 9);
    return [halfW * 0.55, robeTop + 33];
  };

  BLOCKS['scene.shadow'] = (g, p) => {
    const { ctx, W, H, fonts } = g;
    const t = g.sceneT;
    ctx.save(); ctx.globalAlpha = g.a;
    TT.board.stage(ctx, { W, H }, { seed: 1 });

    grass(ctx, W * 0.09, H * 0.76, 1.15, t, 2);
    grass(ctx, W * 0.94, H * 0.77, 0.95, t, 5);
    grass(ctx, W * 0.22, H * 0.78, 0.55, t, 8);

    // 标题写在戏台上，副标与名牌都来自参数，不预设任何故事。
    const titleK = prog(t, 0.35, 1.0);
    ctx.save();
    ctx.globalAlpha = titleK;
    ctx.translate(W * 0.096, H * 0.38 + (1 - titleK) * 18);
    ctx.rotate(-0.018);
    ctx.font = font(fonts, 104, 'display').css;
    ctx.fillStyle = '#3b2418'; ctx.textBaseline = 'alphabetic';
    TT.text(ctx, p.title, 0, 0, 104, { font: font(fonts, 104, 'display').css, color: '#3b2418', role: 'display' });
    if (p.subtitle) {
      ctx.font = font(fonts, 31, 'body').css;
      ctx.fillStyle = '#815637';
      TT.text(ctx, p.subtitle, 8, 63, 31, { font: font(fonts, 31, 'body').css, color: '#815637', role: 'body' });
    }
    ctx.restore();

    const plaques = Array.isArray(p.plaques) ? p.plaques : [];
    plaques.forEach((value, i) => {
      plaque(ctx, fonts, value, W * (0.41 + i * 0.31), H * (0.097 + i * 0.012), W * (i ? 0.11 : 0.19), back(t, 0.8 + i * 1.2, 0.7));
    });

    const characters = Array.isArray(p.characters) && p.characters.length ? p.characters : [];
    // 入场一步一晃：步进用整数拍，避免普通正弦漂移的"滑冰感"。
    const entrance = prog(t, 0.4, 4.0);
    const beat = Math.max(0, (t - 0.4) * 2.15);
    const step = Math.floor(beat);
    const phase = beat - step;
    const moving = t < 4.4 ? 1 : 0.32;
    const bob = -Math.sin(phase * Math.PI) * 12 * moving;
    const sway = (step % 2 ? 1 : -1) * 0.025 * moving;

    characters.forEach((c, i) => {
      const pose = POSES[c.pose] || POSES.stand;
      const baseX = W * (Number.isFinite(c.x) ? c.x : 0.78);
      const px = baseX - entrance * W * 0.096 + i * W * 0.015;
      const py = H * 0.65 + bob + i * 6;
      const s = (Number.isFinite(c.scale) ? c.scale : 1) * 1.04;
      const color = c.color || '#a8432e';

      // 灯影随动：剪影在幕布上留一层偏移的淡影，光越偏影越长。
      ctx.save();
      ctx.globalAlpha = 0.16 * g.a;
      ctx.translate(px + 26 + sway * 60, py + 8);
      ctx.rotate(sway);
      ctx.scale(s * 1.02, s * 1.02);
      poly(ctx, [[-110, -340], [110, -340], [150, 120], [-150, 120]], '#3a2113', null, 0);
      ctx.restore();

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(sway);
      ctx.scale(s, s);
      const rod = figure(ctx, t, c, pose, color);
      ctx.restore();

      // 操纵杆始终垂向幕布下方，和关节一起说明"它是皮影"。
      ctx.save();
      ctx.strokeStyle = '#3b2a1c'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(px + rod[0] * s, py + rod[1] * s); ctx.lineTo(px + 145 * s, H * 0.94); ctx.stroke();
      ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(px - 62 * s, py - 300 * s); ctx.lineTo(px - 22 * s, H * 0.95); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px + 30 * s, H * 0.03); ctx.lineTo(px + 28 * s, py - 480 * s); ctx.stroke();
      ctx.restore();
    });

    // 一记短促的灯闪，给姿态切换一个句读。
    const flash = prog(t, 9.25, 0.22) * (1 - prog(t, 9.48, 0.5));
    if (flash > 0) {
      ctx.save(); ctx.globalAlpha = flash; ctx.strokeStyle = '#fff4c9'; ctx.lineWidth = 13; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(W * 0.53, H * 0.41); ctx.lineTo(W * 0.42, H * 0.73); ctx.stroke(); ctx.restore();
    }
    g.ink = null;
    ctx.restore();
  };
})();
