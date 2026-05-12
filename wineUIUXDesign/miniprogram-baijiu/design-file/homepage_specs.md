## 高端白酒电商首页设计规范（针对 Pixso Frame `iPhone 13 mini`, guid: 12:2）

本规范用于在空白 Frame 中快速搭建“高端白酒电商”首页原型，保证视觉统一、组件可复用，便于后续落地到 uni-app / 原生小程序。

### 1. 画布与布局框架

- **画布尺寸**：375 × 812 px（iPhone 13 mini）。
- **安全区**：顶部预留 44 px（状态栏 + 胶囊按钮），底部预留 34 px（Home 指示条）。
- **栅格/列设置**：
  - 列数 12，最大内容宽度 343 px（左右各 16 px 边距）。
  - 主要内容卡片宽度 343 px，内部可按照 8+8+8+8 列切分。
- **布局分区（由上至下）**：
  1. 顶部沉浸背景 + 搜索胶囊
  2. Hero 主视觉（450 px 高）
  3. 金刚区 8 宫格入口（2 行）
  4. 新人礼包横幅（112 px 高）
  5. 精选推荐商品（双列卡片）
  6. 限时秒杀模块（横向滑动卡片）
  7. 企业礼赠模块（横幅卡片）
  8. 底部导航（固定 92 px，高亮当前页）

### 2. 颜色设计 Token

| Token 名称             | HEX                     | 用途                               |
| ---------------------- | ----------------------- | ---------------------------------- |
| `color/bg-primary`     | `#07111A`               | 全局背景、Hero 背景渐变起点        |
| `color/bg-secondary`   | `#03080D`               | 页面底色、分割区                   |
| `color/card-dark`      | `#0E1A24`               | 深色模块（品牌故事、礼赠横幅）背景 |
| `color/card-light`     | `#F6EBD8`               | 商品卡、优惠券、信息卡背景         |
| `color/gold-primary`   | `#D8A85B`               | 标题、主图案、描边、高亮图标       |
| `color/gold-light`     | `#F6D899`               | 渐变亮部、微光效果                 |
| `color/gold-dark`      | `#8A5A24`               | 渐变暗部、线条加深                 |
| `color/red-primary`    | `#8E241B`               | 主操作按钮、价格强调               |
| `color/red-dark`       | `#5C1512`               | 主按钮渐变终点、倒计时底色         |
| `color/text-primary`   | `#F8E8C8`               | 深色背景上的正文文字               |
| `color/text-secondary` | `#BFA77A`               | 次要说明文字                       |
| `color/text-dark`      | `#2B1A12`               | 浅色卡片上的正文                   |
| `color/divider-gold`   | `rgba(216,168,91,0.35)` | 刻度线、分隔线                     |
| `color/success`        | `#6D8B53`               | 成功状态、提示                     |
| `color/warning`        | `#C98A2E`               | 提醒标签                           |

> 建议在 Pixso 中创建颜色样式：`COLOR/Background/Primary`、`COLOR/Accent/Gold` 等命名。

### 3. 字体与文案规范

- **标题（H1/H2）**：
  - 字体：仿宋 / 思源宋体（可用 Noto Serif SC）
  - 字级：H1 = 28 px / H2 = 24 px；行高 120%
  - 颜色：`color/gold-primary`
- **正文（Body）**：
  - 字体：系统默认（PingFang SC / 思源黑体）
  - 字级：14 px，行高 160%，颜色 `color/text-primary` 或 `color/text-dark`
- **标签/导航**：
  - 字级：12–13 px，字重 500
  - 颜色：默认 `color/text-secondary`，高亮 `color/gold-primary` 或 `color/red-primary`
- **数字价格**：
  - 字体：DIN Alternate / 思源黑体 Bold
  - 价格字号 20 px，颜色 `color/red-primary`

### 4. 圆角与阴影 Token

| Token           | 值                                 | 应用              |
| --------------- | ---------------------------------- | ----------------- |
| `radius/card`   | 24 px                              | 卡片、模块边角    |
| `radius/button` | 999 px                             | 胶囊按钮          |
| `radius/image`  | 20 px                              | 商品图、模块图    |
| `radius/modal`  | 32 px                              | 弹窗、礼包卡片    |
| `shadow/dark`   | `0 16px 40px rgba(0,0,0,0.35)`     | 深色背景模块投影  |
| `shadow/gold`   | `0 8px 24px rgba(216,168,91,0.18)` | 金色按钮/卡片发光 |

### 5. 组件结构说明

#### 5.1 顶部区域

- **背景遮罩**：线性渐变 `color/bg-primary` → `rgba(7,17,26,0)`，高度 160 px。
- **状态栏占位**：顶留 44 px。
- **胶囊按钮**：右上角 72 × 32 px，描边 `color/divider-gold`，背景透明。
- **搜索胶囊**：宽 343 px，高 44 px，背景 `rgba(14,26,36,0.65)`，描边 `color/divider-gold`，左右内边距 16 px，包含放大镜图标 + placeholder（示例：“搜索商品、品牌、酒款”）。

#### 5.2 Hero 主视觉

- **高度**：450 px（含顶部区域）。
- **内容**：
  - 左侧竖排标题（H1/H2）+ 副标题 + CTA（“探索更多”）
  - 右侧/中间展示高端白酒瓶身与礼盒，带光效。
- **CTA 按钮**：宽 132 px，高 40 px，渐变 `color/red-dark` → `color/red-primary`，文字 `color/text-primary`。
- **装饰元素**：金色边线、飘带、山水/云纹纹理，透明度 30–40%。

