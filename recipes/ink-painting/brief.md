# ink-painting · 水墨写意

浓淡墨线慢慢长出来，大片留白交给观众补完。整幅内容写在 `scene.code` 里，`visual.md` 给纸、墨、笔锋、留白的物理规律。

## 何时用

- 东方美学、诗词、茶酒、历史或文化题材。
- 画面要“少而慢”：一笔分三段推进，留白占主体。
- 需要水墨笔锋的提按、晕染与印章，而不是规则图形。

## 何时不用

- 需要清晰步骤、图表或数据 → `whiteboard-explainer` / `crayon-guide`。
- 需要多镜头叙事或快节奏 → `flash-cut` / `footage-cut`。
- 画面必须铺满、信息密度高 → 该 recipe 的留白会变成空白。

## 内容怎么写

- `narration` 拆 2–3 场，每场独立 `scene.code`；`code` 只写画与题款，不照抄旁白。
- 舞台只用 `TT.board.wash(ctx, api, { bleed: true })`；不要再铺第二层底色。
- 笔迹只走 `TT.pen.stroke` / `TT.pen.track`，笔型 `inkbrush`；印章走 `TT.mark.seal`。
- 镜头保持静态（`TT.geom` 的 `from === to`），推镜会让笔迹面积被误读成持续落笔。
- 最后 12% 不落新笔；题款与印章落在空处，不压主体墨线。

## 视觉与数值依据

- `rules.safeMargin: 0.09`：水墨的留白更大，安全框比白板更内收。
- `rules.scale: title 1 / label 0.75 / note 0.55`；`rules.stroke: [3, 12]`，浓淡靠笔锋与叠笔，不靠换颜色。
- `rules.pen: inkbrush`、`rules.board: wash` 为固定值，换笔换板就换 recipe。
- 字幕 `plain`，`baseSize 46`、`lineHeight 1.22`、`top 0.78`、`size 0.8`；底带不抢墨线。
- `audio.mood: "cut"`，音量 0.1；`forbid` 见 `recipe.json`，尤其禁止规则几何图形代替墨线、印章压主体。

## demo

《一滴墨》三场：墨滴落纸先洇开再收住 / 笔锋提起，剩下交给留白 / 最后一方印落在空处。
三场对应“落墨、提笔、收印”，总时长约 10 秒。
