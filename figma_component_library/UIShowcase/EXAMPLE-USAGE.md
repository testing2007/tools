# Wine 组件库使用示例

## 🎨 在 React 项目中使用

### 安装后导入

```tsx
// App.tsx
import React from 'react';
import { UIShowcase } from 'wine';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <UIShowcase />
    </div>
  );
}

export default App;
```

---

## 📦 目前可用的组件

### UIShowcase - UI 组件库展示

这是一个完整的 UI 组件库展示页面，包含：
- 按钮组件（主按钮、次要按钮、危险按钮）
- 卡片组件
- 头像组件
- 标签组件
- 等等...

```tsx
import { UIShowcase } from 'wine';

<UIShowcase />
```

---

## 🔧 实际项目集成示例

### Next.js 项目

```tsx
// app/page.tsx
import { UIShowcase } from 'wine';

export default function Home() {
  return (
    <main>
      <UIShowcase />
    </main>
  );
}
```

### Vite + React 项目

```tsx
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { UIShowcase } from 'wine';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <UIShowcase />
  </React.StrictMode>,
);
```

### Create React App

```tsx
// src/App.tsx
import React from 'react';
import { UIShowcase } from 'wine';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>我的应用</h1>
      </header>
      <main>
        <UIShowcase />
      </main>
    </div>
  );
}

export default App;
```

---

## 🎯 TypeScript 支持

组件库自带 TypeScript 类型定义：

```tsx
import { UIShowcase } from 'wine';
import type { UIShowcaseProps } from 'wine';

// 获得完整的类型提示
const MyComponent: React.FC = () => {
  return <UIShowcase />;
};
```

---

## 📱 注意事项

### 1. 样式依赖

UIShowcase 使用了 Tailwind CSS，确保你的项目也安装了 Tailwind：

```bash
npm install -D tailwindcss
npx tailwindcss init
```

**tailwind.config.js:**
```js
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./node_modules/wine/**/*.{js,jsx,ts,tsx}", // 包含 wine 组件
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

### 2. React 版本

确保你的项目使用 React 18+：

```json
{
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}
```

---

## 🚀 快速测试

### 最小化示例

创建一个最简单的测试页面：

```tsx
// test.tsx
import { UIShowcase } from 'wine';

export default function Test() {
  return <UIShowcase />;
}
```

就这么简单！组件会自动渲染完整的 UI 展示页面。

---

## 🔄 本地开发调试

如果你在修改 wine 组件库，想实时看到效果：

```bash
# 终端 1: 监听组件库变化
cd /workspaces/default/code
pnpm run lib:build

# 终端 2: 运行你的应用
cd /path/to/your-app
npm start
```

每次修改组件库后重新构建，你的应用会自动刷新。

---

## 📖 下一步

- 添加更多组件到 `src/imports/` 
- 运行 `pnpm run lib:create` 重新生成
- 使用 `component-config.json` 重命名组件
