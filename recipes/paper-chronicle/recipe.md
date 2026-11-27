# paper-chronicle · 纸上剧场

用纸幕、舆图、纸偶、文书、门阙和旗幡讲清一个故事。它适合历史、传记、民间传说和神话科普：观众不仅看到知识点，还应看到一个问题的提出、一次选择及其后果。

## 一、先写故事，再选镜头

### 完整叙事链

正式故事必须围绕**一个核心问题**组织，并覆盖以下环节；相邻环节可以合并，但不能只罗列图示：

```text
背景与困境
→ 选择或冲突
→ 证据或关键细节
→ 后果与反转
→ 意义收束
```

例如“刘邦为什么放走刑徒”不能只做地图、原文和年表，还要表现押送困境、两个选择、众人离开、壮士返回，以及身份关系的变化。

### 信息密度

- 通常先做 **60–90 秒、6–10 场**，按内容增减，不固定场数。
- 片头和结尾通常各约 4–5 秒；不要用长片名和长结尾消耗叙事时间。
- 每个 cue 必须提供新事实、新关系或新解释，**不能把同一句话拆成多段凑节拍**。
- 每 5–8 秒至少出现一次有意义的变化：路线停止、选项确定、人数减少、证据揭示、关系反转等。
- 图内文字和底部旁白不得重复搬运同一句话。

### 参考镜头不是整片目录

`ref-shots/` 是能力样例，展示图形、素材和节拍如何配合。**禁止按文件名顺序机械拼成“片头、地图、文书、印章、年表、结尾”。** 根据故事选择、组合或改造镜头；需要新关系时先扩展图形，而不是硬套最接近的示例。

## 二、制作顺序

1. 用一句话写核心问题。
2. 列出困境、选择、证据、后果和意义。
3. 为每个环节选择主图示及必要的辅助标注。
4. 列素材计划：核心图标、可选头像、地图或项目图片；素材能提升理解时主动使用。
5. 再写 scene.code，让所有动画时间从真实 cue 推导。

## 三、固定层

绘制顺序：

```text
TT.board.stage 纸幕
→ 主图示与辅助细节
→ 图内标题和标注
→ 固定系统旁白条或角色对白条
→ TT.board.stageFrame 舞台框
```

1. `TT.board.stageFrame(ctx, { W, H })` 最后绘制。
2. `captions.style: "none"`，不启用公共字幕。
3. `TT.chronicle.systemCaption(ctx, cue, { t: api.t, W, H })` 系统旁白条。
4. `TT.chronicle.dialogueCaption(ctx, cue, speaker, { t: api.t, W, H })` 角色对白条。

文字读取当前真实 cue：`api.cues.find(c => api.t >= c.start && api.t < c.end)`。角色 cue 只写人物实际发言；叙述、原文出处和解释使用系统旁白或图内文字。

## 四、内容 API

```js
const C = TT.chronicle;
const T = api.t;
TT.board.stage(ctx, { W, H }, { seed: 3, variant: 0, screen: 'white' });
```

### 舆图与路线

```js
const MAP = C.readData(api.data('map'));
const frame = C.map(ctx, MAP, {
  t: T, at: 0.3, x: 150, y: 140, w: 1620, h: 660, style: 'antique',
});
const route = C.route(ctx, {
  t: T, at: 1.0, duration: 2.4, frame,
  points: MAP.routes.toFengxi, color: 'red',
});
C.seal(ctx, { t: T, at: 0.8, x: route.x, y: route.y, text: '刘', radius: 46 });
```

- `style:'antique'` 使用柔和边界、细经纬线、山体晕滃、河流注记和罗盘。
- 数据采用归一化坐标；`C.route` 返回当前端点，可让符号跟随。
- 路线只能走到当前叙事实际发生的位置；如果故事在中途停止，图示也必须停止。
- 当前数据是示意舆图，不冒充精确地理。

### 人物符号与图标

```js
C.seal(ctx, { t: T, at: 0.5, x: 960, y: 400, text: '刘', sub: '刘邦', active: true });
C.icon(ctx, api.img('scroll'), { t: T, at: 0.4, x: 420, y: 250, size: 52 });
```

`active` 表示当前讲话者。`icons/` 提供 59 个核心 SVG；特殊图标和图片按项目获取。符号与图标必须帮助识别人物、地点或事件，不作无意义装饰。

### 文书

```js
C.document(ctx, {
  t: T, at: 0.4, x: 330, y: 180, w: 1260, h: 560,
  title: '史记 · 高祖本纪', icon: api.img('scroll'), seal: '史',
  lines: ['高祖以亭长为县送徒骊山，徒多道亡。', '自度比至皆亡之，到丰西泽中，止饮。'],
});
```

正文默认逐行从左到右揭示，可用 `lineStart / lineDelay / lineDuration` 调整，`reveal:false` 关闭动画。

### 岔路推演

