# 混合方案实现计划

## 已确认配置

### 1. Pexels API
- 免费额度：200次/小时，20000次/月
- 需注册获取 API Key：https://www.pexels.com/api/

### 2. DeepSeek API
```
API_KEY: sk-076a624bf5ff4609aff9a9397f574e95
API_URL: https://api.deepseek.com/chat/completions
```

### 3. 本地素材库
待下载免费商用图片

---

## 实现步骤

### Step 1: 增强编辑器
- [ ] 添加 Pexels 图片搜索弹窗
- [ ] 添加渐变背景支持
- [ ] 添加 AI 生成布局入口

### Step 2: DeepSeek 集成
- [ ] 编写布局生成 Prompt
- [ ] 前端调用 API
- [ ] 解析返回的 JSON

### Step 3: 本地素材库
- [ ] 下载 20-30 张免费背景图
- [ ] 分类整理
- [ ] 集成到编辑器

---

## Pexels API 用法

```javascript
const PEXELS_API_KEY = 'YOUR_API_KEY';

async function searchPexels(query) {
  const response = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=20`,
    {
      headers: { Authorization: PEXELS_API_KEY }
    }
  );
  const data = await response.json();
  return data.photos; // 返回图片数组
}
```

## DeepSeek 布局生成 Prompt

```
你是一个电商详情页设计师。根据以下产品信息生成布局JSON：

产品：{产品名称}
卖点：{卖点列表}
风格：{设计风格}

要求：
1. 宽度1000px
2. 使用渐变背景（提供colors数组）
3. 提供图片搜索关键词（英文）
4. 只返回JSON，不要解释

返回格式：
{
  "width": 1000,
  "height": 2000,
  "background": { "type": "gradient", "colors": ["#xxx", "#xxx"] },
  "layers": [
    { "type": "image-placeholder", "searchKeywords": "..." },
    { "type": "text", "content": "..." }
  ]
}
```
