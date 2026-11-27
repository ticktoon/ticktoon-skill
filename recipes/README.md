# recipes · recipe 目录说明

这份文档面向**维护和阅读 recipe 的人**，不进入 Agent 的读取路径。

Agent 在选中前只读 `tt recipe list` 的选择元数据；选中某条 recipe 后才读它的 `recipe.md` 与骨架。`recipe.md` 不是筛选器。

下文 `tt` 指 `node platform/cli.mjs`。

---

## 1. 一条 recipe 是什么

recipe 是**一类成片**的创作单位：它声明这类片子怎么选、怎么写、怎么画、配什么声音，并提供一份建工程用的骨架。

一条 recipe 同时承担四件事：

| 职责 | 文件 | 谁读 |
|---|---|---|
| 选择：这条 recipe 适合什么、不适合什么 | `recipe.json` 的 `keywords / when / notWhen` | Agent 通过 `tt recipe list` 读 |
| 成片规范：模式、视觉规则、字幕、声音 | `recipe.json` 的 `mode / rules / captions / audio / template` | 编译器；Agent 用 `tt recipe show` 核对 |
| 创作纲要：内容怎么写 + 画面怎么画 | `recipe.md` | 选中后的 Agent / 人 |
| 起点与示例：骨架、镜头参考、模板 | `skeleton.storyboard.json`、`ref-shots/`、`template.js` | `tt new`、`tt recipe audit`、`tt lab` |

recipe 有两种模式，同一条 recipe 内不混用：

- **`code`**：每场在 `scene.code` 里实时写画面，调用公共 kit。适合叙事自由、每场构图不同的片子。
- **`params`**：每场只写 `scene.params`，画面由 recipe 自带的 `template.js` 固定。适合换稿不换视觉的版式片。

---

## 2. 选择流程与创作流程是分开的

```text
选择阶段（只看元数据）
  tt recipe list
    → 用 keywords / when 找最贴的
    → 用 notWhen 排除明显不合适的
  tt recipe show <id>
    → 核对 mode / rules / captions / audio / template

创作阶段（选定后才加载文档）
  recipes/<id>/recipe.md
    → 内容怎么写、画面怎么画
  recipes/<id>/skeleton.storyboard.json
    → 建工程、看骨架形状
  recipes/<id>/ref-shots/（仅 code）
    → 示例镜头，供LLM写画面参考
```

没有「先粗筛一遍、再读文档复筛」这一层。`recipe.md` 一旦被读取，recipe 已经选定，所以选择信息只放 `recipe.json`：

- `when`、`notWhen` 都是**字符串数组**，每条写一个独立判断条件；不要再退回成一整句长摘要。
- `notWhen` 尽量给出替代 recipe（如「需要图表 → 改用 xxx」），让选择阶段能直接转向。
- `recipe.md` 里不写「何时用 / 何时不用」，避免和 `recipe.json` 出现两份会漂移的副本。

---

## 3. 目录结构

### code 型

```text
recipes/<id>/
├── recipe.json                # 选择元数据 + 成片规范
├── recipe.md                  # 选中后唯一创作文档：内容 + 画面规范
├── skeleton.storyboard.json   # tt new 的起点（最小空壳）
└── ref-shots/
    ├── <描述性名称>.js        # 独立单场示例，文件头声明元数据
    └── ...
```

### params 型

```text
recipes/<id>/
├── recipe.json                # 选择元数据 + 成片规范 + template 契约
├── recipe.md                  # 选中后唯一创作文档：内容 + 固定视觉说明
├── skeleton.storyboard.json   # tt new 的起点（完整固定样例）
└── template.js                # 固定满幅模板：function draw(g, p)
```

`tt new` 只复制 `skeleton.storyboard.json`，不复制 `ref-shots/` 或 `template.js`；后两者留在 Skill 包里被编译器和 lab 读取。

---

## 4. recipe.json

所有未知键都是硬错误，不会被静默忽略。

### 4.1 身份与选择元数据

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 目录名与 `tt recipe list` 的 id；必须唯一 |
| `abi` | `"1"` | recipe 契约版本；当前只支持 1 |
| `name` | string | 中文名称，出现在 `tt recipe list` |
| `listed` | boolean | 可选；设为 `false` 时仅退出 `tt recipe list` 货架，代码、骨架与直接开发入口仍保留；默认列出 |
| `keywords` | string[] | 检索词；用于和用户第一句话做匹配 |
| `when` | string[] | 适用条件；每条一个判断 |
| `notWhen` | string[] | 不适用条件；每条一个判断，尽量给出替代 recipe |

