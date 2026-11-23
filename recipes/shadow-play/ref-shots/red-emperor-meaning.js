/* @ticktoon-ref-shot
{
  "title": "赤帝白帝 · 史实与附会",
  "note": "人物与蛇左右对照、竖签、红签和黑签依次替换；叙事解释场",
  "duration": 17.1,
  "resources": [
    { "type": "font", "name": "sans-900" },
    { "type": "font", "name": "sans-400" },
    { "type": "data", "name": "cast", "src": "skill:recipes/shadow-play/figures/cast.json" },
    { "type": "data", "name": "official", "src": "skill:recipes/shadow-play/figures/archetypes/official.json" },
    { "type": "data", "name": "soldier", "src": "skill:recipes/shadow-play/figures/archetypes/soldier.json" },
    { "type": "data", "name": "crone", "src": "skill:recipes/shadow-play/figures/archetypes/crone.json" }
  ],
  "tags": ["皮影", "对照", "红签", "黑签", "史实与传说"]
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
  { text: '按五德终始的说法，秦尚水德尚黑，汉自居火德尚赤。', start: 0.25, end: 5.04 },
  { text: '赤帝之子斩白帝之子，正是给汉朝量身定做的开国神话。', start: 5.44, end: 10.29 },
  { text: '斩蛇，是《史记》里白纸黑字的行为。', start: 10.69, end: 13.44 },
  { text: '老妪夜哭，多半是流传下来的造神附会。', start: 13.84, end: 16.93 },
];
const at = (i, dt = 0) => (CUES[i]?.start ?? 0) + dt;
const until = (i, dt = 0) => (CUES[i]?.end ?? api.d) + dt;
const lamps = [{ at: 0, to: 0.95, dur: 0.01, color: 'warm' }];
TT.board.stage(ctx, { W, H }, { seed: 3, variant: 0, screen: 'white' });
const L = S.light(ctx, W, H, { t: T, lamps, base: 1, variant: 0 });

const pose = S.motion(T, [S.steps.talk(at(1, 0.5), 2.0)], { x: W * 0.28, face: 1, size: PS, seed: 16 });
const liu = S.puppet(ctx, CAST.刘邦, pose, { t: T, at: 0.5, y: FLOOR, size: PS, enter: 'fade' });
S.snake(ctx, { t: T, x: W * 0.74, y: FLOOR, len: 500, w: 46, face: 'left', at: 0.8, rear: [1.0, 1.7], rearH: 200, amp: 14 });
S.placard(ctx, { t: T, text: '秦 · 尚黑', at: at(0, 0.6), until: until(0, -0.3), x: W * 0.13, y: H * 0.28, vertical: true, color: 'black', size: 50, swing: false, hanging: true });
S.placard(ctx, { t: T, text: '汉 · 尚赤', at: at(0, 0.6), until: until(0, -0.3), x: W * 0.88, y: H * 0.28, vertical: true, size: 50, swing: false, hanging: true });
S.placard(ctx, { t: T, text: '赤帝子', at: at(1, 0.4), until: until(1, -0.3), over: liu, size: 54 });
S.placard(ctx, { t: T, text: '白帝子', at: at(1, 0.7), until: until(1, -0.3), x: W * 0.74, y: H * 0.30, size: 50, color: 'black', swing: false, hanging: true });
S.placard(ctx, { t: T, text: '斩蛇 · 载于《史记·高祖本纪》', at: at(2), until: until(2, -0.55), y: H * 0.50, size: 48, color: 'black', swing: false });
S.placard(ctx, { t: T, text: '夜哭 · 多为后世附会', at: at(3), until: api.d, y: H * 0.50, size: 48, color: 'black', swing: false });

S.dim(ctx, W, H, L.dark);
S.systemCaption(ctx, CUES.find((c) => T >= c.start && T < c.end), { t: T, W, H });
TT.board.stageFrame(ctx, { W, H });