```js
const B = C.fork(ctx, {
  t: T, at: 0.3, x: 170, y: 130, w: 1580, h: 690,
  title: '丰西泽之夜 · 纸上推演',
  from: [0.06, 0.68], fork: [0.42, 0.55], hubLabel: '丰西泽', selected: 1,
  branches: [
    { label: '继续押送骊山', note: '到骊山也难交差', icon: api.img('gate'), to: [0.86, 0.24] },
    { label: '就地放徒', note: '众人自由 · 刘邦担罪', icon: api.img('flame'), to: [0.86, 0.78], color: 'red' },
  ],
});
const p = C.pointOnPath(B.branches[1].points, 0.45);
C.seal(ctx, { t: T, at: 0.9, x: p.x, y: p.y - 6, text: '刘', radius: 44 });
```

`selected` 会点亮选中的岔路并压暗另一条；`branches[i].points` 可让印章或人物沿路移动。两条岔路必须写出不同后果，不能只是两个同义标题。

### 纸偶人物

```js
C.figure(ctx, { t: T, at: 0.4, x: 980, y: 860, h: 300, style: 'official', dir: 1 });
C.figure(ctx, { t: T, at: 1.2, x: 1200, y: 820, h: 90, color: '#6E6B58', bob: 2, lean: -0.03 });
```

`style`：`commoner / official / soldier / elder / leader`（`leader` 自带披风）。位移、步幅、远近和淡入淡出都由场景按 cue 计算；`dir` 控制朝向。人物是纸偶像，不做面部表演，靠站位、朝向和数量变化表达关系。

### 门阙

```js
C.gate(ctx, { t: T, at: 0.3, x: 340, y: 600, w: 300, h: 320, alpha: 0.9 });
```

代码画的中式门阙：城台、拱门与起翘屋檐，用于官府、城门、关卡。`alpha` 可随解说压暗，表示权威退场。

### 旗幡

```js
C.banner(ctx, { t: T, at: 4.6, x: 1600, y: 862, h: 420, text: '同行者', color: 'red' });
```

竖幡，文字逐字竖排；`at` 之后垂落展开并轻微摆动。用于点明身份、队伍或地点，不替代旁白。

### 年表

```js
C.timeline(ctx, {
  t: T, at: 0.4, x: 240, y: 470, w: 1440,
  events: [
    { year: '前209', label: '沛县起兵', at: 1.0, icon: api.img('banner') },
    { year: '前202', label: '建立汉朝', at: 2.0, active: true },
  ],
});
```

节点、图标和高亮都跟随时点；第二句解说应补充意义，而不是重复节点名称。

## 五、参考镜头

- `hook-title.js`：直接提出核心问题。
- `map-route.js`：真实进度、路线停止和新抉择。
- `fork-decision.js`：在纸面上推演两条岔路及其不同后果。
- `archive-quote.js`：逐行文书、原文与出处。
- `leave-return.js`：纸偶走远、折返、重聚，人数变化由走位完成。
- `oath-tokens.js`：人物符号聚合、讲话者与共同目标。
- `timeline-factions.js`：年表、图标和势力变化。
- `identity-turn.js`：差遣绳、亭长牌、旗幡共同交代身份转变。
- `endcard-seal.js`：简短收束。

参考镜头也要保持正式成片密度：清晰主图示、必要辅助细节、真实 cue 驱动、适量图标，不能只画一个空框或一个组件停留十秒。

## 六、资源边界

skill 只保留绘制代码、小型示例和约 97KB 的核心图标，不预置完整图标包、头像包或地图数据集。

```bash
tt assets search scroll --provider iconify --prefix game-icons --limit 8
tt assets download --id game-icons:scroll-unfurled --name scroll --project <用户工程>
```

也可用 `--provider commons` 检索 Wikimedia Commons。下载必须指定用户工程，并生成带来源和授权的 manifest。素材只在准备阶段联网，之后离线确定性渲染。没有可选素材时使用代码图形，但不能因此删掉关键叙事信息。

## 禁止

- 按参考镜头文件顺序机械拼片。
- 只有知识点罗列，没有问题、冲突、后果。
- 用左右卡片做选项对比或前后对照，把抉择和身份变化做成科普表格。
- 一个组件停留很久，用拆句和延长 hold 填充时长。
- 动作与解说含义相反，或路线走到故事尚未发生的位置。
- 为装饰堆图标、头像和文字，造成多个视觉中心。
- 示意地图冒充精确历史地理。
- 相邻场微调同一组物件位置，造成转场抖动。
- 公共字幕与固定底部文字叠加。
- `Math.random`、墙钟时间、逐帧 fetch/parse、每帧重建静态 Path2D。

## 参数速查

| 项 | 约定 |
|---|---|
| 模式 | `code`，每场独立 `scene.code` |
| 舞台 | `TT.board.stage` + 固定 `stageFrame` |
| 内容 | `map / route / place / seal / icon / document / fork / figure / gate / banner / timeline` |
| 收束 | `title / endcard` |
| 文字 | 固定 `systemCaption / dialogueCaption`；公共 captions 关闭 |
| 安全边距 | `RULES.safeMargin = 0.055` |
| 节拍 | lead-in 0.7s / hold 1.0s / 最短旁白场 5.5s；按内容组织 6–10 场 |
