# Pexels 实拍素材流水线

本文只讲 Pexels 实时检索、下载与回写；突发新闻配方的运行时契约见 `recipes/news-broadcast/recipe.md`。

## Pexels 实时检索与下载

在带视频模板的 params 场里，把查询写在 `scene.params.src`：

```json
{
  "params": {
    "src": "pexels:city traffic night aerial",
    "title": "城市在夜色里\\n保持流动",
    "kicker": "01 / CITY AFTER DARK",
    "credit": "auto"
  }
}
```

也可按带 `src` 的 params 场顺序使用 `meta.assets.queriesEn`。窗口长度优先取 `params.dur`，其次 `scene.duration`，最后取 `meta.assets.segmentDuration`（默认 6 秒）。

```bash
# 任何无 key、检索、时长或下载失败都退出非零，不替换素材
node platform/cli.mjs assets fetch --project <工程目录> --provider pexels --orientation landscape

# 竖屏检索
node platform/cli.mjs assets fetch --project <工程目录> --provider pexels --orientation portrait

# 编译与导出
node platform/cli.mjs build --dir <工程目录>
node scripts/render.mjs <工程目录>/out/composition.json -o <输出.mp4>
```

凭证链沿用 `scripts/config.mjs`：环境变量 `PEXELS_API_KEY` 优先，其次 `~/.dh-video/credentials.json`。密钥不会写入 storyboard、composition 或 manifest。

### 缓存与引用

- 文件落在 `<工程>/out/media/pexels-<id>.mp4`，不污染 `assets/`。
- storyboard 回写为 `job:media/pexels-<id>.mp4`。`job:` 以 composition 所在的 `out/` 为根，render、preview、snapshot 和静帧检查共用这一约定。
- 已完成回写的工程再次执行 `assets fetch` 不会搜索或下载；如果作者恢复 `pexels:` 查询并重新检索，已存在的同 ID 文件只命中缓存，不重复下载。
- `<工程>/out/media/pexels-manifest.json` 记录 ID、查询、作者、作者页、素材原页、原始/选用时长、下载 URL、预览图和 Pexels License。`credit: "auto"` 会把作者回填到 `scene.params.credit`。
- 无 key、检索失败或下载失败都会直接退出，storyboard 不回写，不使用内置素材替代；manifest 的 `provider` 可核对素材确实来自 Pexels。

## 样片

Pexels 实拍样片由 `footage` 配方和 `assets fetch` 生成；凭证与缓存约定见上节。
