<div align="center">

# Ticktoon Skill

<p><strong>Ticktoon 的 Agent 创作层。写 storyboard，出 MP4。</strong></p>

<p>
    <a href="https://nodejs.org/"><img alt="Node.js 18+" src="https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js&logoColor=white"></a>
    <a href="https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API"><img alt="Protocol v1.0" src="https://img.shields.io/badge/Protocol-v1.0-08A9E6?style=flat-square"></a>
    <a href="https://www.google.com/chrome/"><img alt="Chrome 120+" src="https://img.shields.io/badge/Chrome-120%2B-263238?style=flat-square&logo=googlechrome&logoColor=white"></a>
    <a href="https://github.com/ticktoon/ticktoon-skill/stargazers"><img alt="GitHub Stars" src="https://img.shields.io/github/stars/ticktoon/ticktoon-skill?style=flat-square&logo=github&label=Stars"></a>
</p>

<p><a href="README.md">English</a> · <strong>简体中文</strong></p>
</div>

**Ticktoon Skill 是 [Ticktoon](https://github.com/ticktoon/ticktoon) 的 Agent 创作层。**

LLM 只写一份 `storyboard.json`。平台把它编译成 protocol v1.0 `composition.json`；引擎用 `tick(t)` 同步渲染每一帧；Chrome 直接导出普通 MP4。

创作模型刻意保持单一：一份 storyboard、一条编译链、一条同步渲染路径。storyboard 是唯一手写文件；recipe 给生产规范，params 型 recipe 自带固定模板，kit 给绘制词法。

<!--
演示：把 GIF/WebP 放到 assets/readme/，再取消下面注释。

**演示** —— 从 storyboard 到预览再到 MP4：

![Ticktoon Skill 演示](assets/readme/demo.gif)
-->

```text
用户需求
   ↓
SKILL.md ── 选 recipe，读它的 brief / skeleton
   ↓
storyboard.json                  ← Agent 唯一手写的文件
   ├─ scene.code                 code 型 recipe：整幅画面内容
   └─ scene.params               params 型 recipe：交给 recipe 模板的字段
   ↓
schema → resolve → plan → emit → check → assemble
   ↓
composition.json
   ↓
ticktoon tick(t)                 同一条同步渲染路径
   ├─ 只读预览 / 画笔批注
   ├─ stills / probe / qa / det
   └─ WebCodecs + Mediabunny → MP4（H.264 + AAC）
```

## 架构

运行时只有四层，刻意保持精简：

| 层 | 位置 | 职责 | Agent 何时读 |
|---|---|---|---|
| 操作契约 | `SKILL.md` | 路由、创作闭环、红线、交付自检 | 每次任务 |
| recipe 规范 | `recipes/<id>/` | `recipe.json`、`brief.md`、`skeleton.storyboard.json`；code 型另有 `visual.md` / `ref-shots/`，params 型另有 `template.js` | 只读选中的 1 条 |
| 运行时参考 | `references/` | `scene.code` 与公共 kit 的 API 手册 | 需要时读 1 篇 |
| 内容 | `<工程>/storyboard.json` | 本片场景、旁白、字幕、素材、code、params | **写** |

创作层之下是实现层：`platform/kit/`（公共 kit 与字幕样式）、`platform/compile/`（六阶段编译）、`platform/inspect/`（质量管线），以及 Ticktoon 引擎。

两件东西承载全部能力：

| 单位 | 位置 | 它负责 | 它不负责 |
|---|---|---|---|
| **recipe** | `recipes/` | 一类成片的规范：`mode`、`fonts`、`rules`、`captions`、`audio`；params 型还负责 `template`（`draw / params / resources / needs / defaultSfx / sfxTrack / motion / inkless`） | 内容、叙事、绘制 |
| **kit** | `platform/kit/` | 可复用的绘制词法：文字、笔、标注、舞台、相机、转场、字幕、新闻背景 | 构图、题材 |

recipe 只有两种模式，同一条 recipe 内不混用：`mode: "code"` 由场景写 `scene.code` 调用公共 kit；`mode: "params"` 由场景写 `scene.params`，画面交给 recipe 自带的 `template.js` 画定。`recipe.json` 顶层的 `fonts` 是编译共用的机器契约：只有字体角色，没有 `style` 包装，也不承载颜色、背景、字号、行高、版式或动效。颜色由 kit 自带默认值或 `scene.code` 直接写 hex，背景由 `scene.code` / 模板自己铺满。所有取值静态可追踪。

编译是确定性的：同一份 storyboard 与相同输入产出同一份 `composition.json`，由 `tt det` 验证。渐进式披露也是设计的一部分：`SKILL.md` 只做路由，写稿前先读一条 recipe 的 `brief.md` 和 `skeleton.storyboard.json`；code 型再读 `visual.md` 与一两个 `ref-shots/`，`references/` 按需一次读一篇。

## 能做什么

recipe 覆盖讲解、叙事、快闪、突发新闻与实拍。每条要么用整幅 `scene.code` 承载内容，要么用固定模板承接 `scene.params`。`tt recipe list` 是随目录实时变化的唯一货架；下表是本仓库当前内置的一组。

| Recipe | 画面 | 内容载体 | 适合 |
|---|---|---|---|
| `whiteboard-explainer` | 白板 / 黑板，笔迹逐笔生长 | `scene.code` | 机制、科普、步骤讲解 |
| `blackboard-lesson` | 绿板粉笔，按课堂书写节拍推进 | `scene.code` | 推导、课程、教学节奏 |
| `ink-painting` | 墨线、晕染与大片留白 | `scene.code` | 东方美学、诗词、文化 |
| `illustrated-story` | 纸张拼贴、剪报字 | `scene.code` | 小故事、观察随笔 |
| `flash-cut` | 硬切、大字、一句一场 | `scene.code` | 观点、结论、促销节拍 |
| `crayon-guide` | 暖米纸、蜡笔斜纹、手写标签 | `scene.params` | 菜谱、清单、儿童科普 |
| `shadow-play` | 透光幕布、关节剪影 | `scene.params` | 寓言、民间故事、姿态叙事 |
| `news-broadcast` | 固定竖版新闻卡：蓝色径向底、世界地图、流动线 | `scene.params` | 突发快讯、标题 / 正文 / 来源 |
| `footage-cut` | 满幅真实素材 + 硬短句 | `scene.params` | Pexels 或本地实拍混剪 |

除此之外：

- **带 kit 的场景代码**——`TT.text`、`TT.pen`、`TT.mark`、`TT.board`、`TT.geom`、`TT.transition`、`TT.flash`、`TT.chart`、`TT.newsBg` 等；编译器只注入场景实际用到的成员。
- **7 种字幕样式 + `none`**——band、plain、card、karaoke、collage、handnote、vertical，支持逐字时间与主体避让。
- **旁白与声音**——默认零密钥 edge-tts，可选 Volc TTS；BGM/SFX 支持淡入淡出与人声闪避。
- **实拍素材**——Pexels 检索、下载、署名、缓存与内置素材降级。
- **预览与审片**——只读预览、静帧、probe 凭据；预览页可逐帧画笔标注、累积成待发送列表，点「发送批注」后整批连描述与截图写入 `<工程>/annotations/` 并关闭预览，用 `tt annotations` 读回，形成改稿闭环。
- **质量门禁**——`tt qa` 只做轻门禁：`RENDER_PAGE_ERROR` 与 `QA_INK_EMPTY` 两项 must 检查，并输出 12 格联系表；`tt det` 检查编译确定性。
- **直接出 MP4**——通过 WebCodecs 与 Mediabunny 输出 H.264 + AAC，不调用外部 FFmpeg 可执行文件。
- **画幅**——1920×1080@30 与 1080×1920@30。

<!--
案例图：把截图或 GIF 放到 assets/readme/，再取消下面注释并调整文件名。

![白板手写](assets/readme/whiteboard-explainer.png)
![蜡笔图解](assets/readme/crayon-guide.png)
![突发新闻](assets/readme/news-broadcast.png)
-->

## QA：一次浏览器会话，抽帧、凭据、联系表一次完成

`tt qa` 不是“循环截图”。它只 build 一次，然后用一个本机 Chrome 会话（CDP）按场景采样 24–30 帧；每一帧都走引擎自己的 capture 链路：

```text
pause → seek(t) → await video.settle(t) → 同步 tick(t) 重绘 → PNG
```

帧是否稳定由引擎判断，不靠固定 `sleep`。机器快时不会白等；机器慢或视频解码重时，也不会抽到 settle 之前的黑帧/旧帧。

同一个页内回调里算出 32×18 亮度探针，并把当前帧贴进 12 格联系表；随后一次读取这一帧的真实绘制凭据（单元墨迹框 / 文字 / 字幕）。拼图在页面里完成，不为拼图再渲染一轮，也不把 N 张 PNG 搬回 Node 再拼。

采样点按场景分配：每场至少一帧；单帧取场中 55%，多帧沿 18%–82% 铺开，避开入场和退场；联系表首格取开场 6%，末格取收尾 94%。联系表是视觉证据，不是评分卡。

机器只做轻门禁：`RENDER_PAGE_ERROR` 与 `QA_INK_EMPTY`（场景单元执行了却没有可见墨迹）。安全框、碰撞、文字互压、字幕带、对比度、停留时间都不自动打分——交给联系表和人 / Agent 判断。报告里只留真实命中的问题，不保留降级检查。

**为什么快**（本机实测，27 帧 flash-cut，含 build）：

| 项目 | 旧 Playwright 方案 | 现在 |
|---|---|---|
| 浏览器启动 | 2.57s | 0.51s |
| 每帧等待 | 2 个 RAF + 140ms 固定 sleep | 引擎 `video.settle(t)` |
| 27 帧固定等待 | 4.2–4.7s | 0 |
| 整条 `tt qa` | — | 4.1s |
| npm 依赖 | playwright + core，下载约 4.1MB / 落盘约 18.7MB，Node ≥20 | 复用已有 `ws`，Node ≥18 |

在 60–120Hz 下，旧方案光固定等待就要 4.2–4.7s，已经和现在整条 QA 的 4.1s 同一量级。`tt ci --deep` 跑 9 条 recipe 时，仅浏览器启动一项就少约 18s；本机全量 42.2s。QA、stills、snapshot、render 共用同一套本机 Chrome CDP 驱动，不再为自动化框架多装一层壳。

## 实时预览与圈注修改：看到问题，直接标给 Agent

`tt preview --dir my-video` 启动本地只读预览，画面由引擎同一套 `compositor.tick(t)` 实时播放；它不是另一套渲染器，也不是可视化编辑器。改完 storyboard 重新 `tt build`，预览页按 `composition.json` 的 mtime 自动刷新，不需要重启。

看到问题后，在画面上直接画笔圈注，并在底部批注坞写一句描述：

1. 点「画笔批注」暂停在当前帧，画笔画选 / 圈出问题区域；
2. 写描述，点「完成批注」进入页面内待发送列表；可以继续跳到其他时间点标注，也可以删除某条；
3. 点「发送批注」：整批 POST 到本地预览服务，写入 `<工程>/annotations/<batch>/`。每条包含描述、时间、命中的 clip，以及三张 PNG：原始帧、纯笔迹、合成后的批注图；
4. 发送成功后预览自动关闭，控制权回到启动它的 Agent 会话。如果是 Agent 启动的预览，退出时会直接把批次交回；否则用 `tt annotations` 读最新未处理批次。Agent 打开 `annotatedFrame` 看圈注，结合 `desc` / `t` / `clip` 定位要改的场；
5. 改 `storyboard.json` → 重新 `build` → 再 `tt preview`。处理完用 `tt annotations --dir my-video --ack <batch-id>` 标记整批已处理。

这样“看片—圈注—改稿”闭环里，Agent 不需要从聊天里猜用户指的是哪一帧、哪个元素；圈注和截图就是定位证据。`annotations/` 是用户输入，不写进 `out/`，重编译不会丢；整个链路仍然只改 storyboard，不引入第二个运行时或可视化编辑器。

> 预览页不回放音频；要听旁白，导出 MP4 试听。

## 怎么用

环境要求：Node.js 18+（建议 22 LTS）、Chrome 120+，以及可用的 WebGL2 环境。

```bash
git clone https://github.com/ticktoon/ticktoon-skill
cd ticktoon-skill
npm install
node scripts/doctor.mjs
```

`doctor` 会检查 Node、Ticktoon 引擎产物、npm 依赖、Chrome、WebGL2，以及可选的 TTS/素材 provider。若报 `deps` 缺失，在 skill 目录执行 `npm install`；skill 通过 CDP 直接驱动本机 Chrome（≥120），不会下载自带浏览器。无 GPU 服务器可设置 `DH_VIDEO_WEBGL=swiftshader`。

默认链路不需要 API key：edge-tts + 内置演示素材。可选的 Volc TTS 与 Pexels 通过 `node scripts/auth.mjs set <KEY> <value>` 配置；凭证只从环境变量或 `~/.dh-video/credentials.json` 读取，不写入 storyboard 或工程。

### 在 Agent 里用

把本仓库或 `tt pack` 产出的干净分发包放进 Agent 的 skills 目录（Claude Code 可放在 `~/.claude/skills/ticktoon`），确保 [`SKILL.md`](SKILL.md) 位于根目录。Agent 会从 `recipes/` 选一条 recipe，读它的 brief 与 skeleton，然后写 storyboard 并编译；code 型还会读 `visual.md` 与 `ref-shots/`。

示例请求：

> 做一个 30 秒的白板科普视频，讲复利，只用一条旁白，字幕用默认 band 样式。

### 用 CLI

```bash
node platform/cli.mjs new my-video --recipe whiteboard-explainer   # 建工程
node platform/cli.mjs build --dir my-video                          # 快速编译（估时、无配音）
node platform/cli.mjs stills 0.6 3.1 9.4 --dir my-video             # 静帧 + 布局凭据
node platform/cli.mjs preview --dir my-video --port 5123            # 只读预览
node platform/cli.mjs annotations --dir my-video                    # 读取预览页发送的批注批次
node platform/cli.mjs qa --dir my-video                             # must 门禁 + 12 格联系表
node platform/cli.mjs det --twice --dir my-video                    # 编译确定性检查
node platform/cli.mjs build --dir my-video --tts edge               # 带真实旁白重编译
node scripts/render.mjs my-video/out/composition.json -o my-video/video.mp4
```

`tt` 指 `node platform/cli.mjs`（或 `npm run tt --`）。`storyboard.json` 是唯一需要手写的文件。`out/` 下都是构建产物，不要手改；改完重新 `build`，预览会自动刷新。只在明确需要时导出 MP4；不带 `--tts` 的 build 没有旁白音轨。

常用命令：

| 命令 | 作用 |
|---|---|
| `tt recipe list / show <id> / audit` | 列出 recipe、查看单条契约（mode / template）、全量审计骨架与示例 |
| `tt annotations [--all] [--ack [id]]` | 读取预览页发送的批注批次（默认最新未处理批次），`--ack` 标记整批已处理 |
| `tt lab [--recipe <id>] [--port N]` | code recipe 镜头参考实验室：每个 `ref-shots/` 文件都走真实 build + 引擎预览；可改代码重跑，不回写文件 |
| `tt ci [--deep]` | 全量回归：audit + 双编译确定性；`--deep` 对每条 recipe 跑 QA |
| `tt ci --baseline [--write]` | 对比骨架 / 镜头参考合成片的编译指纹；人审后刷新基线 |
| `tt pack [dir]` | 打干净分发包（Skill + 引擎 dist） |

## 文件夹结构

```text
ticktoon-skill/
├── SKILL.md                     # Agent 入口：路由、闭环、红线
├── recipes/                     # 内置 recipe：规范、brief、骨架、ref-shots
│   ├── whiteboard-explainer/
│   │   ├── recipe.json          # mode / fonts / rules / captions / audio
│   │   ├── brief.md             # 何时用、何时不用、视觉数值
│   │   ├── skeleton.storyboard.json
│   │   ├── visual.md            # code 型 recipe 的画法规范
│   │   └── ref-shots/*.js
│   ├── news-broadcast/
│   │   ├── recipe.json          # mode: params + template 契约
│   │   ├── template.js         # 固定满幅模板：draw(g, p)
│   │   ├── brief.md
│   │   └── skeleton.storyboard.json
│   └── ...
├── references/                  # 运行时 API 手册：storyboard、scene code、kit
├── platform/
│   ├── compile/                 # schema → resolve → plan → emit → check → assemble
│   ├── inspect/                 # stills、probe、qa、det
│   ├── project/                 # new、build、audit、ref-shots
│   ├── kit/                     # 公共 kit 命名空间 + 字幕样式
│   └── preview/                 # 只读预览 + 画笔批注
├── scripts/                     # render、doctor、auth、snapshot、pack
├── assets/                      # 字体、BGM、SFX、演示素材、README 案例图
├── docs/                        # 人类 / 开发文档（不参与运行时）
└── output/                      # 构建产物（gitignore）
```

## 说明

- Agent 入口：[`SKILL.md`](SKILL.md)
- 运行时参考索引：[`references/README.md`](references/README.md)
- 当前架构：[`docs/ARCHITECTURE.zh-CN.md`](docs/ARCHITECTURE.zh-CN.md)
- 视觉描述词典（人读参考）：[`docs/style-dictionary.md`](docs/style-dictionary.md)
- 音频链说明：[`docs/AUDIO.md`](docs/AUDIO.md)
- Pexels 流水线说明：[`docs/PEXELS-PIPELINE.md`](docs/PEXELS-PIPELINE.md)
- 引擎、协议与场景 API：[`ticktoon`](https://github.com/ticktoon/ticktoon)

## 许可证

Ticktoon 引擎采用 Apache-2.0。Skill 的代码、字体、音乐、实拍素材与迁移内容需要单独的许可证与署名复核后才能公开发布；见引擎的 [`NOTICE`](https://github.com/ticktoon/ticktoon/blob/main/NOTICE)。
