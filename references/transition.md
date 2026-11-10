# TT.transition 转场 kit

公共实现位于 `platform/kit/transition.js`。storyboard 场上声明 `transitionIn` / `transitionOut`，编译期由 `emit.mjs` 注入到场景 code 的**最后**（字幕之后）——过渡盖住已完成画面，和真实胶片一致。

## 协议限制：为什么没有 crossfade

composition 的 `scenes[]` 首尾相接，每场独立绘制、画满整帧——**同一时刻只有一场活着**。真 crossfade（交叉淡化）需要两场画面同时存在，协议做不到。

能做的是两半拼起来：前一场末尾"盖向一个颜色"（out），后一场开头"从颜色里揭开"（in）。两场用同一种中间色，就是电影里的 **dip-to-color**；它不是叠化，文档和参数名里都不许把它叫 crossfade。

## 声明方式

```json
{ "id": "s01", "transitionOut": { "type": "dip-to-color", "dur": 0.4 },
  "id": "s02", "transitionIn":  { "type": "fade-in",     "dur": 0.4 } }
```

不声明或 `type: "cut"` 就是硬切，**零变化**。`dur` 必须 >0 且 ≤ 场景时长的 40%，否则 `TRANSITION_TOO_LONG`；未知词条报 `TRANSITION_UNKNOWN`（两个都是 build 硬错误）。

## 词条

**out**（修饰前场末尾）：

| id | 效果 | 什么时候用 |
|---|---|---|
| `cut` | 无（默认） | 节奏本来就该断开 |
| `dip-to-color` | 淡到单色 | 章节、时间跳跃；下一场接 `fade-in` 拼成完整 dip |
| `wipe` | 色块沿 `dir` 擦过 | 比硬切明确、又不想动画面 |
| `push` | 整帧向 `dir` 滑出 | 换地点、换章节的推进感 |
| `page` | 翻页压过，边缘带阴影 | 翻章；比 wipe 有纸张感 |
| `zoom-out` | 整帧缩小并淡出 | 收束、抽离 |
| `glitch` | 切片错位 + 色条，收黑 | 故障、强转折；别连续用 |

**in**（修饰当前场开头）：`fade-in` / `iris`（圆形窗口从 `at` 张开）/ `zoom-punch`（1.14→1.0 落定）/ `glitch-in`，以及默认 `cut`。

参数：`dir` ∈ `l/r/u/d`（默认 `l`）；`color` ∈ `bg`/`ink`/`accent`/十六进制（默认场景背景色）；`at` 为归一化圆心。

## 实现说明

- `push` / `page` / `zoom-out` / `glitch` / `zoom-punch` 需要**帧快照**（把已画好的帧读回离屏画布再变换）。引擎环境不支持时**诚实降级**为同方向色块擦除，不假装推镜。
- 所有噪声是进度 p 与切片序号的纯函数，不碰 `Math.random`；同帧两次调用结果一致（`det` 可过）。
- out 类在 p≥0.985 时全遮，保证下一场从纯色开始。

## 什么时候别用

- 单场视频没有"场间"，转场无意义。
- 节奏型 recipe（快闪、卡点）依赖硬切的顿挫，加 dip 会拖泥带水。
- 每场都加转场等于没有转场；一部片里 2–3 次有意义的位置才用。
