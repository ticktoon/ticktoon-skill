/* @ticktoon-ref-shot
{
  "title": "丰西泽 · 路线展开",
  "note": "路线在丰西泽停止：图示必须服从故事进度，而不是机械走完整条参考路线",
  "duration": 9.2,
  "resources": [
    { "type": "font", "name": "sans-900" },
    { "type": "font", "name": "sans-400" },
    { "type": "data", "name": "map", "src": "skill:recipes/paper-chronicle/data/central-plains.json" },
    { "type": "image", "name": "castle", "src": "skill:recipes/paper-chronicle/icons/assets/castle.svg" }
  ],
  "sfx": [
    { "type": "whoosh", "at": 0.1 },
    { "type": "step", "at": 1.3, "gain": 0.45 },
    { "type": "wood", "at": 3.4 }
  ],
  "tags": ["纸上剧场", "舆图", "路线", "印章", "系统旁白"]
}
*/
const T = api.t;
const C = TT.chronicle;
const MAP = C.readData(api.data('map'));
const CUES = api.cues.length ? api.cues : [
  { text: '刘邦奉命押送刑徒前往骊山，可还没走到，人就逃了一路。', start: 0.9, end: 5.0 },
  { text: '走到丰西泽，他索性停下来，重新安排所有人的去路。', start: 5.35, end: 8.8 },
];
const at = (i, dt = 0) => (CUES[i]?.start ?? 0) + dt;
TT.board.stage(ctx, { W, H }, { seed: 3, variant: 0, screen: 'white' });
const frame = C.map(ctx, MAP, { t: T, at: 0.25, x: 150, y: 135, w: 1620, h: 665, style: 'antique' });
for (const [i, key] of ['peixian', 'fengxi', 'lishan'].entries()) {
  const p = MAP.places[key];
  C.place(ctx, { t: T, at: at(0, 0.1 + i * 0.35), frame, point: p.point, name: p.name, color: key === 'fengxi' ? 'red' : 'ochre' });
}
if (frame) {
  const city = MAP.places.xianyang;
  const cityX = frame.x + city.point[0] * frame.w, cityY = frame.y + city.point[1] * frame.h;
  C.icon(ctx, api.img('castle'), { t: T, at: at(0, 0.2), x: cityX, y: cityY, size: 48 });
  TT.text(ctx, city.name, cityX, cityY - 34, 28, { fontKey: 'sans-900', color: '#3B2819', align: 'center', baseline: 'bottom' });
}
const route = C.route(ctx, { t: T, at: at(0, 0.4), duration: 2.2, frame, points: MAP.routes.toFengxi, color: 'red', width: 8 });
if (route) {
  C.seal(ctx, { t: T, at: at(0, 0.3), x: route.x, y: route.y - 48, text: '刘', sub: '刘邦', radius: 42, fontSize: 36, subSize: 28, active: true });
  if (T >= CUES[1].start) {
    const q = C.seg(T, CUES[1].start, CUES[1].start + 0.5, C.E.out);
    ctx.save(); ctx.globalAlpha = q * 0.65; ctx.strokeStyle = '#B5321F'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(route.x, route.y, 34 + 8 * Math.sin(T * 3), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    TT.text(ctx, '止步 · 新的抉择', route.x, route.y + 74, 30, { fontKey: 'sans-900', color: '#7A1E14', align: 'center', baseline: 'middle' });
  }
}
C.systemCaption(ctx, CUES.find((c) => T >= c.start && T < c.end), { t: T, W, H });
TT.board.stageFrame(ctx, { W, H });
