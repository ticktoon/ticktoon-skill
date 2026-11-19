# ticktoon-skill 架构（当前实现）

> 2026-11-10。本文只描述**当前代码实际行为**，不是下一阶段规划。
> 发生冲突时，以 `SKILL.md`、`platform/` 源码和 `tt` 的实际输出为准。

---

## 0. 一页结论

**一句话：Agent 只维护一份 `storyboard.json`；Node 编译器把它变成 protocol v1.0 `composition.json`；引擎通过同步 `tick(t)` 在 Canvas 上逐帧重画，预览、抽帧、QA 和 MP4 导出共用同一条渲染路径。**

```text
用户需求
   ↓
SKILL.md：选 recipe，读对应 contract / skeleton
   ↓
storyboard.json                       ← Agent 唯一需要手写的文件
   ├─ scene.code：code 型 recipe，整幅内容由作者实时写
   └─ scene.params：params 型 recipe，交给 recipe 模板的字段
   ↓
schema → resolve → plan → emit → check → assemble
   ↓
composition.json / events.json / subs.srt / report.json
   ↓
ticktoon CanvasCompositor.tick(t)
   ├─ 只读预览 / 画笔圈注
   ├─ stills / probe / qa（轻量渲染异常 + 空墨迹校验 + 12 格联系表）
   ├─ det
   └─ WebCodecs + Mediabunny → 普通 MP4（H.264 + AAC）
```

当前基线：

| 项 | 实际数量 |
|---|---|
| recipe | **9**（ABI 1，每条声明 `mode: "code"` 或 `"params"`） |
| params 模板 | **2**（news-broadcast / footage-cut） |
| 公共 kit 命名空间 | **11** 个 `TT.*` 入口 + 字幕 kit |
| 字幕样式 | **7** 种，另有 `none` |
| 允许画幅 | **1920×1080@30 / 1080×1920@30** |

---

## 1. 分层与目录

| 层 | 当前位置 | 职责 | Agent 是否直接读 |
|---|---|---|---|
| 操作契约 | `SKILL.md` | 路由、创作闭环、红线、交付自检 | 每次读 |
| recipe 规范 | `recipes/*/recipe.json`、`recipe.md`、`skeleton.storyboard.json`，以及 code 型的 `ref-shots/`、params 型的 `template.js` | `keywords / when / notWhen` 是 `tt recipe list` 的选择元数据；`mode / rules / captions / audio / pacing` 是成片规范，params 型另有 `template`（`draw / params / resources / needs / defaultSfx / sfxTrack / motion / inkless`） | 选择时只读 `tt recipe list`；选中后只读该 recipe 的 1 份文档 |
| 运行时参考 | `references/` | `scene.code`、`scene.params` 与公共 kit 的 API 手册 | 需要时读对应 1 篇 |
| 内容 | `<工程>/storyboard.json` | 本片叙事、场景、字幕、素材、code、params | **写** |
| 公共 kit | `platform/kit/` | 舞台、笔、文字、标注、相机、转场、字幕等纯函数 | 通过注入使用 |
| 编译 | `platform/compile/` | 六阶段编译链与确定性哈希 | 不读 |
| 检查 | `platform/inspect/` | 采样、receipts、轻量 qa、统一质量管线 | 通过 `tt` 使用 |
| 宿主工具 | `platform/project/`、`scripts/` | 建工程、审计、预览、导出、TTS、素材 | 通过 `tt` 使用 |
| 引擎 | `ticktoon/dist/`（或显式源码仓） | protocol v1.0、Canvas/WebCodecs 渲染 | 不读 |
| 人类/开发文档 | `docs/` | 架构、历史、基准、运维记录 | 不读 |

`SKILL.md`、`recipes/` 与 `references/` 是运行时层；`docs/` 只面向人类开发者，运行时文件不引用 `docs/`。历史任务记录留在 `.cc-tasks/`，不进入运行时。

### 1.1 当前货架

**内置 recipe**

