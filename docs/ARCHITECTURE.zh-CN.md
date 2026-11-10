# ticktoon-skill 架构（当前实现）

> 2026-11-10。本文只描述**当前代码实际行为**，不是下一阶段规划。
> 发生冲突时，以 `SKILL.md`、`platform/` 源码和 `tt` 的实际输出为准。

---

## 0. 一页结论

**一句话：Agent 只维护一份 `storyboard.json`；Node 编译器把它变成 protocol v1.0 `composition.json`；引擎通过同步 `tick(t)` 在 Canvas 上逐帧重画，预览、抽帧、QA 和 MP4 导出共用同一条渲染路径。**

```text
用户需求
   ↓
SKILL.md：选 recipe，读对应 contract / demo
   ↓
storyboard.json                       ← Agent 唯一需要手写的文件
   ├─ scene.code：整幅内容由作者实时写
   └─ elements[]：参数化 block 版式
   ↓
schema → resolve → plan → emit → check → assemble
   ↓
composition.json / events.json / subs.srt / report.json
   ↓
ticktoon CanvasCompositor.tick(t)
   ├─ 只读预览 / 画笔批注
   ├─ stills / probe / qa（含 verify/forbid/temporal 与 12 格联系表）
   ├─ det
   └─ WebCodecs + Mediabunny → 普通 MP4（H.264 + AAC）
```

当前基线：

| 项 | 实际数量 |
|---|---|
| recipe | **9**（ABI 8，内置 `style / rules / captions / audio`） |
| 正式 block | **4**（`scene.*`，另有 2 个 `_lab` 实验件） |
| 公共 kit 命名空间 | **11** 个 `TT.*` 入口 + 字幕 kit |
| 字幕样式 | **7** 种，另有 `none` |
| 允许画幅 | **1920×1080@30 / 1080×1920@30** |

---

## 1. 分层与目录

| 层 | 当前位置 | 职责 | Agent 是否直接读 |
|---|---|---|---|
| 操作契约 | `SKILL.md` | 路由、创作闭环、红线、交付自检 | 每次读 |
| recipe 规范 | `recipes/*/recipe.json`、recipe 目录内 `visual.md` / `examples/` | `style / rules / captions / audio / forbid / verify` 与画法沉淀 | 只读选中的 1 份 |
| 运行时参考 | `references/` | `scene.code` 与公共 kit 的 API 手册 | 需要时读对应 1 篇 |
| 内容 | `<工程>/storyboard.json` | 本片叙事、场景、字幕、素材、code | **写** |
| 公共 kit | `platform/kit/` | 舞台、笔、文字、标注、相机、转场、字幕等纯函数 | 通过注入使用 |
| 版式件 | `platform/blocks/` | 可穷举、参数化的整幅版式 | 通过 elements 使用 |
| 编译 | `platform/compile/` | 六阶段编译链与确定性哈希 | 不读 |
| 检查 | `platform/inspect/` | 采样、receipts、qa、verify/forbid、temporal、统一质量管线 | 通过 `tt` 使用 |
| 宿主工具 | `platform/project/`、`scripts/` | 建工程、审计、预览、导出、TTS、素材 | 通过 `tt` 使用 |
| 引擎 | `ticktoon/dist/`（或显式源码仓） | protocol v1.0、Canvas/WebCodecs 渲染 | 不读 |
| 人类/开发文档 | `docs/` | 架构、历史、基准、运维记录 | 不读 |

`SKILL.md`、`recipes/` 与 `references/` 是运行时层；`docs/` 只面向人类开发者，运行时文件不引用 `docs/`。历史任务记录留在 `.cc-tasks/`，不进入运行时。

### 1.1 当前货架

**内置 recipe**

以下为当前快照；实时清单以 `tt recipe list` 为准，本表随目录变化可能滞后。

| recipe | 内容载体 | 自带视觉（`style` 摘要） |
|---|---|---|
| `whiteboard-explainer` | `scene.code` | 暖白纸 / 马克笔红 |
| `blackboard-lesson` | `scene.code` | 绿黑板 / 粉笔白 |
| `ink-painting` | `scene.code` | 近黑底 / 水墨浓淡 |
| `illustrated-story` | `scene.code` | 米色纸 / 拼贴色 |
| `flash-cut` | `scene.code` | 近黑底 / 金色强调 |
| `crayon-guide` | `scene.crayon` | 暖米纸 / 蜡笔色 |
| `shadow-play` | `scene.shadow` | 深棕夜底 / 琥珀剪影 |
| `news-broadcast` | `scene.news` | 径向深蓝 / 地图与网格 |
| `footage-cut` | `scene.footage` | 深棕黑 / 暖白压屏字 |

