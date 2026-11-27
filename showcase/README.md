# Ticktoon Showcase

这是可直接部署到 GitHub Pages 的静态示例页，不需要 npm、框架或构建步骤。

## 发布

在仓库中依次选择：

1. **Settings → Pages**。
2. **Build and deployment → Deploy from a branch**。
3. 选择默认分支 `main` 和 `/ (root)`，保存。

页面地址：

```text
https://ticktoon.github.io/ticktoon-skill/showcase/
```

README 中只链接这个地址，不嵌入完整视频。

## 添加作品

每个示例目录包含：

```text
showcase/<example>/
├── video.mp4
├── qa-sheet.png
└── storyboard.json
```

目录名统一用连字符（`break-news`、`flash-cut`），不要用下划线。然后在 `index.html` 的 `works` 数组中增加一项：

```js
{
  title: '示例标题',
  recipe: 'paper-chronicle',
  duration: '00:45',
  description: '一句话说明画面与配方特点。',
  video: 'paper-chronicle/video.mp4',
  poster: 'paper-chronicle/qa-sheet.png',
  storyboard: 'paper-chronicle/storyboard.json',
  orientation: 'landscape',
}
```

筛选按钮、示例数和配方数都由 `works` 自动生成；新配方只要在 `recipeLabels` 里补一个中文名即可。视频源文件保留在原目录，页面不会移动或重编码它们。

建议：

- MP4 使用常见的 H.264 视频 + AAC 音频，便于浏览器直接播放。
- 单个文件尽量控制在 GitHub 的 100MB 文件上限以内。
- `qa-sheet.png` 用作封面；也可以替换成单独的 `poster.png`。
- 页面只在点击后加载并播放视频，避免首次打开同时下载全部 MP4。

## 本地预览

```bash
python -m http.server 8080 --directory showcase
```

打开 `http://localhost:8080/`。不要直接双击 HTML 检查视频，部分浏览器会限制 `file://` 下的媒体加载。
