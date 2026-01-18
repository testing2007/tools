# Product Detail 生成规范

本文档定义了生成产品详情页 HTML/CSS 时必须遵循的规则。

---

## 1. CSS 尺寸规范

为确保手机端清晰度，所有字体和图标尺寸基于原始值 **放大 1.35 倍**。

### 1.1 字体尺寸标准

| 元素类型 | 原始值 | 1.35x 值 |
|----------|--------|----------|
| 区块标题 (.section-title) | 36px | **49px** |
| 二级标题 (.section-title-dark) | 32px | **43px** |
| 副标题 (.section-subtitle) | 16px | **22px** |
| 正文/高亮文字 | 16px | **22px** |
| 标签文字 (.tag) | 14px | **19px** |
| 表格文字 (.specs-table td) | 15px | **20px** |
| NFC/描述文字 | 18px | **24px** |

### 1.2 图标和装饰尺寸

| 元素类型 | 原始值 | 1.35x 值 |
|----------|--------|----------|
| 大数字 "14" (.big-number) | 180px | **200px** (特殊调整) |
| emoji 图标 (.pairing-emoji) | 64px | **86px** |
| NFC 图标 (.nfc-icon) | 56px | **76px** |
| 金线宽度 (.gold-line) | 80px | **108px** |
| 高亮图标 (.highlight-icon) | 28px | **38px** |

### 1.3 间距规范

- 元素内边距 (padding): 放大 1.35 倍
- 元素间距 (gap, margin): 放大 1.35 倍
- 圆角 (border-radius): 放大 1.35 倍

---

## 2. 导出设置规范

### 2.1 html2canvas 配置

```javascript
const canvas = await html2canvas(element, {
    scale: 2,              // 2倍分辨率，输出 2000px 宽度
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    width: 1000,
    windowWidth: 1000
});
```

### 2.2 图片格式

- **格式**: JPEG
- **压缩质量**: **0.95** (高质量)
- **输出宽度**: 1000px × 2 = **2000px**

```javascript
link.href = canvas.toDataURL('image/jpeg', 0.95);
link.download = `${productName}_${sectionName}.jpg`;
```

---

## 3. 页面基础规范

- **页面宽度**: 1000px
- **viewport**: `<meta name="viewport" content="width=1000">`
- **字体**: PingFang SC, Microsoft YaHei, sans-serif

---

## 4. 版本记录

- **2026-01-09**: 创建规范，确定 1.35x 字体放大 + JPEG 0.95 压缩质量
