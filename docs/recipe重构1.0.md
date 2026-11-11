# recipe 重构 1.0（已落地）

> 2026-11-11。本文记录最终模型与已执行的改动，不再描述过渡方案。
> 当前行为以 `SKILL.md`、`platform/` 源码和 `tt` 输出为准。

## 0. 一页结论

公开概念只剩两个：**recipe** 与 **kit**。

- recipe 是一类成片的创作单位，声明 `mode`、`fonts`、`rules`、`captions`、`audio`。
- `mode: "code"`：场景写 `scene.code`，实时调用公共 kit。
- `mode: "params"`：场景写 `scene.params`；recipe 自带 `template.js`，固定整幅画面。
- kit 是可穷举、可复用、人审过的绘制词法。
- QA 只保留两个机器硬门禁：`RENDER_PAGE_ERROR`、`QA_INK_EMPTY`；12 格联系表是视觉证据，不打分。

同一条 recipe 内两种模式不混用；`scene.code` 与 `scene.params` 互斥，编译期直接报错。

## 1. 目标模型

### 1.1 recipe

```json
{
  "id": "news-broadcast",
  "abi": "9",
  "name": "突发新闻",
  "keywords": [],
  "when": "",
  "mode": "params",
  "template": {
    "draw": "template.js",
    "params": {},
    "resources": [],
    "needs": { "font": [], "image": false, "video": false, "three": false },
    "defaultSfx": null,
    "sfxTrack": null,
    "motion": { "enter": 0.5, "exitRatio": 0.5 },
    "inkless": false
  },
  "fonts": {},
  "rules": { "safeMargin": 0.055, "forbid": [] },
  "captions": { "style": "none" },
  "audio": {}
}
```

`mode: "code"` 的 recipe 不写 `template`。`template` 只允许八个字段：

| 字段 | 作用 |
|---|---|
| `draw` | recipe 相对路径的 `.js`，顶层 `function draw(g, p)` |
| `params` | 唯一一份参数 schema，`type / required / default / maxChars / maxItems / feel` |
| `resources` | 模板固定资源，进本场 `resources[]` |
| `needs` | `font` 角色、`image / video / three` 能力声明 |
| `defaultSfx` | 每次入场音效 |
| `sfxTrack` | 打字音轨：`sfx / cps / start / lineGap / every / linePrefix / loop` |
| `motion` | `enter` / `exitRatio`，驱动 `g.a` / `g.reveal` |
| `inkless` | 整幅底图类模板按契约无墨迹，QA 跳过 `QA_INK_EMPTY` |

### 1.2 storyboard

场景允许 `id / narration / duration / camera / code / params / resources / note / transitionIn / transitionOut`。

- code 场：`scene.code` 必填，`scene.params` / `scene.resources` 被拒绝。
- params 场：`scene.params` 必填并按 `template.params` 校验，`scene.code` 被拒绝。
- `scene.params.src` 指向媒体时，emit 在编译期改写为 `${kind}-${scene.id}` 资源名。
- 参数错误码统一为 `PARAM_*`；模式冲突为 `SCENE_PARAMS_IN_CODE_MODE` / `SCENE_CODE_IN_PARAMS_MODE`。

### 1.3 template 代码契约

`template.js` 只有一种形状：

```js
function draw(g, p) {
  // g: 整帧单元 G0，p: 冻结的 scene.params
}
```

- 只有这一种形状；IIFE、`export` / `import` 一律拒绝。
- `G0`：`g.W / g.H / g.api / g.t / g.sceneT / g.a / g.reveal / g.fonts / g.rng()`，`rect` 固定整帧。
- 模板资源来自 `template.resources` + `template.needs.font`；不接收 `RULES`。
- 一个 params 场只有一个内部单元 `scene.unit = { id: "template", at: 0, dur }`。
- 凭据身份：`unit: "template"`，`source: <recipe.id>`；code 场为 `unit: "code"`，`source: "scene.code"`；字幕为 `unit: "caption"`，`source: "captions.<style>"`。

### 1.4 编译链

`schema → resolve → plan → emit → check → assemble`

| 阶段 | 归属 | 负责 |
|---|---|---|
| schema | 编译前 QA | ABI 9 / mode / 参数 schema / code 静态扫描 / 未知键 |
| resolve | 编译 | TTS、素材、BGM、字体角色、模板 SFX |
| plan | 编译 | 场长与起点、caption cue、逐字时间、params 内部单元 |
| emit | 编译 | kit 注入、模板内联、`G0` / `P0`、资源合并、凭据、字幕 |
| check | 编译 | params 字体声明、资源形状、媒体 `src` 必填；code 沿用 `CODE_*` |
| assemble | 编译 | `audio[]`、总时长、SRT |

