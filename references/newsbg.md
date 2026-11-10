# 新闻背景 kit `TT.newsBg`

公共实现位于 `platform/kit/newsbg.js`，由 `platform/kit/index.json` 注入为 `TT.newsBg`。它只画新闻底：径向蓝底、世界地图、120px 网格与十条种子流动线；不画标题、来源、品牌或任何正文。`scene.news` 用它实现固定竖版新闻模板，其他新闻 recipe 也可以复用同一套底。

## API

```js
TT.newsBg.paint(ctx, {
  W,
  H,
  image,      // api.img('news-world-map') 或 null
  time: 0,    // 流动线时间；必须逐帧推进才会流动，传常量则静止
  alpha: 1,   // 整层透明度，与 element 的 g.a 相乘
  mapAlpha: 0.3,
  grid: 120,
  seed: 7,
});
```

- `image` 缺失或尚未加载时只跳过地图层，背景其余部分照常绘制。
- 所有随机参数由 `seed`（默认 7）固定；画幅相同、时间相同，输出逐像素一致。
- `TT.newsBg` 依赖 `TT.rng`，`platform/kit/index.json` 已声明 `requires: ["num"]`，emit 会递归注入。

## 固定视觉

- 径向渐变中心 `(0.5W, 0.15H)`，半径覆盖四角；色标 `#0078F2 / #0048C2 / #002277 / #000F42`，位置 `0 / 0.4 / 0.7 / 1`。
- 世界地图以 `contain` 放进 `0.9W × 0.45H` 的居中框，透明度 `0.3`。
- 网格间距 `120px`（按画幅缩放），`rgba(255,255,255,0.2)`，线宽 1。
- 十条流动线长度 400–600、速度 80–380、角度 ±0.7、透明度 0.35–0.65、线宽 1.8；所有数值按 `min(W,H)/1080` 缩放。固定 seed 只固定起点与参数，位置由 `time` 驱动，传常量时画面静止。

## 在 block 里复用

`block.json` 现在支持块自带固定资源，emit 会把它们直接放进本场 `resources[]`。`scene.news` 的声明：

```json
"resources": [
  { "type": "image", "name": "news-world-map", "src": "skill:assets/image/world-map.png" }
]
```

draw.js 里用 `g.api.img('news-world-map')` 查询，不需要作者在 storyboard 里再传路径。

## 在 `scene.code` 里复用

code 场没有 block 元数据，资源必须在 storyboard 的 `scene.resources` 里声明：

```json
"resources": [
  { "type": "image", "name": "news-world-map", "src": "skill:assets/image/world-map.png" }
]
```

```js
TT.newsBg.paint(ctx, {
  W,
  H,
  image: api.img('news-world-map'),
  time: api.t,
  alpha: 1,
});
```

新增新闻 recipe 时优先复用这一个 kit，不要复制背景 draw.js。背景版式属于公共视觉资产；如果某个 recipe 确实需要另一套底，先按 `references/mark.md` 的扩展流程提出，并说明为什么不能通过现有参数满足。
