# TT.progress · 全片进度

`TT.progress` 放跨场景的播放进度组件。当前只有 `chapters`：按章节起始秒划分区段宽度，未播区使用背景色，已播与正在播放的区域共用前景色，填充右沿就是当前播放位置。

它只负责同步 Canvas 绘制，不实现点击 seek、hover tooltip，也不在内部创建动画或读取墙钟。

## `TT.progress.chapters(ctx, options)`

```js
TT.progress.chapters(ctx, {
  x: 0,
  y: H - 56,
  w: W,
  h: 56,
  time: FILM.start + api.t,
  duration: FILM.duration,
  chapters: FILM.chapters,
  fg: '#409EFF',
  bg: '#444752b3',
  textColor: '#ffffffed',
});
```

| 字段 | 含义 |
|---|---|
| `x / y / w / h` | 进度条矩形；贴底全宽时写 `x:0, y:H-56, w:W, h:56` |
| `time` | 当前帧的全片绝对秒数，不是单场 `api.t` |
| `duration` | 全片总秒数 |
| `chapters` | `[{ text, start }]`，`start` 是该章节的全片起始秒 |
| `fg / bg / textColor` | 前景、未播背景与文字颜色 |
| `fontKey / fontSize` | 默认 `sans-400 / 26`；字体必须在场景 resources 中声明 |
| `padX / safeX / divider` | 段内文字边距、首尾文字安全区、分界线宽度；默认 `12 / 70 / 3` |
| `dividerColor` | 默认 `#ffffff70` |

- 章节顺序保持作者输入，不暗中排序；倒退起点向前一章夹齐。
- 最后一段延伸到 `duration`。
- 文字按段宽截断并补 `…`，不为不同段落使用不同字号。
- 空 `chapters` 不绘制任何内容。
- 前景只随 `time` 线性前进，不取模、不循环、不额外做入场动画。

## 编译器提供的 `FILM`

构建时每场都会注入：

```js
FILM = {
  start,      // 当前场的全片起始秒
  duration,   // 全片总秒数
  chapters,   // 各场 { text, start }
}
```

章节名依次取 `scene.params.kicker`、`scene.note`、`scene.id`。code 场用 `FILM.start + api.t` 作为当前时间；params 模板可通过 `g.film` 读取同一份数据。

`FILM` 只提供时间轴数据，不会自动绘制进度条。只有场景显式调用 `TT.progress.chapters` 时才出现。后续其他进度形式应继续挂在 `TT.progress` 下，不新建平级命名空间。
