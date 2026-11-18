# 运行时参考

这里只放 Agent 创作时直接查阅的 API、流程与 kit 契约。架构、历史、基准与运维资料属人类开发文档，不进运行时。

一篇一个能力，文件名即能力名。公共 kit 的命名空间与成员以 `platform/kit/index.json` 为准；新增 kit 必须同时新增 `references/<kit>.md` 并登记到下方索引，否则 Agent 无法查到它。

- `storyboard.md`：storyboard 唯一手写文件的契约
- `ticktoon-authoring.md`：引擎级 scene API 与扩展契约
- `authoring-code.md`：`scene.code` 写作、注入与验收
- 具体 recipe 目录里的 `recipe.md` / `ref-shots/`：该 recipe 的创作纲要、物理规范与可运行范例，选中该 recipe 后才读
- `qa.md`：交付前检查、12 格联系表读法
- `iterate.md`：反馈、预览圈注与 TTS 语义
- `pexels.md`：实拍素材检索、缓存与降级
- `captions.md` / `mark.md` / `pen.md` / `board.md` / `newsbg.md` / `transition.md`：公共 kit 参数与用法
