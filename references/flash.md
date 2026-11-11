# TT.flash

快闪大字卡点的公共绘制词法。只画一帧，不读时间轴；`t` / `progress` / `dur` 由 `scene.code` 显式传入。所有随机扰动都来自 `seed` 与索引的纯函数，同一帧两次调用结果一致。

```js
const T = api.t;
TT.flash.stagger(ctx, api, { text: '万物皆动', x: W / 2, y: H * 0.48, size: 280, t: T, dur: 0.32 });
```

`TT.flash` 会自动带入 `TT.ease / TT.clamp01 / TT.num / TT.text / TT.font`，只需要在 `scene.code` 里写 `TT.flash`。图像 / 视频名必须先在 `scene.resources` 里声明。

快闪的默认调色板在 kit 内部：黑底 `#0A0A0A`、白字 `#FFFFFF`、灰 `#8A8A8A`、橙 `#FF4D00`、深蓝 `#12305C`。需要品牌色时直接给 `color` / `colors` / `colorA` 传 hex；不再从 recipe 读颜色 token。每个场景的底色由 code 自己 `fillRect` 铺满。

## 文字

### `TT.flash.fit(ctx, text, maxWidth, opts) -> px`

单行字号选择器：从 `maxPx` 往下试 2px，直到 `text` 能塞进 `maxWidth`。

- `opts.maxPx` / `minPx` / `role` / `tracking` / `font`

### `TT.flash.stagger(ctx, api, opts)`

逐字弹入或重击，每个字一个独立 progress；最终位置按逐字宽度累加。

- `text`、`x`、`y`、`size`、`t`、`dur`、`stagger`（字间延迟）、`tracking`
- `direction`: `scale` / `up` / `down` / `left` / `right`
- `fromScale`、`fromOffset`、`ease`（`back` 可用）、`back`、`rotate`、`jitter`、`seed`
- `color`、`colors[]`；文字不画描边
- `align`: `left / center / right`；`baseline`: `middle / alphabetic`

### `TT.flash.mask(ctx, api, opts)`

图像 / 棋盘 / 半调 / 纯色填字，可加多层字。文字在离屏画布合成，主画布只 blit 一次，并记一条文字回执。

- 不给 `fill` 时默认纯色，不再默认棋盘；棋盘 / 半调只有显式 `fill:'checker' / 'halftone'` 才出现。
- 字形默认按字号 3% 加粗：内部先画 fill + stroke 合成 mask，再一次性 `destination-in`。stroke 不是可见描边，是旧组件的圆角加粗；`weight` 可覆盖。
- 图像填字保持“字是窗口”：不要叠 `layers` 偏移层，否则会出现旧组件没有的阴影。
- `text`、`x`、`y`、`size`、`font` / `role`、`align`、`baseline`、`tracking`、`weight`
- `fill`: `image` / `checker` / `halftone` / 颜色值；`image` 可以是资源名或 `api.img/api.video` 返回的帧
- `fit`: `cover / contain`、`focus [fx,fy]`、`zoom`
- `drift: [dx, dy]`：字窗里图像的移动速度，单位像素/秒；负 x 向左、负 y 向上。只在 `cover` 下有效，靠移动裁切中心完成，不会露底
- `colorA` / `colorB` / `cell` / `dot` / `angle`
- `layers[]`: `{ dx, dy, color }`；从后往前叠加，正面仍是 `fill`
- `rotate` / `skewX` / `skewY` / `scaleX` / `scaleY`
- `reveal 0…1`、`revealDir: l / r / u / d`
- `weight`（可选）：字形加粗像素，默认 `size * 0.03`；只影响字口厚度，不画可见描边

### `TT.flash.contrastColor(api, image, opts) -> color`

图像填字场的底色选择器：采样图像平均亮度，亮图返回深色、暗图返回浅色，让整帧底色和字窗里的图拉开对比。先取到 `api.img/api.video` 的帧，再铺底色，最后画 `mask`。

- `light` / `dark`：候选底色，默认 `#FFFFFF` / `#0A0A0A`
- `threshold`：亮度阈值，默认 `0.55`
- `invert`：反转亮/暗选择
- `image` 也可以是 `scene.resources` 里的资源名

