---
name: ticktoon
description: 用 Ticktoon 生成整幅场景化短视频。recipe 给一类成片的规范，公共 kit 给可穷举、人审过的绘制词法，你在 storyboard 的 scene.code 里实时写内容。当前 recipe 货架以 tt recipe list 为准。用户要求视频创作或修改 composition 时使用。
---

# Ticktoon

唯一产物是 protocol v1.0 `composition.json`（`scenes[]` + `audio[]`）。

下文 `SKILL_DIR` 指本文件所在目录。脚本用绝对路径调用，cwd 保持在用户工程目录。首次使用或环境异常先运行 `node "$SKILL_DIR/scripts/doctor.mjs"`；若 `deps` 报缺包，先在 `$SKILL_DIR` 执行 `npm install`（只装 ws / msedge-tts；Chrome 通过 CDP 直接驱动本机安装，不下载浏览器），再重跑 doctor。

## 结构

运行时四层：`SKILL.md`（操作契约）→ `recipes/`（recipe 规范）→ `references/`（API 参考）→ `<工程>/storyboard.json`（内容）。公共 kit（`platform/kit/`）、编译与渲染链是下层实现，由平台负责，创作时只通过 `tt` 使用。

## 读取顺序（只读需要的）

1. 先用 `tt recipe list` 选 recipe：它的输出（id / 名称 / 关键词 / 适用时机 `when` / 不适用时机 `notWhen`）就是当前货架，本文件不复制清单。按 `keywords` 和 `when` 找最贴的，用 `notWhen` 排除明显不合适的；选中后才读文档。需要看规则时用 `tt recipe show <id>`，它给出 `when / notWhen / mode / rules / captions / audio / template`。
2. 选定后只读该 recipe 的 `recipe.md` 与 `skeleton.storyboard.json`；code 型再读 `ref-shots/`。`recipe.md` 是选中后的唯一创作纲要：先讲内容怎么写，再讲画面怎么画。`recipe.json` 只用于核对 `mode / rules / captions / audio / template`。不要预读其他 recipe。
3. 动手写 storyboard 前读 `references/storyboard.md`。
4. 写 `scene.code` 时才读 `references/authoring-code.md`，再读该 recipe 的 `ref-shots/` 里 1–2 个镜头参考。镜头参考文件头的格式见下文「recipe 目录与镜头参考格式」；params 型不读 `ref-shots/`。
5. 用到任一 kit 能力（字幕、笔迹、标注、舞台、转场、新闻背景等）时，只读对应 `references/<kit>.md` 一篇；不要一次读完整个 `references/`。
6. `references/qa.md` 只在交付检查时读，`references/iterate.md` 只在反馈/预览/配音时读。

`references/README.md` 是运行时参考索引；索引之外的文件不是创作契约，不要预读。

## 一条编译链，两种场景写法

recipe 有两种模式，由 `tt recipe show <id>` 的 `mode` 标明：

- **`code`**：内容由你在 `scene.code` 里**实时写**；平台只给可穷举、可复用、人审过的公共 kit（舞台、笔、文字、标注、相机、转场、字幕、新闻背景等；命名空间与成员以 `platform/kit/index.json` 为准）。叙事由你自由组织，规范由 recipe 给数值与禁止项。
- **`params`**：整幅画面由 recipe 自带的 `template.js` 固定，场景只写 `scene.params`，由模板按 `template.params` 的契约取文本、素材与姿态。

| 用户第一句话 | 怎么走 |
|---|---|
| **带视觉词或题材**（白板 / 黑板 / 水墨 / 新闻 / 实拍 / 蜡笔 / 皮影 / 快闪…） | 与 `tt recipe list` 的 `keywords`、`when` 匹配最贴的 recipe，并用 `notWhen` 排除明显不合适的；选中后再读该 recipe 的 recipe.md / skeleton，code 型再读 ref-shots；recipe 只给规范，不给内容 |
| **没带视觉词** | 从 `tt recipe list` 里**主动推荐 2–3 个视觉让用户选**，不静默兜底 |
| 想换题材 | 只改 storyboard 文本与 `scene.code`，平台与 kit 一行不动 |
| 需要固定版式（新闻卡 / 实拍压字 / 图解 / 剪影…） | 选 `mode: "params"` 的 recipe；只填 `scene.params` 的文本、素材、姿态，不含题材枚举 |