内容形态取决于 `recipe.json` 的 `blocks`（code 型写 `scene.code`，layout 型用 `scene.*`）。新增 recipe 只需建目录并写 `recipe.json`，`tt recipe list / audit / ci --baseline` 都会自动纳入，不需要改任何索引文件。

**公共 kit（`platform/kit/index.json`）**

`ease`、`num`（含 `clamp01 / env / rng`）、`text`、`style`（`color / font`）、`chart`、`pen`、`mark`、`transition`、`board`、`geom`、`newsbg`（`newsBg`：新闻径向蓝底 + 地图 + 网格 + 种子流动线）。

字幕 kit 在 `platform/kit/captions/`：`core.js` 提供 `TT.captionKit`，`styles/*.js` 是七种可选样式。它随编译期选中的样式一起注入，不走 `index.json` 的命名空间机制。

**正式 block（4）**

- `scene.crayon` / `scene.footage` / `scene.news` / `scene.shadow`

这也是当前 recipe 唯一允许的 block 集合；`tt block list` 会额外列出 2 个 `_lab` 实验件。

`platform/blocks/_lab/` 还有 `scene.caption-demo` / `scene.pen-demo`。它们用于 kit 对照，不属于正式创作货架；`tt block list` 目前会一并列出。

**style 契约（ABI 8）**

`style` 只有 `fonts`（角色 → manifest 字体键）与 `colors`（`bg / ink / muted / accent / line`），可选 `backgrounds`（命名背景色）。字号、行高、版式、动效、图表参数不属于 `style`；它们归 recipe `rules` 的白名单字段或 block 本地配置。`style` 是 recipe 自带的静态字段，直接参与编译与 QA，不经过注册表或运行时合并。

---

## 2. storyboard 契约

顶层只允许 `recipe / format / meta / beats / scenes / uses`。场景允许 `id / narration / duration / bg / camera / elements / code / resources / note / transitionIn / transitionOut`。

关键规则：

- `format` 只接受两种：`1920×1080@30`、`1080×1920@30`；其他正数画幅是引擎能力，不是 Skill 的开放格式。
- `narration` 与 `duration` 结构互斥：旁白场由 TTS 或估时求时长，静默场必须写 `duration`。
- 没有 `start`、没有 `tracks`、没有顶层 `duration`；场景起点按数组顺序累加，总时长是场景时长之和。
- `beats` 是场景相对命名时刻；只能指向本场，跨场报 `BEAT_CROSS_SCENE`。
- `elements[]` 的保留键只有 `block / slot / rect / at / dur / sfx / sfxAt`；其余键按 block 参数校验，未知键直接报错。
- `scene.code` 可以是字符串或字符串数组（数组按换行拼接），上限 20000 字符。
- `scene.code` 与 `elements[]` 可以共存：code 先画，elements 作为叠加层。

---

## 3. 编译链

实际入口是 `platform/project/build.mjs`：

```text
loadCatalog + normalizeStoryboard         ① schema
  ↓
resolveStoryboard                          ② resolve：TTS、素材、BGM
  ↓
planStoryboard                             ③ plan：场长、起点、cue、绝对时刻
  ↓
emitScene × N                              ④ emit：生成每场函数体
  ↓
check(...)                                 ⑤ check：静态规则与 recipe 语义
  ↓
assemble(...)                              ⑥ assemble：audio[]、总时长、SRT
  ↓
engine validateComposition                 引擎二次协议校验
  ↓
out/{composition,events,subs.srt,report}.json
```

| 阶段 | 当前行为 |
|---|---|
| schema | 载入 block/style/Caption/recipe 契约；补齐缺省；校验未知键与参数；同时执行 `scene.code` 静态扫描 |
| resolve | 解析 TTS 时长与词级时间、素材路径、BGM、SFX manifest；TTS 为空时按 4.6 字/秒估算 |
| plan | 求每场时长与起点；解析 `beats`；切 caption cue；生成场景相对逐字时间 |
| emit | 按引用注入 kit/block/caption 源码；生成两段式场景函数；收集 resources/needs/cues；冻结 element 参数 |
| check | 停留、slot 重叠、字幕区、对比度、能量连续、资源与 `CODE_*` 等静态规则 |
| assemble | 旁白/BGM/SFX 事件；BGM ducking；总时长；SRT 直接从 cues 生成 |

