# 汴河入梦：走进《清明上河图》玩一天

选一个小主角，和阿芽一起走进汴京。逛摊位、交朋友、上虹桥、坐篷船，最后放飞记录这趟春游的纸鸢。孩子可以自己找路、做选择，边玩边看看画里的街市与汴河。

[立即试玩（免登录）](https://bytedance.feishu.link/app/app_17geaupaa8v) · 建议用电脑游玩，手机也支持屏幕摇杆。

## 先看效果

[![汴河全卷、虹桥与街市的动态预览](docs/media/panorama-showcase.gif)](docs/media/panorama-showcase.mp4)

[看全景视频 · 42 秒](docs/media/panorama-showcase.mp4)

[![逛集市的游玩预览](docs/media/journey-showcase.gif)](docs/media/journey-showcase.mp4)

[看游玩视频 · 2 分 44 秒](docs/media/journey-showcase.mp4)

桥上有人走动，汴河里有船行驶；购物、交谈和乘船都能在游玩视频里看到。视频是实机录制，较长的赶路过程已快放。

| 汴河与虹桥 | 在玩具摊问价 |
| --- | --- |
| ![汴河、虹桥、街市、城门和古塔](docs/media/showcase-city.png) | ![主角在玩具摊与掌柜问价](docs/media/showcase-market.png) |
| 给花婆婆送花 | 坐船经过虹桥 |
| ![主角与花婆婆交谈](docs/media/showcase-granny.png) | ![主角坐在篷船上沿汴河游览](docs/media/showcase-boat.png) |

## 这趟春游能玩什么

- **逛集市：**糕饼、鲜花和玩具摊各卖不同东西。可以问价、还价、购买，买来的点心能吃，玩具能把玩。
- **认识朋友：**和阿芽、豆豆、花婆婆交谈，帮他们完成小心愿。对话有字幕，语音可以开关。
- **游汴河：**上虹桥看景，坐船从桥下经过，吟诗记下见闻，最后放飞自己的纸鸢。

## 怎么玩

打开试玩链接，选小男孩或小女孩。靠近人物，按提示交谈；想自由逛，也可以打开地图找路。进度会保存在当前浏览器。

电脑用 **WASD／方向键**移动、**Shift** 小跑、**E** 互动、**M** 看地图、**B** 看背包。手机用屏幕摇杆和按钮。

## 怎么做的

汴河、虹桥、街市、船和行人由 **Three.js** 呈现；主角用 **Tripo** 建模，走跑动作、剧情、商品、钱袋和碰撞由游戏代码控制。模型、画面和语音都打包进一个 [HTML 文件](index.html)，下载后可以离线打开。

想从源码构建，在项目目录运行：

```sh
npm install
npm run build
npm test
```

这是受《清明上河图》启发的互动创作，并非历史建筑的精确复原。更多内容：[剧本与玩法](剧本与玩法.md) · [验收记录](VERIFICATION.md)。