### `TT.flash.stretch(ctx, api, opts)`

拉伸字 + 速度线。`t/dur` 从 0 到 1 时，字从斜切拉伸回正并横向进场。

- `text`、`x`、`y`、`size`、`t`、`dur`、`skew`、`scaleY`、`offset`
- `speed` / `speedLines:false`、`lineCount`、`lineLength`、`lineColor`、`seed`
- `color`、`align`、`baseline`；文字不画描边

### `TT.flash.speedLines(ctx, opts)`

独立速度线场：`rect`、`count`、`color`、`alpha`、`seed`、`length`、`width`。

### `TT.flash.layers(ctx, api, opts)`

多层文字视差：`lines[]`，每行 `{ text, x, y, size, color, dx, dy, offset }`。`dx/dy` 是每秒位移，远近感靠行间速度差，不靠模糊或叠层。

## 图形

### `TT.flash.pattern(ctx, opts)`

棋盘 / 半调 / 斜条 / 扫描线 / 网格。

- `kind`: `checker / halftone / stripes / scan / grid`
- `rect`、`colorA`、`colorB`、`cell`、`dot`、`dotGap`、`gap`、`angle`、`alpha`、`seed`、`width`

### `TT.flash.carry(ctx, opts)`

跨镜承接：

- `mode: out`：色块从 `origin` 长大到铺屏；`shape: circle / rect`
- `mode: residual`：同色圆从大到小残留
- `mode: in`：全屏色从洞中揭开（`rect + arc` evenodd）
- `t`、`dur`、`progress`、`color`、`origin`、`ease`、`W`、`H`

### `TT.flash.panels(ctx, api, opts)`

网格 / 卡片墙 / 拼贴 / 斜版。`cells[]` 每项可带：

- `image`（资源名）、`video`（资源名）、`color`、`tint`
- `text`、`textSize`、`textColor`、`role`、`align`
- `label`、`labelSize`、`labelColor`
- `x / y / w / h`（0…1 归一化；给了就走自定义拼贴）
- `from`、`offset`：单格入场方向与位移，覆盖整面的 `from`；用于双向格子墙

版式参数：`layout: quad / grid / collage / vertical`、`cols`、`rows`、`gap`、`pad`、`radius`（默认 22）、`slant`、`border`（默认不画）、`borderColor`、`borderWidth`。

`quad` 是旧组件的四格比例：左高图、右上两小卡、右下宽字卡。卡片默认圆角、无描边，像纸片而不是 UI 控件。

动画：`t`、`dur`、`stagger`、`from: bottom / top / left / right / alternate / alternateY`、`fromScale`、`offset`、`ease`、`alpha`。`alternate` 让相邻格左右交替进场，`alternateY` 上下交替；单格 `from` 可再覆盖。返回 `{ rects }`，供镜头或后续绘制复用。

### `TT.flash.tour(ctx, api, opts)`

内容卡片墙的焦点巡览：先用 `panels` 画墙，再让相机贴着三张卡做三角移动，最后拉远到全景。

- 版式参数同 `panels`：`layout`、`rect`、`cells`、`cols`、`rows`、`gap`、`radius`、`border`
- `tour.points[]`：格子索引 `0,1,2`，或 `[x, y, zoom]` 屏幕坐标；默认 `[0,1,2]`
- `tour.zoom`（默认 1.7）、`tour.finalZoom`（默认 1）、`tour.dur`（默认 `api.d`）、`tour.ease`
- `cellT`：卡片自身入场进度；默认 `Infinity`，巡览时整面已在位
- 镜头运动中的卡片文字是构图纹理，不记文字回执；正文放 `TT.flash.micro` 或镜头外

### `TT.flash.bars(ctx, opts)`

数据卡。默认 `layout:'columns'`：卡片底 + 左上标题 + 一排竖柱，最后一根默认 accent；`layout:'rows'` 才画旧式横向进度条。

- `rect`、`card`（默认 true）、`cardColor`（默认 ink）、`radius`、`pad`、`label` / `labelSize`
- `rows[]`：`{ value, max, color, label, valueText, digits }`
- `layout`、`gap`、`barW`、`max`、`t`、`dur`、`stagger`、`ease`
- `big { text, x, y, size, color }`；卡片底上默认自动取反色文字