`when` / `notWhen` 由 `platform/compile/recipe.mjs` 校验，必须是非空字符串数组。

### 4.2 mode

```json
"mode": "code"
```

或

```json
"mode": "params"
```

`code` 场景只收 `scene.code`，`params` 场景只收 `scene.params`；混写直接报错。

### 4.3 rules

成片级视觉契约。`code` 场的 `RULES` 会原样注入 `scene.code`；`params` 场的模板通过参数契约拿内容，不读 `RULES`。

| 字段 | 类型 | 说明 |
|---|---|---|
| `safeMargin` | number 0–0.5 | 安全边距；编译器与检查器共用 |
| `scale` | `{ 档位: 倍率 }` | 字号阶梯，倍率 0.4–2.0 |
| `stroke` | `[min, max]` | 线宽区间，必须 `min < max` |
| `pen` | 维度对象 | 笔型；如 `{ "mode": "fixed", "value": "chalk" }` |
| `board` | 维度对象 | 舞台；如 `{ "mode": "fixed", "value": "blackboard" }` |
| `forbid` | string[] | 禁止项，至少 1 条 |

维度对象的四种 `mode`：

- `fixed`：`{ "mode": "fixed", "value": ... }`
- `enum`：`{ "mode": "enum", "choices": [...], "default": ... }`，`default` 必须在 `choices` 里
- `auto`：`{ "mode": "auto", "from": "..." }`
- `random`：`{ "mode": "random", "choices": [...] }`

`forbid` 是给人和 Agent 的创作契约，编译器不会自动判违规；视觉是否越界靠 `tt qa`、`tt probe` 与 12 格联系表人审（`params` 固定模板跳过 QA，直接 preview）。

### 4.4 captions

字幕默认值。字段与 `platform/compile/captions.mjs` 的白名单一致：

| 字段 | 说明 |
|---|---|
| `style` | 字幕样式 id；关闭字幕写 `"none"` |
| `font` | **manifest 字体键**（如 `"sans-400"`），不是文件路径，也不是角色名 |
| `baseSize` | 基准字号，12–240 |
| `lineHeight` | 行高，0.8–2.5 倍字号 |
| `top` | 0–1 的画面高度比例 |
| `at` | `bottom` / `top` / `center` / `auto` |
| 其他 | `band / size / color / background / accent / highlight / palette / avoid / maxWidth / maxHeight / align / seed / rotation / tracking / padding / shadow / stroke` |

字幕字体在 emit 阶段自动加入本场 `resources`。storyboard 顶层 `uses.captions` 可以在单条片子里覆盖样式或位置，不改 recipe 默认契约。

### 4.5 audio

只按情绪选 BGM，不点名文件。

| 字段 | 说明 |
|---|---|
| `mood` | `assets/bgm/manifest.json` 里的情绪键，如 `soft / cut / tense` |
| `volume` | 0–1 |
| `fadeIn` / `fadeOut` | 秒数 |
| `duck` | `{ level, edge }`，旁白时的压低参数 |

`mood` 找不到对应 BGM 会产生 `BGM_MISSING` 警告，片子仍然能编译，但会没有背景音。

### 4.6 template（仅 params）

`params` 型 recipe 必须声明，`code` 型声明了会报错。

| 字段 | 说明 |
|---|---|
| `draw` | recipe 目录内的相对 `.js` 路径；文件里必须有顶层 `function draw(g, p)`，且不允许 `import` / `export` |
| `params` | 场景参数字段契约，见下表 |
| `resources` | 模板自带的固定资源：字体、图片、视频 |
| `needs` | `{ image, video, three }`；需要外部媒体的 recipe 在这里声明 |
| `defaultSfx` | 默认音效名（来自 `assets/sfx/manifest.json`） |
| `sfxTrack` | 打字机等按字符推进的音效轨；目前 `type` 只支持 `"typing"` |
| `inkless` | boolean；模板没有墨迹时跳过 `QA_INK_EMPTY` |

#### template.params 字段契约

