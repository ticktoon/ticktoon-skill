# Pexels 实拍素材

实拍素材优先实时检索 Pexels：

```bash
node "$SKILL_DIR/platform/cli.mjs" assets fetch --project <dir> --provider pexels --orientation landscape
node "$SKILL_DIR/platform/cli.mjs" assets fetch --project <dir> --provider pexels --orientation portrait
node "$SKILL_DIR/platform/cli.mjs" assets fetch --project <dir> --provider pexels --orientation landscape --strict
```

- `src` 写 `pexels:<英文查询>`，也可以按 `meta.assets.queriesEn` 的顺序查询。
- 凭证只走 `PEXELS_API_KEY` 或 `~/.dh-video/credentials.json`；不要写进 storyboard、composition 或任务目录。
- 下载落在 `<工程>/out/media/pexels-<id>.mp4`，storyboard 回写为 `job:media/pexels-<id>.mp4`；同 ID 文件命中缓存，不重复下载。
- 作者、授权与降级原因写入 `pexels-manifest.json`。无 key/失败时默认整片一致回退内置实拍并打印原因；`--strict` 下直接失败，不静默替换。
