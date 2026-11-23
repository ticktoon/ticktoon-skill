/* @ticktoon-ref-shot
{
  "title": "真实人体与器官导览",
  "note": "左侧 3D 舞台展示 BodyParts3D 人体与器官，机位按身高推算，右侧三大系统关系",
  "duration": 8,
  "bg": "#F4F7FB",
  "thumbTime": 4.5,
  "tags": ["3D", "人体", "器官", "系统"],
  "resources": [
    { "type": "font", "name": "sans-900" },
    { "type": "font", "name": "JiangChengYuanTi" }
  ]
}
*/
const PAGE = '#F4F7FB';
const INK = '#203B5A';
const MUTED = '#65758A';
const ACCENT = '#5C7FC1';
// 3D 舞台：一块白色卡片，模型只在这块矩形里成像。
const STAGE = { x: W * 0.04, y: H * 0.085, w: W * 0.505, h: H * 0.83, r: 30 };

const layer = api.three({
  rect: { x: STAGE.x, y: STAGE.y, width: STAGE.w, height: STAGE.h },
});
const T = api.THREE;
const H0 = TT.anatomy.height;

// 透明外壳只负责比例与定位；器官用同一套解剖模型，位置不需要手工摆。
const shell = new T.MeshStandardMaterial({ color: '#A8D4EA', transparent: true, opacity: 0.17, roughness: 0.55, depthWrite: false });
const organ = {
  heart: new T.MeshStandardMaterial({ color: '#E86A78', roughness: 0.58 }),
  airways: new T.MeshStandardMaterial({ color: '#63B9D1', roughness: 0.62 }),
  brain: new T.MeshStandardMaterial({ color: '#B58BE0', roughness: 0.68 }),
  liver: new T.MeshStandardMaterial({ color: '#B86D66', roughness: 0.70 }),
  stomach: new T.MeshStandardMaterial({ color: '#E9A65F', roughness: 0.68 }),
  kidneys: new T.MeshStandardMaterial({ color: '#A66FA0', roughness: 0.70 }),
};

const human = new T.Group();
human.add(TT.anatomy.mesh(T, 'body', shell));
human.add(TT.anatomy.mesh(T, 'heart', organ.heart));
human.add(TT.anatomy.mesh(T, 'airways', organ.airways));
human.add(TT.anatomy.mesh(T, 'brain', organ.brain));
human.add(TT.anatomy.mesh(T, 'liver', organ.liver));
human.add(TT.anatomy.mesh(T, 'stomach', organ.stomach));
human.add(TT.anatomy.mesh(T, 'kidneys', organ.kidneys));

// 落地参考圈：脚底在 y = 0，圈子只做空间提示，不参与解剖表达。
const ground = new T.Mesh(
  new T.CircleGeometry(H0 * 0.30, 64),
  new T.MeshBasicMaterial({ color: '#6B879B', transparent: true, opacity: 0.10 }),
);
ground.rotation.x = -Math.PI / 2;
human.add(ground);
layer.scene.add(human);

layer.scene.add(new T.AmbientLight('#FFFFFF', 1.15));
const key = new T.DirectionalLight('#FFFFFF', 2.3);
key.position.set(4, 7, 6);
layer.scene.add(key);
const fill = new T.DirectionalLight('#A9C8FF', 0.75);
fill.position.set(-5, 3, 2);
layer.scene.add(fill);
const rim = new T.DirectionalLight('#CFE4FF', 0.55);
rim.position.set(-2, 4, -6);
layer.scene.add(rim);

// 全身机位由身高推算：fov 38 时可见高度 ≈ 0.689 × 距离，取 83% 构图。
const CAM = { pos: [H0 * 0.34, H0 * 0.54, H0 * 1.72], at: [0, H0 * 0.50, 0] };
layer.camera.position.set(CAM.pos[0], CAM.pos[1], CAM.pos[2]);
layer.camera.lookAt(CAM.at[0], CAM.at[1], CAM.at[2]);

function stage(ctx) {
  ctx.save();
  ctx.beginPath(); ctx.roundRect(STAGE.x, STAGE.y, STAGE.w, STAGE.h, STAGE.r); ctx.clip();
  layer.draw(ctx);
  ctx.restore();
}
function reveal(ctx, t, at, draw) {
  const k = TT.ease.outCubic(TT.clamp01((t - at) / 0.55));
  if (k <= 0) return;
  ctx.save();
  ctx.globalAlpha = k;
  ctx.translate(0, (1 - k) * 16);
  draw();
  ctx.restore();
}
function card(y, color, title, text) {
  ctx.save();
  ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.roundRect(W * 0.60, y, W * 0.345, 108, 20); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(W * 0.635, y + 36, 10, 0, Math.PI * 2); ctx.fill();
  TT.text(ctx, title, W * 0.66, y + 45, 29, { fontKey: 'sans-900', color: INK, baseline: 'middle' });
  TT.text(ctx, text, W * 0.66, y + 81, 23, { fontKey: 'JiangChengYuanTi', color: MUTED, baseline: 'middle' });
  ctx.restore();
}

return (ctx, api) => {
  ctx.fillStyle = PAGE; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.shadowColor = 'rgba(32, 59, 90, 0.10)';
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.roundRect(STAGE.x, STAGE.y, STAGE.w, STAGE.h, STAGE.r); ctx.fill();
  ctx.restore();

  // 极轻微的转身：让体积感出来，但不抢讲解的注意力。
  human.rotation.y = Math.sin(api.t * 0.35) * 0.12;
  stage(ctx);

  reveal(ctx, api.t, 0.10, () => {
    TT.text(ctx, 'ANATOMY / 01', W * 0.60, H * 0.15, 22, { fontKey: 'sans-900', color: ACCENT });
  });
  reveal(ctx, api.t, 0.20, () => {
    TT.text(ctx, '人体，是连续协作的系统', W * 0.60, H * 0.235, 52, { fontKey: 'sans-900', color: INK, baseline: 'middle' });
  });
  reveal(ctx, api.t, 0.32, () => {
    TT.text(ctx, '透明外壳只用来定位，器官各司其职。', W * 0.60, H * 0.30, 25, { fontKey: 'JiangChengYuanTi', color: MUTED, baseline: 'middle' });
  });
  reveal(ctx, api.t, 0.48, () => card(H * 0.38, '#E86A78', '循环系统', '心脏推动血液，把氧气与养分送到全身。'));
  reveal(ctx, api.t, 0.60, () => card(H * 0.38 + 128, '#63B9D1', '呼吸系统', '气道把空气送进肺，气体交换让氧气进入血液。'));
  reveal(ctx, api.t, 0.72, () => card(H * 0.38 + 256, '#B58BE0', '神经系统', '脑与神经协调感觉、动作与身体调节。'));
  reveal(ctx, api.t, 0.86, () => {
    TT.text(ctx, '后续镜头会逐一靠近这些器官。', W * 0.60, H * 0.79, 23, { fontKey: 'JiangChengYuanTi', color: MUTED });
    TT.text(ctx, '模型 BodyParts3D · © The Database Center for Life Science · CC BY 4.0', W * 0.60, H * 0.845, 18, { fontKey: 'JiangChengYuanTi', color: 'rgba(101,117,138,0.72)' });
  });
};
