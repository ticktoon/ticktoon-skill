# `scene.code` 写作手册

这页给写 `scene.code` 的模型看。只讲协议、注入、可用的公共组件、会被自动检查抓到的边界，以及怎么用真实命令验收。**所有结论都要能落到数字或命令上；审美判断不进规范。**

配套文件在具体 recipe 目录里，只读你选中的那一条：

- 白板手绘的物理规范（与题材无关）：`recipes/whiteboard-explainer/visual.md`
- 两个可运行范例：
  - `recipes/whiteboard-explainer/examples/el-nino.js`：机制剖面，演示 `TT.geom` 相机、`TT.board`、`TT.pen`、分段落笔。
  - `recipes/whiteboard-explainer/examples/compound-interest.js`：图表构图，演示坐标轴、刻度、曲线、翻倍阶梯与标注。
- 水墨与拼贴的物理规范/范例：`recipes/ink-painting/visual.md`、`recipes/illustrated-story/visual.md`，各自带一个 `examples/`。

---

## 1. 协议

`composition.json` 只有 `scenes[]` + `audio[]`。`scene.code` 是 scene 的字段：

| 项 | 规则 |
|---|---|
| 类型 | 字符串，或字符串数组（数组按 `\n` 拼）；见 `SCENE_CODE_TYPE` |
| 空值 | 空串 / 全空白报 `SCENE_CODE_EMPTY` |
| 长度 | 上限 **20000 字符**；超了报 `SCENE_CODE_TOO_LONG` |
| 执行 | `scene.code` 由 `emit.mjs` **内联进编译器生成的逐帧 draw**；引擎再用 `new Function('ctx', 'api', code)` 编译整段场景函数。作者代码没有 import / 模块系统 |
| 返回值 | storyboard 的 `scene.code` 不提供自定义 setup 或返回函数通道；不要写 `return (ctx, api) => {}`。引擎本身支持两段式与 `api.three()`，但当前 storyboard 编译路径未开放 Three |
| 与 `elements` 共存 | code 先画（底色与主体），elements 后画（叠加层） |
| 与 `scene.camera` 共存 | 引擎先套一层 `scene.camera` 的线性 `from→to` 缩放，再执行 code；白板 code 场通常在 code 内自己管相机，不要再写 `scene.camera`，否则会叠两层 |

`ctx` 是 Canvas 2D 上下文，逻辑坐标与 `api.W` / `api.H` 对齐。协议规定 `api` 是冻结的只读对象；不要写入它，也不要挂载跨帧可变状态。一帧一次执行，所有动画都要写成 `api.t` 的纯函数。

`api` 字段：

| 字段 | 含义 |
|---|---|
| `api.t` | 当前场景内的相对秒数，0…`api.d` |
| `api.d` | 当前场景时长（秒） |
| `api.W` / `api.H` | 逻辑画幅，1920×1080 时为 1920 / 1080 |
| `api.cues` | 本场相对时间的只读字幕 cue；每项含 `chars: [{text,start,end}]` |
| `api.seed` | 确定性的场景种子 |
| `api.rng()` | 每次调用返回一个新的确定性随机数 |
| `api.img(name)` / `api.video(name)` | 读本场 `resources` 里已预载的同名图片 / 视频帧；视频帧未发布时返回 `null`，跳过绘制 |

`api.img` / `api.video` 引用的名字必须在本场 `resources` 里声明，否则编译报 `CODE_RESOURCE_MISSING`。视频只能在 draw 里读，不要在初始化阶段读一次。

---

## 2. 注入

`emit.mjs` 在 scene 代码前拼接这些标识符，code 场直接可用：

| 标识符 | 何时注入 | 内容 |
|---|---|---|
| `TT` | 总是 | 公共组件集合，见第 5 节 |
| `BLOCKS` | 总是 | 引擎为 elements 注入的 block 绘制函数；code 作者不要把它的内部签名当稳定 API |
| `CAPTIONS` | 本场有字幕 cue 且有 caption 代码时 | 字幕实现；code 作者不应调用它 |
| `FONTS` | 总是 | 当前 recipe 顶层的 `fonts`：角色 → manifest 字体键 |
| `RULES` | **只有 code 场** | 当前 recipe 的 `rules` 对象；block 场没有这个标识符 |

`RULES` 只在 `scene.code` 存在的场注入（`platform/compile/emit.mjs`）。不要在 block 场或全局脚本里引用它。