以下为当前快照；实时清单以 `tt recipe list` 为准，本表随目录变化可能滞后。

| recipe | 内容载体 | 自带视觉（code / template 内） |
|---|---|---|
| `whiteboard-explainer` | `scene.code` | 暖白纸 / 马克笔红 |
| `blackboard-lesson` | `scene.code` | 绿黑板 / 粉笔白 |
| `ink-painting` | `scene.code` | 近黑底 / 水墨浓淡 |
| `illustrated-story` | `scene.code` | 米色纸 / 拼贴色 |
| `flash-cut` | `scene.code` | 近黑底 / 橙与深蓝 |
| `flat-motion` | `scene.code` | 群青 / 珊瑚 / 薄荷色块、圆角人物与图标、弹性变形 |
| `crayon-guide` | `scene.code` | 暖米纸 / 蜡笔人物 / 手绘图解 |
| `shadow-play` | `scene.code` | 透光幕布 / 琥珀灯影 / 侧面镂空人物与器物 |
| `news-broadcast` | `scene.params` | 径向深蓝 / 地图与网格 |
| `footage-cut` | `scene.params` | 深棕黑 / 暖白压屏字 |

内容形态取决于 `recipe.json` 的 `mode`（`code` 型写 `scene.code`，`params` 型写 `scene.params`）。新增 recipe 只需建目录并写 `recipe.json`（params 型再加 `template.js`），`tt recipe list / audit / ci --baseline` 都会自动纳入，不需要改任何索引文件。

**公共 kit（`platform/kit/index.json`）**

`ease`、`num`（含 `clamp01 / env / rng`）、`text`、`fonts`（`font`）、`chart`、`pen`、`mark`、`transition`、`board`、`geom`、`newsbg`（`newsBg`：新闻径向蓝底 + 地图 + 网格 + 种子流动线）。

字幕 kit 在 `platform/kit/captions/`：`core.js` 提供 `TT.captionKit`，`styles/*.js` 是七种可选样式。它随编译期选中的样式一起注入，不走 `index.json` 的命名空间机制。

**params 模板（2）**

每条 params recipe 在目录下自带一个 `template.js`，顶层只导出 `function draw(g, p)`：

- `footage-cut/template.js`
- `news-broadcast/template.js`

模板不进入公共货架；只有对应 recipe 的 params 场能用。`template` 的八个字段是 `draw / params / resources / needs / defaultSfx / sfxTrack / motion / inkless`，其余键在 `tt build` 时报错。

**字体契约（ABI 1）**

recipe 不承载字体表。字体库由 `assets/fonts/manifest.json` 定义：键即引擎 FontFace 族名，条目带 `src / family / weight / desc`，`desc` 是作者选型依据。code 场在 `scene.resources` 里声明 `{"type":"font","name":"<manifest 键>"}`，`src` 由 schema 阶段按 manifest 补齐；params 模板把字体键写死在模板代码，并在 `template.resources` 声明同样的 font 条目。`FONTS` 是本场 font 资源键的恒等映射，`TT.font` / `TT.text.fontKey` 全部只认 manifest 键。颜色不属于 recipe：kit 自带默认调色板，调用方需要品牌色时直接传 hex；背景也不属于 recipe，由 `scene.code` / params 模板自己铺满整帧。字号、行高、版式、动效、图表参数同样不归字体表；它们归 recipe `rules` 的白名单字段或模板本地配置。

---

## 2. storyboard 契约

顶层只允许 `recipe / format / meta / scenes / uses`。场景允许 `id / narration / duration / camera / code / params / resources / note / transition / sfx`。场景不再声明背景色：`scene.code` / params 模板负责铺满整帧。`transition` 是固定预设名，写在两个 code 场边界的前一场；emit 后展开为 `(A-D/2)+T+(B-D/2)` 双帧视觉节点，声音仍使用原始逻辑场。

关键规则：

