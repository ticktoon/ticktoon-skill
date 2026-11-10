# storyboard 契约

`<工程>/storyboard.json` 是 Agent 唯一手写的文件；`out/` 下的 composition、报告和视频都由编译器生成，不要手改。

```json
{
  "recipe": "whiteboard-explainer",
  "format": { "w": 1920, "h": 1080, "fps": 30 },
  "beats": { "hook": 0.4, "turn": 4.2 },
  "scenes": [
    { "id": "s01", "narration": "凌晨三点，城南一处仓库起火。",
      "bg": "paper",
      "code": [
        "TT.board.paper(ctx, api);",
        "const font = TT.font(STYLE, 132, 'display');",
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
- `at` 是秒（场景相对）或 `beats` 名；**beat 只能指向本场**，跨场是 error `BEAT_CROSS_SCENE`。
- `bg` 写 recipe `style.backgrounds` 里的背景名（或 `colors` token），不写色值。`camera` 包住元素、不包字幕。
- element 只保留 `block/slot/rect/at/dur/sfx/sfxAt`，其余是 block 参数，**未知键直接报错**。
- `recipe` 与 `format` 由 recipe 与工程决定；需要另一套规范时换 recipe，不要手改平台源码。