### `TT.flash.wave(ctx, opts)`

波形条。`rect`、`count`、`gap`、`barW`、`amplitude`、`baseline`、`color`、`seed`、`t`、`speed`、`mirror`。

### `TT.flash.reveal(ctx, api, opts)`

图片出现：

- `kind: circle / iris / grid / bars`
- `progress` 或 `t/dur`
- `rect`、`image`（资源名或帧）、`color`、`fit`、`focus`、`zoom`
- `grid` 用 `cols / rows / gap`；`bars` 用 `count / gap`
- `ring` / `ringColor` / `ringWidth`

### `TT.flash.gridFocus(ctx, api, opts)`

格子焦点 → 原图铺屏。同一张图先切成格子墙，选中一格放大；放大过程中从该格切片过渡到完整原图，单镜完成收尾。

- `image`（资源名或 `api.img/api.video` 帧）、`rect`、`full`（最终铺屏矩形，默认同 `rect`）
- `cols`（默认 4）、`rows`（默认 3）、`gap`、`radius`、`focusCell`（默认中间格）
- `t / dur` 或 `progress`、`start`（放大起点，默认 0.42）、`ease`
- `fit`、`focus`、`zoom`、`color`（无图时的兜底色）

### `TT.flash.glitch(ctx, api, opts)`

故障切片。**必须在最后调用**：它先快照当前帧，再按条带错位重画。`rect`、`count`、`shift`、`seed`、`color`、`colorAlpha`、`W`、`H`。

### `TT.flash.glitchType(ctx, api, opts)`

故障风超大字。整行字在离屏字版里合成，按条带横向错位，其中一个字按时间跳色；不会把背景一起切碎。切片强度按场景进度脉冲式爆发：窗口外是干净字面，窗口内条带错位，因此同一场里能看到“抽一下—恢复—再抽一下”。

- `text`、`x`、`y`、`size`、`role / font`、`align`、`baseline`、`tracking`
- `t`、`dur`（默认 `api.d`）、`seed`、`count`、`shift`、`slice:false`
- `burstAt`：故障窗口数组，默认 `[[0.3, 0.1], [0.72, 0.08]]`，每项 `[中心进度, 半宽]` 或 `{ at, width }`
- `burst:false`：关闭时间脉冲，恢复为固定切片
- `color`、`jumpColor`、`jumpIndex`（固定跳色字）；不给 `jumpIndex` 时按 `t * jumpRate` 轮换
- `jump:false` 关闭单字跳色；`weight` 默认 3% 字号，只加粗字口，不画可见描边

### `TT.flash.viewfinder(ctx, opts)`

四角取景框、十字、REC、进度条。`rect`、`color`、`length`、`width`、`crosshair`、`rec`、`progress { value, rect, color, track }`、`labels[]`。

### `TT.flash.micro(ctx, opts)`

技术微标签：`text` 或 `index + total`（生成 `01 / 06`）；`x`、`y`、`size`、`color`、`align`、`alpha`、`bar { x, y, w, h, value, color, track }`、`rec`。

### `TT.flash.bands(ctx, opts)`

多段横带 / 三段式海报。`rect`、`bands[]`（`{ color, text, textColor, size, dir, speed, offset }`）、`gap`、`t`、`speed`、`alpha`。文字在带内循环，单带最多两份。

### `TT.flash.screencast(ctx, opts)`

代码录屏感：顶栏、打字代码行、右侧预览。`rect`、`title`、`lines[]`、`t`、`speed`、`progress`、`split`、`card`、`bar`、`accent`。不是第二套运行时。

## 组合建议

- 先画背景 / 色块 / 图案，再画图，再画字，最后画 `glitch` / `viewfinder` / 微标签。
- 满幅大字只用一个主角；微标签退到 2.5% 安全边距内，不要与主字同字号。
- 需要图像填字时，先 `scene.resources` 声明 `{ type: 'video' | 'image', name, src }`，代码里 `api.video(name)` / `api.img(name)` 取源。
- 所有时间从 `api.t` 来，所有随机从 `seed` 来；不要写 `Date.now` / `Math.random`。
