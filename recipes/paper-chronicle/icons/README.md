# 历史叙事核心图标组

59 个静态单色 SVG，总内容约 97KB。用于 paper-chronicle 的通用历史、地理、军事、礼制、民生和神话叙事；不是完整图标库，也不包含头像或地图数据。

| 类别 | name |
|---|---|
| 文书 | `scroll` 书卷、`quill` 书笔、`book` 书、`archive` 档案、`seal` 封印、`map` 地图、`compass` 罗盘、`marker` 地点、`token` 令牌、`edict` 诏书 |
| 地理 | `castle` 城池、`gate` 城门、`mountains` 山地、`river` 河流、`bridge` 桥梁、`road` 山路、`pagoda` 塔、`village` 村落、`willow` 柳树 |
| 军事 | `swords` 交锋、`sword` 挥剑、`bow` 弓箭、`shield` 盾、`banner` 旗帜、`horse` 马、`cavalry` 骑兵、`siege` 攻城、`manacles` 枷锁、`tent` 营帐、`chariot` 战车、`warship` 战船、`drum` 鼓、`horn` 号角、`spear` 长矛、`arrows` 箭、`axe` 战斧、`wall` 城墙 |
| 神话 | `sun` 太阳、`moon` 月亮、`flame` 火焰、`wind` 风、`dragon` 龙、`snake` 蛇、`wing` 羽翼、`lotus` 莲花、`turtle` 龟、`tiger` 虎、`deer` 鹿 |
| 器物 | `torch` 火把、`lantern` 灯笼 |
| 礼制 | `ding` 鼎、`coins` 钱币、`gong` 锣、`bell` 钟 |
| 民生 | `granary` 粮仓、`wheat` 麦、`ox` 牛 |
| 天象 | `cloud` 云、`lightning` 雷电 |

使用：

```json
{ "type": "image", "name": "castle", "src": "skill:recipes/paper-chronicle/icons/assets/castle.svg" }
```

```js
C.icon(ctx, api.img('castle'), { t: T, at: 0.4, x: 600, y: 360, size: 64 });
```

完整 id、类别和逐文件来源见 `manifest.json`。

- 来源：Game-icons.net / Iconify API
- 作者：Lorc、Delapouite 与 Game-icons 贡献者
- 授权：Creative Commons Attribution 3.0（CC BY 3.0）
- 授权说明：https://github.com/game-icons/icons/blob/master/license.txt

这批之后不再扩充核心库；特殊题材需要的其他图标仍用 `tt assets search / download` 按需进入用户工程。