货架随 `recipes/` 扩张，清单只由 `tt recipe list` 给出，本文件不维护。

## recipe 目录与镜头参考格式

所有 recipe 的目录结构一致：

```text
recipes/<id>/
├── recipe.json              # mode / rules / captions / audio（params 还有 template）
├── recipe.md                # 选中后唯一的创作纲要：内容怎么写 + 画面怎么画
├── skeleton.storyboard.json # 建工程与 params 回归的骨架
├── ref-shots/               # 仅 code 型：独立、可直接编译的单场镜头参考
│   └── <描述性名称>.js
└── template.js              # 仅 params 型：固定满幅模板
```

- `skeleton.storyboard.json` 是 `tt new` 复制的起点。params 型的骨架是一份完整固定样例，按 `scene.params` 改内容；code 型的骨架只是一个最小空壳，不要把它当成成片模板。
- `recipe.md` 是选中后的创作纲要：先写内容与文案怎么写，再写「画面怎么写」的物理规律：画幅、安全区、字号阶梯、线宽、节拍、揭示顺序、收尾与禁止项。它不描述某个具体题材。params 型只有创作纲要与固定模板说明，不写物理规律。选择信息不在这里：何时用 / 何时不用只放 `recipe.json` 的 `when / notWhen`。
- `ref-shots/` 里的每个 `.js` 是一个独立镜头参考：文件头声明元数据，注释块之后就是可放进 `scene.code` 的代码。文件名用描述性英文，不加 `01-` / `02-` 序号；镜头参考可以随时增删，不配 `README.md` 或 `manifest.json`。
- 镜头参考文件头统一写成：

  ```js
  /* @ticktoon-ref-shot
  {
    "title": "逐字弹入",
    "note": "大字占满画面，适合口号或结论",
    "duration": 1.8576,
    "resources": []
  }
  */
  // 下面是这一场的 scene.code
  ```

  必填 `title`（字符串）、`duration`（秒，>0）、`resources`（数组，没有就写 `[]`）。可选 `note`、`bg`、`thumbTime`、`tags`、`component`、`orientation`（`landscape` / `portrait`）。`bg` 只给 lab 预览用，不写进 storyboard。
- `tt recipe audit` / `tt ci` 会读取所有镜头参考，合成一部只用于回归的 storyboard 再编译；`tt new` 不会复制镜头参考。镜头参考是**写法参考**，不是整片模板：只复用结构、节拍与 kit 用法，不要照抄它的题材。
- 目录结构与镜头参考格式只在这里定义一次；`recipe.md` 只写一句「写法见 `ref-shots/`，文件头格式见 `SKILL.md`」，不再重复定义。

## 标准创作闭环

```bash
node "$SKILL_DIR/platform/cli.mjs" new <dir> --recipe <id>   # 1. 建工程，skeleton 预填；<id> 从 tt recipe list 选
# 2. 改 <dir>/storyboard.json —— 这是你唯一要写的文件
node "$SKILL_DIR/platform/cli.mjs" build --dir <dir>                  # 3. 快速编译（估时，无配音；供预览/qa/det）
node "$SKILL_DIR/platform/cli.mjs" preview --dir <dir> --port 5123    # 4. 只读预览：用户可多帧标注；发送后预览关闭，命令直接返回批注批次
node "$SKILL_DIR/platform/cli.mjs" annotations --dir <dir>             # 5. 预览不在本会话启动时手动读最新未处理批次；--ack 标记整批已处理
node "$SKILL_DIR/platform/cli.mjs" stills 0.6 3.1 9.4 --dir <dir>     # 6. 静帧 + 布局凭据
node "$SKILL_DIR/platform/cli.mjs" build --dir <dir> --tts edge         # 7. 出片前重编译：带真实旁白
node "$SKILL_DIR/scripts/render.mjs" <dir>/out/composition.json -o <dir>/video.mp4   # 8. 仅明确要求时
```

创作、检查与预览走 `platform/cli.mjs`（下称 `tt`），`tt` 命令支持 `--json`。MP4 导出是独立入口 `scripts/render.mjs`，只在用户明确要求时调用。

### 镜头参考调试（可选）

