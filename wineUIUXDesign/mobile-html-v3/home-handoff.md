# Home 高保真开发交付说明

目标文件：`home.html`

## 1) 画布与布局

- 设计宽度：`375px`
- 页面容器：`.phone`
- 页面底部安全区：`calc(74px + env(safe-area-inset-bottom))`
- 主要间距：
  - 页面外边距：`12px`
  - 模块内边距：`12px`
  - 模块间距：`12px`

## 2) 设计 Token（可直接抽离）

- 主背景：`#F6F1EB`
- 卡片背景：`#FFFAF3`
- 文字主色：`#120F0D`
- 辅助文字：`#6A5C54`
- 主品牌深色：`#1C1917`
- 强调色（金）：`#CA8A04`
- 组件圆角：
  - 大卡片：`18px`
  - 小卡片：`14px`
- 阴影：`0 8px 20px rgba(30, 19, 16, 0.1)`

## 3) 图片策略

当前页面已接入在线图片（Unsplash）用于快速预览。

正式开发建议：

1. 把线上图替换为业务 CDN 地址。
2. 首图尺寸建议 `750x420`（2x 适配移动端）。
3. 列表图建议 `360x180`，保持统一裁切比例。
4. 全部图片加 `loading="lazy"`，首屏 Hero 不懒加载。

## 4) 图标策略

- 全部使用 inline SVG，避免图标字体依赖。
- 统一线宽：`1.8`
- 统一拐角：`stroke-linecap/linejoin=round`
- 可把 SVG 抽到 `icons.js` 或 sprite 文件统一维护。

## 5) 模块映射（业务到页面）

- 顶部搜索 + 消息：`header.topbar`
- Banner 主推荐：`.hero`
- 酒类分类：`#catGrid`
- 品牌故事：`.story`
- 热门产区：`#regionGrid`
- 搭餐建议：`#pairingGrid`
- 口感档案：`#tastePane`
- 适饮窗口：`.window`
- 关键入口：`.entry-grid`
- 底部导航：`.bottom-nav`

## 6) 动效与可访问性

- 卡片进入动效：`.reveal + IntersectionObserver`
- 条形图动效：`.fill` 宽度过渡
- 已支持 `prefers-reduced-motion`
- 图片均包含 `alt`
- 搜索输入包含 `aria-label`

## 7) 程序员落地建议

1. 先把 `:root` token 抽成全局主题变量。
2. 将卡片、区块标题、入口卡抽成复用组件。
3. 以 mock JSON 替换当前内联数组，后续接 API 仅需替换数据源。
4. 保留当前 class 命名，可直接迁移到 Vue/React 组件结构。
