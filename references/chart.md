# TT.chart · 图表几何

`TT.chart` 提供可复用的图表几何，不提供固定题材、整页模板或 GSAP 时间线。场景代码负责颜色、字体、标题、图例、数值取舍与 `api.t` 动画。

所有函数同步、确定、无 DOM / `document` / 帧历史；文字是否缩字或截断由调用方用当前 `ctx` 和 manifest 字体决定。

## 既有工具

```js
TT.chart.niceMax(173);            // 200
TT.chart.ticks(200, 4);           // [0, 50, 100, 150, 200]
TT.chart.bars(rect, rows, opts);  // 横向条形几何
```

## `columns(rect, rows, opts)`

纵向分类柱状图。`rows` 为 `[{ label, value }]`，最多 12 列，负数按 0 处理。

```js
const geo = TT.chart.columns(rect, rows, {
  max: 100,       // 省略时按数据最大值 niceMax
  minWidth: 44,  // 默认 44；整组超宽时整体等比缩小
  maxWidth: 126,  // 默认 126
  gap: 26,        // 默认列间距 26px
  valueGap: 12,
  labelGap: 18,
});
```

返回 `{ max, baselineY, bars[] }`。每列包含：

- `x / y / w / h / centerX / baselineY`
- `valueX / valueY`：柱顶数值锚点
- `labelX / labelY`：分类名锚点

柱高从同一基线生长；动画由场景用 `h = bar.h * progress` 和 `y = baselineY - h` 计算。标签、网格和标题不自动绘制。

## `radar(rect, opts)`

3–8 轴雷达图，支持单系列或多系列：

```js
const geo = TT.chart.radar(rect, {
  labels: ['性能', '易用性', '稳定性'],
  rings: 4,          // 2–6，默认 4
  max: 100,          // 省略时所有系列共享自动量程
  radiusRatio: 0.72, // 外圈半径相对 rect 短边一半
  series: [
    { name: '当前', color: '#38bdf8', values: [88, 72, 94] },
  ],
});
```

返回：

- `center / radius / max`
- `grid[]`：各圈多边形 `points`
- `spokes[]`：辐条 `from / to / angle`
- `labels[]`：轴名 `x / y / align / baseline`
- `series[].points[]`：`value / ratio / angle / x / y`

每个系列 `values.length` 必须等于轴数。两个系列使用同一量程，不生成双 Y 轴；多系列时场景应同时提供图例或其他非颜色识别方式。

## `pie(rect, rows, opts)`

饼图与环图共用。`rows` 为 `[{ label, value }]`，最多 8 项；通常建议不超过 6 项，更多类别合并为 `Other`。

```js
const geo = TT.chart.pie(rect, rows, {
  innerRadius: 0.55, // 外半径比例：0 = 饼图，>0 = 环图，最大 0.9
  radiusRatio: 0.72,
  gapPx: 6,          // 内外沿等宽缝，0 = 无缝
  progress: 1,       // 0–1，扇区按顺序重叠扫入
  overlap: 1.25,     // 相邻扇区动画重叠程度
  startAngle: -Math.PI / 2,
});
```

返回 `center / outerRadius / innerRadius / total / slices[]`。每片包含：

- `outerStart / outerEnd`：外弧起止角
- `innerStart / innerEnd`：内弧起止角
- `midAngle / value / pct`
- `label`：非零扇区的折线 `tip / break / end`、文字 `textX / nameY / pctY / align`；零值扇区为 `null`

场景绘制路径：

```js
for (const slice of geo.slices) {
  ctx.beginPath();
  ctx.arc(geo.center.x, geo.center.y, geo.outerRadius, slice.outerStart, slice.outerEnd);
  ctx.lineTo(
    geo.center.x + Math.cos(slice.innerEnd) * geo.innerRadius,
    geo.center.y + Math.sin(slice.innerEnd) * geo.innerRadius,
  );
  ctx.arc(geo.center.x, geo.center.y, geo.innerRadius, slice.innerEnd, slice.innerStart, true);
  ctx.closePath();
  ctx.fill();
}
```

`gapPx` 不是简单扣固定角度：内外半径使用各自的插入角，使间隙从内沿到外沿保持等宽。标签只提供几何，是否画折线、名称和百分比由场景决定。`progress` 使用与旧组件一致的重叠扫入节奏，不再让所有扇区同时从各自起点生长；轨道和外部标签可以全程保留，避免开场出现整片空白。

## 使用边界

- 颜色跟随实体，不因排名变化而改色；不要让字号、颜色、动画都来自 Kit 默认值。
- 坐标轴只能共用一套量程；不同量纲拆图，不做双轴。
- 饼图用于部分占整体，不用于比较非常接近的数值；此时改用柱状图。
- `bar-race` 是独立 params recipe，不属于 `TT.chart`，不要将其排名动画抽成通用预设。
- `TT.progress` 是全片播放进度，也不属于图表。