`FONTS` 是字体契约，不是这个 recipe 所有视觉值的仓库：字号、行高、版式、动画节奏由 code 场自己算；颜色直接写 hex 或用 kit 默认值。`FONTS` 的 key 是角色名（`display / body / num / hand / caption / brand / serif / round / poster / cutout`），value 是 `assets/fonts/manifest.json` 的字体键。

---

## 3. 禁用 API（静态扫描）

编译期做**词法扫描**，不是 AST，也不是安全沙箱。注释会先被抹成等长空格再扫描，不会误报；**字符串字面量仍会被扫描**，字符串里写 `document.` 同样会被拦。错误会报出第几行。`code` 最终仍按可信作者代码执行，静态扫描只能拦住常见破坏确定性或引入外部 IO 的写法。

| 禁用 token | 原因 | 替代 |
|---|---|---|
| `import(` | 没有模块系统 | 用注入的 `TT` / 本场资源 |
| `require(` | 没有模块系统 | 同上 |
| `fetch(` | 外部 IO | 资源走 `api.img` / `api.video` |
| `XMLHttpRequest` | 外部 IO | 同上 |
| `WebSocket` | 外部 IO | 删掉 |
| `document.` | 宿主 DOM 不可用 | 只用 `ctx` |
| `window.` | 宿主 DOM 不可用 | 只用 `ctx` |
| `localStorage` | 外部持久化 | 删掉；所有状态由 `api.t` 重算 |
| `eval(` | 非确定性 / 注入面 | 直接写代码 |
| `new Function` | 非确定性 / 注入面 | 直接写代码 |
| `Date.now` | 墙钟破坏确定性 | `api.t` / `api.d` |
| `new Date` | 墙钟破坏确定性 | `api.t` / `api.d` |
| `Math.random` | 随机数破坏确定性 | `TT.rng(api.seed)` 或 `api.rng()` |

需要随机抖动时，用**固定 seed 重开**的数列：

```js
const rand = TT.rng(api.seed);
const jitter = rand() * 2 - 1;      // 同一 seed，每帧同一数列
```

`while (` 和 `for (;;` 不报 error，但会给 `CODE_LOOP_RISK`（should）：code 每帧同步执行，无界循环会卡死预览/导出。循环写成有确定上界的 `for (let i = 0; i < n; i += 1)`。

---

## 4. `FONTS` 与 `RULES`

`FONTS` 只承载字体契约：

```js
const body = TT.font(FONTS, 30, 'body');   // FONTS: 角色 → manifest 字体键
const ink = '#F0ECE4';                     // 颜色直接写 hex，或用 kit 的默认色
```

`RULES` 是 recipe 的场景级规则：`safeMargin`、`scale`、`stroke` 是 code 场要读的数值；`pen` / `board` / `forbid` 是 recipe 与 QA 的约束。白板 recipe：

```js
const SCALE = RULES.scale;          // { title, label, note } 三个倍率
const STROKE = RULES.stroke;        // [thin, thick]
const M = RULES.safeMargin;         // 归一化边距
const titlePx = 66 * SCALE.title;
const notePx = 50 * SCALE.note;
const bold = STROKE[1];
```

| 字段 | 白板 demo 值 | 用法 |
|---|---|---|
| `safeMargin` | `0.06` | 归一化到 W/H；用 `TT.geom.safeBox({ W, H, m: M })` 得到像素安全框；不要手写 115 / 65 |
| `scale` | `{ title: 1, label: 0.8, note: 0.6 }` | 标题 / 标注 / 注释三档字号倍率；基准 px 由作者选，demo 用 title 66、label 47.5–65、note 50 → 实得 66 / 38–52 / 30（屏幕约 52–55 / 34–43 / 23–24px） |
| `stroke` | `[2.4, 4.5]` | 线宽区间；细线（刻度 / 小标注）、中线（引线 / 箭头）、粗线（主轮廓 / 轴）分别取 `STROKE[0]`、中值、`STROKE[1]` |

不读 `RULES` 不会在编译期报错，但排版会散：

- 越出安全框 → 不再自动判 must；recipe 自己写了 verify 时才会出 `VERIFY_INK_OUTSIDE_SAFE` / `VERIFY_TEXT_OUTSIDE_SAFE`。
- 字号只落一两档 → 画面层级弱；看 12 格联系表，真实文字高度可从 text 回执读。
- 线宽全用一个值 → 画面能出，但主次结构没有可量化的层级；联系表会直接暴露这一点。

