# Product Detail HTML 生成规则

本文档定义了为 html-editor.html 生成产品详情页 HTML 时必须遵循的规则。

---

## 1. 核心原则

所有可见的文本内容都必须可编辑，包括：
- 标题、副标题、描述文字
- 标签、按钮、提示文字
- 表格单元格内容
- 任何用户可能需要修改的文本

---

## 2. 必须添加的 data 属性

### 2.1 可编辑文本：`data-editable`

**所有需要编辑的文本元素必须添加 `data-editable` 属性**

```html
<!-- ✅ 正确 -->
<h1 data-editable="title">标题文字</h1>
<span class="tag" data-editable="tag1">标签内容</span>
<td data-editable="spec-name">产品名称</td>

<!-- ❌ 错误 - 缺少 data-editable -->
<h1>标题文字</h1>
<span class="tag">标签内容</span>
```

**命名规则**：
- 使用小写字母和连字符
- 名称要具有描述性，如 `hero-title`、`feature1-desc`
- 相似元素使用数字后缀，如 `tag1`、`tag2`、`tag3`

### 2.2 可替换图片：`data-slot`

**所有图片容器必须添加 `data-slot` 属性**

```html
<!-- ✅ 正确 -->
<div class="image-container" data-slot="product-main">
    <img src="..." alt="...">
</div>

<!-- ❌ 错误 - 缺少 data-slot -->
<div class="image-container">
    <img src="..." alt="...">
</div>
```

### 2.3 区块标识：`data-section`

**每个 section 必须添加 `data-section` 属性**

```html
<section class="section hero-section" data-section="hero">
    ...
</section>
<section class="section intro-section" data-section="intro">
    ...
</section>
```

---

## 3. 常见遗漏清单

以下元素类型容易遗漏 `data-editable`，请特别注意：

| 元素类型 | 示例 | 必须添加 |
|----------|------|----------|
| span 标签文字 | `<span class="tag">` | ✅ data-editable |
| 表情/图标 | `<span class="emoji">🍕</span>` | ✅ data-editable |
| 表格单元格 | `<td>内容</td>` | ✅ data-editable |
| 按钮文字 | `<button>点击</button>` | ✅ data-editable |
| 徽章/标记 | `<div class="badge">NEW</div>` | ✅ data-editable |
| 数字/百分比 | `<span class="number">14</span>` | ✅ data-editable |
| 价格 | `<span class="price">¥99</span>` | ✅ data-editable |

---

## 4. HTML 结构规范

### 4.1 基本模板结构

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=1000">
    <title>产品名称 - 产品详情页</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="detail-page" id="detailPage">
        <section class="section xxx-section" data-section="xxx">
            <!-- 内容 -->
        </section>
        <!-- 更多 sections -->
    </div>
</body>
</html>
```

### 4.2 页面宽度

- 详情页固定宽度：**1000px**
- `meta viewport` 设置为 `width=1000`

### 4.3 图片规范

- 优先使用 Pexels 免费图片
- URL 格式：`https://images.pexels.com/photos/{id}/...?auto=compress&cs=tinysrgb&w=600`
- 图片必须放在 `data-slot` 容器内

---

## 5. 文件组织

```
prototype/details/
├── {product-name}/           # 每个产品一个文件夹
│   ├── index.html            # 详情页 HTML
│   └── style.css             # 样式文件
├── fabrang-wine/
└── swan-legend/
```

---

## 6. 检查清单

生成 HTML 后，请确认以下事项：

- [ ] 所有 `<h1>` ~ `<h6>` 标签都有 `data-editable`
- [ ] 所有 `<p>` 段落都有 `data-editable`
- [ ] 所有 `<span>` 文本都有 `data-editable`
- [ ] 所有表格 `<td>` 内容单元格都有 `data-editable`
- [ ] 所有图片容器都有 `data-slot`
- [ ] 所有 `<section>` 都有 `data-section`
- [ ] 没有遗漏任何可见文本

---

## 7. 编辑器兼容性

html-editor.html 会自动处理：

| 操作 | 行为 |
|------|------|
| 点击 `[data-editable]` | 启用 contenteditable 编辑 |
| 点击 `[data-slot]` | 弹出图片上传对话框 |
| 导出区块 | 按 `[data-section]` 分段导出 JPG |

---

## 8. 版本记录

- **2026-01-07**: 创建规则文档，明确 data-editable 必须覆盖所有文本元素
