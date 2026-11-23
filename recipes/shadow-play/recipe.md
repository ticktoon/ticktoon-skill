# shadow-play · 皮影戏

以侧面镂空皮偶演完整戏剧情拍：大人物、透光幕布、少量道具、红签与黑签随旁白进场。重点不是搭建一张风景图，而是让观众看清“谁在哪里、做了什么、这句话为何重要”。

`ref-shots/` 的八场以《刘邦斩白蛇》为母版，示范多人调度、动作与 cue 同步、道具生命周期、灯光和签条。它们不是固定题材模板；新故事必须重新定妆、重新组织空间。

## 一、先叙事，再画面

- 一场承担一个完整戏剧情拍，可以有多句 narration。**场景管空间连续，cue 管表演节拍**；不要一句话就换场，也不要整幕只做同一个姿势。
- 先写每句旁白触发的变化：谁入场/离场、谁做什么动作、哪个道具出现、哪块签条显示、灯色是否改变。没有叙事功能的装饰不放。
- 主角通常 `460–600px` 高，配角按关系略小；脚底线默认 `0.8H`。不要让人物退成风景里的小配件。
- **空幕优先**：一场一个主要视觉关系，主角周围保留干净轮廓区。月亮、芦苇、酒坛、城门、马、蛇等必须参与剧情，不能只为填空。
- 同场多人最少保证站位、朝向、动作目的不同；至少两人在脸色、须发、头饰、袍色、体型中差两项。

## 二、固定层：不要重写视觉设计

以下结构在八场中保持不变，只有内容可以替换：

1. `TT.board.stageFrame(ctx, { W, H })` 舞台框，最后绘制。
2. `captions.style: "none"`，不启用公共字幕。
3. `TT.shadow.systemCaption(ctx, cue, { t: api.t, W, H })` 系统旁白条。
4. `TT.shadow.dialogueCaption(ctx, cue, speaker, { t: api.t, W, H })` 两段式角色对白条。

文字读取当前真实 cue：`api.cues.find(c => api.t >= c.start && api.t < c.end)`。系统旁白与角色对白按 cue 选择，不把角色名写入 narration 或 TTS。**角色 cue 只写这个角色实际说的话**，“某某说 / 回来报 / 只回了一句”等叙述应放进系统 cue 或删去，不能混进角色对白条。压暗先画，文字后画。

## 三、figures + data resource：先定妆，后分幕

`figures/` 是当前工程的素材池，分人读索引和机器读数据，缺一不可。

```text
figures/
  FIGURES.md              # 角色速查、识别特征、资源关系
  cast.json               # 本片角色：kind / look / colors / scale
  archetypes/*.json       # 基础皮片、关节层级、颜色槽
  props/*.json            # 可复用道具皮片
```

- `cast.json` 只写角色定妆，不复制整套皮片。相同基础人物用袍色、脸色、须发、头饰和尺度区分。
- `archetypes` 与 `props` 保存轮廓、洞、pivot 和静态层级。坐标只能放 data，不能散写到 scene.code，也不能塞回公共 kit。
- `FIGURES.md` 是 Agent 的快速索引；改造型先改数据与索引，再让所有场景复用同一 src。
- `scene.resources` 声明 cast、所需 archetype、props 和字体。引擎按 src 去重 fetch；kit 按文本缓存 JSON、按路径缓存 Path2D。
- 参考母版可用 `scripts/tools/extract-shadow-archetypes.mjs` 重新提取；正式故事应建立自己的 figures，而不是枚举刘邦角色。

```js
const S = TT.shadow;
const CAST = S.cast(api.data('cast'), {
  official: api.data('official'),
  soldier: api.data('soldier'),
  crone: api.data('crone'),
});
```

## 四、幕布与灯光

绘制顺序固定为：

```text
TT.board.stage 幕布
→ TT.shadow.light 冷/红光场
→ 道具与人物
→ TT.shadow.dim 压暗
→ 红签 / 黑签 / 标题 / 两种底部文字
→ TT.board.stageFrame 舞台框
```

- `stage(ctx, { W, H }, { seed, variant, screen })` 提供全幅低对比柔光、双八度连续纸筋和四边暗角，不画聚焦光斑。纸纹按 seed 在同页共享缓存，不逐帧闪动；**同一部片共用同一 seed**，不要逐场换纸。`screen: 'white'` 为常态，`'oil'` 只用于回忆、夜场等更暖的段落。
- `light({ t, lamps, base, variant })` 返回 `{ dark }`。冷光与红光是整幅色场，不是给背景加一圈炫光。
- 用 `S.lamp(lamps, at, { to, dur, color })` 写亮度与色温；`S.change` 只用于真正的换场暗亮，4 秒内最多一次。
- `red` 只给斩击、战火等高潮；`cold` 给夜路、逃亡、悲恸。禁止逐帧随机闪灯。

## 五、人物与 cue 动作

`S.motion(api.t, timeline, options)` 求关节姿态，`S.puppet` 按 data 皮片组装。不要逐场重写肩肘变换。

