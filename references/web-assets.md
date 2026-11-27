# 在线图标与图片素材

用于按需准备项目素材，不把完整素材库写进 ticktoon-skill。

## 搜索

```bash
tt assets search scroll --provider iconify --prefix game-icons --limit 8
tt assets search "Liu Bei portrait" --provider commons --limit 8
```

- `iconify`：返回图标 id、集合、作者、授权和 SVG 地址；`--prefix game-icons` 可限定集合。
- `commons`：检索 Wikimedia Commons 图片并返回缩略图、原页与可读取的授权元数据。授权不完整时必须到原页人工核对。

## 下载选中项

```bash
tt assets download --provider iconify --id game-icons:scroll-unfurled --name scroll --project <用户工程>
tt assets download --provider commons --id "File:Example.jpg" --name portrait --project <用户工程>
```

下载必须显式指定 `--project`，避免误写 skill。结果保存到用户工程：

```text
out/media/<name>.<svg|png|jpg|webp>
out/media/web-assets-manifest.json
```

命令输出可直接放进 `scene.resources`：

```json
{ "type": "image", "name": "scroll", "src": "job:media/scroll.svg" }
```

Iconify SVG 会检查脚本、事件属性、foreignObject 和外部引用；只接受静态 SVG。Commons 只下载 PNG/JPEG/WebP 图片，不执行下载内容。单文件上限 12MB。

素材只在准备阶段联网；渲染仍读取本地文件，保持确定性。paper-chronicle 仅预置 59 个约 97KB 的高频历史图标，完整图标库、头像库和其他特殊素材不进入 skill。