每个字段是一个 spec，场景写 `scene.params` 时由 schema 逐项校验并补齐默认值。支持的 spec：

| `type` | 值形状 | 可用约束 |
|---|---|---|
| `string` | 字符串 | `required`、`maxChars`、`minLines`、`maxLines`、`default` |
| `number` | 数字 | `required`、`default` |
| `boolean` | true/false | `required`、`default` |
| `array` | 字符串数组 | `maxItems`、`maxChars`（每项，默认 24）、`default` |
| `objects` | 对象数组 | `maxItems`、`fields`（每字段 `enum` / `type` / `default`）、`default` |
| `rows` | `[{ label, value }]` | `minItems`、`maxItems`；label 上限 12 字 |
| 无 `type` 只有 `enum` | 枚举值 | `enum`、`default` |

补充规则：

- 缺省值在 **schema 阶段**补齐，不留给模板写 `p.x || 默认值`；这样 receipts 与 report 的字段才稳定。
- `required` 字段缺失直接报错；空字符串也按缺失处理。
- 未知参数键报 `PARAM_UNKNOWN`，不会静默丢弃。
- 多行字符串的 `minLines / maxLines` 只数非空行；空行用作段落间距。

#### template.resources

```json
"resources": [
  { "type": "font", "name": "sans-900" },
  { "type": "image", "name": "news-world-map", "src": "skill:assets/image/world-map.png" }
]
```

- `font` 只写 manifest 键，**不许写 `src`**；`src` 由编译期按 manifest 补齐。
- `image / video` 必须写 `src`；`skill:assets/...` 指向 Skill 包内资源，`job:` 指向任务目录。
- code 场的资源写在 `scene.resources`；params 场的资源声明在 `template.resources`，场景里不要再写 `scene.resources`。

#### template.needs

`image` 或 `video` 为 `true` 时，每个场景的 `params.src` 必须是非空素材路径。emit 会按 `<image|video>-<scene.id>` 生成资源名，并把 `params.src` 换成这个查询名；视频还可以带 `params.start`。

---

## 5. recipe.md

选中 recipe 后才读的唯一创作文档。它像一段给模型的创作 prompt，而不是结构手册。

推荐结构：

```markdown
# <id> · <中文名>

一句话定位。

选中本 recipe 后……（说明这份文档负责什么）

## 内容怎么写
- 旁白、文案、字段、题材边界

## 画面怎么写（code 型）
### 安全区 / 字号 / 线宽 / 节拍 / 收尾 / 禁止
- 与题材无关的物理规律

## 参数速查
- 一张表收拢数值与字体键

## 示例
- 骨架样例或 ref-shots 指向
```

`params` 型的 `recipe.md` 没有「画面怎么写」的物理规律，改为固定视觉、参数契约说明与骨架样例。

写作约定：

- **不写选择信息**：何时用 / 何时不用只放 `recipe.json` 的 `when / notWhen`。
- **不给题材枚举或例题模板**：code 型的内容必须由 storyboard 当场决定。
- **字体写 manifest 键**：code 场在 `scene.resources` 声明；params 模板在代码里写死并在 `template.resources` 声明；字幕在 `captions.font` 写键。任何地方都不写字体 `src`。
- **不重复定义目录与镜头参考格式**：这些只在 `SKILL.md` 定义一次，`recipe.md` 只写一句「写法见 `ref-shots/`」。
- **数值要能追溯到 `recipe.json`**：`recipe.md` 的「参数速查」应与 `rules / captions / audio / template` 一致，不另造一套。

---

## 6. skeleton.storyboard.json

`tt new <dir> --recipe <id>` 会把它原样复制成工程的 `storyboard.json`。

- `params` 型：完整固定样例，改 `scene.params` 的文本、素材与姿态即可。
- `code` 型：最小空壳，只铺舞台并留一行提示；**不是成片模板**，不要照抄。
- `recipe` 字段必须与 recipe id 一致。
- 骨架必须自己能编译；`tt recipe audit` 会单独检查 code 型的骨架。
- `params` 型骨架同时是回归输入。

---

## 7. ref-shots（仅 code 型）

`ref-shots/` 里每个 `.js` 是一个独立镜头参考：文件头声明元数据，注释块之后就是可以直接放进 `scene.code` 的代码。

