请帮我生成一套“酒类电商后台编辑系统”的 HTML 原型项目，要求如下：

一、技术要求

1. 使用纯 HTML + CSS + 原生 JavaScript；
2. 每个功能独立为一个 html 页面；
3. 使用 mock 数据；
4. 页面为 PC 后台管理风格，适合 1440px 宽度；
5. 左侧菜单 + 顶部栏 + 主内容区布局；
6. 不依赖后端接口；
7. 不使用 Vue/React；
8. 所有页面可通过 index.html 统一跳转预览；
9. 整体风格专业、整洁、偏 SaaS 管理系统；
10. 输出完整可运行 HTML 文件。

二、业务定位
这是一个“酒类优先”的电商后台，不是通用商城后台。
在通用商品、订单、会员、营销之外，必须重点体现酒类特有能力：

- 品牌故事管理
- 产区地图管理
- 搭餐建议配置
- 口感档案配置
- 适饮窗口配置
- 真伪/批次溯源管理
- 数字酒窖/数字藏酒管理
- AI侍酒师知识库入口
- NFC互动活动管理
- 酒局游戏活动管理
- 葡萄酒养成计划配置
- 福袋盲盒规则配置
- 瑕疵酒专区管理
- 企业员工礼品卡管理
- AR内容入口管理

三、需要生成的页面文件

1. index.html：后台原型导航页
2. dashboard.html：仪表盘
3. product-list.html：商品列表
4. product-edit.html：商品编辑
5. order-list.html：订单列表
6. order-detail.html：订单详情
7. user-list.html：用户列表
8. member-level.html：会员等级配置
9. points-config.html：积分与积分商城配置
10. group-buy-manage.html：拼团活动管理
11. coupon-manage.html：满减券/优惠券管理
12. flash-sale-manage.html：限时折扣/秒杀管理
13. gift-card-manage.html：企业员工礼品卡管理
14. drinking-game-manage.html：酒局游戏管理
15. grape-plan-manage.html：葡萄酒养成计划管理
16. nfc-activity-manage.html：NFC多人瓜分红包管理
17. ar-content-manage.html：AR内容管理
18. digital-cellar-manage.html：数字藏酒/数字酒窖管理
19. blind-box-manage.html：福袋盲盒管理
20. defect-wine-manage.html：瑕疵酒专区管理
21. traceability-manage.html：真伪/批次溯源管理
22. brand-story-manage.html：品牌故事管理
23. region-map-manage.html：产区地图管理
24. pairing-manage.html：搭餐建议管理
25. taste-profile-manage.html：口感档案管理
26. drink-window-manage.html：适饮窗口管理
27. ai-sommelier-manage.html：AI侍酒师配置页

四、后台核心要求

1. 商品编辑页必须支持酒类专属字段：
   - 品牌故事
   - 产区
   - 产区地图
   - 搭餐建议
   - 口感档案
   - 适饮窗口
   - 批次号
   - 溯源码
   - 是否支持数字酒窖
   - 是否瑕疵酒
   - 瑕疵说明
2. 所有管理页要有表格、筛选、状态标签、弹窗示意、表单配置区；
3. 重点不是 CRUD 完整，而是展示后台交互原型；
4. 页面要有 mock 统计、假数据、状态切换效果；
5. index.html 作为总导航页，清晰展示所有后台页面入口。

五、视觉要求

1. SaaS 后台风格；
2. 浅色背景 + 白色卡片 + 深色文字；
3. 主色可用酒红色作为品牌强调色；
4. 页面布局清晰、控件统一；
5. 表格、筛选区、详情抽屉、弹窗、表单区域都要有。

六、交付要求

1. 输出完整 HTML 文件；
2. 每个文件单独可运行；
3. 所有页面通过相对路径可跳转；
4. 图片可用占位图；
5. mock 数据必须贴合酒类业务。