```js
const pose = S.motion(api.t, [
  S.steps.walk(at(0, 0.3), W * 0.42, 1.8),
  S.steps.talk(at(1, 0.2), 1.6),
  S.steps.bow(at(2, 0.4)),
], { x: W * 0.28, face: 1, size: 560, seed: 3 });

const actor = S.puppet(ctx, CAST.刘邦, pose, {
  t: api.t, at: 0.4, y: H * 0.8, size: 560, enter: 'fade',
});
```

- `at / until` 从当前 cue 的 `start / end` 推导，不写与语音无关的固定动作秒数。
- `steps.walk / exit` 的 `at` 是到位时刻；`talk / point / bow / fight / dance / sway / weep` 从指定时刻开始，结束后有释放。
- 另有 `fall / lie / rise / sink / turn / faceTo / strike`。`face:'hollow'` 是开脸，`solid` 是实脸；红脸忠勇、白脸奸诈、黑脸直率，老者白须。
- `enter:'fade'` 是从幕布后贴幕；`left / right` 用 walk 完成侧入。操偶杆由 kit 接实时手位，不能另画固定斜线。
- `actor` 返回值可传给 `S.placard({ over: actor })`，名签会跟随人物头顶。

## 六、道具、蛇与骑乘

```js
S.prop(ctx, api.data('reeds'), { t: api.t, x: W * 0.08, y: H * 0.8, size: 300, at: 0.5, depth: 0.35 });
```

- `prop` 支持 `at / until / depth / face / moves / gallops / falls`。马的四腿、芦苇摆动、旗帜布面和火焰由 kit 驱动。
- `S.snake({ t, x, y, len, w, face, at, crawl, rear, rearH, cut, sep, dead })` 支持爬行、昂首吐信、斩断分离与停颤。斩击时刻必须与旁白、人物 `fight` 和灯色共用。
- 骑乘先取得 `const horse = S.prop(...)`，再传给 `S.puppet(..., { riding: horse })`，人物与马共享位置和朝向。

## 七、红签、黑签、标题与结尾

- **红签**用于人物名、地点、年份和状态名签，`color:'black'` 的**黑签**用于原文引文、解释以及史实/附会判断；`vertical:true` 用于对照短签。黑签是画面内的引用/说明，不是底部字幕，也不与字幕重复全文。
- 红签默认吊线，黑签默认不吊线；`hanging` 可显式覆盖。**成组对照签必须统一吊线规则**，例如赤帝子/白帝子都显式 `hanging:true`。`swing:false` 只关闭摆动，不决定是否吊线。
- 签条只在与当前 cue 相关时出现，`at / until` 与语音一致；不要全场堆满。
- `S.title` 用于片名和收束大字；`S.endcard({ at, title, sub, seal })` 用于纯结尾卡。
- 签条和大字不替代底部系统旁白条/角色对白条，也不遮挡主角脸。

## 八、参考镜头

1. `hook-title.js`：片名、地点签、主角侧入。
2. `escort-escape.js`：多人入场、相继离场。
3. `release-followers.js`：放徒、黑签引文、壮士返回与躬身。
4. `snake-standoff.js`：探路往返、蛇昂首、拔剑斩断、冷暖光与两种底部文字。
5. `night-crone.js`：醉卧、夜哭、两段引文、沉没、起身。
6. `red-emperor-meaning.js`：人物/蛇对照、竖签、史实与附会。
7. `founding-ride.js`：马步与骑乘、汉旗、年份签、收束大字。
8. `endcard-seal.js`：纯结尾卡与印章。

## 禁止

- `scene.params`、固定题材构图枚举、默认堆房屋山水。
- 人物或道具坐标写进 scene.code、每幕复制造型、把造型塞进 kit。
- 动作时间脱离真实 cue；全场持续漂浮或所有人同频摆动。
- 小人物配密集灰点、假镂空、正面卡通圆脸、固定操偶杆。
- 公共字幕与自绘文字层叠加；文字被压暗；签条长期占满画面。
- `Math.random`、墙钟时间、逐帧 fetch/parse、每帧重建可缓存的 Path2D。

## 参数速查

| 项 | 约定 |
|---|---|
| 模式 | `code`，每场独立 `scene.code` |
| 主角高度 | 通常 460–600px；脚底线 `0.8H` |
| 舞台 | `TT.board.stage` + `TT.shadow.light/dim` + 固定 `stageFrame` |
| 素材 | `figures/FIGURES.md` + `cast.json` + archetypes/props data |
| 表演 | `steps + motion + puppet`；时间从 `api.cues` 推导 |
| 签条 | `placard / title / endcard` |
| 文字 | 固定 `systemCaption / dialogueCaption`；公共 captions 关闭 |
| 字体 | 标题与名签 `sans-900`，正文 `sans-400`，本场声明 |
| 安全边距 | `RULES.safeMargin = 0.055` |
| 节拍 | 场可含多个 cue；lead-in 1.2s / hold 2.2s / 最短 6.5s，长场按内容延长 |
