/* @ticktoon-ref-shot
{
  "title": "全身到心脏聚焦",
  "note": "机位按心脏包围盒推进，右侧用三步循环解释泵血",
  "duration": 8,
  "bg": "#F4F7FB",
  "thumbTime": 5.5,
  "tags": ["3D", "心脏", "器官聚焦", "循环"],
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
const STAGE = { x: W * 0.04, y: H * 0.085, w: W * 0.505, h: H * 0.83, r: 30 };

const layer = api.three({
  rect: { x: STAGE.x, y: STAGE.y, width: STAGE.w, height: STAGE.h },
});
const T = api.THREE;
const H0 = TT.anatomy.height;

// 外壳、脑各自一份材质：推近胸腔时只淡掉与当前主题无关的部位。
const shell = new T.MeshStandardMaterial({ color: '#A8D4EA', transparent: true, opacity: 0.17, roughness: 0.55, depthWrite: false });
// 非目标器官与脑都是半透明参照：关掉 depthWrite，避免透明面互相遮挡出硬边。
const brain = new T.MeshStandardMaterial({ color: '#B58BE0', roughness: 0.68, transparent: true, depthWrite: false });
const heartMat = new T.MeshStandardMaterial({ color: '#E86A78', roughness: 0.55 });
const organ = {
  airways: new T.MeshStandardMaterial({ color: '#63B9D1', roughness: 0.62, transparent: true, opacity: 0.55, depthWrite: false }),
  liver: new T.MeshStandardMaterial({ color: '#B86D66', roughness: 0.70, transparent: true, opacity: 0.45, depthWrite: false }),
  stomach: new T.MeshStandardMaterial({ color: '#E9A65F', roughness: 0.68, transparent: true, opacity: 0.45, depthWrite: false }),
  kidneys: new T.MeshStandardMaterial({ color: '#A66FA0', roughness: 0.70, transparent: true, opacity: 0.45, depthWrite: false }),
};

const human = new T.Group();
human.add(TT.anatomy.mesh(T, 'body', shell));
human.add(TT.anatomy.mesh(T, 'brain', brain));
human.add(TT.anatomy.mesh(T, 'airways', organ.airways));
human.add(TT.anatomy.mesh(T, 'liver', organ.liver));
human.add(TT.anatomy.mesh(T, 'stomach', organ.stomach));
human.add(TT.anatomy.mesh(T, 'kidneys', organ.kidneys));
human.add(TT.anatomy.mesh(T, 'heart', heartMat));
layer.scene.add(human);

layer.scene.add(new T.AmbientLight('#FFFFFF', 1.15));
const key = new T.DirectionalLight('#FFFFFF', 2.3);
key.position.set(4, 7, 6);
layer.scene.add(key);
const fill = new T.DirectionalLight('#A9C8FF', 0.8);
fill.position.set(-5, 3, 2);
layer.scene.add(fill);
const rim = new T.DirectionalLight('#CFE4FF', 0.55);
rim.position.set(-2, 4, -6);
layer.scene.add(rim);

// 机位不写死坐标：全身按身高推，器官特写按目标包围盒推。
const HEART = TT.anatomy.center('heart');
const HEART_BOX = TT.anatomy.bounds('heart');
const HEART_SPAN = Math.max(HEART_BOX.size[0], HEART_BOX.size[1], HEART_BOX.size[2]);
const FROM = { pos: [H0 * 0.34, H0 * 0.54, H0 * 1.72], at: [0, H0 * 0.50, 0] };
const DIST = HEART_SPAN / 0.58 / 0.689;  // fov 38：可见高度 ≈ 0.689 × 距离；心脏占画面 58%
const TO = {
  pos: [HEART[0] + DIST * 0.40, HEART[1] + DIST * 0.12, HEART[2] + DIST * 0.90],
  at: HEART,
};
layer.camera.position.set(FROM.pos[0], FROM.pos[1], FROM.pos[2]);
layer.camera.lookAt(FROM.at[0], FROM.at[1], FROM.at[2]);
const lerp = (a, b, k) => a + (b - a) * k;

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
function flowStep(y, index, title, text) {
  ctx.save();
  ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.roundRect(W * 0.60, y, W * 0.345, 108, 20); ctx.fill();
  ctx.fillStyle = '#E86A78'; ctx.beginPath(); ctx.arc(W * 0.635, y + 54, 23, 0, Math.PI * 2); ctx.fill();
  TT.text(ctx, String(index), W * 0.635, y + 55, 24, { fontKey: 'sans-900', color: '#FFFFFF', align: 'center', baseline: 'middle' });
  TT.text(ctx, title, W * 0.67, y + 40, 29, { fontKey: 'sans-900', color: INK, baseline: 'middle' });
  TT.text(ctx, text, W * 0.67, y + 78, 23, { fontKey: 'JiangChengYuanTi', color: MUTED, baseline: 'middle' });
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

  const k = TT.ease.inOutCubic(TT.clamp01((api.t - 0.5) / 1.8));
  const clear = TT.clamp01((k - 0.30) / 0.45);
  // 推近时把外壳与脑让开；气道与腹腔器官压成浅色参照，心脏才是唯一实体。
  shell.opacity = 0.17 * (1 - clear);
  brain.opacity = 1 - TT.clamp01((k - 0.22) / 0.35);
  layer.camera.position.set(
    lerp(FROM.pos[0], TO.pos[0], k),
    lerp(FROM.pos[1], TO.pos[1], k),
    lerp(FROM.pos[2], TO.pos[2], k),
  );
  layer.camera.lookAt(
    lerp(FROM.at[0], TO.at[0], k),
    lerp(FROM.at[1], TO.at[1], k),
    lerp(FROM.at[2], TO.at[2], k),
  );
  stage(ctx);

  reveal(ctx, api.t, 0.85, () => {
    TT.text(ctx, 'ORGAN FOCUS / HEART', W * 0.60, H * 0.15, 22, { fontKey: 'sans-900', color: ACCENT });
  });
  reveal(ctx, api.t, 0.95, () => {
    TT.text(ctx, '心脏：让血液持续循环', W * 0.60, H * 0.235, 52, { fontKey: 'sans-900', color: INK, baseline: 'middle' });
  });
  reveal(ctx, api.t, 1.05, () => {
    TT.text(ctx, '位于胸腔中后部，略偏左。', W * 0.60, H * 0.30, 25, { fontKey: 'JiangChengYuanTi', color: MUTED, baseline: 'middle' });
  });
  reveal(ctx, api.t, 1.25, () => flowStep(H * 0.38, 1, '收集', '静脉血回流到右心，再进入肺部。'));
  reveal(ctx, api.t, 1.40, () => flowStep(H * 0.38 + 128, 2, '收缩', '心肌有节律地收缩，产生泵血动力。'));
  reveal(ctx, api.t, 1.55, () => flowStep(H * 0.38 + 256, 3, '输送', '左心把富氧血送往全身组织。'));
  reveal(ctx, api.t, 1.75, () => {
    TT.text(ctx, '泵血不是一次脉冲，而是持续协作的循环。', W * 0.60, H * 0.79, 23, { fontKey: 'JiangChengYuanTi', color: MUTED });
    TT.text(ctx, '模型 BodyParts3D · © The Database Center for Life Science · CC BY 4.0', W * 0.60, H * 0.845, 18, { fontKey: 'JiangChengYuanTi', color: 'rgba(101,117,138,0.72)' });
  });
};
