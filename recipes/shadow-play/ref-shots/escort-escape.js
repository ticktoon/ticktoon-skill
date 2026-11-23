/* @ticktoon-ref-shot
{
  "title": "押解夜路 · 刑徒道亡",
  "note": "三人同场、依次入场与离场；人物动作跟随两句旁白",
  "duration": 9.5,
  "resources": [
    { "type": "font", "name": "sans-900" },
    { "type": "font", "name": "sans-400" },
    { "type": "data", "name": "cast", "src": "skill:recipes/shadow-play/figures/cast.json" },
    { "type": "data", "name": "official", "src": "skill:recipes/shadow-play/figures/archetypes/official.json" },
    { "type": "data", "name": "soldier", "src": "skill:recipes/shadow-play/figures/archetypes/soldier.json" },
    { "type": "data", "name": "crone", "src": "skill:recipes/shadow-play/figures/archetypes/crone.json" },
    { "type": "data", "name": "gate", "src": "skill:recipes/shadow-play/figures/props/gate.json" }
  ],
  "tags": ["皮影", "多人调度", "入场", "离场", "系统旁白"]
}
*/
const T = api.t;
const S = TT.shadow;
const CAST = S.cast(api.data('cast'), {
  official: api.data('official'), soldier: api.data('soldier'), crone: api.data('crone'),
});
const FLOOR = H * 0.8;
const PS = 560;
const CUES = api.cues.length ? api.cues : [
  { text: '刘邦当时是沛县的泗水亭长，奉命押送刑徒去骊山服役。', start: 0.25, end: 5.16 },
  { text: '路还没走完，刑徒就逃了一路，眼看交不了差。', start: 5.56, end: 9.31 },
];
const at = (i, dt = 0) => (CUES[i]?.start ?? 0) + dt;
const lamps = [{ at: 0, to: 0.88, dur: 0.01, color: 'cold' }];
TT.board.stage(ctx, { W, H }, { seed: 3, variant: 0, screen: 'white' });
const L = S.light(ctx, W, H, { t: T, lamps, base: 1, variant: 0 });
S.prop(ctx, api.data('gate'), { t: T, x: W * 0.80, y: FLOOR, size: 360, at: 0.4, depth: 0.4 });

const aPose = S.motion(T, [S.steps.talk(at(0, 0.8), 2.2), S.steps.turn(at(1, 0.5))],
  { x: W * 0.32, face: 1, size: PS, seed: 5 });
const liu = S.puppet(ctx, CAST.刘邦, aPose, { t: T, at: 0.4, y: FLOOR, size: PS, enter: 'fade' });
S.placard(ctx, { t: T, text: '泗水亭长', at: at(0, 0.6), until: api.d, over: liu, size: 50 });

function prisoner(who, x, enterAt, exitAt, seed) {
  const size = PS * 0.9;
  const pose = S.motion(T, [
    S.steps.walk(enterAt, x, 1.6),
    S.steps.exit(exitAt, W + 240, 1.5),
  ], { x: -size * 0.6, face: 1, size, seed });
  S.puppet(ctx, CAST[who], pose, { t: T, at: enterAt, y: FLOOR, size, enter: 'left', enterDur: 1.6 });
}
prisoner('徒甲', W * 0.48, at(0, 0.9), at(1, 1.5), 7);
prisoner('徒乙', W * 0.60, at(0, 1.4), at(1, 0.4), 9);

S.dim(ctx, W, H, L.dark);
S.systemCaption(ctx, CUES.find((c) => T >= c.start && T < c.end), { t: T, W, H });
TT.board.stageFrame(ctx, { W, H });