#### 5.3 金刚区（核心功能入口）

- **总宽**：343 px；分 4 列 × 2 行。
- **单项尺寸**：宽 78 px，高 92 px，卡片背景 `rgba(14,26,36,0.6)` 或 `color/card-light`。
- **图标**：线性金色图标（32 × 32 px）。
- **文字**：12 px，居中，颜色 `color/text-primary`。
- **内容示例**：新人礼包、优惠券、秒杀活动、多 人拼团、签到有礼、临期特卖、企业礼赠、溯源防伪。

#### 5.4 新人礼包横幅

- **尺寸**：343 × 112 px。
- **背景**：深色底 `color/card-dark` + 金色描边。
- **内容**：礼盒插画、礼包价值提示、一次性按钮。
- **按钮**：右下，小胶囊 104 × 36 px，渐变 `color/red-primary` → `color/red-dark`。

#### 5.5 精选商品区

- **标题栏**：H2 + “查看更多”描边按钮。
- **布局**：双列卡片，每张卡宽 163 px，高 252 px。
- **卡片内容**：
  - 商品图（120 × 120 px，圆角 20 px）
  - 标签（如“限量”“年份”）、商品名、度数、容量、价格、加入购物车按钮（icon-only）。
- **背景**：卡片背景 `color/card-light`，内边距 16 px。

#### 5.6 限时秒杀模块

- **标题**：含倒计时（数字 18 px，颜色 `color/red-primary`）。
- **布局**：横向滚动卡片（Auto Layout 水平）。单卡尺寸 220 × 156 px。
- **进度条**：线性渐变 `color/red-primary` → `color/gold-primary`，背景 `rgba(255,255,255,0.15)`。
- **抢购按钮**：36 px 高，圆角 999 px。

#### 5.7 企业礼赠模块

- **宽高**：343 × 148 px，背景 `color/card-dark` + 金色花纹。
- **文案**：突出“企业礼卡 / 专属定制”。
- **按钮**：描边按钮 `color/gold-primary`。

#### 5.8 底部导航

- **高度**：92 px（含安全区）。
- **背景**：`rgba(7,17,26,0.88)`，描边 `color/divider-gold`。
- **图标**：
  - 默认状态：线性金色 24 × 24 px，文字 `color/text-secondary`。
  - 高亮：填充金色或酒红，并加发光阴影。
- **标签**：12 px。

### 6. 设计 Tokens（CSS / 编号参考）

```css
:root {
  --color-bg-primary: #07111a;
  --color-bg-secondary: #03080d;
  --color-card-dark: #0e1a24;
  --color-card-light: #f6ebd8;
  --color-gold-primary: #d8a85b;
  --color-gold-light: #f6d899;
  --color-gold-dark: #8a5a24;
  --color-red-primary: #8e241b;
  --color-red-dark: #5c1512;
  --color-text-primary: #f8e8c8;
  --color-text-secondary: #bfa77a;
  --color-text-dark: #2b1a12;
  --radius-card: 24px;
  --radius-button: 999px;
  --shadow-dark: 0 16px 40px rgba(0, 0, 0, 0.35);
  --shadow-gold: 0 8px 24px rgba(216, 168, 91, 0.18);
  --spacing-page-h: 16px;
  --spacing-section-v: 32px;
  --spacing-item-v: 16px;
}
```

### 7. 图标与图像风格

- 图标统一使用线性金色描边，粗细 2 px，圆角端点。
- 商品图与装饰图使用高端实拍，与深色背景对比明显。
- 可添加山水、云纹、金粉纹理，透明度控制在 20–40%。
- 不使用卡通插画、饱和亮色。

### 8. 交互与状态

- 按钮悬浮：外发光 `color/gold-light`，亮度 +10%。
- 按钮按下：渐变加深，阴影缩小。
- Tab/导航：选中态添加底部 3 px 金色指示条。
- 秒杀倒计时：使用红色数字翻牌效果，提醒紧迫感。

### 9. Pixso 组件命名建议

| 组件名称                    | 用途                  |
| --------------------------- | --------------------- |
| `Comp/Header/SearchBar`     | 顶部搜索胶囊          |
| `Comp/Hero/Card`            | Hero 主视觉背景 + CTA |
| `Comp/IconMenu/Item`        | 金刚区单项            |
| `Comp/Banner/NewUserGift`   | 新人礼包横幅          |
| `Comp/ProductCard/Standard` | 双列商品卡            |
| `Comp/FlashSale/Card`       | 秒杀横卡              |
| `Comp/CTA/ButtonPrimary`    | 主按钮（红金渐变）    |
| `Comp/CTA/ButtonSecondary`  | 次按钮（鎏金描边）    |
| `Comp/Tabbar/Item`          | 底部导航项            |

### 10. 交付检查清单

- [ ] 顶部、底部安全区已预留。
- [ ] 背景渐变、纹理保持低透明度，避免干扰内容。
- [ ] 所有颜色、字体、阴影均引用统一 Token。
- [ ] 组件命名清晰并启用 Auto Layout，便于后续扩展。
- [ ] 商品卡片与活动卡片内容可通过 Overrides 快速替换。
- [ ] 页面主要交互（按钮、 tab）已建立连线或标注说明。

按照本规范搭建完成后，可将该页面复制扩展至其它页面（优惠券、秒杀、礼赠等），保持一致的黑金奢华调性。
