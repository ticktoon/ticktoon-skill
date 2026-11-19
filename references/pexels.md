# Pexels 实拍素材

实拍素材优先实时检索 Pexels：

```bash
node "$SKILL_DIR/platform/cli.mjs" assets fetch --project <dir> --provider pexels --orientation landscape
node "$SKILL_DIR/platform/cli.mjs" assets fetch --project <dir> --provider pexels --orientation portrait
```

- `src` 写 `pexels:<英文查询>`，也可以按 `meta.assets.queriesEn` 的顺序查询。
- 凭证只走 `PEXELS_API_KEY` 或 `~/.dh-video/credentials.json`；不要写进 storyboard、composition 或任务目录。
- 下载落在 `<工程>/out/media/pexels-<id>.mp4`，storyboard 回写为 `job:media/pexels-<id>.mp4`；同 ID 文件命中缓存，不重复下载。
- 作者与授权写入 `pexels-manifest.json`。无 key、检索失败或下载失败都会直接报错，storyboard 不回写，不会替换成内置素材；本地视频引用不需要 Pexels key。