注意：qa、probe、verify 与编译期检查都取 `recipe.rules.safeMargin`；白板是 0.06，水墨是 0.09。不要假设所有 recipe 同边距。

---

## 5. 公共组件最小用法

### 5.1 纸 / 板

```js
TT.board.paper(ctx, api);          // 白纸底；默认 #f8f5ec
TT.board.blackboard(ctx, api);     // 绿板 + 粉笔槽 + 板擦
```

底只画一次；后续内容都在同一块 `ctx` 上画，不要自己 `fillRect` 整幅背景。

### 5.2 笔迹

时间轴批量绘制：`strokes` 是数组，每项 `{ pts, at, dur, pen, color, width, seed, dash, ease, rotate }`。`at` / `dur` 是**场景相对秒**。

```js
const strokes = [
  { pts: [[300, 420], [520, 416], [760, 421]], at: 1.2, dur: 0.9, pen: 'marker', color: ink, width: bold, dash: [] },
  { pts: [[900, 300], [1200, 260]], at: 2.4, dur: 0.7, pen: 'marker', color: blue, width: mid },
];
TT.pen.track(ctx, strokes, api.t, { sceneScale: fit * scale });
```

- `TT.pen.track` 在笔画末端画笔身；同一时刻有多笔未完成时，选 `at` 最新的一笔（同 `at` 取数组后项）；所有笔完成后 80ms 淡出笔身。
- `TT.pen.stroke(ctx, pts, k, opts)` 是单笔即时绘制，`k` 为 0…1；不参与时间轴。
- `TT.pen.list()` 返回 `marker / pencil / brush / inkbrush / chalk / fineliner`。
- `TT.pen.bbox()` 返回本帧笔迹在画布逻辑像素里的框；`TT.pen.resetBBox()` 由引擎每帧调用，作者通常不用手动调。
- `sceneScale` 传你在 code 里施加的场景倍率（如 `fit * zoom`）；有 `scene.camera` 时把它的当前倍率也乘进去。笔身大小才会与纸张一致。

### 5.3 文字

```js
TT.text(ctx, '标注', 300, 400, 30, { role: 'body', color: ink, align: 'left' });
```

`TT.text(ctx, text, x, y, size, opts)` 的 `opts`：`font`（css 或 `TT.font` 结果）、`role`、`color`、`align`、`baseline`、`alpha`、`maxWidth`。默认字体从 `FONTS` 的 `body` 角色取。

- 直接写 `ctx.fillText` 也会被 emit 的包装器记进文字回执；但 `TT.text` 会同时处理 `FONTS` 字体与对齐，推荐优先用。
- `TT.text.measure(ctx, str)` 返回当前 `ctx.font` 下的宽度；排上下标/公式时先设字体再量。
- `TT.text.bbox()` / `TT.text.items()` 返回本帧文字并集 / 逐条框；逐条项含 `text`、`bbox`、`size`。引擎每帧 reset。
- `TT.text.wrap` / `fit` / `inkBox` 是给 block 的排版工具；code 场通常不需要整段排版，用 `TT.text` 一行行写即可。

### 5.4 几何与相机

```js
const frames = TT.geom.keyframes({ mode: 'in', from: 1, to: 1.06, focus: [0.5, 0.5] }, api.d);
const safe = TT.geom.safeBox({ W, H, m: RULES.safeMargin });
const pre = TT.geom.preimage({ frames, dur: api.d, W, H, safe });
const framing = TT.geom.fit(FRAME, pre);
const z = TT.geom.camera(frames, api.t);
```

- `safeBox({W,H,m})` → `{x0,y0,x1,y1,w,h}`。
- `keyframes(zoom, dur)` → 帧表；`zoom` 支持 `mode: 'none' | 'in' | 'out' | 'pan'`、`from`、`to`、`focus`、`beats`。
- `camera(frames, now)` → 当前 `{scale,fx,fy}`。
- `preimage({frames,dur,W,H,safe})` → 安全框在所有采样时刻的反像交集，返回 `{x,y,w,h,minScale,fit}`；其中 `fit` 是按画幅 W/H 算的参考值，内容框排版用 `TT.geom.fit(FRAME, pre)`。**zoom > 1 时必须用它**，见第 9 节。
- `fit(frameRect, safeRect)` → `{scale,dx,dy}`，按 `translate(dx,dy); scale(scale,scale)` 使用。

### 5.5 缓动 / 数值 / 包络

