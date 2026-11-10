# TT.pen 公共笔库

公共实现位于 `platform/kit/pen.js`，由 `platform/kit/index.json` 注入为 `TT.pen`。场景 block 只提交路径、时间与笔种，不另写笔尖跟随、笔具显隐或笔迹纹理。

## 内置笔种

`TT.pen.list()` 按以下顺序返回 6 种笔：

| id | 名称 | 笔迹与笔具 |
|---|---|---|
| `marker` | 马克笔 | 圆头粗线，粗黑笔身与方形笔头；白板默认 |
| `pencil` | 铅笔 | 较细的石墨线与确定性颗粒，黄色六棱木杆 |
| `brush` | 毛笔 | 中锋提按、起收较细，竹杆与白毫 |
| `inkbrush` | 水墨笔 | 饱满软毫、渐细笔锋，深色竹木杆；墨色可配 `color`，行笔提按更明显，边缘有极轻微墨晕 |
| `chalk` | 粉笔 | 断续粉粒与较宽线迹，白色短圆柱 |
| `fineliner` | 细线笔 | 均匀细线、平端点，细长深色笔身 |

`inkbrush` 的墨晕是低透明度、略宽的同色底层，不用 `shadowBlur` 或亮色外发光。它面向水墨／国风场景；现有 `brush` 仍保留竹杆白毫的毛笔观感。

## 默认固定笔身朝向

所有内置笔都默认 `rotate: 'fixed'`：笔尖锚在当前实际笔迹末端，笔身始终相对竖直方向向右倾 **35°**，因此笔杆向画面右上方延伸，笔尖朝左下落在纸面上。

固定朝向模拟真人书写时相对稳定的手腕角度，避免笔身在曲线、圆圈和回折处随笔迹方向突然翻转。只有笔尖位置跟随路径，笔身朝向不跟随；需要旧版方向跟随行为时，显式设置 `rotate: 'follow'`。

```js
TT.pen.stroke(ctx, pts, 0.6, {
  pen: 'inkbrush',
  color: '#202923',
  width: 16,
  rotate: 'fixed', // 可省略，默认就是 fixed
});

TT.pen.track(ctx, [
  { pts, at: 0.2, dur: 1.4, pen: 'marker' },
  { pts: circle, at: 1.9, dur: 0.8, pen: 'inkbrush', rotate: 'follow' },
], sceneT);
```

`stroke` 与 `track` 都支持 `rotate`；`track` 在每一笔上分别设置。其他常用参数为 `color`、`width`、`seed`、`dash`、`ease`。

## 显隐规则

- 起笔进度大于 0 且尚未画完时，笔具显示在真实笔迹末端。
- 一笔完成后仅在约 **80ms** 内淡出；两笔之间的空档不显示笔具。
- 多笔并发时，只显示 `at` 最新的未完笔；同一 `at` 取数组后项。
- 没有未完笔时才选择收笔淡出的笔，因此后续空档和片尾不会残留笔具。

六种笔的效果由 `TT.pen` 的 `style` 参数直接控制；`scene.pen-demo` 是开发对照用的 _lab block，不进入正式 recipe。
