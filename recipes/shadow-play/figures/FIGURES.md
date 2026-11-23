# 皮影素材索引（ref-shot 母版）

本目录是 shadow-play 参考镜头的**机器可读造型库**。正式制作时，应在当前工程建立自己的 `figures/`，不要把这些示例人物当成固定题材枚举。

## 定妆流程

1. 先列本场人物，确定 `kind / look / colors / scale`，写入 `cast.json`。
2. 为每个 `kind` 准备一份基础皮片到 `archetypes/`。
3. 每场在 `scene.resources` 声明 cast、所需 archetype 与 props。
4. 用 `TT.shadow.cast(api.data('cast'), { official: api.data('official'), ... })` 建角色表；整场只按角色名取用。
5. 同帧两人至少在脸色、须发、头饰、袍色、体型中差两项。

## 当前母版人物

| 角色 | 基础 | 主要识别 | 袍色 |
|---|---|---|---|
| 刘邦 | official | 秦汉长冠、全须、红脸 | 朱红 |
| 老妪 | crone | 白发、素髻、佝偻 | 靛蓝 |
| 徒甲 | soldier | 束发、无盔、长矛 | 靛蓝 |
| 徒乙 | soldier | 束发、较小 | 深红 |
| 探路人 | soldier | 束发、略小 | 青绿 |

## 文件职责

- `cast.json`：本片角色与 `kind / look / colors / scale`，不含皮片坐标。
- `archetypes/*.json`：基础人物的静态 SVG 节点树，含皮片路径、关节层级、颜色槽。
- `props/*.json`：月亮、城门、酒坛、芦苇、马、旗、火、山、树、云。
- 蛇由 `TT.shadow.snake` 按长度、宽度、爬行、昂首、斩断等参数生成，不保存某条故事的坐标。

## 数据边界

- JSON 只保存画什么；渲染、关节动作、光照和签条属于 `TT.shadow`。
- 同一 src 跨场复用，引擎只 fetch 一次；kit 还按文本缓存 JSON、按路径缓存 Path2D。
- 不在每幕复制皮片，不把人物坐标写进 scene.code，不把造型数据塞回 kit。
- 重新生成母版：`node scripts/tools/extract-shadow-archetypes.mjs <参考工程> <输出目录>`。
