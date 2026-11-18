# Captions · 字幕样式 kit

字幕系统由**公共排版层 + 七个绘制样式**组成。recipe 只选择样式和参数；字体解析、逐字时间轴、多行量测、位置、安全区、淡入淡出和主体避让都由 `TT.captionKit` 统一处理。

```text
recipe.uses.captions / CLI --captions
                ↓
platform/compile/captions.mjs       校验、默认值、字体资源
                ↓
platform/kit/captions/core.js       公共排版与避障模型
                ↓
platform/kit/captions/styles/*.js       各样式只负责盒型参数与绘制
```

字幕使用 plan 阶段生成的 cue 和 `chars[].start/end`，在场景元素之后绘制，不进入相机变换。横屏 `1920×1080` 与竖屏 `1080×1920` 共用同一套逻辑坐标规则。

## 快速使用

`uses.captions` 可以是样式 ID：

```json
{
  "uses": {
    "captions": "perchar"
  }
}
```

也可以是参数对象；未填参数使用 recipe `captions` 与样式默认值：

```json
{
  "uses": {
    "captions": {
      "style": "collage",
      "font": "sans-900",
      "band": true,
      "at": "auto",
      "size": 1.0
    }
  }
}
```

CLI 的 `--captions` 会覆盖 recipe 设置，既接受 ID，也接受 JSON 对象：

```bash
node "$SKILL_DIR/platform/cli.mjs" build --dir output/caption-kit/styles/perchar \
  --captions '{"style":"collage","at":{"x":0.66,"y":0.43},"size":1.25,"maxWidth":0.30}'

node "$SKILL_DIR/platform/cli.mjs" stills 1.4 2.2 \
  --dir output/caption-kit/styles/perchar \
  --captions collage
```

配置优先级为 **CLI `--captions` → storyboard `uses.captions` → recipe `captions`**。

## 七种样式

| ID | 视觉特征 | 适合内容 | 常用参数 |
|---|---|---|---|
| `plain` | 默认无底色，白字配深色描边和柔和阴影，可放在任意位置 | 实拍、插画、需要露出画面的短视频 | `at`、`stroke`、`shadow`、`color`、`band`、`padding` |
| `perchar` | 圆角背衬跟随实际文本宽度，逐字字幕：未读字弱化，已读字点亮 | 新闻、播报、数据和正式说明 | `background`、`color`、`align`、`band` |
| `karaoke` | 已读字变白，当前字使用高亮色并放大到 1.12 倍 | 叙事、历史、歌曲和跟读 | `highlight`、`background`、`color` |
| `collage` | 每字独立色块，色板循环，确定性错位、逐字回弹和最大 ±6° 微旋转；多行有不同横向偏移 | 社交视频、拼贴插画、生活方式和活泼标题 | `palette`、`seed`、`rotation`、`maxWidth`、`avoid` |
| `handnote` | 手写字、灰色纸带、不规则荧光笔条，字级轻微手绘抖动且不逐帧闪烁 | 白板、手账、教育、轻量解释 | `font`、`highlight`、`background`、`color` |
| `vertical` | 字从上到下，列从右到左，逐字显现 | 水墨、国风、诗词和东方美学 | `font`、`maxHeight`、`at`、`color`、`band` |
| `tornpaper` | 白色手撕纸背衬，带柔和投影；上下撕边平缓，纸纤维按 `seed` 固定；左上角斜置一块 accent 和纸色块，深墨字默认江城圆体 | 手账、生活记录、报刊剪贴和轻松叙事 | `background`、`accent`、`color`、`seed`、`band` |

`collage` 的色块是字形设计本身，不受 `band: false` 抑制。其色块前景色默认按背景亮度自动选择；单色 `palette` 时可用 `color` 指定文字颜色。随机偏移由字符序号与 `seed` 哈希得到，不使用 `Math.random()`，同一输入可重复渲染。

`perchar` 的四周留白来自盒型的 `padX: 34 / padY: 14`，不是额外加的 padding；即使 `band: false` 关闭背衬，文字仍保留这段留白。`plain` 的背衬内边距为 `28 / 14`，只有 `band: true` 时才会看到底色和留白。