### 文件头

```js
/* @ticktoon-ref-shot
{
  "title": "逐字弹入",
  "note": "大字占满画面，适合口号或结论",
  "duration": 1.8576,
  "sfx": [
    { "name": "common-pop", "at": 0.65, "volume": 0.2 }
  ],
  "resources": [
    { "type": "font", "name": "sans-900" }
  ],
  "tags": ["快闪", "大字"]
}
*/
// 下面是这一场的 scene.code
```

必填：

- `title`：非空字符串
- `duration`：大于 0 的秒数
- `resources`：数组；没有资源写 `[]`

可选：`note`、`bg`、`thumbTime`、`tags`、`component`、`orientation`（`landscape / portrait`）、`sfx`。`bg` 只给 lab 预览用，不写进 storyboard；`sfx` 与 `scene.sfx` 同形，会进入镜头参考的编译和试听。

资源规则与 code 场景一致：`font` 只写 manifest 键，`image / video` 必须写 `src`。

### 约定

- 文件名用描述性英文，不加 `01-` / `02-` 序号；不建 `README.md` 或 `manifest.json`。
- 镜头参考可以随时增删；只复用结构、节拍与 kit 用法，不要照抄题材。
- `tt new` 不复制镜头参考。
- `tt recipe audit` / `tt ci` 会读取全部镜头参考，合成一部只用于回归的 storyboard 再编译。
- `tt lab --recipe <id>` 逐个打开镜头参考，走真实编译与引擎预览；页面里改代码只影响预览，不回写文件。

---

## 8. template.js（仅 params 型）

固定满幅模板，顶层函数签名固定：

```js
function draw(g, p) {
  // g: 画布 / 尺寸 / 字体 / 状态
  // p: schema 已补齐默认值的 scene.params
}
```

- 不允许 `import` / `export`；模板不是模块。
- 字体键直接写死在模板代码里，并在 `template.resources` 声明同一个 manifest 键。
- 颜色、版式、字号、动效由模板本地决定；recipe.json 不承载用色决策。
- 内容只来自 `p`；模板不得内置题材枚举、具体文案或随机数。
- 确定性：同一份 `params` 每帧必须画出同一张画面；禁止 `Math.random` / `Date.now` / 外部 IO。

---

## 9. 加载与编译流程

### 9.1 载入货架

`loadCatalog()`（[platform/compile/schema.mjs](../platform/compile/schema.mjs)）启动时扫描 `recipes/**/recipe.json`：

1. 读 `recipe.json`；
2. 挂上目录、`recipe.md` 全文、params 模板的 `drawSource`；
3. 立刻跑 `validateRecipe()`，错误只挂在条目上，**选中该 recipe 时才升级为 build error**；
4. 读字幕样式、字体 manifest、BGM / SFX manifest。

`tt recipe list` 只投影 `id / name / keywords / when / notWhen`，不读文档。

### 9.2 从 storyboard 到 composition

`tt build` 跑六阶段：

| 阶段 | recipe 在哪起作用 |
|---|---|
| ① schema | 校验 `recipe` 存在、`mode` 匹配、`scene.code / params` 互斥；按 `template.params` 补齐参数；校验资源与字体键；应用字幕默认值 |
| ② resolve | `audio.mood` → BGM 文件；`template.defaultSfx / sfxTrack` → SFX；旁白交给 TTS 或按 4.6 字/秒估算 |
| ③ plan | 排时间轴、镜头时长、字幕分句；不读 recipe 文档 |
| ④ emit | code 场注入 kit、`RULES`、`FONTS` 与 `scene.resources`；params 场注入 `draw(g, p)`、`G0 / P0`、`template.resources` 与打字音效 |
| ⑤ check | params 模板字体是否声明、媒体 `params.src` 是否为空 |
| ⑥ assemble | 合成 scenes 与 audio；code 场边界在 emit 后先展开为 A' + T + B' 双帧视觉节点，音频仍按原始逻辑场生成 |

引擎执行的是 `new Function('ctx', 'api', code)`，没有模块系统；emit 只注入本场用到的 kit。

---

## 10. 校验、审计与回归

