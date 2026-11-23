/* @ticktoon-ref-shot
{
  "title": "大蛇当道 · 一剑两段",
  "note": "探路往返、蛇昂首吐信、拔剑斩断与冷暖光切换；含角色对白条",
  "duration": 17.3,
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
  "tags": ["皮影", "白蛇", "拔剑", "角色对白", "灯光叙事"]
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
  { text: '一行人趁夜色穿行草泽，先派一个人前去探路。', start: 0.25, end: 3.9 },
  { text: '前有大蛇当道，还是绕道吧。', start: 4.30, end: 7.69 },
  { text: '壮士赶路，怕什么！', start: 8.09, end: 12.04 },
  { text: '他拔剑上前，一剑将白蛇斩作两段，道路豁然打开。', start: 12.44, end: 17.09 },
];
const at = (i, dt = 0) => (CUES[i]?.start ?? 0) + dt;
const until = (i, dt = 0) => (CUES[i]?.end ?? api.d) + dt;
const lamps = [{ at: 0, to: 0.85, dur: 0.01, color: 'cold' }];
S.lamp(lamps, at(3, 1.0), { to: 0.78, color: 'red', dur: 0.5 });
S.lamp(lamps, at(3, 2.4), { to: 0.85, color: 'cold', dur: 1.0 });
TT.board.stage(ctx, { W, H }, { seed: 3, variant: 0, screen: 'white' });
const L = S.light(ctx, W, H, { t: T, lamps, base: 1, variant: 0 });
S.prop(ctx, api.data('reeds'), { t: T, x: W * 0.07, y: FLOOR, size: 320, at: 0.4, depth: 0.3 });
S.prop(ctx, api.data('reeds'), { t: T, x: W * 0.95, y: FLOOR, size: 280, at: 0.5, depth: 0.45 });
S.prop(ctx, api.data('moon'), { t: T, x: W * 0.85, y: H * 0.14, size: 170, at: 0.4, depth: 0.2 });

const liuPose = S.motion(T, [
  S.steps.sway(at(0, 0.2), 3.5, 4),
  S.steps.walk(at(0, 0.3), W * 0.36, 2.2),
  S.steps.talk(at(1, 1.6), 1.2),
  S.steps.walk(at(2, 2.0), W * 0.46, 1.5),
  S.steps.fight(at(3, 0.3), 1.5),
], { x: W * 0.30, face: 1, size: PS, seed: 9 });
S.puppet(ctx, CAST.刘邦, liuPose, { t: T, at: 0.4, y: FLOOR, size: PS, enter: 'fade' });

function follower(who, x, target, at0, seed) {
  const size = PS * 0.9;
  const pose = S.motion(T, [S.steps.walk(at(0, 0.3), target, 2.4)], { x, face: 1, size, seed });
  S.puppet(ctx, CAST[who], pose, { t: T, at: at0, y: FLOOR, size, enter: 'fade' });
}
follower('徒甲', W * 0.22, W * 0.24, 0.7, 11);
follower('徒乙', W * 0.12, W * 0.14, 1.0, 13);

const scoutSize = PS * 0.88;
const scoutPose = S.motion(T, [
  S.steps.walk(at(0, 0.5), W + 180, 2.4),
  S.steps.walk(at(1, 0.4), W * 0.56, 1.8),
  S.steps.faceTo(at(1, 1.7), W * 0.36),
  S.steps.bow(at(1, 1.9)),
  S.steps.walk(at(2, 0.5), -W * 0.2, 1.8),
], { x: W * 0.46, face: 1, size: scoutSize, seed: 15 });
S.puppet(ctx, CAST.探路人, scoutPose, { t: T, at: 1.3, y: FLOOR, size: scoutSize, enter: 'fade' });

S.placard(ctx, { t: T, text: '前有大蛇当径，愿还', at: at(1, 0.9), until: until(1, 0.3), y: H * 0.16, size: 54, color: 'black', swing: false });
S.placard(ctx, { t: T, text: '壮士行，何畏', at: at(2, 1.7), until: until(2, 0.5), y: H * 0.16, size: 54, color: 'black', swing: false });
S.snake(ctx, {
  t: T, x: W * 0.90, y: FLOOR - 60, len: 600, w: 56, face: 'left',
  at: at(1, 0.7), crawl: 55, crawlFor: 3.2, amp: 18,
  rear: [at(2, 1.2), at(2, 1.9)], rearH: 190, cut: at(3, 1.5), sep: 95,
});

S.dim(ctx, W, H, L.dark);
const cueIndex = CUES.findIndex((c) => T >= c.start && T < c.end);
const cue = CUES[cueIndex];
if (cueIndex === 1) S.dialogueCaption(ctx, cue, '探路人', { t: T, W, H });
else if (cueIndex === 2) S.dialogueCaption(ctx, cue, '刘邦', { t: T, W, H });
else S.systemCaption(ctx, cue, { t: T, W, H });
TT.board.stageFrame(ctx, { W, H });
