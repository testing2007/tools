# 产品详情页编辑器 - 原型

## 📦 文件说明

```
prototype/
├── index.html      # 主程序（单文件，可直接运行）
├── README.md       # 本文件
└── assets/         # 模板素材图片
    ├── hero_v2.png
    ├── origin_v2.png
    ├── pairing_v2.png
    ├── alcohol_v2.png
    └── flavor_v2.png
```

## 🚀 快速开始

### 方式一：直接打开
双击 `index.html` 在浏览器中打开即可使用。

### 方式二：本地服务器（推荐）
```bash
# 使用 Python
python -m http.server 8000

# 或使用 Node.js
npx serve .

# 然后访问 http://localhost:8000
```

## ✨ 功能特性

### 1. 模板预览
- 固定宽度 1000px（符合电商详情页标准）
- 包含 5 个区块：Hero、介绍、特点、搭配建议、页脚

### 2. 产品图上传
- 点击产品框或使用侧边栏上传
- 自动填充到 Hero 区域

### 3. 文字编辑
- **双击任意文字可直接编辑**
- 支持多行文本
- 编辑时有视觉反馈

### 4. AI 文案生成
- 输入产品描述
- 一键生成模拟文案（演示用）
- 实际项目中可接入 DeepSeek API

### 5. 图片导出
- 分段保存：鼠标悬停区块，点击"保存此区块"
- 整页导出：点击侧边栏"导出完整详情页"
- 输出格式：JPG

## 🔧 后续开发建议

1. **模板系统**
   - 将模板结构定义为 JSON
   - 支持多模板切换
   - 模板分类管理

2. **AI 集成**
   - 接入 DeepSeek API
   - 根据产品描述生成专业文案

3. **编辑增强**
   - 字体/字号/颜色调整
   - 图片位置微调
   - 撤销/重做

4. **部署**
   - 使用 Vue 3 重构
   - 部署到 Vercel/Netlify

## 📝 技术栈

- **HTML/CSS**：页面结构和样式
- **html2canvas**：DOM 转图片导出
- **原生 JS**：交互逻辑

---

Made with ❤️ for Product Editors
