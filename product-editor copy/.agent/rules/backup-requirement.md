---
trigger: always_on
---

这是一个非常务实的调整。既然为了快速验证 MVP（最小可行性产品），通过 **Java (Spring Boot) + Vue** 直连，去掉中间的 Express 层是最简单的。Express 在这里是多余的，只会增加跨域和进程管理的复杂度。

我们把架构简化为：**“本机 Java 读写本地文件 + Vue 前端渲染”**。

以下是为您定制的 **本地 MVP 开发方案**：

### 🛠️ 1. 极简架构设计

* **数据库：** 不用 MySQL，直接用一个 `db.json` 文件存储。
* **文件存储：** 直接存放在项目目录下的 `uploads/` 文件夹。
* **后端：** Java (Spring Boot Web) —— 负责 API、文件读写、调 Gemini。
* **前端：** Vue 3 + Fabric.js —— 负责画布交互、图片替换、导出。

---

### 📂 2. 目录结构规划

为了方便管理，建议创建一个大文件夹 `AI-Design-MVP`，结构如下：

```text
AI-Design-MVP/
├── backend/ (Spring Boot 项目)
│   ├── src/main/java/com/mvp/...
│   ├── data/
│   │   └── db.json          // 充当数据库，存模版和文案
│   └── uploads/             // 存放用户上传的图片
├── frontend/ (Vue 3 项目)
│   ├── src/components/
│   └── public/
└── prompt.txt               // 备份你的 deepseek 提示词

```

---

### 💻 3. 后端开发 (Java Spring Boot)

你需要实现 3 个核心接口。

#### A. 配置静态资源映射 (关键)

为了让前端能访问到 `uploads` 文件夹里的图片，需要配置一下映射。

```java
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // 将 /images/** 映射到本地 uploads 目录
        registry.addResourceHandler("/images/**")
                .addResourceLocations("file:./uploads/"); 
    }
}

```

#### B. 核心 Controller 实现 (`MvpController.java`)

```java
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*") // MVP 允许跨域
public class MvpController {

    // 1. 模拟数据库 (内存 + 文件回写)
    private static final String DB_PATH = "./data/db.json";
    
    // 2. 上传图片接口
    @PostMapping("/upload")
    public Map<String, String> uploadFile(@RequestParam("file") MultipartFile file) throws IOException {
        String filename = System.currentTimeMillis() + "_" + file.getOriginalFilename();
        File saveFile = new File("./uploads/" + filename);
        if (!saveFile.getParentFile().exists()) saveFile.getParentFile().mkdirs();
        file.transferTo(saveFile);
        
        return Map.of("url", "http://localhost:8080/images/" + filename);
    }

    // 3. 调用 Gemini 生成文案 (核心)
    @PostMapping("/generate")
    public String generateCopy(@RequestBody Map<String, String> payload) {
        String keyword = payload.get("keyword");
        // 这里调用你的 Gemini 工具类
        // 提示词要求返回包含 title, shareText 等字段的 JSON
        return GeminiService.call(keyword); 
    }

    // 4. 获取模版数据 (JSON DSL)
    @GetMapping("/template")
    public Map<String, Object> getTemplate() {
        // 直接读取本地 JSON 文件返回，或者硬编码返回
        // 包含 轮播图、分享图 的结构定义
        return MockData.getTemplateJson(); 
    }
}

```

#### C. AI 调用工具类 (简化版)

使用 Java 11+ 的 `HttpClient`，无需引入额外依赖。

```java
public class AIService {
    private static final String API_KEY = "你的deepseek api";
    private static final String API_URL = "https://api.deepseek.com/chat/completions";

    public static String call(String keyword) {
        // 构造 Prompt，要求返回纯 JSON
        String prompt = "请根据关键词'" + keyword + "'生成电商文案(标题、卖点、分享语)... 返回JSON格式...";
        
        String requestBody = "{ \"contents\": [{ \"parts\": [{ \"text\": \"" + prompt + "\" }] }] }";

        // 发送 HTTP POST 请求...
        // 解析返回的 JSON，提取 text 字段
        return jsonResponse;
    }
}

```

---

### 🎨 4. 前端开发 (Vue 3 + Fabric.js)

#### A. 安装依赖

```bash
npm install fabric axios

```

#### B. 核心页面逻辑 (`App.vue`)

这个页面将包含：**左侧操作栏** 和 **右侧 Canvas 预览**。