编译产物：

```text
<工程>/out/
├── composition.json   protocol v1.0，给引擎
├── events.json        音频事件调试副本
├── subs.srt           按 composition cues 生成
└── report.json        统计、warnings/errors、det、耗时
```

`report.json` 的核心字段：

```json
{
  "ok": true,
  "status": "ok",
  "duration": 22.34,
  "scenes": 8,
  "elements": 31,
  "codeScenes": 3,
  "captionCues": 14,
  "estimatedNarration": 0,
  "det": { "hash": "…", "scenes": [] },
  "engineChecked": true,
  "timings": { "totalMs": 1200 },
  "warnings": [],
  "errors": [],
  "receipts": []
}
```

receipts 不是 build 时产生的像素证据；它由 `stills / probe / qa` 的浏览器采样采集。

---

## 4. emit 的实际代码形态

### 4.1 源码片段注入

`TT`、`BLOCKS`、`CAPTIONS` 都不是 ES 模块，而是 IIFE 源码片段。引擎用 `new Function('ctx','api',code)` 编译整段场景代码，因此不存在 `import`。

emit 规则：

- kit 按 `platform/kit/index.json` 的 `provides` 和 `requires` 递归解析，只注入当前场景引用到的命名空间。
- block 只注入当前场景 `elements[]` 用到的条目。
- code 场会把 `STYLE` 的全部字体角色带进本场 `resources`，因为无法静态穷举作者会调用哪些 `TT.font`。
- `RULES` 只在含 `scene.code` 的场景注入。
- `render receipts` 只在采样模式注入；正式 `composition.json` 不含调试钩子。

### 4.2 每个场景只有一个 draw

emit 固定生成：

```js
return (ctx, api) => {
  // 1. 重置 ink/text 回执
  // 2. scene.camera 线性缩放
  // 3. scene.code（包一层 fillText 记账）
  // 4. elements（复用冻结的 G{i} / P{i}）
  // 5. captions
  // 6. receipts（仅采样模式）
};
```

因此当前 storyboard 里的 `scene.code` 是**内联在逐帧 draw 中执行**，不是引擎原始的“函数体直出”通道：

- 作者不能通过 `return (ctx, api) => {}` 自定义 setup；
- `api.three()` 无法从 storyboard 的 `scene.code` 直接使用；
- Three 的 `needs: ['three']` 目前只从 block 元数据收集，而当前 block 货架都未启用 Three；
- 引擎本身支持两段式与 Three，但当前 Skill 的 storyboard 编译路径尚未产品化暴露。

### 4.3 `scene.code` 静态扫描

`platform/compile/code-scan.mjs` 是词法扫描，不是 AST，也不是安全沙箱。被拦截的 token：

```text
import( / require( / fetch( / XMLHttpRequest / WebSocket
document. / window. / localStorage / eval( / new Function
Date.now / new Date / Math.random
```

补充规则：

- 注释会先被抹成等长空格再扫描，避免把说明文字当调用；行号仍保留。
- **字符串字面量仍会被扫描**：字符串里写 `document.` 也会报 `CODE_FORBIDDEN_API`。
- `while (`、`for (;;` 只报 `CODE_LOOP_RISK`（should），不直接 error。
- `api.img()` / `api.video()` 引用的资源名不在本场 `resources` 时报 `CODE_RESOURCE_MISSING`。
- 最终执行仍是可信作者代码：扫描只能拦常见破坏确定性/外部 IO 的写法，不能抵御恶意代码。

---

## 5. 运行时边界

引擎协议只有：

```ts
interface Composition {
  version?: '1.0';
  width: number;
  height: number;
  fps?: number;
  duration: number;
  scenes: Scene[];
  audio?: AudioEvent[];
}
```

