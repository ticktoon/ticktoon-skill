/* @ticktoon-ref-shot
{
  "title": "丰西泽放徒 · 壮士愿从",
  "note": "多人退场与返回、黑签引文、躬身；同一场内连续推进三句旁白",
  "duration": 11.3,
  "resources": [
    { "type": "font", "name": "sans-900" },
    { "type": "font", "name": "sans-400" },
    { "type": "data", "name": "cast", "src": "skill:recipes/shadow-play/figures/cast.json" },
    { "type": "data", "name": "official", "src": "skill:recipes/shadow-play/figures/archetypes/official.json" },
    { "type": "data", "name": "soldier", "src": "skill:recipes/shadow-play/figures/archetypes/soldier.json" },
    { "type": "data", "name": "crone", "src": "skill:recipes/shadow-play/figures/archetypes/crone.json" },
    { "type": "data", "name": "jar", "src": "skill:recipes/shadow-play/figures/props/jar.json" },
    { "type": "data", "name": "reeds", "src": "skill:recipes/shadow-play/figures/props/reeds.json" }
  ],
  "tags": ["皮影", "多人调度", "黑签引文", "躬身", "系统旁白"]
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
  { text: '夜里歇在丰西泽，他干脆解开绳索，放走了所有人。', start: 0.25, end: 4.25 },
  { text: '你们都走吧，我也不干了。', start: 4.65, end: 7.61 },
  { text: '十多个壮士，愿意留下来跟着他。', start: 8.51, end: 11.06 },
];
const at = (i, dt = 0) => (CUES[i]?.start ?? 0) + dt;
const until = (i, dt = 0) => (CUES[i]?.end ?? api.d) + dt;
const lamps = [{ at: 0, to: 0.82, dur: 0.01, color: 'cold' }];
TT.board.stage(ctx, { W, H }, { seed: 3, variant: 0, screen: 'white' });
const L = S.light(ctx, W, H, { t: T, lamps, base: 1, variant: 0 });
S.prop(ctx, api.data('jar'), { t: T, x: W * 0.14, y: FLOOR, size: 170, at: 0.5 });
S.prop(ctx, api.data('reeds'), { t: T, x: W * 0.90, y: FLOOR, size: 280, at: 0.5, depth: 0.4 });

const liuPose = S.motion(T, [S.steps.talk(at(0, 0.6), 1.4), S.steps.talk(at(2, 0.8), 1.2)],
  { x: W * 0.32, face: 1, size: PS, seed: 4 });
S.puppet(ctx, CAST.刘邦, liuPose, { t: T, at: 0.4, y: FLOOR, size: PS, enter: 'fade' });

function fadePrisoner(who, x, at0, extra, seed) {
  const size = PS * 0.9;
  const pose = S.motion(T, extra, { x, face: -1, size, seed });
  S.puppet(ctx, CAST[who], pose, { t: T, at: at0, y: FLOOR, size, enter: 'fade' });
}
fadePrisoner('徒甲', W * 0.48, 0.8, [S.steps.walk(at(0, 1.0), W * 0.46, 1.3), S.steps.bow(at(2, 1.4))], 8);
fadePrisoner('徒乙', W * 0.62, 1.2, [S.steps.exit(at(0, 0.8), W + 220, 1.4)], 10);
fadePrisoner('探路人', W * 0.74, 1.6, [S.steps.exit(at(0, 1.3), W + 220, 1.4)], 12);

function returning(who, x, at0, seed) {
  const size = PS * 0.9;
  const pose = S.motion(T, [S.steps.walk(at0, x, 1.6)], { x: W + size * 0.6, face: -1, size, seed });
  S.puppet(ctx, CAST[who], pose, { t: T, at: at0, y: FLOOR, size, enter: 'right', enterDur: 1.6 });
}
returning('徒乙', W * 0.62, at(2, 0.2), 14);
returning('探路人', W * 0.74, at(2, 0.6), 16);
S.placard(ctx, { t: T, text: '公等皆去，吾亦从此逝矣', at: at(1), until: until(1, 0.4), y: H * 0.17, size: 54, color: 'black', swing: false });

S.dim(ctx, W, H, L.dark);
const cueIndex = CUES.findIndex((c) => T >= c.start && T < c.end);
const cue = CUES[cueIndex];
if (cueIndex === 1) S.dialogueCaption(ctx, cue, '刘邦', { t: T, W, H });
else S.systemCaption(ctx, cue, { t: T, W, H });
TT.board.stageFrame(ctx, { W, H });