- `format` 只接受两种：`1920×1080@30`、`1080×1920@30`；其他正数画幅是引擎能力，不是 Skill 的开放格式。
- `narration` 与 `duration` 结构互斥：旁白场由 TTS 或估时求时长，静默场必须写 `duration`。
- 没有 `start`、没有 `tracks`、没有顶层 `duration`；场景起点按数组顺序累加，总时长是场景时长之和。
- `recipe.mode` 决定场景内容：`code` 只收 `scene.code`，`params` 只收 `scene.params`；两种互斥，另写会报 `SCENE_PARAMS_IN_CODE_MODE` / `SCENE_CODE_IN_PARAMS_MODE`。空场报 `SCENE_CONTENT_MISSING`。
- `scene.code` 可以是字符串或字符串数组（数组按换行拼接），上限 20000 字符。
- `scene.params` 的键与类型由该 recipe 的 `template.params` 决定；未知键、缺必填、类型不符、超出 `maxChars` / `maxItems` 都在编译期报 `PARAM_*`。
- `scene.resources` 只属于 code 场；params 场的媒体资源走 `template.resources` + `template.needs`，`params.src` 在编译期改写为 `${kind}-${scene.id}` 资源名。
- 场景未知键直接报错。

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
createVisualScenes(...)                     code 边界展开为 A' + T + B'；原始场列表留给音频
  ↓
assemble(...)                              ⑥ assemble：audio[]、总时长
  ↓
engine validateComposition                 引擎二次协议校验
  ↓
