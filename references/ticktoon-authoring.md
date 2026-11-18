# Ticktoon v1.0 authoring contract

本文是平台扩展（写 recipe `template.js` / 改 captions）时的场景代码契约，不是日常创作入口。日常只写 `storyboard.json`。编译产物是 protocol v1.0 `composition.json`（`scenes[]` + `audio[]`）；场景代码直接使用下述 Canvas/Three API。

## Canvas scene

`code` 是同步函数体，每帧接收 `ctx` 与冻结的 `api`：

- `api.t`：当前场景内相对秒数。
- `api.d`：当前场景时长。
- `api.W` / `api.H`：逻辑尺寸。
- `api.cues`：当前场景内相对时间的只读 cues；每项含 `chars: [{text,start,end}]`，字符时间同样是场景相对。没有字符时间戳的来源使用空数组。
- `api.seed` / `api.rng()`：确定性种子和每次返回的新 RNG。
- `api.img(name)`：读取 `resources` 中同名 `type: 'image'` 的已预载图片。
- `api.video(name)`：读取 `resources` 中同名 `type: 'video'` 的当前帧；宿主还没发布这一帧时返回 `null`，跳过绘制即可。**只能在 draw 里读**，初始化阶段读一次会永久停在 `t = 0`。

禁止使用墙钟、`Math.random()`、异步绘制、帧间可变历史和 Canvas 像素回读。数学助手使用下方 `TT`，不要假设 `api` 提供 `ease`、`lerp`、`clamp`、`cover` 或 `contain`。

`platform/compile/emit.mjs` 在 scene 前拼接 `TT` 与 `CAPTIONS`（有字幕时），都按 IIFE 挂到全局，只注入本次用到的成员（`new Function('ctx','api', code)` 没有 import）。可用的 `TT` 成员：`TT.ease.*`（缓动）、`TT.clamp01` / `TT.num.fmt` / `TT.env.fade|reveal` / `TT.rng`（数值与包络）、`TT.text`（中文优先断行 + 量测 + 墨迹框）、`TT.font`（本场字体资源键查询，`font().css` 的族名恒等于 `resources[].name`），以及场景 kit `TT.chart` / `TT.pen` / `TT.mark` / `TT.board` / `TT.geom`。`TT.transition` 只由编译器注入独立双帧转场场，普通 `scene.code` 不直接调用。code 场额外注入 `FONTS` 与 `RULES`；params 模板在顶层定义 `function draw(g, p)`，每帧由 emit 传入整帧 `G0` 与 `scene.params`，资源来自 `template.resources`（字体同样在模板代码里写 manifest 键）。params 模板不注入 `RULES`。

## Three layers

场景仍然是一段 Canvas 函数体。要 3D，就在初始化阶段开一块区域，拿到自带 scene、camera 和 `draw(ctx)` 的图层：

```js
const hero = api.three({ rect: { x: api.W * 0.55, y: 80, width: api.W * 0.4, height: api.H - 160 } });
const mesh = new api.THREE.Mesh(new api.THREE.BoxGeometry(1, 1, 1), new api.THREE.MeshNormalMaterial());
hero.scene.add(mesh);

return (ctx, api) => {
  mesh.rotation.y = api.t * 0.6;
  hero.draw(ctx);          // 画在这一行：之前的是底，之后的是面
  ctx.fillText('叶片组件', 96, 140);
};
```

- 用 `api.three()` 的 params 模板必须在 `template.needs.three` 写 `true`，否则宿主不注入 Three，`api.THREE` 是 `undefined`。
- `rect` 同时决定位置和相机宽高比，所以「左边文字、右边模型」不需要第二块画布，也不需要手动偏相机。
- 一个场景可以有多个图层，各自独立相机。
- 3D 对象必须跨帧存在，所以场景函数体必须**返回一个 draw 函数**（两段式）。什么都不返回表示每帧执行，此时调用 `api.three()` 会直接报错。
- 图片可以直接当纹理：`new api.THREE.Texture(api.img('logo'))`。字体走 `api.canvas()` + `CanvasTexture`：`api.canvas(w,h)` 只收逻辑尺寸，返回 `{ ctx, canvas, width, height, blit }`——`ctx` 已按逻辑坐标建好变换，`canvas` 才是传给 `CanvasTexture` 的原生画布，贴回场景用 `blit(ctx,x,y)`。初始化时建一次，每帧重画内容。倍率由引擎吸收，不要去找 `api.scale` 这类字段。
- 全 composition 共用一个 `WebGLRenderer`，clip 只持有 scene、camera 和自己的资源，`api` 不暴露 renderer。

## Timeline

composition 只有两个顶层字段：

| 字段 | 顺序 | 说明 |
|---|---|---|
| `scenes[]` | 有序、连续 | 每场从 0 开始按场景相对时间画满整帧；`duration` 之和必须等于 composition `duration` |
| `audio[]` | 无序 | 绝对时间线的事件表，`at` 是 composition 绝对秒；重叠即混音 |

- 场景起点由编译期按顺序累加，画幅继承 composition。
- 每个场景有唯一 `id`；`background` 默认 `"#000000"`，`seed` 默认 `0`，`cues` 默认 `[]`。
- 所有 cues 都是场景相对；每个 cue 必须带 `chars` 数组，来源没有逐字边界时为空数组。
- 图片、字体、视频都在**场景自己的** `resources` 里声明。字体只写 manifest 键 `{type:"font", name:"sans-400"}`，`src` 由编译期补齐；图片/视频写 `{type, name, src}`，视频额外可带 `start`（源内偏移，默认 0）。图片/视频的 `name` 对应 `api.img(name)` / `api.video(name)`，字体的 `name` 就是 `family`。params 模板的字体写 `template.resources`。
- 同一个字体在多个场景声明是正常写法，引擎按 `src` 只下载一次。
- 音频是 `audio[]` 里的扁平事件，不是资源：`{ src, at, duration, role, volume, sourceStart, fadeIn, fadeOut }`。`role: 'bgm'` 会在比文件长时循环。
- 音频事件不得越过 composition 时长。

## Execution policy

默认只编译并启动只读预览，等待人工审片。不要自动导出 MP4 或例行抽帧。只有用户明确要求渲染时才执行 render；诊断工具也是按需调用，不属于 recipe 规范。