## 参数 schema

### 通用参数

| 参数 | 类型 / 范围 | 默认值 | 说明 |
|---|---|---|---|
| `style` | 七样式 ID 或 `none`（关闭字幕） | `perchar` | 对象形式时指定样式 |
| `font` | `assets/fonts/manifest.json` 的字体键 | 随样式 | 见下方字体表；直接写键，如 `JiangChengYuanTi`，没有角色层 |
| `size` | number，`0.5–2.0` | `1` | 相对 recipe `captions.baseSize` 的倍率 |
| `at` | `bottom` / `top` / `center` / `auto` / `{x,y}` | 随样式 | 字幕整体位置 |
| `band` | boolean | 随样式 | 是否绘制该样式的整体背衬；`collage` 例外 |
| `maxWidth` | positive number | 安全区宽度 | `<=1` 为画宽比例，`>1` 为逻辑像素；控制横排折行 |
| `maxHeight` | positive number | 竖排默认画高的 56%，再受安全区约束 | `<=1` 为画高比例，`>1` 为逻辑像素；控制竖排列高 |
| `align` | `left` / `center` / `right` | 随样式，通常 `center` | 文字在背衬内的对齐方式 |
| `lineHeight` | positive number | recipe `captions.lineHeight` 或样式值，通常 `1.24` | 相对字号的行距 / 列距倍率 |
| `padding` | 非负 number 或 `[x,y]` | 样式内边距 | 相对字号的倍率；数字表示 XY 相同，数组分别覆盖 X/Y |
| `avoid` | 归一化矩形数组 | `[]` | `auto` 排位时的额外主体障碍，见“主体避让” |
| `color` | CSS 颜色字符串 | 随样式 | 主文字颜色 |
| `background` | CSS 颜色字符串 | 随样式 | 整体背衬颜色 |
| `accent` | CSS 颜色字符串 | `tornpaper: #9FD4BD` | `tornpaper` 左上角斜置色块 |
| `highlight` | CSS 颜色字符串 | `karaoke: #FFD166`；`handnote: #F4D35E` | 当前字或荧光笔高亮 |
| `palette` | 非空 CSS 颜色字符串数组 | collage 六色色板 | 逐字循环的独立色块颜色 |
| `seed` | integer | `17` | collage 确定性错位、块尺寸和旋转的种子 |
| `rotation` | number，`0–6` | `6` | collage 最大绝对旋转角度；`0` 关闭旋转 |
| `tracking` | number，`0–0.5` | `0.12` | collage 相邻色块槽位的间隙，相对字号的倍率；推进量已含旋转外接盒，建议 `0.08–0.16` |
| `shadow` | CSS 颜色字符串 | `rgba(0,0,0,0.42)` | plain 阴影颜色 |
| `stroke` | CSS 颜色字符串，或 `none` | `rgba(10,15,20,0.86)` | plain 描边；`none` 关闭描边 |

各样式的 `font / at / band` 默认值：

| 样式 | font | at | band |
|---|---|---|---|
| `plain` | `sans-900` | `bottom` | `false` |
| `perchar` | `sans-900` | `bottom` | `true` |
| `karaoke` | `sans-900` | `bottom` | `true` |
| `collage` | `sans-900` | `auto` | `true` |
| `handnote` | `ZTZiYouTi` | `bottom` | `true` |
| `vertical` | `WenYuanSerifSC-Bold` | `auto` | `false` |
| `tornpaper` | `JiangChengYuanTi` | `bottom` | `true` |

未识别参数、未知样式或字体、越界的 `size` / `rotation`、非法位置等会在 schema 阶段报错，不会静默回退成另一种字幕。

### 文本与时间

- 普通文本按实际 `measureText()` 宽度折行；字符 `\n` 强制换行。
- 竖排按 `maxHeight` 分列，新列放在前一列左侧。
- 每个字符都有独立 `start / end`。若源 cue 没有字符时间轴，kit 会在 cue 时长内均匀补齐。
- 样式可决定未读、已读和当前字的颜色、透明度与弹出方式；公共层负责 cue 整体淡入淡出。

