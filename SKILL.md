---
name: ticktoon
description: 用 Ticktoon 生成整幅场景化短视频。recipe 给一类成片的规范，公共 kit 给可穷举、人审过的绘制词法，你在 storyboard 的 scene.code 里实时写内容。当前 recipe 货架以 tt recipe list 为准。用户要求视频创作或修改 composition 时使用。
---

# Ticktoon

唯一产物是 protocol v1.0 `composition.json`（`scenes[]` + `audio[]`）。

下文 `SKILL_DIR` 指本文件所在目录。脚本用绝对路径调用，cwd 保持在用户工程目录。首次使用或环境异常运行 `node "$SKILL_DIR/scripts/doctor.mjs" --install`：它会检查全部环境，只在缺少 ticktoon / ws / msedge-tts 时自动执行 npm install（引擎固定使用 npm 包 `ticktoon@1.0.4`），然后继续检查，不要拆成 doctor → 手动安装 → 重跑 doctor。Chrome 通过 CDP 直接驱动本机安装，不下载浏览器。

## 结构

运行时四层：`SKILL.md`（操作契约）→ `recipes/`（recipe 规范）→ `references/`（API 参考）→ `<工程>/storyboard.json`（内容）。公共 kit（`platform/kit/`）、编译与渲染链是下层实现，由平台负责，创作时只通过 `tt` 使用。

## 读取顺序（只读需要的）