```js
TT.ease.inOutCubic(k);             // 0…1
TT.clamp01(x);
TT.env.fade(api.t, api.d, 0.62, 0.3472);   // 入场淡入 + 出场淡出
TT.num.fmt(1006);                  // '1,006'
```

`TT.ease` 只有 `linear / outCubic / outQuart / outExpo / inOutCubic / back(o)`；不要假设有 `power2` 之类不存在的曲线。

### 5.6 字体 / 颜色

```js
const f = TT.font(FONTS, 30, 'body');
ctx.font = f.css;
ctx.fillStyle = '#F0ECE4';
```

`TT.font` 返回 `{css,size,family,lineHeight,ascent,descent}`。族名必须等于本场 `resources[].name`；不要手写字体族名，否则会静默回落到系统字体。颜色不经过 `FONTS`：直接写 hex，或交给 kit 自己的默认色。字号、行高、基线由 code 场按内容自己定，`FONTS` 不提供字号阶梯。

### 5.7 图表几何

```js
TT.chart.ticks(1000, 2);           // [0, 500, 1000]
TT.chart.niceMax(173);             // 200
TT.chart.bars(rect, rows, opts);   // 横向条形的 y/h/满值像素宽
```

`TT.chart` 只算不画；画笔、颜色、时间轴仍归 code / block。

---

## 6. 文字不是墨迹

这是两套回执，不能互相代替：

| 回执 | 来源 | 用途 |
|---|---|---|
| ink | `TT.pen` 绘制通道累计的笔迹（路径 + 半线宽，经 `ctx` 变换到画布像素） | 空墨迹兜底 |
| text | `TT.text` 与 raw `ctx.fillText` 的逐条文字框 | probe 定位 |
| caption | 字幕 kit 自己记的文字框 | probe 定位 |

要点：

- `fillText` **不会**进入 `ink` 回执；它进独立的 text 回执，逐条带原文（截 40 字符）与字号。
- `tt qa` 只自动判 `QA_INK_EMPTY`：元素执行了却没有任何可见墨迹。其余构图问题（安全框、互压、碰撞、字幕带）不再自动判定，直接看 12 格联系表。
- recipe 自己写了 `verify` 时，`VERIFY_TEXT_OUTSIDE_SAFE` / `VERIFY_INK_OUTSIDE_SAFE` / `VERIFY_CAPTION_OVERLAP` 仍然按 recipe 的断言执行；那是配方作者主动加的门槛，不是全局规则。
- 规划节拍时仍要让笔迹扩 bbox：只让文字出现，画面看起来不会推进。这条交给 12 格联系表和人审。

---

## 7. 字幕带

字幕位置由 `uses.captions.at` 决定：

- `top`：上带从 0 到**真实字幕框下缘 +2px**。
- `bottom`：下带从**真实字幕框上缘 −2px** 到 H；没有实拍字幕框时按 recipe `captions.top`（白板 0.80H）估算。
- `center` / `{x,y}`：按字幕框上下沿展开。

code 场会画出真实的 caption 回执，所以**不要估算字幕带**，直接看 `tt probe`：

```bash
node "$SKILL_DIR/platform/cli.mjs" probe --t 5.0 --dir <工程>
# 输出行：字幕带 未压 0–115（实拍，top）
```

白板 demo 的顶带实测是 `0–115px`；同一条 recipe 换一条字幕可能是 `0–114px`（字幕框高度差 1px）。以 probe 的实拍值为准，不要背数字。

判定：

- 主体是否压进字幕带，机器不再自动判；看 12 格联系表或 `tt probe` 的实拍框。
- recipe 有 `caption.noOverlapSubject` 时，verify 会按配方自己的断言报 `VERIFY_CAPTION_OVERLAP`（must）。
- 顶字幕时，开场锚点的文字框要在带下；底字幕时，所有主体要停在 `0.80H` 以上（或实拍字幕框上缘以上）。

---

## 8. 活动笔尖

`TT.pen.track` 会把笔身画在**当前未完成笔画的末端**，笔画结束后再淡出 80ms。这带来一条硬约束：

> 最后一笔必须在场景结束前 **≥0.6s** 完成；否则末帧还会带着一支笔。

更稳的做法是让最后 12% 完全不落新笔，并让最后活动早于 88% 时刻。demo 的最后活动在 10.02s / 15.81s，静止 5.8s；图表范例最后一笔约 14.0s / 16.53s，静止约 2.5s。两片末帧都没有活动笔尖（联系表末格可直接确认）。

笔身朝向默认固定 35°；需要跟随路径时传 `rotate: 'follow'`。