- 画面只有连续场景，没有 tracks，也没有跨场景同时存在的图层。
- `tick(t)` 同步执行，每帧从零重画；Promise 返回值会被拒绝。
- 每一帧冻结 `api`，并以场景 seed 重建确定性 RNG。
- 预览和导出共用 `CanvasCompositor.tick(t)`；导出只是换更高的宿主渲染倍率。
- 首场预载，后续场景按需 prepare，播放时预取下一场。
- 图片/字体按 `src` 去重、懒加载；资源池不主动淘汰，长片资源驻留是明确的内存边界。
- 视频帧尚未发布时 `api.video(name)` 返回 `null`，绘制必须跳过。
- 导出默认 QP20，自动协商 AVC profile/level；音频 AAC-LC；无外部 FFmpeg CLI。
- 超采样：1080p→2×、1440p→1.5×、4K→1×，受 4K 像素面积封顶。

---

## 6. 时间、字幕与音频

### 6.1 时间链

```text
narration ──TTS──► speech
                  ├─► sceneDur = leadIn + speech + hold
duration ─────────┘
sceneDur ──累加──► scene.start
         ──求和──► composition.duration
```

- 旁白一场一个音频事件，`at = scene.start + speechStart`。
- 没有 TTS 或 provider 不返回时长时，按 4.6 字/秒 + 句末标点估算，并给提示。
- `beats` 只解析本场范围；边界浮点差 1e-3 内吸附。
- cue 在 plan 阶段切成场景相对时间；SRT 只写不读。

### 6.2 字幕

`platform/kit/captions/core.js` 统一处理字体、逐字时间、折行、定位、安全区、淡入淡出与主体避让；`platform/kit/captions/styles/*.js` 只定义盒型与绘制。

7 种样式：`band / plain / card / karaoke / collage / handnote / vertical`，另有 `none`。字幕在场景元素之后、相机变换之外绘制。

### 6.3 音频事件

默认角色音量：

```js
{ narration: 1.0, bgm: 0.12, sfx: 0.6 }
```

- 旁白：一场一个事件。
- BGM：可按旁白区间切成相邻事件实现 ducking；无 duck 配置时用单事件 + 首尾淡入淡出。
- SFX：element 的 `sfx` / block 静态 `sfxTrack` / 循环音效，全部在编译期展开为绝对时间事件；运行时不产生声音。
- 引擎不做 LUFS、母带归一、侧链压缩；响度属导出后工序。

### 6.4 语音与素材

- Edge TTS：零密钥，支持 WordBoundary 词级时间。
- 火山 TTS：需要 `VOLC_TTS_APP_ID` / `VOLC_TTS_ACCESS_TOKEN`；无词级时间，逐字字幕按字符等比降级。
- Pexels：检索、下载、缓存、署名 manifest；失败默认回退 bundled 素材，`--strict` 可禁止降级。

凭证只从环境变量或 `~/.dh-video/credentials.json` 读取，任何文档、日志、storyboard 都不写明文凭证。

---

## 7. 验收体系

| 命令 | 输入 | 证明什么 | 不证明什么 |
|---|---|---|---|
| `tt build` | storyboard | 六阶段编译通过，引擎协议校验通过 | 画面好不好 |
| `tt stills` / `probe` | 指定时刻 | 真实 ink/text/caption 框、亮度、元素可见性 | 全片时间连续性 |
| `tt qa` | 一次 build + 一次浏览器会话；约 24 个时间维采样帧，联系表 12 格复用其中大部分采样点（首尾与 verify 时刻追加），单会话约 24–30 帧 | must 级像素/几何缺陷、recipe verify/forbid、采样帧间的 temporal 事实、12 格视觉证据 | 全片逐帧无缺陷；审美好坏 |
| recipe `verify/forbid` | receipts + composition（由 `tt qa` 调用） | 规范断言与题材枚举禁止项 | 主观审美 |
| `tt det` | 编译产物 | 规范化 composition 的 SHA-256 指纹 | 像素一致、MP4 字节一致 |
| `tt ci --baseline` | 9 条 demo | 编译指纹与构建状态回归；指纹变化提示人审后刷新 | 像素/视觉回归 |
| `tt ci [--deep]` | 全货架 | 快速/深度全量回归；`--deep` 复用 `tt qa` 同一管线 | 真机联网、真实素材与导出验收 |

### 7.1 采样口径

`platform/inspect/sample.mjs` 一次浏览器会话渲染所有采样帧：

