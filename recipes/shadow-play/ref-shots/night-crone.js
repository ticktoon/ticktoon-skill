/* @ticktoon-ref-shot
{
  "title": "醉卧夜哭 · 老妪忽隐",
  "note": "醉卧、老妪啼哭、两段引文、沉没与起身；六句旁白共用一个空间",
  "duration": 24.2,
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
  "tags": ["皮影", "老妪", "夜哭", "沉没", "角色对白", "冷光"]
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
  { text: '又走了几里，酒意上来，刘邦倒头便睡。', start: 0.25, end: 3.55 },
  { text: '落在后面的人经过斩蛇处，见一位老妪在夜里啼哭。', start: 3.95, end: 8.13 },
  { text: '我儿子是白帝之子，化作大蛇当道——', start: 8.53, end: 12.10 },
  { text: '如今，被赤帝之子杀了。', start: 12.50, end: 14.48 },
  { text: '众人当她说笑，正要呵斥，老妪忽然不见了。', start: 15.38, end: 19.10 },
  { text: '刘邦听说后心独喜，暗暗自负，跟随的人越来越敬畏他。', start: 19.50, end: 23.99 },
];
const at = (i, dt = 0) => (CUES[i]?.start ?? 0) + dt;
const until = (i, dt = 0) => (CUES[i]?.end ?? api.d) + dt;
const lamps = [{ at: 0, to: 0.72, dur: 0.01, color: 'cold' }];
TT.board.stage(ctx, { W, H }, { seed: 3, variant: 0, screen: 'white' });
const L = S.light(ctx, W, H, { t: T, lamps, base: 1, variant: 0 });
S.prop(ctx, api.data('reeds'), { t: T, x: W * 0.06, y: FLOOR, size: 300, at: 0.4, depth: 0.35 });
S.prop(ctx, api.data('reeds'), { t: T, x: W * 0.96, y: FLOOR, size: 260, at: 0.5, depth: 0.45 });
S.prop(ctx, api.data('moon'), { t: T, x: W * 0.14, y: H * 0.13, size: 150, at: 0.4, depth: 0.25 });
S.snake(ctx, { t: T, x: W * 0.76, y: FLOOR - 50, len: 440, w: 54, face: 'left', dead: true, sep: 60, at: 0.6 });

const liuPose = S.motion(T, [
  S.steps.lie(at(0, 0.8), { back: true }),
  S.steps.rise(at(5, 0.2), 0.9),
  S.steps.talk(at(5, 1.0), 2.0),
], { x: W * 0.42, face: 1, size: PS, seed: 12 });
const liu = S.puppet(ctx, CAST.刘邦, liuPose, { t: T, at: 0.5, y: FLOOR, size: PS, enter: 'fade' });

const croneUntil = until(4, 2.0);
const cronePose = S.motion(T, [
  S.steps.weep(at(1, 1.1), 4.0),
  S.steps.talk(at(2, 0.3), 3.0),
  S.steps.talk(at(3, 0.1), 1.4),
  S.steps.sink(at(4, 1.0), 1.8),
], { x: W * 0.56, face: 1, size: PS, stoop: 1, seed: 14, until: croneUntil });
const crone = S.puppet(ctx, CAST.老妪, cronePose, { t: T, at: at(1, 0.3), until: croneUntil, y: FLOOR, size: PS * 0.92, enter: 'fade' });
S.placard(ctx, { t: T, text: '老妪', at: at(1, 1.2), until: until(1, -0.2), over: crone, size: 54 });
S.placard(ctx, { t: T, text: '吾子，白帝子也', at: at(2, 0.4), until: until(2, -0.2), y: H * 0.11, size: 54, color: 'black', swing: false });
S.placard(ctx, { t: T, text: '今为赤帝子斩之', at: at(3, 0.2), until: until(3, 1.0), y: H * 0.11, size: 54, color: 'black', swing: false });
S.placard(ctx, { t: T, text: '心独喜', at: at(5, 1.1), until: api.d, over: liu, size: 54 });

S.dim(ctx, W, H, L.dark);
const cueIndex = CUES.findIndex((c) => T >= c.start && T < c.end);
const cue = CUES[cueIndex];
if (cueIndex === 2 || cueIndex === 3) S.dialogueCaption(ctx, cue, '老妪', { t: T, W, H });
else S.systemCaption(ctx, cue, { t: T, W, H });
TT.board.stageFrame(ctx, { W, H });
