# 音频链：词级时间 / 空时长 / 电平口径

编译层的音频链路：`resolve`（TTS 合成，拿时长 + 词级时间）→ `plan`（切字幕 cue，逐字时间）→ `assemble`（音轨事件）。**全链路纯 JS，零外部二进制依赖。**

## 响度：引擎不做，导出后交给外部工具

引擎架构决策（`docs/ARCHITECTURE.zh-CN.md` §6.3）：母带响度归一不做，引擎不计算 LUFS，导出后交给外部工具；编译层只保证参数合法、事件不越界。

编译链只负责三件与音量有关的静态参数：`volume`、`fadeIn/fadeOut`、`duck`（duck 由 assemble 切成相邻事件实现）。需要母带级 `-16 LUFS / -1.5 dBTP` 时，在**导出之后**用外部工具处理成片音频，不在 build 阶段重编码素材：

- 不引入 ffmpeg / sharp / 任何 npm 音频包；
- 不覆盖 `out/tts/` 的旁白，不复制 `assets/bgm/` 的公共资产，不写 `*.loudness.json` 缓存；
- 编译链不解码音频、不做响度分析；`tt det --twice` 只比较规范化 `composition.json` 指纹，不证明音频字节、波形或 MP4 输出一致。

> 2026-11-08 曾把 ffmpeg loudnorm 双 pass 接进 build，实测把 build 从 1.5s 拖到 3.8s、多出 BGM 副本与缓存文件，收益只是约 7dB 的电平一致。已整段回退；本文件保留说明，避免后续又把它加回来。

## 词级时间

| provider | 词级时间 | 来源 |
|---|---|---|
| edge-tts | ✅ 实测 | 微软 WordBoundary 逐词时间戳，`scripts/providers/tts.mjs` 已捕获 |
| volc-tts | ❌ 无 | 流式接口未开时间戳，`words` 为 null |
| 无 TTS | ❌ 无 | 时长按 4.6 字/秒估算，逐字时间等比摊 |

edge 的实测时间经 `createTts().synthesize()` 以 `words: [{text, start, end}]` 返回（秒，相对语音起点），`plan.buildCues` 把它对齐回旁白文本：

- 对齐成功的 cue：`source: "words"`，逐字时间来自 WordBoundary——长句字幕不再与语音漂移（等比摊假设语速恒定，实际不是）。
- 对齐失败（字数或标点差异、words 缺失）：该场降级为字符等比摊，`source: "estimated"`，warn 一次 `CUE_WORDS_SKIPPED`。**不抛异常、不静默**。
- cue 上带 `source` 字段，进 `composition.json`，可逐条检查。

标点与未覆盖字符夹在相邻实测时间之间，且全部 clamp 进 cue 区间——逐字动画不会越过 cue 切换点亮到下一行。

## 空时长兜底

provider 返回 `durationSec: null`（如 volc 流式未带回传）时，`resolve` 按语速（`CHARS_PER_SECOND = 4.6` 字/秒 + 句末标点加 0.14s）估算时长，warn `TTS_DURATION_ESTIMATED`，场景照常成立。**不再落 `PLAN_ZERO_DURATION`**。静默场必须写 `duration`；旁白场由语音或估算链求时长，`narration` 与 `duration` 不能同时存在。

## 已知边界

- 首次 build / QA / preview 自动生成真实 narration 事件，内部按凭证选择 Volc 或 Edge，无需上层传 provider。预览点击播放后同时播放旁白与 BGM；预览和导出共享同一份 composition，导出不再重编译音频。
- volc-tts 打开 `enable_timestamp` 可拿词级时间，返回结构未核，接上后 `words` 自动生效，无需改上层。
- 词级对齐用 indexOf 前进式，旁白若含重复短句且 TTS 合并了相邻重复词，理论上有错位风险；覆盖率 <50% 会自动降级兜底。
- 不同 provider 的电平差异仍在（Edge 实测约 -23.85 LUFS），这是导出后工序要处理的事，编译层不管。