- 时间维采样 `sampleTimes`：每场至少一帧；名额富余时优先分给长场；单帧位置固定在 55%，多帧在 18%–82% 内铺开。
- 联系表 `reviewSampleTimes`：12 格；首内容场开场 6%、末内容场收尾 94%，其余从时间维候选点里均匀挑选，不另起一套渲染。
- verify 的 `at` 与 signature `t` 也并入同一批采样点；时间去重窗口 0.05s。
- 一次 `sampleFilm` 同时产出 receipts、平均亮度和联系表 PNG；`grid.picks` 决定哪些帧进图。

### 7.2 `det` 的真实语义

`detHash` 对规范化后的 **composition JSON** 做 SHA-256，键排序，数组顺序保留，截取 16 位。它证明的是“同一个 storyboard 在相同编译输入下生成同一份协议产物”。

`tt det --twice` 当前实现：第一次按 `--tts` 参数编译，第二次强制 `tts: null` 编译。不带 `--tts` 时两次输入链一致；带 `--tts` 时第二次不是同一输入链，不能把结果解释为严格同输入双编译。CI 内部跑的两次都不接 TTS。

它不校验：

- 外部图片/字体/BGM/视频的字节；
- Canvas 像素或 MP4 字节；
- 音频重采样/编码结果。

### 7.3 质量门与联系表

`tt qa` 的唯一硬门禁是 **must = 0**。must 项包括：

- 页内渲染异常 `RENDER_PAGE_ERROR`；
- `QA_INK_EMPTY`：元素声明了却没有墨迹；
- `QA_TEXT_OUT_OF_SAFE`：文字越出安全框；
- `QA_TEXT_OVERLAP > 12%`：同一帧文字互压；
- recipe `verify` 的 must 断言失败；
- `RECIPE_FORBID_VIOLATION`：recipe `forbid` 命中。

其余为 `should`：墨迹出安全框、元素碰撞、字幕带、空帧、temporal 闪烁/字幕跳位/转场越界、未知 verify 断言。它们写进 `out/qa.json` 和 `report.json.quality`，但不改变退出码。

12 格联系表固定输出到 `review/qa-sheet.png`（默认 4 列 × 3 行，格子 420px，标签为 `<秒> <场>`）。审美判断直接看这张图，由 Agent 或人定“好不好”；不再用确定性评分替代。轻量人审问题见 `references/qa.md` 的“12 格联系表怎么读”。`--count` 改时间维采样帧数，`--cols` 改联系表列数。

### 7.4 temporal 的真实语义

时间维检查不再有独立命令，由 `tt qa` 在统一采样上运行。`scanTemporal` 只读取 `sampleFilm` 已产出的 receipts / luminance，不重新渲染全片。检查：

1. 相邻采样帧的单帧亮度尖峰：必须是局部极值，且前后两帧接近；单调淡入/淡出不算；
2. 同一场、同一字幕样式且框尺寸可比时 caption 框中心大幅位移；逐字排版导致的 bbox 变化不算；
3. 转场场里的 ink/text 框越过安全边距。

三类问题都记为 `should`，不改变 `tt qa` 的退出码；不能把“命令成功”当成时间维零问题。结果看 `out/qa.json` 的 `checks.temporal` 和命令输出。

### 7.5 baseline 的真实语义

`tt ci --baseline` 直接编译 9 条 demo，只记录每条 recipe 的编译指纹与构建状态到 `output/baseline.json`，不启浏览器、不采样、不存分数。构建失败是硬失败；指纹变化是复审提示，人审后 `--write` 刷新。它证明“编译产物是否稳定”，不证明像素或审美回归。

---

## 8. CLI 与工程目录

创作、检查与预览统一走 `platform/cli.mjs`（下称 `tt`）。MP4 导出是单独的 `scripts/render.mjs`，因为需要 Playwright 启浏览器并回传分片字节；当前没有 `tt render` 子命令。

| 命令 | 作用 |
|---|---|
| `tt new <dir> --recipe <id>` | 建工程，复制 recipe demo 到 storyboard |
| `tt build` | 编译，产出 `out/` 四件套 |
| `tt assets fetch` | Pexels 检索/下载/署名/回写素材 |
| `tt stills` / `tt probe` | 指定帧 / 单帧凭据 |
| `tt qa` | 统一质量管线：像素/几何 + verify/forbid + temporal + 12 格联系表 |
| `tt det` | 编译指纹 |
| `tt preview` | 只读预览 + 多帧画笔批注；发送后写工程 `annotations/` 并关闭 |
| `tt annotations [--all] [--ack [id]]` | 读取批注批次：默认最新未处理批次；`--ack` 标记整批已处理 |
| `tt ci [--deep] [--baseline]` | 快速/深度/基线回归 |
| `tt block list` | 列出 block 与契约 |
| `tt recipe list / show / audit` | recipe 清单 / 详情 / 全量审计 |
| `tt pack` | 打 Skill + 引擎干净分发包 |