| 命令 | 做什么 | 不做什么 |
|---|---|---|
| `tt recipe audit` | 逐条：recipe 结构校验；params 编译骨架；code 编译骨架 + 合成全部 ref-shots | 不起浏览器、不判视觉质量 |
| `tt ci` | 全货架快速回归 | 不导视频 |
| `tt ci --deep` | 复用 `tt qa` 管线做深度检查（params 跳过） | 不做审美评分 |
| `tt ci --baseline` | 记录每条 recipe 的编译指纹与构建状态 | 不存像素、不做图像回归 |
| `tt lab --recipe <id>` | code 型镜头参考实验室：真实编译 + 引擎预览，可改代码重跑 | 不回写 `ref-shots/` |

视觉好坏由 12 格联系表与 `tt probe` 交给人审，机器只保证「结构合法、能编译、能画出来」。

常见失败码：

| 错误码 | 含义 |
|---|---|
| `RECIPE_ABI_UNSUPPORTED` | `abi` 不是 `"1"` |
| `RECIPE_UNKNOWN_KEY` | `recipe.json` 有未知字段 |
| `RECIPE_WHEN_INVALID` / `RECIPE_NOTWHEN_INVALID` | `when` / `notWhen` 不是非空字符串数组 |
| `RECIPE_RULES_MISSING` / `RECIPE_FORBID_EMPTY` | 缺 `rules` 或 `forbid` 为空 |
| `RECIPE_CAPTION_FONT_UNKNOWN` | `captions.font` 不是 manifest 键 |
| `RECIPE_TEMPLATE_MISSING` / `RECIPE_TEMPLATE_UNEXPECTED` | params 缺 template，或 code 多写了 template |
| `TEMPLATE_DRAW_NOT_FOUND` / `TEMPLATE_DRAW_FUNCTION` | `draw` 路径不存在，或文件里没有 `function draw(g, p)` |
| `TEMPLATE_FONT_UNKNOWN` / `TEMPLATE_FONT_SRC` | 模板字体不是 manifest 键，或 font 资源写了 `src` |
| `TEMPLATE_FONT_UNDECLARED` | 模板用了字体键但没在 `template.resources` 声明 |
| `TEMPLATE_MEDIA_SRC_MISSING` | `needs.image/video` 为 true，但某场 `params.src` 为空 |
| `PARAM_UNKNOWN` / `PARAM_REQUIRED` | 场景参数缺失或写了契约外的键 |
| `PARAM_TYPE` / `PARAM_ENUM` | 参数类型不符，或枚举值不在允许列表 |
| `PARAM_MAXCHARS` / `PARAM_MAXITEMS` / `PARAM_MINITEMS` | 字数、项数越界 |
| `PARAM_MINLINES` / `PARAM_MAXLINES` | 多行文本的可见行数不符合契约 |
| `SCENE_CODE_REQUIRED` / `SCENE_PARAMS_REQUIRED` | 场景内容形态与 `mode` 不符 |
| `RECIPE_DOC_MISSING` | code recipe 缺少 `recipe.md` |
| `REF_SHOT_HEADER_MISSING` / `REF_SHOT_META_INVALID` | 镜头参考文件头缺失或字段不合法 |

---

## 11. 新增一条 recipe 的检查清单

1. 建目录 `recipes/<id>/`，`id` 与目录名一致。
2. 写 `recipe.json`：`abi: "1"`、`mode`、`keywords / when / notWhen`、`rules / captions / audio`；params 型再写 `template`。
3. 写 `recipe.md`：定位 → 内容怎么写 → code 型的画面规范 → 参数速查 → 示例。**不要写选择信息。**
4. 写 `skeleton.storyboard.json`：params 型给完整样例，code 型给最小空壳；两条都要能编译。
5. code 型：加 `ref-shots/`，每个文件按约定写文件头；至少覆盖该 recipe 的主要写法。
6. params 型：加 `template.js`，顶层 `function draw(g, p)`；字体键写死并在 `template.resources` 声明。
7. 跑 `tt recipe audit`；全绿后再进 lab 或真实工程。

修改 recipe 时优先只动一处真源：

- 改选择口径 → 只改 `recipe.json` 的 `keywords / when / notWhen`。
- 改创作方向或物理规律 → 改 `recipe.md`。
- 改固定版式 → 改 `template.js` 与 `template.params / resources`。
- 改音画约束 → 改 `recipe.json` 的 `rules / captions / audio`，然后跑 audit。
