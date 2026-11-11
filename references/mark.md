# TT.mark 标注 kit

公共实现位于 `platform/kit/mark.js`，由 `platform/kit/index.json` 注入为 `TT.mark`。场景 code 里画箭头、圈、波浪线、涂底色**一律用 `TT.mark`，禁止手写贝塞尔控制点和自己的抖动**。

第一原则：所有线条类词条都走 `TT.pen.stroke` 出笔，自动继承笔的质感（粉粒、墨晕）、手绘抖动（确定性）、笔身跟随与墨迹框上报。填充类（`highlight`）不走笔画，但通过 `TT.pen.addBox` 并入墨迹框，qa/verify 照样能判它越界。

## 统一参数

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `pen` | enum | `'marker'` | 转调 `TT.pen.stroke` 的笔种 |
| `width` | number | 3.2 | 线宽 |
| `color` | string\|null | `null` | null 取 kit 默认墨色（铅笔灰）；强调类词条默认取 kit 的陶土红 |
| `alpha` | number | 1 | 整体透明度 |
| `seed` | number | 0 | 抖动种子，**确定性**：同 seed 同参两次调用结果逐像素一致 |
| `progress` | number | 1 | 0→1 渐进绘制，配合书写节拍（`seal` 除外：印章是"砸"上去的） |

每个词条返回 `{ box: {x,y,w,h}, length }`（画布坐标墨迹框），失败返回 `null`。

## 8 个词条

`TT.mark.list()` 返回全部词条与适用场景：

| id | 关键参数 | 什么时候用 |
|---|---|---|
| `arrow` | `from`, `to`, `bend`(带符号曲率), `head:'open'\|'solid'\|'none'`, `double` | 指向方向、增长、因果；`double` 画手绘双线 |
| `circle` | `at`, `rx`, `ry`, `rotate`, `closure:0.16`, `laps:1.08` | 圈住人物/数字/局部；闭合多绕 8–16%，起止点错开，像人手圈的 |
| `box` | `rect`, `radius`, `shape:'rect'\|'round'\|'cloud'` | 框住一段文案；云朵用于概念/气泡 |
| `wavy` | `from`, `to`, `amp:6`, `freq:5`, `phase` | 波浪线强调；别用在长段落 |
| `highlight` | `rect`, `color`, `alpha:0.28`, `mode:'fill'\|'pen'`, `grow:0.06` | 重点涂底色；**必须先 highlight 后写字** |
| `underline` | `from`, `to`, `offset:0.14`, `slack:0.06` | 微弯下划线，比波浪线收敛 |
| `strike` | `from`, `to`, `double` | 划掉错误说法、做前后对比 |
| `seal` | `at`, `text`, `shape:'circle'\|'square'`, `rotate:-0.08`, `size:0.10` | 盖章式结论、已核实角标 |

```js
TT.mark.arrow(ctx, { from: [300, 880], to: [700, 880], bend: 0.18, head: 'solid', color: acc });
TT.mark.circle(ctx, { at: [960, 900], rx: 90, ry: 46, pen: 'marker', color: acc });
TT.mark.highlight(ctx, { rect: [300, 500, 560, 80], color: acc, alpha: 0.3, mode: 'fill' });
TT.mark.seal(ctx, { at: [1650, 540], text: '重点', shape: 'circle', color: acc });
```

## 容易踩的坑

- **顺序**：`highlight` 在文字之前画（底色垫底）；其他标注在文字之后画（线压在字上）。
- **`bend` 的符号**：正负决定弧拱向 `from→to` 连线的哪一侧；想清楚再写。
- **不要超线宽规范**：线宽用 `RULES.stroke` 的三档（见白板 contract），标注是"中档"的典型消费者。
- **确定性**：不要在参数里放 `Math.random()`（静态扫描会拦），要变化用 `seed`。
- **墨迹框**：mark 的框自动并入场景 bbox，供 `tt probe` 和 12 格联系表定位；画出安全框不再自动判 must。

## 扩展词条

照 `mark.js` 内现有词条的模式：生成中心线点列 → 交给 `TT.pen.stroke`（或填充后调 `TT.pen.addBox`）→ 返回 `{ box, length }`。在 `list` 里加 `desc` 和 `when`。禁止在词条里内嵌题材（"画一条鱼"不是词条，`arrow` + `circle` 组合才是）。