编译后 QA 归 `tt qa`：一次 build + 一次浏览器会话，机器只判渲染异常与空墨迹。

### 1.5 QA

| 节点 | 检查 | 是否阻断 |
|---|---|---|
| 编译前 | `PARAM_*`、模式冲突、SCENE 键、code 禁用 API | 阻断 |
| 编译期 | 资源、字体声明、媒体 `src` | 阻断 |
| 编译后 | `RENDER_PAGE_ERROR`、`QA_INK_EMPTY`；覆盖与 12 格联系表 | must 阻断 |

`QA_INK_EMPTY` 只对声明过的单元生效：params 场的 `template` 单元、code 场的 `code` 单元；`template.inkless` 的 recipe 跳过。构图、安全框、碰撞、字幕带、对比度、停留时间都不自动打分。

### 1.6 recipe 交付物与回归

所有 recipe 的目录结构统一：

```text
recipes/<id>/
├── recipe.json
├── brief.md
├── skeleton.storyboard.json   # tt new 的起点；params 为完整固定样例，code 为最小空壳
├── visual.md                  # 仅 code：与内容无关的物理规范
├── ref-shots/*.js              # 仅 code：独立单场示例
└── template.js                # 仅 params：固定整幅模板
```

- `skeleton.storyboard.json` 同时是 params recipe 的回归输入；`tt new` 只复制骨架，不复制镜头参考。
- code recipe 的每个镜头参考文件自带 `@ticktoon-ref-shot` JSON 注释头（`title / duration / resources` 必填），文件其余部分是 `scene.code`。格式只在 `SKILL.md` 定义一次；不放 `ref-shots/README.md` 或 `manifest.json`，文件名不加序号。
- `tt recipe audit` / `tt ci` 对 params 编译骨架，对 code 读取全部镜头参考并合成一部回归 storyboard；`tt ci --baseline` 同样基于这份回归输入。
- code 模式不再有 `demo.storyboard.json`、`--demo` 或仓库内的回归 storyboard；CI 的合成片只写到 `output/ci/`。
- `tt lab [--recipe <id>] [--port N]` 打开镜头参考实验室：单个镜头参考用同一处 `refShotStoryboard()` 包成一场，走真实 `buildProject` + 引擎面板；卡片缩略图由服务端 CDP 抓帧，编辑只影响预览、不回写 `ref-shots/`。

## 2. 已执行的改动

| 区域 | 结果 |
|---|---|
| 编译 | `recipe.mjs` 的计数器收敛为 `id / abi / name / keywords / when / mode / template / fonts / rules / captions / audio`；ABI 9 是唯一入口 |
| 编译 | `schema / resolve / plan / emit / check / assemble` 移除全局版式货架与叠加元素；params 场只留一个内部单元 |
| 模板 | 四条 params recipe 各自持有 `template.js`；顶层 `function draw(g, p)` |
| 模板音效 | 新增 `template-sfx.mjs`，sfx 事件从 `template.sfxTrack` 渲染，assemble 读 `scene.meta.sfx` |
| 字幕 | 避障只来自 recipe 的归一化 `avoid`；场景不再提交结构化避障框 |
| 凭据 | 统一 `unit / source`，`report.json` 使用 `paramsScenes / units`，不再有兼容字段 |
| CLI | 删除全局版式货架命令；`tt recipe show` 输出 `mode / template / recipeErrors` |
| recipe 交付物 | 统一 `skeleton.storyboard.json`；code 型以 `visual.md` + `ref-shots/` 取代 demo，CI 从镜头参考合成回归片 |
| QA | 删除配方自评与签名断言；只留 `RENDER_PAGE_ERROR` + `QA_INK_EMPTY` |
| 基线 | `output/baseline.json` 已按新编译指纹刷新 |

## 3. 验收

| 命令 | 通过线 |
|---|---|
| `tt recipe audit` | 9 条 recipe 全部 `ok: true` |
| `tt ci` | 9 条 recipe，audit + 双编译指纹稳定 |
| `tt ci --deep` | 9 条 recipe，QA `must 0 / should 0` |
| `tt ci --baseline` | 全部 `ok`；指纹变化需人审后 `--write` |

四条 params recipe 的 12 格联系表已人工核对：蜡笔图解、皮影、新闻卡、实拍压字均按模板满幅出画。

## 4. 明确不做

- 不做双 ABI 过渡；ABI 9 是唯一格式。
- 不保留旧概念的别名、兼容字段或废弃命令。
- 不做配方自评分、签名断言或机器审美评分。
- 不把固定模板放回公共货架；模板只属于它所在的 recipe。
