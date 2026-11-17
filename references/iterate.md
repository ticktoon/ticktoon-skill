# 反馈、预览与配音

1. 用户反馈后**改 storyboard 重新编译**，不要手改 `out/` 下任何产物。
2. 全片视觉检查与改稿复查只跑 `tt qa` 并读取 `review/qa-sheet.png`。`must=0` 且联系表无明显问题后**直接打开 Preview Studio**，结束自动检查；不要为确认构图、稳定帧、透明度或“再看看高潮/收尾”追加 `stills`。只有用户指定时刻，或已经确认一个具体缺陷、需要该时刻布局凭据（receipts）定位重叠/出界时，才跑 `tt stills <t…>`。
3. 预览是默认交付点：无需修改时点「完成预览」，需要改稿时逐帧画笔画选、写描述并发送批注。完成预览会写入当前 storyboard 的预览凭据并关闭服务；批注则写入 `<工程>/annotations/<batch>/request.json` + 每条三张 PNG。若预览是你的命令启动的，退出时会直接打印批注批次；否则跑 `tt annotations --dir <工程> [--json]` 读最新未处理批次，`--all` 看历史。用 Read 打开每条 `images.annotatedFrame`，结合 `desc` / `t` / `clip` 定位要改的场；改 storyboard 重新 `build → qa → preview`，处理完跑 `tt annotations --ack <batch>`。不要手改 `annotations/`，不要依赖页面 `window` 事件。预览命令返回后等待用户，不自动渲染。
4. `--tts edge`（或 volc）接真实配音。**只有带 `--tts` 的 build 才会生成 narration 音轨；不带时按 4.6 字/秒估时并出 `NARRATION_ESTIMATED` 提示，导出的 MP4 只有 BGM/SFX。** 预览页不回放音频，要听旁白必须导出 MP4；`render` 发现「有字幕 cue 但无 narration 音轨」会提示补救命令。
5. 最初的“制作 / 生成视频”不等于导出指令。只有用户在预览后另外明确要求导出 MP4 时才运行 `scripts/render.mjs`。render 默认要求当前 storyboard 已完成预览；配音重编译不失效，改稿会失效。只有用户明确要求跳过预览时才传 `--without-preview`。

完整的 QA 与联系表读法见 `references/qa.md`。
