# TT.mark 标注 kit

公共实现位于 `platform/kit/mark.js`，由 `platform/kit/index.json` 注入为 `TT.mark`。场景 code 里画箭头、圈、框、对勾、叉、数字圈、分割线、涂底色**一律用 `TT.mark`，禁止手写贝塞尔控制点和自己的抖动**。

第一原则：所有线条类词条都走 `TT.pen.stroke` 出笔，自动继承笔的质感（粉粒、墨晕、起收笔）、墨迹框上报与笔身跟随。笔身默认不出现；强调标注（圈重点、下划线、箭头）传 `penBody: true` + `sceneScale` 才带笔——这些标注是叙事的一部分，光有墨没有笔，观众会觉得这一段没被画出来。填充类（`highlight`、实心箭头）不走笔画，但会通过 `TT.pen.addBox` 并入墨迹框，qa / probe 照样能读到它们。

带笔的标注同样受“同一时刻只有一支笔”约束：它们的 `progress` 时段不要和 `TT.pen.track` 的 `heroStrokes` 重叠，多个同向小箭头只给第一支带笔。标注的笔身在 `progress` 到 1 时直接消失（不复用 track 的 80ms 淡出），所以 `progress` 的 `dur` 就是笔身在场时长。

## 统一参数

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `pen` | enum | `'marker'` | 转调 `TT.pen.stroke` 的笔种；`check`、`cross` 默认 `'brush'` 以形成手写提按 |
| `width` | number | 3.2 | **除 `highlight` 外所有词条都可传**。`numberCircle` 不传时按半径取细线，`check`、`cross` 按 size 取粗笔 |
| `color` | string\|null | `null` | null 取 kit 默认墨色（铅笔灰）；`highlight`、`strike`、`cross` 默认陶土红 |
| `alpha` | number | 1 | 整体透明度 |
| `seed` | number | 0 | 抖动种子，**确定性**：同 seed 同参两次调用结果逐像素一致 |
| `progress` | number | 1 | 0→1 渐进绘制；**不会自行读取 `api.t`**，不传就直接画完整。动画须传 `TT.clamp01((api.t - start) / dur)` |
| `penBody` | boolean | `false` | 线类标注是否带笔身。圈重点、下划线、箭头这类强调标注显式传 `true` |
| `sceneScale` | number | `undefined` | 场景倍率（`fit × zoom`）。带笔时必须传，笔身才和纸面同尺度 |
| `fontKey` | string | `'sans-900'` | 仅 `numberCircle` 使用。字体必须在场景 `resources` 里声明，否则传本场已有的字体键 |

每个词条返回 `{ box: {x,y,w,h}, length }`（画布坐标墨迹框），失败返回 `null`。

**手绘强度默认固定，不开放 `wobble` / `dash`；只有 `arrow` 可用 `smooth:true` 关闭曲线扰动**：`circle = 1`、`box = 0.6`、`underline = 0.3`、`numberCircle = 1`、`divider = 0.4`；箭头、对勾、叉使用内部基准值，删除线始终平直。`mark` 只做低频轮廓形变，并关闭 `pen` 的逐点高频坐标扰动；粗细用 `width`，笔种用 `pen`。

## 10 个词条

`TT.mark.list()` 返回全部词条与适用场景：

