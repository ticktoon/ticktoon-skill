# 生成式音频

`platform/audio` 把 Ticktoon 的时间轴转成乐谱与音效 plan，在 Node 构建期合成 WAV。没有输入音频素材，也不经过 `assets/bgm` / `assets/sfx` manifest。

## 模块

- `upstream/bgm.mjs`：轻量配乐，四种风格，含章节与旁白 duck。
- `upstream/music.mjs`：完整乐谱、画面重音、乐器层、音效、混音与检查。
- `upstream/sound.mjs`：参数化材质音效、变体、声像、共享空间。
- `upstream/scores/`：代码乐谱，不是音频素材。
- `presets/`：recipe 共享的生成参数。`chronicle-*` 是纸上剧场的默认预设。
- `index.mjs`：Ticktoon plan → 音频 plan → 缓存 WAV → composition events。

生成式音频代码在本仓库内实现；公开发布前需确认 `assets/` 中字体、BGM、SFX 的授权与署名。

## recipe 配置

完整配乐与音效：

```json
"audio": {
  "generator": "score",
  "scorePreset": "chronicle",
  "soundPreset": "chronicle",
  "bpm": 84,
  "seed": "paper-chronicle",
  "voiceRms": 0.07,
  "duckDb": 8,
  "gapDb": 11
}
```

轻量配乐：

```json
"audio": {
  "generator": "bgm",
  "style": "history",
  "soundPreset": "chronicle"
}
```

`score` 模式输出一条已混好配乐和音效的 accompaniment；`bgm` 模式输出 music bed 与独立 effects 两轨。它们都已经包含人声 duck，**不能再次经过静态 BGM duck**。

## 生成式音效事件

正式 storyboard 使用 cue 相对时间：

```json
{
  "type": "impact",
  "cue": 3,
  "offset": 1.5,
  "gain": 1.4,
  "keep": true
}
```

emit 在 TTS 时长确定后换算为 `at = cues[cue].start + offset`。也可直接写绝对 `at`。可选参数：`gain / dur / dir / size / pan / keep`。

`type` 是声音设计语义，不是 manifest 键；实际波形由当前 preset 和事件参数生成。ref-shot 的演示 cue 不进入编译期，因此 ref-shot 使用与演示时间轴一致的绝对 `at`。

## 人声与缓存

第一版使用固定 `voiceRms: 0.07`，不解码 TTS、不调用 FFmpeg。旁白行仍来自真实 planned cues。

正式工程写到 `<工程>/out/audio/`；`write:false` 的 audit/分析构建统一写到根目录 `output/audio/`，不能写进 `recipes/<id>/`；lab 写到 `output/lab/audio/`。文件名由生成器、预设、plan 和适配器版本 hash 决定；描述未变化时直接复用。这些文件都是构建产物，不是素材库。

混音分析作为 `nice / AUDIO_MIX` 诊断写入 report，不阻止构建。最终 LUFS 不在本模块内，仍属于导出后工序。