---

## 9. 相机与 `preimage`

zoom > 1 时，可见场景区域会向 focus 收缩。按画布安全框（115 / 65 边距）直接布内容，推到 1.06 倍时右/下边缘会被推出安全框。`TT.geom.preimage` 把安全框沿时间按相机反像回场景坐标，求交集，得到“内容放在这里，任何时刻都不越界”的可行矩形。

标准用法（照抄这 5 行，不要自己写反像采样）：

```js
const frames = TT.geom.keyframes({ mode: 'in', from: 1, to: 1.06, focus: [0.5, 0.5] }, api.d);
const safe = TT.geom.safeBox({ W, H, m: RULES.safeMargin });
const pre = TT.geom.preimage({ frames, dur: api.d, W, H, safe });
const framing = TT.geom.fit(FRAME, pre);
const z = TT.geom.camera(frames, api.t);
```

然后按固定顺序套变换：

```js
ctx.translate(fx, fy);
ctx.scale(scale, scale);
ctx.translate(-fx, -fy);
ctx.translate(framing.dx, framing.dy);
ctx.scale(framing.scale, framing.scale);
```

白板 demo 的实测值（1920×1080，m=0.06，zoom 1→1.06）：

- 安全框：`x0=115.2, y0=64.8, x1=1804.8, y1=1015.2`（probe 显示 115 / 65）。
- 1.06 倍反像：`x=163.0189, y=91.6981, w=1593.9623, h=896.6038`（右 1756.98 / 下 988.30）。
- demo 的 `FRAME` 是 `{x:-70,y:30,w:2060,h:850}`，`fit=0.773768`；屏幕字号 = 场景字号 × fit × zoom。

不要在 code 里写 `for (let i = 0; i <= 256; i++)` 之类的反像采样：符号抄错会把内容推出安全框，而像素检查只会说出界，说不出相机算错。用 `TT.geom`。

---

## 10. 验收链路

按顺序跑，不要跳：

| 步骤 | 命令 | 通过线 |
|---|---|---|
| 编译 | `tt build --dir <工程>` | status 通过、exit 0、`report.errors` 为空 |
| 质量 | `tt qa --dir <工程>` | **must 0**；recipe 有 verify 时 fail 0；`review/qa-sheet.png` 已生成并**实际看过** |
| 确定性 | `tt det --twice --dir <工程>` | 两次编译的规范化 composition 指纹一致；它不证明像素或 MP4 字节一致 |
| 单帧 | `tt probe --t <秒> --dir <工程>` | 看 `ink` / `text` 逐条 bbox、安全框、字幕带；定位越界/重叠到具体元素与帧 |

`tt qa` 一次 build + 一次浏览器会话完成轻校验（空墨迹、recipe verify/forbid）；`out/qa.json` 只保留这几类硬问题，`report.json.quality` 同步写入。12 格联系表是质量判断的唯一入口：构图、安全框、对比度、停留、转场都直接看图，不再由机器评分。

### 症状 → 命令 → 错误码

| 症状 | 先跑 | 错误码（级别） | 处理 |
|---|---|---|---|
| 编译报 code 用了禁用 API | `tt build` | `CODE_FORBIDDEN_API`（error） | 按第 3 节替换；行号在 msg 里 |
| 编译 warning 出现无界循环 | `tt build` | `CODE_LOOP_RISK`（should） | 改成有确定上界的 for |
| 画面少了一层图 / 视频 | `tt build` | `CODE_RESOURCE_MISSING`（error） | 在 `scene.resources` 补 `{type,name,src}` |
| code 类型/空值/长度不对 | `tt build` | `SCENE_CODE_TYPE` / `SCENE_CODE_EMPTY` / `SCENE_CODE_TOO_LONG`（error） | 字符串或字符串数组；≤20000 字符 |
| 场景键拼错 | `tt build` | `SCENE_UNKNOWN_KEY`（error） | 删掉未知键；可用键看报错列表 |
| beat 指到别的场 | `tt build` | `BEAT_CROSS_SCENE`（error） | beat 只能指向本场；改成本场秒数 |
| narration 和 duration 同时写 | `tt build` | `SCENE_DURATION_CONFLICT`（error） | 二选一：旁白场删 duration |
| storyboard JSON 语法错 | `tt build` | `PROJECT_BAD_JSON`（error） | 修 JSON；先跑 `tt build` 看行号 |
| 文字越出安全框 | `tt probe` / 12 格联系表 | 无自动码；recipe 写了 verify 时才有 `VERIFY_TEXT_OUTSIDE_SAFE`（must） | 用 `TT.text.bbox()` / probe 回算位置；构图允许出框时不用改 |
| 两次编译指纹不同 | `tt det --twice` | `twice=false` | 检查 code 是否引入非确定性；带 `--tts` 时不要把它当严格同输入双编译 |
| 两条文字互压 | 12 格联系表 | 无自动码；recipe 写了 verify 时按 verify | 调字号 / 行距 / 位置；用逐条 text 回执 |
| 墨迹越出安全框 | `tt probe` / 12 格联系表 | 无自动码；recipe 写了 verify 时才有 `VERIFY_INK_OUTSIDE_SAFE`（must） | 用 `TT.geom.preimage` + `fit` 重排 |
| 主体压进字幕带 | `tt probe` / 12 格联系表 | 无自动码；recipe 写了 verify 时才有 `VERIFY_CAPTION_OVERLAP`（must） | 顶字幕看带下，底字幕看 0.80H / 实拍字幕框 |
| 元素画了但没有墨迹 | `tt qa` | `QA_INK_EMPTY`（must） | 检查颜色 alpha、字体是否加载、路径是否为空 |