1. 先用 `tt recipe list` 选 recipe：它的输出（id / 名称 / 关键词 / 适用时机 `when` / 不适用时机 `notWhen`）就是当前货架，本文件不复制清单。按 `keywords` 和 `when` 找最贴的，用 `notWhen` 排除明显不合适的；选中后才读文档。需要看规则时用 `tt recipe show <id>`，它给出 `when / notWhen / mode / rules / captions / audio / pacing / template`。
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
| **带视觉词或题材**（白板 / 黑板 / 新闻 / 实拍 / 蜡笔 / 纸上剧场 / 快闪…） | 与 `tt recipe list` 的 `keywords`、`when` 匹配最贴的 recipe，并用 `notWhen` 排除明显不合适的；选中后再读该 recipe 的 recipe.md / skeleton，code 型再读 ref-shots；recipe 只给规范，不给内容 |
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
node "$SKILL_DIR/platform/cli.mjs" build --dir <dir>          # 3. 编译并自动生成真实音轨；provider 由内部按环境选择
node "$SKILL_DIR/platform/cli.mjs" qa --dir <dir>             # 4. 仅 code 配方：采样 + 12 格联系表；params 固定模板直接跳到第 5 步
node "$SKILL_DIR/platform/cli.mjs" preview --dir <dir> --port 5123  # 5. 首次以后台任务启动；复用时输出 ready 即返回
node "$SKILL_DIR/platform/cli.mjs" annotations --wait              # 6. 同时启动唯一的全局圈注等待任务，圈注到达后继续修改；导出时关闭
```

创作、检查与预览走 `platform/cli.mjs`（下称 `tt`），`tt` 命令支持 `--json`。**默认创作终点是 Preview Studio，不是 MP4。** 最初的“制作 / 生成视频”请求不等于授权导出 MP4，也不等于允许跳过预览。**`code` 配方在 QA `must=0` 且联系表没有明显问题后，直接打开 Preview Studio；`params` 配方使用固定模板，build 后直接 preview，不跑 QA。** 不要为了再次确认构图、稳定帧或入场透明度追加 `stills`，不要继续做无实际缺陷支撑的反复检查。

预览服务全局单例，自动复用、切换工程和刷新 composition。右上角「下载 board JSON」直接保存当前 composition 的原始 UTF-8 JSON 文件，用于分析或交付，不经过剪贴板。

用户明确要求导出 MP4 时，**直接导出，不要求再次点击预览确认**：

```bash
node "$SKILL_DIR/platform/cli.mjs" export --dir <dir>
```

预览与导出共享同一份 composition 和音轨。**导出只渲染当前数据，禁止再跑 build / TTS / det。**只有 storyboard 更新时才重新构建并生成新版本；未改文案的 TTS 命中缓存。`render` 默认使用 1× 输出避免 1080p 内部 2× 超采样；用户明确要求更高超采样画质时才加 `--render-scale 2`。

**本机普通 Chrome 可用时，不要设置 `TICKTOON_CHROME_PATH` / `CHROME_PATH` 指向 Playwright 的 `chrome-headless-shell`；省略这两个变量，让启动器使用普通 Chrome 和本机 GPU。** headless shell 会默认走 SwiftShader，导出明显更慢；只有普通 Chrome 不可用或用户明确指定时才使用它。

**全片视觉检查只对 `code` 配方跑 `tt qa` 并读取 `review/qa-sheet.png`；`params` 配方是固定模板，不跑 `tt qa`，build 后直接 `tt preview`（`tt qa` 对 params 工程会自动跳过并提示）。人工快速验收用 `tt preview`，不要自造时间点运行 `tt stills` 来代替 QA。** `stills` 会同时输出**指定时刻的完整 PNG 静帧和布局凭据（receipts）**，只用于用户指定时刻或定点排障，不是标准创作步骤。**禁止 FFmpeg 抽帧、截图、转码验证，禁止先导出 MP4 再检查画面；`tt export` 只负责导出，不提供抽帧参数。**


## 核心契约

- storyboard 是唯一手写文件；完整契约见 `references/storyboard.md`。`narration` 与 `duration` 互斥，未知场景键直接报错。
- `mode: "code"` 的 recipe 只写 `scene.code`，不写 `scene.params`；`mode: "params"` 的 recipe 只写 `scene.params`，不写 `scene.code`。`maxChars` 超了拆场而不是缩字。
- 反馈、stills/receipts、圈注读回与 TTS 语义见 `references/iterate.md`；改稿只改 storyboard，然后重编译。打开或复用预览时，同时启动全局唯一的 `annotations --wait`；等待只读全局收件箱，不随工程切换重启。圈注落盘后任务返回批次及所属工程，同一 Agent 继续解读修改；重编译后预览自动刷新，并按需建立下一次等待。导出时结束等待任务，预览服务不受影响。用 `tt annotations` 读回，不要读页面事件。

## 导出前自检（仅用户明确要求导出时）

```bash
node "$SKILL_DIR/platform/cli.mjs" qa --dir <dir>             # 仅 code 配方：must 必须 0，同时产出 12 格联系表
node "$SKILL_DIR/platform/cli.mjs" det --twice --dir <dir>    # 编译指纹，两次必须一致
```

`params` 配方使用固定模板，跳过 `qa`；直接 preview / export。`qa`/`det` 的语义与 12 格联系表读法见 `references/qa.md`。

## recipe 契约

recipe 是一类成片的创作单位：它决定场景写法（`mode`），并固定 `rules`、`captions`、`audio`、`pacing`；`mode: "params"` 的 recipe 还带 `template`（`draw / params / resources / needs / defaultSfx / sfxTrack / inkless`）。字体不归 recipe 管：字体库在 `assets/fonts/manifest.json`，每个键带 `desc`；code 场把选中的键写进 `scene.resources`（`{"type":"font","name":"sans-400"}`），params 模板写死字体键并在 `template.resources` 声明。颜色由 kit 自带默认值或场景自己写 hex，背景由场景代码 / 模板自己铺满。字号、行高、版式、动效由场景代码或模板本地决定。不同片型对应不同 recipe，由 `tt recipe list` 选择；所有取值静态可追踪。

## 公共 kit

kit 是场景内可复用的绘制词法。命名空间、成员与依赖以 `platform/kit/index.json` 为准，本文件不维护清单；用到哪类能力，只读对应的 `references/<kit>.md` 一篇（索引见 `references/README.md`）。

- **笔迹与标注**：场景笔迹走 `TT.pen`；箭头、圈、框、对勾、叉、数字圈、分割线和涂底色走 `TT.mark`。禁止手写笔迹、复制实现或手写贝塞尔控制点。
- **舞台背景**：使用 `TT.board`，同一片子保持同一种舞台；它只负责场景内部的底面与框景，不负责场间衔接。
- **字幕排版**：样式与位置由 recipe 的 `captions` 决定，可用 `uses.captions` 覆盖样式或位置（bottom / top / center / auto）。

## 场间转场

转场不是舞台绘制，也不是在单场景末尾自行叠加的效果。Agent 判断两个 code 场确需衔接时，只在边界前一场声明 `transition: "<预设>"`；编译器生成独立双帧转场场并调用 `TT.transition` 合成。未声明即硬切。选择规则、预设与固定时间轴见 `references/transition.md`，配方自己的节奏限制见对应 `recipe.md`。

## 固定模板型 recipe 与素材

- `mode: "params"` 的 recipe 只换 `scene.params` 里的少量动态字段，参数契约、排版与声音约束以 `recipe.json` / `recipe.md` 为准；旁白与字幕不是必有的，由该 recipe 的 `audio` / `captions` 决定。
- 实拍素材的检索、缓存与凭证链见 `references/pexels.md`。`footage` 的 `src` 为 `pexels:` 查询时必须先运行 `tt assets fetch`，无 key 直接报错；本地视频不需要 key。
- 按需图标与图片使用 `tt assets search / download`，见 `references/web-assets.md`。下载必须指定用户工程并记录授权；skill 只保留极小的 lab demo，不预置完整素材库。

## 红线

- 不手写生成的 composition；只改 storyboard，然后重编译。
- 不引入第二套运行时、运行时组件注册、FFmpeg 后处理或拖拽式可视化编辑器；禁止 FFmpeg 抽帧、截图和转码验证。
- 不在场景代码中使用 `Date.now`、`Math.random()`、异步绘制或帧间可变历史。
- 不往公共 kit 里塞内容：kit 只收可穷举 + 复用 ≥3 类 + 人审过的词法；具体实现永远写在 `scene.code` 里。缺新词条先记录缺口，不在本片里临场扩展。
- 本任务只做内容。新增 recipe 或 kit 属于扩展工作，按 `docs/ARCHITECTURE.zh-CN.md` 的扩展流程单独做，不在一次创作里临场添加。
- 凭证只走环境变量。