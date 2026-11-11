# storyboard 契约

`<工程>/storyboard.json` 是 Agent 唯一手写的文件；`out/` 下的 composition、报告和视频都由编译器生成，不要手改。

```json
{
  "recipe": "whiteboard-explainer",
  "format": { "w": 1920, "h": 1080, "fps": 30 },
  "scenes": [
    { "id": "s01", "narration": "凌晨三点，城南一处仓库起火。",
      "code": [
        "TT.board.paper(ctx, api);",
        "const font = TT.font(FONTS, 132, 'display');",
        "ctx.font = font.css;",
        "const lines = TT.text.wrap(ctx, '凌晨三点，仓库起火', W - 2 * W * 0.08);",
        "lines.forEach((line, i) => {",
        "  TT.text(ctx, line, W / 2, H * 0.42 + i * font.lineHeight, 132, { role: 'display', align: 'center' });",
        "});"
      ] }
  ]
}
```

- **`narration` 与 `duration` 结构互斥**：有旁白写旁白（时长 = leadIn + 语音 + hold），静默场写 `duration`。两个都写直接报错。
- 场景起点由编译器按数组顺序累加，总时长是各场时长之和。
- 场景没有 `bg` 字段：背景由 `scene.code` / params 模板自己铺满整帧。`camera` 包住场景内容、不包字幕。
- 场景只收 `id / narration / duration / camera / code / params / resources / note / transitionIn / transitionOut`，**未知键直接报错**。
- `mode: "code"` 的 recipe：场景写 `scene.code`，不能写 `scene.params`；`mode: "params"` 的 recipe：场景写 `scene.params`，不能写 `scene.code` / `scene.resources`。两种内容互斥，`SCENE_CONTENT_CONFLICT` / `SCENE_CONTENT_MISSING` 会指出问题。
- `scene.params` 的键与类型由 recipe 的 `template.params` 决定；必填缺失、类型不符、超出 `maxChars` / `maxItems` 都会在编译期报 `PARAM_*`。
- `recipe` 与 `format` 由 recipe 与工程决定；需要另一套规范时换 recipe，不要手改平台源码。
