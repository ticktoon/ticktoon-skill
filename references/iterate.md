# 反馈、预览与配音

1. 用户反馈后**改 storyboard 重新编译**，不要手改 `out/` 下任何产物。
2. 全片视觉检查与改稿复查只跑 `tt qa` 并读取 `review/qa-sheet.png`。`must=0` 且联系表无明显问题后**直接打开 Preview Studio**，结束自动检查；不要为确认构图、稳定帧、透明度或“再看看高潮/收尾”追加 `stills`。只有用户指定时刻，或已经确认一个具体缺陷、需要该时刻布局凭据（receipts）定位重叠/出界时，才跑 `tt stills <t…>`。
3. `tt preview` 首次作为长期后台任务承载服务，复用时输出 ready 即返回；可用 `--json` 获取 url / pid / composition。预览是默认交付点，导出通过对话发起。需要改稿时逐帧画笔画选、写描述并发送批注，批次写入 `<工程>/annotations/<batch>/request.json` + 每条三张 PNG，页面显示 2 秒半透明提示。打开或复用预览时启动全局唯一的 `tt annotations --wait`；新创作会替换旧等待任务。批注落盘后命令完成并带回批次，同一 Agent 继续修改；需要继续圈注时建立下一次等待，导出时结束等待任务。后续处理批注时，用 `tt annotations --dir <工程> [--json]` 读最新未处理批次，`--all` 看历史；先确认数量与逐条摘要，再用 Read 打开 `images.annotatedFrame`，结合 `desc` / `t` / `clip` 定位要改的场。改 storyboard 重新 `build → qa → preview`，处理完跑 `tt annotations --ack <batch>`。不要手改 `annotations/`，不要依赖页面 `window` 事件。
4. 首次 build / QA / preview 自动准备真实配音，上层不传 provider。内部在火山凭证齐备时使用 volc-tts，否则使用 edge-tts；相同 provider、音色和文案读取 `out/tts/` 缓存。预览页在用户点击播放后同时播放画面、旁白和 BGM。
5. 用户明确要求导出时直接对当前 `out/composition.json` 运行 `scripts/render.mjs`，不要求再次确认，**不得重跑 build / TTS / det，也不做任务 ID 或音频匹配校验**。只有 storyboard 更新时才生成新 composition；预览与导出始终使用同一份数据。render 默认 1×，`--render-scale 2` 仅用于用户明确要求的超采样画质档。

完整的 QA 与联系表读法见 `references/qa.md`。
