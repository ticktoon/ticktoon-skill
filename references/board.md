# TT.board 舞台底库

公共实现位于 `platform/kit/board.js`，由 `platform/kit/index.json` 注入为 `TT.board`。code 场与 params 模板共用同一批底：内容由 `scene.code` / 模板实时写，舞台（纸、板、幕布）必须可穷举、由人审过，所以写死在这里。舞台只画底，不画任何内容——人物、图形、标注、正文都不在它的职责内。

## 通用约定

- 签名统一为 `TT.board.<kind>(ctx, api, opts = {})`。
- 尺寸优先取 `api.W / api.H`（逻辑尺寸），没有 `api` 时退回 `ctx.canvas` 的像素尺寸。
- 纹理密度按**短边**定量：横屏与竖屏下看到的是同一种纸，而不是拉伸后的两套密度。
- 所有扰动都是「序号 + 固定常量」的确定性函数，不读墙钟、不用随机数；同一 `seed` 两次 build 出同一张图（`tt det` 可验）。
- `opts.tone`：整体色偏，`-1..1`，正暖负冷；省略或 0 时不落任何额外的笔。
- `opts.seed`：扰动种子，默认 0；换 seed 会换纤维/斑驳/褶皱的分布，不换质感。

## 七种舞台

`TT.board.list()` 按以下顺序返回 7 种，每条含 `kind / desc / when / opts`：

| kind | 舞台 | 长什么样 | 什么时候用 | 别怎么用 |
|---|---|---|---|---|
| `paper` | 白纸 | 暖白 `#f8f5ec` + 短纤维与细点 | 白板讲解、板书推导的默认底；内容多、要最大对比度 | 底色已经很深的正文别用它，笔画会看不清 |
| `blackboard` | 绿板 | 深绿渐变 + 擦痕雾 + 木内框 + 粉笔槽（三根粉笔与板擦） | 课堂/讲义口吻，粉笔质感是卖点时 | 正文别用深色；板比纸暗，文字要换浅色 |
| `cream` | 米色拼贴纸 | 中心暖亮、四边压深 + 短纤维与不均浅斑 | 手账/剪报/拼贴感，贴纸与便签混排 | 干净科技感内容别用，斑驳会显旧 |
| `wash` | 宣纸 | 偏白微黄 + 长纤维 + 未化开的料点 | 水墨/国风/湿画法，墨色有浓淡层次 | 硬边几何图形别用，宣纸会把利落感吃掉 |
| `crayon` | 暖米纸 | `#f2e8d5` + 45° 蜡笔细斜纹 + 四边毛糙 | 蜡笔绘本、儿童向，要"手工纸上画的"粗颗粒感 | 精细图表别用，斜纹会干扰细线 |
| `stage` | 纸幕舞台 | 全幅柔光 + 双八度连续纸筋 + 四边暖褐暗角；`screen=white/oil` | 纸上剧场，主体是舆图、文书、纸偶或符号 | 不要画聚焦光斑或叠第二层底色；灯光由调用方另行处理，木框单独用 `stageFrame` |
| `news` | 新闻黑底 | 近黑 + 中心微亮 + 上下窄光带 + 极细网格 | 资讯播报、数据快报，主体是高亮图形或大号标题 | 大段深色正文别用；`opts.grid=false` 可去网格 |

## 可选参数

| opts | 适用 | 说明 |
|---|---|---|
| `paper` | paper / crayon / news | 换底色（字符串，任意 CSS 颜色） |
| `tray: false` | blackboard | 去掉粉笔槽与粉笔/板擦道具 |
| `bleed: true` | wash | 四周加淡墨晕，湿画法的边界不该是干脆的直角 |
| `screen` | stage | `white` 白幕 / `oil` 油灯暖幕 |
| `variant` | stage | 0–3，轻微改变柔光中心；默认 0 |
| `grid: false` | news | 去掉极细网格 |
| `tone` | 全部 | 整体色偏 `-1..1`，正暖负冷 |
| `seed` | cream / crayon / stage | 扰动种子，换分布不换质感 |

## 用法

```js
// 最常用：一张白纸
TT.board.paper(ctx, api);

// 宣纸 + 四周淡墨晕，稍微偏冷
TT.board.wash(ctx, api, { bleed: true, tone: -0.2 });

// 换一张斑驳分布不同的拼贴纸
TT.board.cream(ctx, api, { seed: 7 });

// 纸幕舞台：内容与灯光另画，最后单独加固定木框
TT.board.stage(ctx, { W, H }, { screen: 'white', variant: 0, seed: 3 });
// ...scene content...
TT.board.stageFrame(ctx, { W, H });
```

场景先选舞台、再写内容；同一片子里所有场景应使用同一种舞台（转场那一拍除外，见 `references/transition.md`）。舞台没有独立样片：在 `scene.code` 里直接调 `TT.board.<舞台>(ctx, api)`，用 `tt stills` 或预览核对即可。
