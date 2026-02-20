# TabBar 图标说明

## 需要准备的图标文件

请准备以下 4 个图标文件(建议尺寸 81x81px):

1. `home.png` - 首页未选中状态(灰色 #999999)
2. `home-active.png` - 首页选中状态(橙色 #FD5900)
3. `settings.png` - 设置未选中状态(灰色 #999999)
4. `settings-active.png` - 设置选中状态(橙色 #FD5900)

## 图标规范

- 尺寸: 81x81px(推荐)或 162x162px(@2x)
- 格式: PNG(支持透明背景)
- 风格: 线性图标或面性图标均可

## 临时方案

如果暂时没有图标,可以:
1. 使用 iconfont(阿里巴巴矢量图标库)
2. 使用设计工具(Figma/Sketch)快速设计
3. 从 icon8.com 或 flaticon.com 下载免费图标

## 当前配置

已在 pages.json 中配置 tabBar:
- 背景色: #FFF6EB
- 选中颜色: #FD5900
- 未选中颜色: #999999