## 位置与安全区

`at` 的所有形式都基于**整个字幕盒**，而不是某一行或某个字符。

| 值 | 含义 |
|---|---|
| `bottom` | 水平居中，顶部从 recipe `captions.top`（通常画高的 78%–80%）开始 |
| `top` | 水平居中，贴安全区顶部 |
| `center` | 画面中心 |
| `auto` | 从九个候选位置中选择与主体障碍重叠最少的位置 |
| `{ "x": 0.66, "y": 0.43 }` | 字幕盒中心的归一化坐标；`(0,0)` 为左上，`(1,1)` 为右下 |

所有位置都会被 `recipe.rules.safeMargin` 约束在画面安全区内。归一化坐标同时适用于横屏和竖屏，不需要分别写像素值。显式坐标是固定构图指令；`avoid` 的自动评分只在 `at: "auto"` 时进行，因此指定坐标时仍应把字幕放在主体之外。

## 主体避让

障碍只有一处来源：`options.avoid`，即 recipe / `uses.captions` 显式给出的归一化矩形。场景代码和 params 模板不向字幕层提交结构化避障区；`at: "auto"` 时如果没有 `avoid`，九个候选点按顺序取第一个能放进安全区的位置。

`at: "auto"` 依赖 recipe 自己知道主体在哪。全幅画面（code 场铺满整帧、params 模板铺满整帧）没有可避让的主体框，应改用明确的 `at` 或给出 `avoid`。

显式避障示例：

```json
{
  "style": "collage",
  "at": "auto",
  "avoid": [
    [0, 0.12, 0.39, 0.88],
    { "x": 0.72, "y": 0.10, "w": 0.18, "h": 0.30 }
  ]
}
```

数组和对象均表示 `[x, y, w, h]` / `{x,y,w,h}`，数值为画宽、画高比例。

## 字幕字体

`font` 直接写 `assets/fonts/manifest.json` 的键，没有角色层。字幕字体是独立资源：只要 `captions.font` 指定的文件，`emit` 就会加载它，与场景代码、模板用没用到同一款字体无关。不写 `font` 时用样式默认键；写了 manifest 里不存在的键会在 schema 阶段报 `CAPTION_FONT_UNKNOWN`。

| manifest 键 | 字体真实 family | 文件 | 字重与用途 |
|---|---|---|---|
| `sans-900` | DingTalkJinBuTi | `DingTalk-JinBuTi.woff2` | 900；默认主字幕，紧凑有力 |
| `sans-700` | WenYuanSansSC | `WenYuanSansSC-Bold.woff2` | 700；小标题与关键词，比默认字幕略轻 |
| `sans-400` | WenYuanSansSC | `WenYuanSansSC-Medium.woff2` | 400；长句与信息型字幕，阅读更稳 |
| `WenYuanSerifSC-Bold` | WenYuanSerifSC | `WYST_BOLD.woff2` | 700；宋体，vertical 与国风字幕默认 |
| `JiangChengYuanTi` | JiangChengYuanTi | `江城圆体.woff2` | 400；柔和圆体，tornpaper 默认 |
| `ZTZiYouTi` | ZTZiYouTi | `ZTZYT.woff2` | 400；自由手写，handnote 默认 |
| `ZTYueDongHei` | ZTYueDongHei | `ZTYDH.woff2` | 400；海报型强调字幕 |
| `MaokenAssortedSans` | MaokenAssortedSans | `MKSJH.woff2` | 400；不规则字面，适合剪报拼贴 |
| `DouYinMeiHaoTi` | DouYinMeiHaoTi | `DYMHT.woff2` | 400；活泼标题字 |
| `QianTuBiFengShouXie` | QianTuBiFengShouXie | `QTBFSXT.woff2` | 400；笔锋手写，适合国风题款 |
| `TsangerYuMo` | TsangerYuMo | `CEYM-W02.woff2` | 400；毛笔墨韵，适合水墨题款与东方情绪标题 |
| `TsangerShuYuan` | TsangerShuYuan | `CESYT03.woff2` | 400；圆润舒展，适合轻松日常与亲和标题 |
| `StarLovePencil` | StarLovePencil | `ZZJZDB.woff2` | 400；自动铅笔手写感，适合手账、圈注与草稿 |

