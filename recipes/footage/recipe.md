# footage · 实拍

通过 Pexels 检索或本地视频素材拼接成完整短片。真实素材铺满画幅，只压一两行硬短句；靠镜头切换与素材本身讲事实，不靠手绘。

选中本 recipe 后，这份文档就是创作纲要：recipe 只规定固定版式与素材检索意图，题材与叙事由 storyboard 自由组织。

## 内容怎么写

- 每场只写 `scene.params`；`footage/template.js` 固定满幅 cover，禁止缩成卡片。
- `title` 是压屏短句，分行只用 `\n`；不要让自动折行决定断句。
- `keywords` 只描述检索意图，不要写素材名或 Pexels id 当题材枚举。
- 字幕固定 `perchar`、`band: false`，位于底部进度条上方；压屏 `title` 只提炼画面短句，不重复 narration。
- 使用 `pexels:` 查询时必须先配置 `PEXELS_API_KEY` 并执行 `tt assets fetch`；无 key、检索或下载失败会直接报错，不会替换成内置素材。使用本地视频时不需要 Pexels key。

## 视觉与数值依据

- 调色板固定在模板内：深棕黑底（`#0E0C0A`）、暖白字（`#F0ECE4`）、暗红强调（`#C0392B`）；recipe 不声明颜色。
- `rules.safeMargin: 0.055`；压屏字用模板基准字号，不再叠第二层标题。
- 素材上只用发丝线与细分割线。
- `captions.style: "perchar"`、`band: false`、`top: 0.83`，无字幕背景；`audio.mood: "soft"`，音量 0.1，淡入 2s / 淡出 2.6s。
- 素材检索、缓存、署名与降级链见 `references/pexels.md`。

## 章节进度

- 底部固定显示 `56px` 高的全片章节进度条，使用 `TT.progress.chapters`，不再另写模板内进度实现。
- 每场就是一章，`params.kicker` 同时作为章节名；章节宽度按该场实际时长占全片的比例计算，旁白改变时长后自动更新。
- 前景按 `FILM.start + g.t` 连续推进，不会每场重新从 0 开始；进度条不参与单场淡入淡出。
- 该组件只用于视频画面，不提供点击跳转或 hover tooltip。

## 字体

压屏字与模板内文字用 `sans-900`，细标注用 `sans-400`；两族字体都在 `template.resources` 声明，模板代码里直接写 manifest 键。

## 骨架样例

《第一班车》两场：天还没全亮，街上已经有第一班车 / 窗户一扇扇亮起来，一天就这么开始。
每场一段满幅实拍，一句压屏短句，硬切衔接。
