/* @ticktoon-ref-shot
{
  "title": "片头 · 丰西泽之夜",
  "note": "片名、地点红签、主角入场；大人物与空幕构成片头",
  "duration": 6,
  "resources": [
    { "type": "font", "name": "sans-900" },
    { "type": "font", "name": "sans-400" },
    { "type": "data", "name": "cast", "src": "skill:recipes/shadow-play/figures/cast.json" },
    { "type": "data", "name": "official", "src": "skill:recipes/shadow-play/figures/archetypes/official.json" },
    { "type": "data", "name": "soldier", "src": "skill:recipes/shadow-play/figures/archetypes/soldier.json" },
    { "type": "data", "name": "crone", "src": "skill:recipes/shadow-play/figures/archetypes/crone.json" },
    { "type": "data", "name": "moon", "src": "skill:recipes/shadow-play/figures/props/moon.json" },
    { "type": "data", "name": "reeds", "src": "skill:recipes/shadow-play/figures/props/reeds.json" }
  ],
  "tags": ["皮影", "片头", "定妆", "系统旁白", "空幕"]
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
  { text: '一个押送刑徒的小亭长，怎么就斩出了四百年大汉江山？', start: 1.25, end: 5.56 },
];
const at = (i, dt = 0) => (CUES[i]?.start ?? 0) + dt;
const until = (i, dt = 0) => (CUES[i]?.end ?? api.d) + dt;
const lamps = [];
S.lamp(lamps, 1.0, { to: 1, dur: 1.2 });
TT.board.stage(ctx, { W, H }, { seed: 3, variant: 0, screen: 'white' });
const L = S.light(ctx, W, H, { t: T, lamps, base: 0.05, variant: 0 });

S.prop(ctx, api.data('moon'), { t: T, x: W * 0.85, y: H * 0.15, size: 210, at: 0.8, depth: 0.2 });
S.prop(ctx, api.data('reeds'), { t: T, x: W * 0.08, y: FLOOR, size: 300, at: 0.8, depth: 0.35 });
S.prop(ctx, api.data('reeds'), { t: T, x: W * 0.93, y: FLOOR, size: 250, at: 0.9, depth: 0.45 });
S.title(ctx, { t: T, text: '刘邦斩白蛇', at: at(0, 0.3), until: until(0, 0.4), x: W * 0.36, y: H * 0.40, size: 104 });
S.placard(ctx, { t: T, text: '秦末 · 丰西泽', at: 0.9, until: until(0, 0.4), y: H * 0.14, size: 50 });

const enterAt = at(0, 0.5);
const pose = S.motion(T, [
  S.steps.walk(enterAt, W * 0.70, 1.6),
  S.steps.talk(at(0, 2.0), 2.0),
], { x: -PS * 0.6, face: 1, size: PS, seed: 3 });
const liu = S.puppet(ctx, CAST.刘邦, pose, { t: T, at: enterAt, y: FLOOR, size: PS * 0.95, enter: 'left', enterDur: 1.6 });
S.placard(ctx, { t: T, text: '刘邦', at: at(0, 1.6), until: api.d, over: liu, size: 54 });

S.dim(ctx, W, H, L.dark);
S.systemCaption(ctx, CUES.find((c) => T >= c.start && T < c.end), { t: T, W, H });
TT.board.stageFrame(ctx, { W, H });
