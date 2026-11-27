/* @ticktoon-ref-shot
{
  "title": "史册批注 · 原文与解释",
  "note": "古籍文书、图内原文与系统旁白",
  "duration": 8.6,
  "resources": [
    { "type": "font", "name": "sans-900" },
    { "type": "font", "name": "sans-400" },
    { "type": "image", "name": "scroll", "src": "skill:recipes/paper-chronicle/icons/assets/scroll.svg" }
  ],
  "sfx": [
    { "type": "whoosh", "at": 0.1 },
    { "type": "wood", "at": 1.4 }
  ],
  "tags": ["纸上剧场", "古籍", "原文", "系统旁白"]
}
*/
const T = api.t;
const C = TT.chronicle;
const CUES = api.cues.length ? api.cues : [
  { text: '《史记》记载，刘邦估计照这样走下去，到骊山时人也会逃光，于是在丰西泽停了下来。', start: 1.0, end: 7.9 },
];
const at = (i, dt = 0) => (CUES[i]?.start ?? 0) + dt;
TT.board.stage(ctx, { W, H }, { seed: 3, variant: 0, screen: 'white' });
C.document(ctx, {
  t: T, at: 0.35, x: 330, y: 190, w: 1260, h: 430,
  title: '史记 · 高祖本纪', seal: '史', icon: api.img('scroll'), fontSize: 40, lineHeight: 78,
  lineStart: 0.45, lineDelay: 0.85, lineDuration: 0.9,
  lines: [
    '高祖以亭长为县送徒骊山，徒多道亡。',
    '自度比至皆亡之，到丰西泽中，止饮。',
    '夜乃解纵所送徒。',
  ],
});
TT.text(ctx, '原文出自《史记 · 高祖本纪》', W * 0.5, 700, 30,
  { fontKey: 'sans-400', color: '#5B4030', align: 'center', baseline: 'middle' });
C.systemCaption(ctx, CUES.find((c) => T >= c.start && T < c.end), { t: T, W, H });
TT.board.stageFrame(ctx, { W, H });