```html
<template>
  <div class="container">
    <div class="sidebar">
      <input type="file" @change="handleUpload" />
      <input v-model="keyword" placeholder="输入产品关键词 (如: 法布朗红酒)" />
      <button @click="generateAI">✨ AI 一键生成</button>
      <button @click="exportAll">⬇️ 导出所有图片</button>
      
      <div class="text-preview" v-if="aiResult">
        <h4>朋友圈文案：</h4>
        <textarea v-model="aiResult.shareText" rows="4"></textarea>
      </div>
    </div>

    <div class="canvas-area">
      <h3>1. 轮播主图 (800x800)</h3>
      <canvas id="c-main"></canvas>
      
      <h3>2. 分享卡片 (5:4)</h3>
      <canvas id="c-share"></canvas>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { fabric } from 'fabric';
import axios from 'axios';

const keyword = ref('');
const aiResult = ref(null);
let canvasMain = null;
let canvasShare = null;
let userImgUrl = null; // 暂存用户上传的图片URL

// 初始化画布
onMounted(() => {
  canvasMain = new fabric.Canvas('c-main', { width: 800, height: 800 });
  canvasShare = new fabric.Canvas('c-share', { width: 500, height: 400 }); // 5:4 比例
  
  // 加载默认模版 (从后端获取 JSON)
  loadTemplate();
});

// 1. 上传图片
const handleUpload = async (e) => {
  const file = e.target.files[0];
  const formData = new FormData();
  formData.append('file', file);
  
  const res = await axios.post('http://localhost:8080/api/upload', formData);
  userImgUrl = res.data.url;
  
  // 核心：替换画布中的槽位图片
  replaceSlotImage(canvasMain, 'slot_product', userImgUrl);
  replaceSlotImage(canvasShare, 'slot_product', userImgUrl);
};

// 2. AI 生成
const generateAI = async () => {
  const res = await axios.post('http://localhost:8080/api/generate', { keyword: keyword.value });
  aiResult.value = JSON.parse(res.data); // 假设后端返回的是 JSON 字符串
  
  // 更新画布上的文字
  updateText(canvasMain, 'text_title', aiResult.value.shortTitle);
  updateText(canvasShare, 'text_title', aiResult.value.productTitle);
};

// 工具函数：智能替换图片 (Cover模式)
function replaceSlotImage(canvas, slotId, imgUrl) {
  const slot = canvas.getObjects().find(o => o.id === slotId);
  if (!slot) return;
  
  fabric.Image.fromURL(imgUrl, (img) => {
    // ... 这里填入上一条回复中的“缩放+裁剪”算法代码 ...
    // 计算 scale, 设置 clipPath
    
    // 替换逻辑：插入新图，移除旧槽位(或隐藏)
    canvas.add(img);
    canvas.sendToBack(img); // 根据层级调整
    canvas.renderAll();
  });
}

// 工具函数：更新文字
function updateText(canvas, id, text) {
  const textObj = canvas.getObjects().find(o => o.id === id);
  if (textObj) {
    textObj.set('text', text);
    canvas.renderAll();
  }
}
</script>

```

---

### 📝 5. 数据协议 (MVP版 `mock_template.json`)

为了让你快速跑通，后端接口 `/template` 可以直接返回这个硬编码的 JSON：

```json
{
  "main": {
    "width": 800, 
    "height": 800,
    "layers": [
      { "type": "rect", "fill": "#f0f0f0", "width": 800, "height": 800 },
      { "type": "image-slot", "id": "slot_product", "left": 0, "top": 0, "width": 800, "height": 800 },
      { "type": "rect", "fill": "black", "opacity": 0.4, "width": 800, "height": 200, "top": 600 },
      { "type": "text", "id": "text_title", "text": "等待AI生成标题...", "fill": "white", "top": 650, "left": 400, "originX": "center" }
    ]
  },
  "share": {
    "width": 500,
    "height": 400,
    "layers": [
       // ... 类似结构，比例不同
    ]
  }
}

```

### 🚀 6. 你的下一步行动 (MVP Checklist)

1. **创建 Java Spring Boot 项目：** 只需勾选 `Spring Web` 依赖。
2. **创建 Vue 项目：** `npm create vue@latest`。
3. **实现“上传接口”：** 确保你能把图片存到 `uploads` 文件夹，并能通过浏览器访问到它。
4. **跑通 Fabric.js：** 在 Vue 里画出一个红色的矩形，证明 Canvas 工作正常。
5. **实现“替换”：** 写死一个图片 URL，调用 `replaceSlotImage` 函数，看看能不能完美填充进 Canvas 的方框里。

这个方案去掉了所有花哨的中间件，全是“硬桥硬马”的 Java 和 Vue 代码，非常适合本地快速验证可行性。需要我提供 `replaceSlotImage` 完整的数学计算代码吗？（那个有点繁琐但很重要）。


### 工程
product-editor-client：客户端工程代码
product-editor-server: 服务端工程代码