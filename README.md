# 汴河入梦 · 阿芽的春日游会

把《清明上河图》里的汴河街市，变成可以走进去的春日游会。你可以逛摊位、买点心和玩具、上虹桥看风景、与花婆婆聊天，再坐船吟诗，和阿芽一起完成游会。

[在线试玩（免登录）](https://bytedance.feishu.link/app/app_17geaupaa8v) · [查看单文件 HTML](index.html)

## 两支实机视频

[![全卷、虹桥、河埠与城阙的动态预览，点击观看全景视频](docs/media/panorama-showcase.gif)](docs/media/panorama-showcase.mp4)

[全景展示 · 42 秒](docs/media/panorama-showcase.mp4)：看完整汴河、虹桥、两岸街市、城门与行船。

[![集市购物、上桥、送花、乘船的动态预览，点击观看游玩视频](docs/media/journey-showcase.gif)](docs/media/journey-showcase.mp4)

[游玩展示 · 2 分 33 秒](docs/media/journey-showcase.mp4)：从阿芽出发，逛糕饼、玩具和鲜花摊，找豆豆与花婆婆，上桥看风，再乘篷船记下诗句、返航。

两支视频均由当前版本真实浏览器画面录制，长路程作了标注快放，配乐由游戏原创旋律重新合成。共享机器使用软件渲染，录像不代表普通电脑的游戏帧率。

## 游戏画面

| 汴河全卷 | 玩具摊问价 |
| --- | --- |
| ![汴河、虹桥、街市、城门和古塔](docs/media/showcase-city.png) | ![主角在玩具摊与掌柜问价](docs/media/showcase-market.png) |
| 给花婆婆送花 | 坐船经过虹桥 |
| ![主角与花婆婆交谈](docs/media/showcase-granny.png) | ![主角坐在篷船上沿汴河游览](docs/media/showcase-boat.png) |

## 怎么玩

选小男孩或小女孩出发。靠近人物交谈，按自己的顺序探索街市；右上角的小地图可以找路。电脑用 WASD／方向键移动、Shift 小跑、E 互动、M 看地图、B 看背包；手机用摇杆和屏幕按钮。

直接打开 [index.html](index.html) 就能离线游玩。想从源码重新构建：

```sh
npm install
npm run build
npm test
```

这是以《清明上河图》为灵感的互动创作，并非历史建筑的精确复原。故事设计见 [剧本与玩法](剧本与玩法.md)，测试记录见 [验收记录](VERIFICATION.md)。
