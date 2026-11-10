# 反馈、预览与配音

1. 用户反馈后**改 storyboard 重新编译**，不要手改 `out/` 下任何产物。
2. 需要看布局事实时跑 `tt stills`：`out/report.json` 的 `receipts` 给每个元素的真实墨迹框 `[x,y,w,h]`，重叠/出界/字幕区判定都用它，不靠肉眼。
3. 预览批注是闭环的：用户在预览页底部批注坞逐帧画笔画选、写描述，点「完成批注」先进入页面内的待发送列表（可删、可继续标下一帧）；点「发送批注」后整批 POST 到预览服务，写入 `<工程>/annotations/<batch>/request.json` + 每条三张 PNG（不是 `out/`），随后预览自动关闭，控制权回到启动它的会话。若预览是你的命令启动的，退出时会直接打印该批次；否则跑 `tt annotations --dir <工程> [--json]` 读最新未处理批次，`--all` 看历史。用 Read 打开每条 `images.annotatedFrame` 理解笔迹，结合 `desc` / `t` / `clip` 定位要改的场；改 storyboard 重新 `build` 后再 `tt preview`，处理完跑 `tt annotations --ack <batch>` 标记整批已处理。不要手改 `annotations/`，也不要依赖页面的 `window` 事件。
4. `--tts edge`（或 volc）接真实配音。**只有带 `--tts` 的 build 才会生成 narration 音轨；不带时按 4.6 字/秒估时并出 `NARRATION_ESTIMATED` 提示，导出的 MP4 只有 BGM/SFX。** 预览页不回放音频，要听旁白必须导出 MP4；`render` 发现「有字幕 cue 但无 narration 音轨」会提示补救命令。
5. 用户明确要求导出时才运行 `scripts/render.mjs`；不要自动渲染。

完整的 QA 与联系表读法见 `references/qa.md`。