资源键与 FontFace 族名一律用 manifest 键；manifest 的 `family` 只做说明，不写进 `captions.font`。

## 添加新样式

只需新增 `platform/kit/captions/styles/pill.js`。catalog 会按文件名自动注册 `pill`，不需要修改 emit、字体加载、cue 计划或位置代码。

```js
/** pill：只定义盒型和绘制；排版、逐字坐标、位置与淡出全部来自 kit。 */
(() => {
  CAPTIONS.pill = (c) => TT.captionKit.render(c, {
    padX: 28,
    padY: 12,
    fadeIn: 0.12,
    fadeOut: 0.12,
  }, (m) => {
    const { ctx, o, f, rect } = m;
    ctx.fillStyle = o.background || 'rgba(12,18,24,0.88)';
    TT.captionKit.rounded(ctx, rect.x, rect.y, rect.w, rect.h, rect.h / 2);
    ctx.fillStyle = o.color || '#FFFFFF';
    TT.captionKit.eachChar(m, (ch) => {
      if (c.sceneT < ch.start) return;
      ctx.fillText(ch.text, ch.x, ch.baseline);
    });
  });
})();
```

如需不同的默认 `font / at / band`，在 `platform/compile/captions.mjs` 的 `CAPTION_STYLE_DEFAULTS` 加一项即可。若需要新公共参数，再在同一文件的 `COMMON_KEYS` 和校验中加入契约。

`TT.captionKit.render(c, spec, draw)` 的 `draw(model)` 常用字段：

| 字段 | 内容 |
|---|---|
| `c` / `ctx` / `o` | 调用上下文、canvas context、归一化后的字幕参数 |
| `cue` / `t` / `alpha` | 当前 cue、cue 内时间、整体包络透明度 |
| `f` | 已解析字体，含 `css`、`size`、`ascent` |
| `lines` | 行或竖排列；每项含 `chars`、`x`、`y`、`width`、`index` |
| `rect` | 完成安全区和位置解析后的字幕盒 |
| `originX` / `originY` / `lineHeight` | 内容原点与行 / 列距 |
| `contentW` / `contentH` / `padX` / `padY` | 内容尺寸与内边距 |
| `vertical` | 是否竖排 |

字符对象含 `text`、`start`、`end`、`w`、`x`、`y`、`baseline`、`index` 和 `line`。公共 helper 包括 `eachChar`、`rounded`、`inkFor`、`noise` 和 `clamp`。样式不应重新实现字体选择、文本折行、safe area、`auto` 避障或 cue 包络。

## 演示与验收

七样式同文本演示使用同一句“字幕跟着声音，逐字亮起来。”，每段约 2.43 秒，总长约 17 秒；左上角标注样式名。

```bash
# 通过真实 buildProject 分别构建七段，再合并 composition；演示不请求 TTS。
node scripts/demos/build-caption-kit.mjs

# 浏览器 compositor 导出 MP4（按需执行）。
node scripts/render.mjs output/caption-kit/project/out/composition.json \
  -o output/caption-kit/video.mp4

# 各段中间帧，用于逐样式检查版式与安全区。
node scripts/snapshot.mjs output/caption-kit/project/out/composition.json \
  --shots -o output/caption-kit/stills

# 全量 recipe 回归。
node "$SKILL_DIR/platform/cli.mjs" recipe audit
```

产物位置：

- `output/caption-kit/project/out/composition.json`：七样式同文本对照工程。
- `output/caption-kit/styles/<style>/storyboard.json`：各样式单场源工程。
- `output/caption-kit/stills/`：按合成时间抽出的检查帧。
- `output/caption-kit/video.mp4`：仅在执行 render 后生成。
