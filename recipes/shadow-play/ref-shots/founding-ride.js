/* @ticktoon-ref-shot
{
  "title": "纵马入汉 · 开国收束",
  "note": "马步与人物骑乘共享位置、汉旗、年份红签与收束大字",
  "duration": 10.1,
  "resources": [
    { "type": "font", "name": "sans-900" },
    { "type": "font", "name": "sans-400" },
    { "type": "data", "name": "cast", "src": "skill:recipes/shadow-play/figures/cast.json" },
    { "type": "data", "name": "official", "src": "skill:recipes/shadow-play/figures/archetypes/official.json" },
    { "type": "data", "name": "soldier", "src": "skill:recipes/shadow-play/figures/archetypes/soldier.json" },
    { "type": "data", "name": "crone", "src": "skill:recipes/shadow-play/figures/archetypes/crone.json" },
    { "type": "data", "name": "horse", "src": "skill:recipes/shadow-play/figures/props/horse.json" },
    { "type": "data", "name": "flag", "src": "skill:recipes/shadow-play/figures/props/flag.json" }
  ],
  "tags": ["皮影", "纵马", "骑乘", "旗帜", "结局"]
}
*/
const T = api.t;
const S = TT.shadow;
const CAST = S.cast(api.data('cast'), {
  official: api.data('official'), soldier: api.data('soldier'), crone: api.data('crone'),
});
const FLOOR = H * 0.8;
const CUES = api.cues.length ? api.cues : [
  { text: '后来他起兵于沛，公元前202年称帝，建立汉朝。', start: 0.25, end: 4.60 },
  { text: '从逃亡的亭长到开国皇帝，故事就从这条大蛇说起。', start: 5.00, end: 9.34 },
];
const at = (i, dt = 0) => (CUES[i]?.start ?? 0) + dt;
const until = (i, dt = 0) => (CUES[i]?.end ?? api.d) + dt;
const lamps = [{ at: 0, to: 1, dur: 0.01, color: 'warm' }];
TT.board.stage(ctx, { W, H }, { seed: 3, variant: 0, screen: 'white' });
const L = S.light(ctx, W, H, { t: T, lamps, base: 1, variant: 0 });

const moves = [S.steps.walk(at(0, 0.5), W * 0.55, 2.2), S.steps.walk(at(1, 0.2), W * 0.78, 2.5)];
const gallops = [{ a: at(0, 0.5), b: at(0, 3.1) }, { a: at(1, 0.2), b: at(1, 2.7) }];
const horse = S.prop(ctx, api.data('horse'), { t: T, x: W * 0.25, y: FLOOR, size: 390, at: 0.5, face: 'right', moves, gallops });
S.prop(ctx, api.data('flag'), { t: T, x: W * 0.13, y: FLOOR, size: 320, at: 0.8, until: api.d - 0.4, face: 'right', text: '汉' });
const pose = S.motion(T, [], { x: W * 0.25, face: 1, size: 470 });
S.puppet(ctx, CAST.刘邦, pose, { t: T, at: 0.5, y: FLOOR, size: 470, enter: 'fade', riding: horse });
S.placard(ctx, { t: T, text: '公元前202年 · 称帝', at: at(0, 1.0), until: until(0, -0.3), y: H * 0.13, size: 50 });
S.title(ctx, { t: T, text: '一剑斩开四百年', at: at(1, 0.3), until: until(1, 0.5), y: H * 0.22, size: 92 });

S.dim(ctx, W, H, L.dark);
S.systemCaption(ctx, CUES.find((c) => T >= c.start && T < c.end), { t: T, W, H });
TT.board.stageFrame(ctx, { W, H });
