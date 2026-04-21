# home 页面生成说明（V3）

目标：生成“酒类优先”的微信小程序风格移动端首页，输出为单文件 `home.html`（375px 视觉宽度），使用纯 HTML + CSS + 原生 JavaScript。

## 设计基线（来自 ui-ux-pro-max）

- 产品类型：`E-commerce Luxury`
- 风格：`Liquid Glass + premium minimal`
- 色板：
  - Primary `#1C1917`
  - Secondary `#44403C`
  - CTA `#CA8A04`
  - Background `#FAFAF9`
  - Text `#0C0A09`
- 字体策略：标题偏精致、正文偏清晰现代
- 动效策略：轻量、非持续性、支持 `prefers-reduced-motion`

## 页面必须包含的业务模块

1. 顶部搜索 + banner
2. 酒类分类入口（红酒、白酒、威士忌、香槟、精酿）
3. 品牌故事
4. 热门产区（地图感卡片）
5. 搭餐建议
6. 本周适饮推荐
7. 秒杀/限时折扣入口
8. 福袋盲盒入口
9. 数字酒窖入口
10. AI侍酒师入口
11. NFC互动活动入口
12. 瑕疵酒专区入口

## 交互与实现要求

- 所有数据使用 mock
- 页面底部有小程序风格 TabBar
- 卡片统一圆角、阴影、边框层级
- 点击入口使用相对路径（如 `flash-sale.html`）
- 不依赖第三方框架或构建工具
- 适配手机浏览器，安全区留白（`env(safe-area-inset-bottom)`）

## Mock 内容关键词

- 酒名：`Chateau Lumiere Reserve 2018`、`Napa Ridge Cabernet 2020`
- 品牌：`Lumiere Cellars`、`Oak & Barrel`
- 产区：`波尔多左岸`、`纳帕谷`、`勃艮第`
- 口感：黑樱桃、雪松、香草、矿物感
- 适饮窗口：2026-2031

## 验收点

- 一眼看出“酒类垂直电商”而非通用商城
- 入口完整，层级清晰，信息密度适中
- 可直接打开 `home.html` 预览