code recipe 的 `ref-shots/` 可以用 `tt lab [--recipe <id>] [--port N]` 打开镜头参考实验室：卡片静止帧与弹窗播放都来自真实 `tt build` + 引擎面板；页面里可以改 `scene.code`、时长、画幅并重跑。页面里的修改只影响本次预览，不回写 `ref-shots/`。params recipe 没有 `ref-shots/`，不会出现在 lab 里。

## 核心契约

- storyboard 是唯一手写文件；完整契约见 `references/storyboard.md`。`narration` 与 `duration` 互斥，未知场景键直接报错。
- `mode: "code"` 的 recipe 只写 `scene.code`，不写 `scene.params`；`mode: "params"` 的 recipe 只写 `scene.params`，不写 `scene.code`。`maxChars` 超了拆场而不是缩字。
- 反馈、stills/receipts、批注读回与 TTS 语义见 `references/iterate.md`；改稿只改 storyboard，然后重编译。预览页的批注先在页面内多帧累积，用户点「发送批注」后整批写入 `<工程>/annotations/<batch>/` 并关闭预览；用 `tt annotations` 读回，不要读页面事件。

## 交付前自检（别跳过）

```bash
node "$SKILL_DIR/platform/cli.mjs" qa --dir <dir>             # 全片质量：must 必须 0，同时产出 12 格联系表
node "$SKILL_DIR/platform/cli.mjs" det --twice --dir <dir>    # 编译指纹，两次必须一致
```

`qa`/`det` 的语义与 12 格联系表读法见 `references/qa.md`。

## recipe 契约

recipe 是一类成片的创作单位：它决定场景写法（`mode`），并固定 `rules`、`captions`、`audio`；`mode: "params"` 的 recipe 还带 `template`（`draw / params / resources / needs / defaultSfx / sfxTrack / motion / inkless`）。字体不归 recipe 管：字体库在 `assets/fonts/manifest.json`，每个键带 `desc`；code 场把选中的键写进 `scene.resources`（`{"type":"font","name":"sans-400"}`），params 模板写死字体键并在 `template.resources` 声明。颜色由 kit 自带默认值或场景自己写 hex，背景由场景代码 / 模板自己铺满。字号、行高、版式、动效由场景代码或模板本地决定。不同片型对应不同 recipe，由 `tt recipe list` 选择；所有取值静态可追踪。

## 公共 kit

kit 是可复用的绘制词法。用到哪类能力就读 `references/<kit>.md` 一篇（索引见 `references/README.md`）；命名空间、成员与依赖以 `platform/kit/index.json` 为准，本文件不维护 kit 清单。

- 场景笔迹一律走 `TT.pen`，箭头 / 圈 / 框 / 对勾 / 叉 / 数字圈 / 分割线 / 涂底色一律走 `TT.mark`，禁止手写笔迹、复制绘制实现或手写贝塞尔控制点。
- 舞台底走 `TT.board`，同一片子保持同一种舞台；两个 code 场之间需要转场时，只在边界前一场写 `transition: "<预设>"`，编译器生成双帧转场场；不声明按硬切处理。预设与固定时间轴见 `references/transition.md`。
- 字幕样式与位置由 recipe 的 `captions` 决定，可用 `uses.captions` 覆盖样式或位置（bottom / top / center / auto）。

## 固定模板型 recipe 与素材

- `mode: "params"` 的 recipe 只换 `scene.params` 里的少量动态字段，参数契约、排版与声音约束以 `recipe.json` / `recipe.md` 为准；旁白与字幕不是必有的，由该 recipe 的 `audio` / `captions` 决定。
- 实拍素材的检索、缓存、降级与凭证链见 `references/pexels.md`。

## 红线

- 不手写生成的 composition；只改 storyboard，然后重编译。
- 不引入第二套运行时、运行时组件注册、FFmpeg 后处理或拖拽式可视化编辑器。
- 不在场景代码中使用 `Date.now`、`Math.random()`、异步绘制或帧间可变历史。
- 不往公共 kit 里塞内容：kit 只收可穷举 + 复用 ≥3 类 + 人审过的词法；具体实现永远写在 `scene.code` 里。缺新词条先记录缺口，不在本片里临场扩展。
- 本任务只做内容。新增 recipe 或 kit 属于扩展工作，按 `docs/ARCHITECTURE.zh-CN.md` 的扩展流程单独做，不在一次创作里临场添加。
- 凭证只走环境变量或 `~/.dh-video/credentials.json`。
- 不替用户执行 Git 提交、推送、发布或 npm 发布。