工程目录：

```text
<工程>/
├── storyboard.json       # Agent 唯一要写的文件
├── assets/               # 本工程素材（可选）
├── out/                  # 编译产物，禁止手改
├── annotations/          # 预览页发送的批注批次（用户输入，勿手改；tt annotations 读取）
├── review/               # 联系表（qa-sheet.png）与可选采样静帧
└── video.mp4             # 仅明确要求导出时生成
```

预览是只读宿主：POST `/api/track` 返回 405；页面按 `composition.json` mtime 自动刷新。引擎页面本身已去掉轨道区，只留空的 `#bottom` 扩展槽；skill 层补丁往槽里挂批注坞，并在右上角提供「复制 board JSON」。用户逐帧标注，点「完成批注」进入页面内待发送列表，点「发送批注」时整批 POST `/api/annotations`（每条 JSON + 三张 PNG data URL），预览服务写到 `<工程>/annotations/<batch>/request.json` 与 `<batch>/NN.{annotated,frame,ink}.png`；随后页面请求 `/shutdown`，`tt preview` 退出时直接把未处理批次交回 Agent。`tt annotations` 读回最新批次，`--ack` 写 `<batch>/.ack` 标记整批已处理。页面不再派发批注事件，Agent 的契约入口只有 CLI。

---

## 9. 明确边界

| 项 | 当前状态 |
|---|---|
| 画幅 | Skill 仅开放 1920×1080@30 和 1080×1920@30 |
| 轨道 / 多图层合成 | 不支持；只有顺序场景 |
| 跨场景 crossfade | 不支持；转场是单场景内快照/覆盖 |
| 3D | 引擎支持；当前 storyboard 编译路径未开放 `api.three` |
| 场景代码安全 | 无沙箱；可信作者输入，词法扫描只拦常见问题 |
| 母带响度 | 不做 LUFS；导出后交给外部工具 |
| 自动作曲 | 不做；BGM 从 manifest 选 |
| 可视化编辑器 | 不做；只读预览 + 批注 |
| 实拍精剪 / 多机位 / 口播剪辑 | 不支持 |
| 资源内存 | 池按 `src` 去重且不淘汰，长片驻留 |
| 质量门禁 | 只有 `tt qa` 的 `must` 阻断；`should` 与审美判断不阻断 |

---

## 10. 文档地图

**运行时（Agent 直接读）**

- `SKILL.md`：Agent 操作契约与路由
- `recipes/*/brief.md`、`recipe.json`、`demo.storyboard.json`：recipe 契约、规范与样片
- recipe 目录内 `visual.md` 与 `examples/`：该 recipe 的画法物理规律与可运行范例
- `references/README.md`：运行时参考索引
- `references/storyboard.md`：storyboard 契约
- `references/ticktoon-authoring.md`：引擎级 scene API 与扩展契约
- `references/authoring-code.md`：`scene.code` 写作、注入与验收
- `references/qa.md`：交付前检查、12 格联系表读法
- `references/iterate.md`：反馈、预览批注与 TTS 语义
- `docs/style-dictionary.md`：40 条风格描述词典（人读参考，不是 recipe 实现清单）
- `references/pexels.md`：实拍素材检索、缓存与降级
- `references/captions.md` / `mark.md` / `pen.md` / `board.md` / `newsbg.md` / `transition.md`：公共 kit 契约

**人类/开发（不进入运行时）**

- `docs/ARCHITECTURE.zh-CN.md`：本文件，当前架构与 QA 语义
- `docs/AUDIO.md`：词级时间、空时长、响度边界
- `docs/PEXELS-PIPELINE.md`：Pexels 素材流水线
- `README.md` / `README.zh-CN.md`：安装、命令与能力总览

早期分析文档（`RECIPE-STRUCTURE`、`BENCHMARK-vs-competitors`、`RESEARCH-skills`）已移出仓库，归档在 `.cc-tasks/archive-2026-11-10/docs/`；它们是历史背景，不是当前规格。