所有错误码都来自源码里的 `bag.error` / `add(level, ...)`；不要发明新码。

---

## 11. 图表构图的最小骨架

以“一条随时间指数增长的曲线”为例，骨架只依赖四组数：坐标轴原点、x 上限、y 轴上限、数据函数。

1. **两条映射**：先定义 `valuePx(v)` 与 `yearX(n)`，所有点都走这两个纯函数，不要散落算坐标。
   ```js
   const valuePx = (v) => yBase - (v / yMax) * (yBase - yTop);
   const yearX = (n) => x0 + (n / nMax) * (x1 - x0);
   ```
2. **轴与刻度**：轴先用粗线落笔；刻度由 `TT.chart.ticks(yMax, 2)` 给出（如 `1000 → [0,500,1000]`），短横线用细线，数值标签在轴之后出现。x 轴刻度写在 `0 / 10 / 20 / 30` 这类等距年份上。
3. **曲线**：数据在固定年份步长上采样（例如每 1.5 年一个点），不要按像素采样；把 0–30 年切成 2–3 段独立 stroke，段边界选在故事要停顿的年份。曲线每段只扩 bbox 一次，形成可数的落笔节拍。
4. **终点**：如果轴上限取整（1000），而 `100 × 1.08^30 = 1006.27`，端点会略高于 1000 刻度线；标注写 `≈1000`，不要偷偷把 y 轴抬到 2000（`TT.chart.niceMax(1006)` 会得到 2000，曲线会被压成一半）。**轴上的整数是叙事锚点时，硬编码轴上限并显式允许 0.6% 溢出**；轴上限只用于取整、没有叙事含义时，再用 `niceMax`。
5. **翻倍阶梯**：把 `×2 / ×4 / ×8` 画成一条阶梯折线（在 9 / 18 / 27 年处各上升一级），放在曲线下方的空白带；阶梯先落笔，年份/倍率标注后出现，不要和曲线标签挤在同一行。
6. **标注**：所有点标注在主体笔画之后出现；用 `TT.text` 或 raw `fillText`，逐条回执会抓住 text-text 重叠。公式里的上标（如 `n`）用 `TT.text` 单独画小字号，先量主公式宽度再定位，不要依赖字体是否支持 `ⁿ`。

完整实现见 `recipes/whiteboard-explainer/examples/compound-interest.js`；上面只给骨架，不贴整段代码。

---

## 12. 写作约束

- **按机制、坐标、时间、receipt 写**。题材不决定骨架；不要用题材分类来选画法，也不要写“这种题材应该……”的规则。
- **不写观感形容词**。审美判断不进规范；写“字号 ≥4%H”“交叠 ≤5%”“最后 12% 不落笔”“停顿占比 15%–45%”这类可验收的量。
- **不手写不确定的东西**。所有时间从 `api.t` 来，所有随机从 `TT.rng(api.seed)` 来，所有外部内容从 `scene.resources` 声明。
- **先跑 build，再跑 qa（must 0），然后必须看 12 格联系表，最后 probe**。报告里必须贴真实输出，不贴“应该通过”。
- **范例学技术，不抄题材**。读 `examples/` 里的坐标、相机、节拍和回执用法；换内容时保留这些结构，不要复制题目。