out/{composition,events,subs.srt,report}.json
```

| 阶段 | 当前行为 |
|---|---|
| schema | 载入 recipe / 字体 manifest / Caption 契约并校验 ABI 1；校验 `mode` 与 `scene.code` / `scene.params` 的二选一；params 按 `template.params` 检查类型与上限；按 manifest 校验并补齐场景与模板的 font 资源；同时执行 `scene.code` 静态扫描 |
| resolve | 解析 TTS 时长与词级时间、素材路径、BGM、SFX manifest；字体不在这里解析；TTS 为空时按 4.6 字/秒估算 |
| plan | 求每场时长与起点；切 caption cue；生成场景相对逐字时间；params 场生成唯一内部单元 `template` |
| emit | 按引用注入 kit/caption 源码；params 场在顶层内联 `draw(g, p)` 并传入整帧 `G0` 与 `scene.params`；收集 resources/needs/cues；冻结 params 与媒体资源名 |
| check | params 场的 `TEMPLATE_FONTS_MISSING` / `TEMPLATE_FONT_UNDECLARED`、模板资源形状、媒体 `params.src` 必填；code 场沿用 `CODE_*` 静态规则 |
| assemble | 视觉 scenes 与原始逻辑场的旁白/BGM/SFX 事件；BGM ducking；总时长。SRT 在 build 中直接按 planned cues 生成 |

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
  "paramsScenes": 0,
  "units": 0,
  "codeScenes": 8,
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

`TT`、`CAPTIONS` 都不是 ES 模块，而是 IIFE 源码片段。引擎用 `new Function('ctx','api',code)` 编译整段场景代码，因此不存在 `import`。

emit 规则：

- kit 按 `platform/kit/index.json` 的 `provides` 和 `requires` 递归解析，只注入当前场景引用到的命名空间；params 场额外固定注入 `env` / `rng`。
- params 场把 `recipe.template.draw` 的源码按顶层函数内联，并把 `template.resources` 带进本场 `resources`。
- code 场的 font 资源来自 `scene.resources`，作者显式声明需要哪些字体键；params 场的 font 资源来自 `template.resources`。字幕字体由字幕层单独追加。
- `RULES` 只在含 `scene.code` 的场景注入；params 模板不接收 `RULES`。
- `render receipts` 只在采样模式注入；正式 `composition.json` 不含调试钩子。

### 4.2 每个场景只有一个 draw

emit 固定生成：

```js
return (ctx, api) => {
  // 1. 重置 ink/text 回执
  // 2. scene.camera 线性缩放
  // 3. code 场：scene.code（包一层 fillText 记账）
  //    params 场：draw(g, p)，g 是整帧 G0
  // 4. captions
  // 5. receipts（仅采样模式）
  // 场间转场不在这里绘制；随后生成独立双帧转场场
};
```

因此当前 storyboard 里的 `scene.code` 是**内联在逐帧 draw 中执行**，不是引擎原始的“函数体直出”通道：

- 作者不能通过 `return (ctx, api) => {}` 自定义 setup；
- `api.three()` 无法从 storyboard 的 `scene.code` 直接使用；params 模板可用，且必须声明 `template.needs.three: true`；
- params 模板的代码形状固定为顶层 `function draw(g, p) { ... }`：IIFE、`export` / `import` 一律拒绝；
- `G0` 是整帧单元：`rect: {x:0,y:0,w:W,h:H}`，`g.api` / `g.t` / `g.sceneT` / `g.a` / `g.reveal` 每帧由 emit 写入。

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
- cue 在 plan 阶段切成场景相对时间；SRT 只写不读。

### 6.2 字幕

`platform/kit/captions/core.js` 统一处理字体、逐字时间、折行、定位、安全区、淡入淡出与主体避让；`platform/kit/captions/styles/*.js` 只定义盒型与绘制。

6 种样式：`plain / perchar / karaoke / collage / vertical / tornpaper`，另有 `none`。字幕在场景内容之后、相机变换之外绘制。

### 6.3 音频事件

默认角色音量：

```js
{ narration: 1.0, bgm: 0.12, sfx: 0.6 }
```

- 旁白：一场一个事件。
- BGM：可按旁白区间切成相邻事件实现 ducking；无 duck 配置时用单事件 + 首尾淡入淡出。
- SFX：params 场可使用 `template.defaultSfx` / `template.sfxTrack` / 循环音效；任意场景也可显式写 `scene.sfx` 时间事件，全部在编译期展开为绝对时间事件；运行时不产生声音。
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
| `tt stills` / `probe` | 指定时刻 | 真实 ink/text/caption 框、亮度、单元可见性 | 全片时间连续性 |
| `tt qa` | 一次 build + 一次浏览器会话；约 24 个采样帧，联系表 12 格复用其中大部分采样点（首尾追加），单会话约 24–30 帧 | 渲染异常与空墨迹（`RENDER_PAGE_ERROR` / `QA_INK_EMPTY`）、12 格视觉证据 | 全片逐帧无缺陷；安全框、碰撞、审美好坏 |
| `tt det` | 编译产物 | 规范化 composition 的 SHA-256 指纹 | 像素一致、MP4 字节一致 |
| `tt ci --baseline` | 10 条 recipe 的骨架 / 镜头参考合成片 | 编译指纹与构建状态回归；指纹变化提示人审后刷新 | 像素/视觉回归 |
| `tt ci [--deep]` | 全货架 | 快速/深度全量回归；`--deep` 复用 `tt qa` 同一管线 | 真机联网、真实素材与导出验收 |

### 7.1 采样口径

`platform/inspect/sample.mjs` 一次浏览器会话渲染所有采样帧：

- 时间维采样 `sampleTimes`：每场至少一帧；名额富余时优先分给长场；单帧位置固定在 55%，多帧在 18%–82% 内铺开。
- 联系表 `reviewSampleTimes`：12 格；首内容场开场 6%、末内容场收尾 94%，其余从时间维候选点里均匀挑选，不另起一套渲染。
- 联系表首尾格并入同一批采样点；时间去重窗口 0.05s。
- 每一帧走 preview-panel 的 `capture(t)`：面板 pause → seek → await video settle → 同步重绘 → 回传 PNG；不再用固定 140ms 等待，视频场也不会抽到 settle 前的中间帧。
- 一次 `sampleFilm` 同时产出 receipts、平均亮度和联系表 PNG；联系表在页内按 capture 顺序直接拼，`grid.picks` 决定哪些帧进图，不另起一轮渲染。
- 浏览器由 `scripts/lib/chrome-cdp.mjs` 直接启动本机 Chrome 并通过 CDP 驱动；不依赖 Playwright，也不需要下载浏览器。

### 7.2 `det` 的真实语义

`detHash` 对规范化后的 **composition JSON** 做 SHA-256，键排序，数组顺序保留，截取 16 位。它证明的是“同一个 storyboard 在相同编译输入下生成同一份协议产物”。

`tt det --twice` 当前实现：第一次按 `--tts` 参数编译，第二次强制 `tts: null` 编译。不带 `--tts` 时两次输入链一致；带 `--tts` 时第二次不是同一输入链，不能把结果解释为严格同输入双编译。CI 内部跑的两次都不接 TTS。

它不校验：

- 外部图片/字体/BGM/视频的字节；
- Canvas 像素或 MP4 字节；
- 音频重采样/编码结果。

### 7.3 质量门与联系表

`tt qa` 是**轻校验**，唯一硬门禁是 **must = 0**。must 只有两类：

- 页内渲染异常 `RENDER_PAGE_ERROR`；
- `QA_INK_EMPTY`：场景单元执行了却没有墨迹（字体没加载、资源丢失、颜色透明）。

安全框、碰撞、文字互压、字幕带、对比度、停留时长、空帧、能量曲线、时间维闪烁都不再自动判定——它们是构图与审美，机器不替人下结论，也不写进报告。

12 格联系表固定输出到 `review/qa-sheet.png`（默认 4 列 × 3 行，格子 420px，标签为 `<秒> <场>`）。**这才是质量入口**：由 Agent 或人直接看图定“好不好”。`--count` 改时间维采样帧数，`--cols` 改联系表列数。

### 7.4 baseline 的真实语义

`tt ci --baseline` 对 params 型编译 `skeleton.storyboard.json`，对 code 型编译由 `ref-shots/` 合成的回归片；只记录每条 recipe 的编译指纹与构建状态到 `output/baseline.json`，不启浏览器、不采样、不存分数。构建失败是硬失败；指纹变化是复审提示，人审后 `--write` 刷新。它证明“编译产物是否稳定”，不证明像素或审美回归。

---

## 8. CLI 与工程目录

创作、检查与预览统一走 `platform/cli.mjs`（下称 `tt`）。MP4 导出是单独的 `scripts/render.mjs`，因为需要本地 Chrome + CDP 把分片字节回传给 Node；当前没有 `tt render` 子命令。

| 命令 | 作用 |
|---|---|
| `tt new <dir> --recipe <id>` | 建工程，复制 recipe 的 `skeleton.storyboard.json` 到 storyboard |
| `tt build` | 编译，产出 `out/` 四件套 |
| `tt assets fetch` | Pexels 检索/下载/署名/回写素材 |
| `tt stills` / `tt probe` | 指定帧 / 单帧凭据 |
| `tt qa` | 轻量质量管线：渲染异常 + 空墨迹 + 12 格联系表 |
| `tt det` | 编译指纹 |
| `tt preview` | 只读预览 + 多帧画笔圈注；发送后写工程 `annotations/` 并关闭 |
| `tt annotations [--all] [--ack [id]]` | 读取圈注批次：默认最新未处理批次；`--ack` 标记整批已处理 |
| `tt lab [--recipe <id>] [--port N]` | code recipe 镜头参考实验室：`ref-shots/` 逐个走真实编译 + 引擎面板，可改代码重跑、不回写 |
| `tt ci [--deep] [--baseline]` | 快速/深度/基线回归 |
| `tt recipe list / show / audit` | recipe 清单 / 详情（mode + template）/ 全量审计 |
| `tt pack` | 打 Skill + 引擎干净分发包 |

工程目录：

```text
<工程>/
├── storyboard.json       # Agent 唯一要写的文件
├── assets/               # 本工程素材（可选）
├── out/                  # 编译产物，禁止手改
├── annotations/          # 预览页发送的圈注批次（用户输入，勿手改；tt annotations 读取）
├── review/               # 联系表（qa-sheet.png）与可选采样静帧
└── video.mp4             # 仅明确要求导出时生成
```

预览是只读常驻宿主：POST `/api/track` 返回 405；全局服务唯一，存在即复用并切换 composition，不存在才启动。页面按 `composition.json` mtime 自动刷新；圈注只落盘，预览服务保持运行。引擎页面本身已去掉轨道区，只留空的 `#bottom` 扩展槽；skill 层补丁往槽里挂圈注坞，并在右上角提供「复制 board JSON」。用户逐帧圈注，点「完成圈注」进入页面内待发送列表，点「发送圈注」时整批 POST `/api/annotations`（每条 JSON + 三张 PNG data URL），预览服务写到 `<工程>/annotations/<batch>/request.json` 与 `<batch>/NN.{annotated,frame,ink}.png`；后续由对话驱动 Agent 用 `tt annotations` 读取批次，常驻预览服务继续运行。`tt annotations` 读回最新批次，`--ack` 写 `<batch>/.ack` 标记整批已处理。页面不再派发圈注事件，Agent 的契约入口只有 CLI。

---

## 9. 明确边界

| 项 | 当前状态 |
|---|---|
| 画幅 | Skill 仅开放 1920×1080@30 和 1080×1920@30 |
| 轨道 / 多图层合成 | 不支持；只有顺序场景 |
| 跨场景合成 | 支持 10 个固定双帧转场，含方向擦入 / 推移与 GL 风格图案转场；编译器生成独立 code scene，同时绘制前后完整画面；仅限 code 场边界 |
| 3D | 引擎支持；`scene.code` 未开放，params 模板需声明 `template.needs.three: true` |
| 场景代码安全 | 无沙箱；可信作者输入，词法扫描只拦常见问题 |
| 母带响度 | 不做 LUFS；导出后交给外部工具 |
| 自动作曲 | 不做；BGM 从 manifest 选 |
| 可视化编辑器 | 不做；只读预览 + 圈注 |
| 实拍精剪 / 多机位 / 口播剪辑 | 不支持 |
| 资源内存 | 池按 `src` 去重且不淘汰，长片驻留 |
| 质量门禁 | 只有 `tt qa` 的 `must` 阻断；`should` 与审美判断不阻断 |

---

## 10. 文档地图

**运行时（Agent 直接读）**

- `SKILL.md`：Agent 操作契约与路由
- `recipes/*/recipe.json`、`recipe.md`、`skeleton.storyboard.json`：recipe 契约、创作纲要与建工程骨架
- code 型 recipe 目录内的 `ref-shots/`：独立单场镜头参考（镜头参考文件头格式统一由 `SKILL.md` 定义）
- `references/README.md`：运行时参考索引
- `references/storyboard.md`：storyboard 契约
- `references/ticktoon-authoring.md`：引擎级 scene API 与扩展契约
- `references/authoring-code.md`：`scene.code` 写作、注入与验收
- `references/qa.md`：交付前检查、12 格联系表读法
- `references/iterate.md`：反馈、预览圈注与 TTS 语义
- `docs/style-dictionary.md`：40 条风格描述词典（人读参考，不是 recipe 实现清单）
- `references/pexels.md`：实拍素材检索、缓存与降级
- `references/captions.md` / `mark.md` / `pen.md` / `board.md` / `newsbg.md` / `transition.md`：公共 kit 契约

**人类/开发（不进入运行时）**

- `docs/ARCHITECTURE.zh-CN.md`：本文件，当前架构与 QA 语义
- `docs/AUDIO.md`：词级时间、空时长、响度边界
- `docs/PEXELS-PIPELINE.md`：Pexels 素材流水线
- `README.md` / `README.zh-CN.md`：安装、命令与能力总览

早期分析文档（`RECIPE-STRUCTURE`、`BENCHMARK-vs-competitors`、`RESEARCH-skills`）已移出仓库，归档在 `.cc-tasks/archive-2026-11-10/docs/`；它们是历史背景，不是当前规格。
