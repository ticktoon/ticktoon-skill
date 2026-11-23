/* @ticktoon-ref-shot
{
  "title": "全身到气道树聚焦",
  "note": "机位按气道包围盒推进，右侧用肺泡示意图解释气体交换",
  "duration": 8,
  "bg": "#F4F7FB",
  "thumbTime": 5.5,
  "tags": ["3D", "气道", "器官聚焦", "气体交换"],
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

const shell = new T.MeshStandardMaterial({ color: '#A8D4EA', transparent: true, opacity: 0.17, roughness: 0.55, depthWrite: false });
// 非目标器官与脑都是半透明参照：关掉 depthWrite，避免透明面互相遮挡出硬边。
const brain = new T.MeshStandardMaterial({ color: '#B58BE0', roughness: 0.68, transparent: true, depthWrite: false });
const airwayMat = new T.MeshStandardMaterial({ color: '#63B9D1', roughness: 0.60 });
const organ = {
  heart: new T.MeshStandardMaterial({ color: '#E86A78', roughness: 0.55, transparent: true, opacity: 0.40, depthWrite: false }),
  liver: new T.MeshStandardMaterial({ color: '#B86D66', roughness: 0.70, transparent: true, opacity: 0.40, depthWrite: false }),
  stomach: new T.MeshStandardMaterial({ color: '#E9A65F', roughness: 0.68, transparent: true, opacity: 0.40, depthWrite: false }),
  kidneys: new T.MeshStandardMaterial({ color: '#A66FA0', roughness: 0.70, transparent: true, opacity: 0.40, depthWrite: false }),
};

const human = new T.Group();
human.add(TT.anatomy.mesh(T, 'body', shell));
human.add(TT.anatomy.mesh(T, 'brain', brain));
human.add(TT.anatomy.mesh(T, 'heart', organ.heart));
human.add(TT.anatomy.mesh(T, 'liver', organ.liver));
human.add(TT.anatomy.mesh(T, 'stomach', organ.stomach));
human.add(TT.anatomy.mesh(T, 'kidneys', organ.kidneys));
human.add(TT.anatomy.mesh(T, 'airways', airwayMat));
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

// 全程机位：全身 → 气道树。气道树宽而扁，视距同样由包围盒推，不写死距离。
const AIR = TT.anatomy.center('airways');
const AIR_BOX = TT.anatomy.bounds('airways');
const AIR_SPAN = Math.max(AIR_BOX.size[0], AIR_BOX.size[1], AIR_BOX.size[2]);
const FROM = { pos: [H0 * 0.34, H0 * 0.54, H0 * 1.72], at: [0, H0 * 0.50, 0] };
const DIST = AIR_SPAN / 0.72 / 0.689;  // fov 38：可见高度 ≈ 0.689 × 距离；气道树占画面 72%
const TO = {
  pos: [AIR[0] + DIST * 0.34, AIR[1] + DIST * 0.10, AIR[2] + DIST * 0.94],
  at: AIR,
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
// 肺泡簇：只表示"一个肺泡连着毛细血管"的结构，不是真实组织比例。
function alveoli(ctx, cx, cy) {
  ctx.save();
  ctx.strokeStyle = '#9FC7DE'; ctx.lineWidth = 3;
  for (let i = 0; i < 7; i += 1) {
    const a = (i * Math.PI * 2) / 7 - Math.PI / 2;
    const x = cx + Math.cos(a) * 64;
    const y = cy + Math.sin(a) * 56;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(99, 185, 209, 0.18)'; ctx.fill();
    ctx.strokeStyle = '#63B9D1'; ctx.lineWidth = 2.5; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(cx, cy, 42, 0, Math.PI * 2); ctx.fillStyle = '#63B9D1'; ctx.fill();
  TT.text(ctx, '肺泡', cx, cy + 1, 22, { fontKey: 'sans-900', color: '#FFFFFF', align: 'center', baseline: 'middle' });
  ctx.restore();
}
function gasCard(y, color, gas, text) {
  ctx.save();
  ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.roundRect(W * 0.60, y, W * 0.345, 108, 20); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(W * 0.625, y + 24, 96, 60, 14); ctx.fill();
  TT.text(ctx, gas, W * 0.625 + 48, y + 55, 24, { fontKey: 'sans-900', color: '#FFFFFF', align: 'center', baseline: 'middle' });
  TT.text(ctx, text, W * 0.70, y + 55, 24, { fontKey: 'JiangChengYuanTi', color: INK, baseline: 'middle' });
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
  shell.opacity = 0.17 * (1 - TT.clamp01((k - 0.30) / 0.45));
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
    TT.text(ctx, 'ORGAN FOCUS / AIRWAY', W * 0.60, H * 0.15, 22, { fontKey: 'sans-900', color: ACCENT });
  });
  reveal(ctx, api.t, 0.95, () => {
    TT.text(ctx, '气道：把空气送进肺', W * 0.60, H * 0.235, 52, { fontKey: 'sans-900', color: INK, baseline: 'middle' });
  });
  reveal(ctx, api.t, 1.05, () => {
    TT.text(ctx, '气管分叉成支气管，逐级变细到肺泡。', W * 0.60, H * 0.30, 25, { fontKey: 'JiangChengYuanTi', color: MUTED, baseline: 'middle' });
  });
  reveal(ctx, api.t, 1.25, () => alveoli(ctx, W * 0.7725, H * 0.45));
  reveal(ctx, api.t, 1.45, () => gasCard(H * 0.58, '#63B9D1', 'O₂', '氧气进入血液'));
  reveal(ctx, api.t, 1.60, () => gasCard(H * 0.58 + 128, '#8B93A5', 'CO₂', '二氧化碳进入肺泡'));
  reveal(ctx, api.t, 1.80, () => {
    TT.text(ctx, '空气走完这段分支，才有和血液交换的机会。', W * 0.60, H * 0.79, 23, { fontKey: 'JiangChengYuanTi', color: MUTED });
    TT.text(ctx, '模型 BodyParts3D · © The Database Center for Life Science · CC BY 4.0', W * 0.60, H * 0.845, 18, { fontKey: 'JiangChengYuanTi', color: 'rgba(101,117,138,0.72)' });
  });
};