| id | 关键参数 | 什么时候用 |
|---|---|---|
| `arrow` | `from`, `to`, `bend`(带符号曲率), `via`, `head:'open'\|'solid'\|'none'`, `double`, `smooth` | 指向方向、增长、因果；默认扰动 0.045，短线自动衰减；`smooth:true` 关闭曲线扰动，适合几何循环 |
| `circle` | `at`, `rx`, `ry`, `rotate` | 圈住人物/数字/局部；一笔带长起笔尾，轮廓为明显的低频不规则曲线，起止点错开 |
| `box` | `rect`, `radius`, `shape:'rect'\|'round'\|'cloud'`, `width` | 不规则手画框；边缘密采样后只做低频形变，云朵用于概念/气泡 |
| `highlight` | `rect`, `color`, `alpha:0.28`, `seed` | 一笔涂抹词/句的底色；**必须先 highlight 后写字** |
| `underline` | `from`, `to`, `overhang:0.06` | 带轻微低频扰动的下划线，两端略出头，不形成明显波浪 |
| `strike` | `from`, `to`, `double` | 平直、无波浪；`from/to` 对准文字中线，划掉错误说法、做前后对比 |
| `check` | `at`, `size:64`, `pen:'brush'` | 确认、完成、正确项；一笔连续短下压 + 长弧线上扬，末端收尖，默认手写粗笔 |
| `cross` | `at`, `size:60`, `rotate`, `pen:'brush'` | 否定、错误、取消项；两条微弧粗笔交叉，两端圆厚、中段轻压 |
| `numberCircle` | `at`, `r:28`, `text`, `textSize`, `fontKey`, `width` | 步骤编号、序号、计数；不规则空心圈，轮廓平滑 |
| `divider` | `at`, `length:320`, `orient:'h'\|'v'`, `width` | 分隔段落、步骤或画面层级 |

```js
TT.mark.arrow(ctx, { from: [300, 880], to: [700, 880], bend: 0.18, head: 'solid', color: acc, width: 4 });
TT.mark.circle(ctx, { at: [960, 900], rx: 90, ry: 46, color: acc, width: 4, penBody: true, sceneScale: fit * scale });
TT.mark.highlight(ctx, { rect: [300, 500, 560, 80], color: acc, alpha: 0.3 });
TT.mark.check(ctx, { at: [760, 980], size: 80, color: acc, width: 6 });
TT.mark.numberCircle(ctx, { at: [420, 300], r: 42, text: '3', color: acc, width: 2.4 });
TT.mark.divider(ctx, { at: [540, 1000], length: 720, orient: 'h', color: acc, width: 3 });
```

## 容易踩的坑

- **顺序**：`highlight` 在文字之前画（底色垫底）；其他标注在文字之后画（线压在字上）。
- **整笔涂抹**：`highlight` 按 `rect` 从词头到词尾一笔扫过，上下边缘抖动、两端略收，不是规矩的圆角色块；`rect` 给整段词/句的范围，不要按单字拆调用。
- **`bend` 的符号**：正负决定弧拱向 `from→to` 连线的哪一侧；想清楚再写。
- **下划线、分割线只有轻微手感**：只叠低频扰动，不要调成大波浪；删除线始终是直线，`from/to` 要对准文字中线，`double` 只是平行复制。
- **圈和框是不规则轮廓，不是抖线**：变化只来自 2、3 次低频轮廓形变；框会先密采样再变形，避免只把四个角拉歪。
- **对勾、叉的手写感来自笔势和提按**：`check` 的两条二次曲线共享折点并合并为一笔，整体 `taper:'end'` 收尖；`cross` 用微弧粗笔与圆润端点。不要加逐点抖动。
- **数字圈要稳**：`numberCircle` 只有 2、3 次低频轮廓；所有标注都关闭 pen 的逐点高频扰动。
- **云朵扇贝**：`box.shape:'cloud'` 的扇贝幅度是内部质感，不暴露强度参数；只调 `radius`、`width` 和位置。
- **不要超线宽规范**：线宽用 `RULES.stroke` 的三档（见白板 contract），标注是“中档”的典型消费者。
- **确定性**：不要在参数里放 `Math.random()`（静态扫描会拦），要变化用 `seed`。
- **墨迹框**：mark 的框自动并入场景 bbox，供 `tt probe` 和 12 格联系表定位；画出安全框不再自动判 must。

## 扩展词条

照 `mark.js` 内现有词条的模式：生成中心线点列 → 交给 `TT.pen.stroke`（或填充后调 `TT.pen.addBox`）→ 返回 `{ box, length }`。在 `entries` 里加 `desc` 和 `when`。禁止在词条里内嵌题材（“画一条鱼”不是词条，`arrow` + `circle` 组合才是）。

手绘形变统一用 `smoothWobble` / `loopPoints` 的低频正弦，不要给单个词条另造一套抖动参数；短元素先用 `shortAttenuation` 衰减幅度。
