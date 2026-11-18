# TT.transition 双帧转场

转场是编译器生成的独立 `code scene`，不是前场末尾与后场开头分别叠加两个效果。前后场各自绘制到一张离屏 Canvas，`TT.transition` 再对两张完整画面进行合成，因此方向擦入和推移不需要经过黑色间隙。

公共实现：`platform/kit/transition.js`。固定预设：`platform/compile/transitions.mjs`。视觉展开：`platform/compile/transition-scenes.mjs`。

## storyboard 只选预设

把 `transition` 写在边界的前一场：

```json
{
  "scenes": [
    { "id": "s01", "duration": 4, "transition": "push-up", "code": "/* 前场完整画面 */" },
    { "id": "s02", "duration": 4, "code": "/* 后场完整画面 */" }
  ]
}
```

不写就是硬切。最后一场不能声明转场；前后两场都必须是 `scene.code`，params 场不使用双帧转场。作者不配置时长、圆心、中间色或出入场词条；擦入和推移的方向直接由预设名区分。

## 固定预设

| id | 双帧效果 | 固定时长 | 使用建议 |
|---|---|---:|---|
| `dip-fade` | 前后场直接交叉淡化，不经过黑屏或暗场 | 0.35s | 柔和衔接、连续叙事、章节切换 |
| `wipe-left` | 后场从右向左擦入，前场始终留在底层 | 0.50s | 利落的横向段落切换 |
| `wipe-up` | 后场从下向上擦入，前场始终留在底层 | 0.50s | 榜单上升、层级递进 |
| `push-left` | 前场向左推出，后场从右侧同步推入 | 0.55s | 换地点、横向推进 |
| `push-up` | 前场向上推出，后场从底部同步推入 | 0.55s | 上升、升级、纵向推进 |
| `zoom-pop` | 前场缩小淡出，后场推近落定 | 0.55s | 强调新结论、节奏转折 |
| `glitch` | 前场故障切片消散，后场恢复 | 0.45s | 数据中断、强转折；不要连续使用 |
| `iris` | 圆形窗口从中心打开，直接揭示后场 | 0.65s | 聚焦、揭示、观察对象切换 |
| `squares-wire` | 10×10 圆角方格按原 shader 的 smoothness 从左上向右下逐渐填满，最终无空隙 | 0.60s | 科技、模块化内容、界面切换 |
| `morph` | 双帧分条错位、波形扭曲并交叉淡化 | 0.70s | 形态变化、柔和变形、概念转化 |

时长不开放参数，也不做 40% 动态缩放。编译器只检查场景扣除相邻转场各一半后仍有正常画面；过短则报 `TRANSITION_SCENE_TOO_SHORT`。

`when` 只是选择建议，不会自动给场景添加转场。recipe 的 `when` 同样只用于选择 recipe。

### GL 风格图案转场

`page-turn` 已暂时从编译器预设表和 Kit Lab 停用，storyboard 不再接受该预设；底层实现保留，待后续重做。

`squares-wire` 和 `morph` 参考 GL Transitions 的视觉结构，用确定性的 Canvas `Path2D`、clip、分条绘制和透明度合成实现，不启动 WebGL，也不执行 GLSL。

`squares-wire` 使用 `10×10` 网格，并对齐原 shader 的 `direction = vec2(1.0, -0.5)` 与 `smoothness = 1.6`：每个单元格的 inset 随 smoothstep 从完整缩小到 0，后场从左上向右下逐渐填满。圆角随 inset 一起收为 0，没有固定 padding、描边或末尾补盖，结束时每个单元格都完整显示后场。

其中 `Morph.glsl` 原本依赖两张画面的逐像素颜色来计算位移；当前 Canvas 版不做像素回读，因此使用双帧分条反向位移、轻微缩放与交叉淡化保留形变观感，而不是宣称逐像素复刻原 shader。

## A' + T + B'：画面与声音分离

设转场固定时长为 `D`，原切点为 `C`。编译器把原始逻辑场 A、B 展开成视觉节点：

```text
(A - D/2) + T(D) + (B - D/2) = A + B

A 正场       转场 T（以原切点 C 为中心）       B 正场
             ├──── D/2 ────┼──── D/2 ────┤
           C-D/2           C             C+D/2
```

转场场内部时间 `u = 0…D` 映射为：

```js
timeA = Math.min(A - D / 2 + u, A);
timeB = Math.max(0, u - D / 2);
```

前半段 A 继续、B 持首帧；后半段 A 持末帧、B 从 0 开始。进入 B 正场后，从 `D/2` 继续，不重播、不跳帧。两个相邻转场可以同时借用一个中间场的首尾，只要扣除后仍有正常画面。

声音和 SRT 使用另一份未拆分的原始逻辑场列表：

- 旁白、模板 SFX 的起点仍是原始 `scene.start + 本地时间`。
- BGM 总时长不变，ducking 仍按原始旁白事件计算。
- 转场场不生成、不复制音频事件。
- 总片长保持 `A + B`，不会因为插入 T 而增加。

## 画面是整体，不处理字幕特例

转场场分别调用前后场的完整 `draw(ctx, api)`。背景、人物、动画、自绘文字以及已经画进场景的内容都成为整帧像素；文字随画面一起推移、遮挡、形变或淡化。没有独立字幕层、字幕时间偏移或字幕合成分支。

## TT.transition 协议

正常 `scene.code` 不直接调用转场。编译器在转场场初始化时创建合成器：

```js
const renderTransition = TT.transition.create({
  W, H, type: 'push-up', dur: 0.55, color: '#10151d',
});

return (ctx, api) => {
  renderTransition(ctx, {
    t: api.t,
    a: { draw: drawA, api: apiA },
    b: { draw: drawB, api: apiB },
  });
};
```

`create()` 持有两张离屏画布，每帧完全清屏并重绘 A/B，再使用 `drawImage`、`Path2D`、`clip` 和 `globalAlpha` 合成。没有像素回读、`Math.random` 或帧间可变历史。环境不支持离屏画布时，降级为原切点硬切，不插入黑色或假装完成双帧效果。

`TT.transition.list()` 返回固定预设及用途。旧的 `TT.transition.out/in`、`pairs` 和 storyboard `transitionOut/transitionIn` 已移除；方向预设使用完整名字，不为旧的无方向名字保留别名。

## 使用节制

- 单场视频没有边界，不需要转场。
- 快闪、卡点等依赖硬切顿挫的 recipe 通常不声明转场。
- 不要每场都加；一部片只在有意义的边界使用。
