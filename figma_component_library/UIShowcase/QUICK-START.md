# Wine 组件库 - 快速开始

## 📦 方案一：发布到 npm 后使用（推荐）

### 步骤 1: 构建组件库

```bash
# 在当前项目目录下
cd /workspaces/default/code

# 构建组件库
pnpm run lib:build
```

构建完成后会生成 `dist/` 目录。

### 步骤 2: 发布到 npm

```bash
# 登录 npm（只需要做一次）
npm login

# 发布组件库
pnpm run lib:publish
```

**注意事项：**
- 包名 `wine` 可能已被占用，需要改成 `@your-username/wine` 
- 编辑 `lib-package.json` 修改包名：
  ```json
  {
    "name": "@your-username/wine",
    "version": "1.0.0"
  }
  ```

### 步骤 3: 在其他项目中使用

```bash
# 在你的新项目中安装
npm install wine
# 或如果你改了包名
npm install @your-username/wine
```

### 步骤 4: 导入使用

```tsx
// 在你的 React 项目中
import { UIShowcase } from 'wine';

function App() {
  return (
    <div>
      <UIShowcase />
    </div>
  );
}

export default App;
```

---

## 📦 方案二：本地链接测试（不发布到 npm）

如果你想先本地测试，不着急发布到 npm：

### 步骤 1: 构建组件库

```bash
cd /workspaces/default/code
pnpm run lib:build
```

### 步骤 2: 创建本地链接

```bash
# 在 dist 目录创建 npm link
cd dist
npm link
```

### 步骤 3: 在其他项目中链接

```bash
# 在你的新项目目录下
cd /path/to/your-new-project
npm link wine
```

### 步骤 4: 使用组件

```tsx
import { UIShowcase } from 'wine';

function App() {
  return <UIShowcase />;
}
```

### 取消链接

```bash
# 在你的项目中
npm unlink wine

# 在组件库的 dist 目录
cd /workspaces/default/code/dist
npm unlink
```

---

## 📦 方案三：直接复制文件（最简单但不推荐）

### 直接复制 lib 目录

```bash
# 复制整个 lib 目录到你的新项目
cp -r /workspaces/default/code/lib /path/to/your-project/src/wine
```

### 使用组件

```tsx
import { UIShowcase } from './wine';

function App() {
  return <UIShowcase />;
}
```

---

## 📦 方案四：使用 pnpm workspace（适合 monorepo）

### 项目结构

```
my-project/
├── packages/
│   ├── wine/           # 组件库
│   └── app/            # 你的应用
└── package.json
```

### 根目录 package.json

```json
{
  "name": "my-monorepo",
  "private": true,
  "workspaces": [
    "packages/*"
  ]
}
```

### 使用组件

```bash
# 在 app 的 package.json 中
{
  "dependencies": {
    "wine": "workspace:*"
  }
}
```

```tsx
import { UIShowcase } from 'wine';
```

---

## 🎯 推荐流程

### 对于个人项目
1. 使用**方案二（本地链接）** 先测试
2. 确认没问题后，使用**方案一** 发布到 npm

### 对于团队项目
1. 发布到**私有 npm** 或使用**方案四（monorepo）**
2. 团队成员直接安装使用

### 对于快速原型
1. 使用**方案三（直接复制）**
2. 后期再重构为独立包

---

## 📝 完整示例

### 创建新的 React 项目并使用 wine

```bash
# 1. 创建新项目
npx create-react-app my-app
cd my-app

# 2. 安装 wine（假设已发布）
npm install wine

# 3. 修改 src/App.tsx
```

```tsx
import React from 'react';
import { UIShowcase } from 'wine';
import './App.css';

function App() {
  return (
    <div className="App">
      <UIShowcase />
    </div>
  );
}

export default App;
```

```bash
# 4. 启动项目
npm start
```

---

## 🔧 常见问题

### Q: 包名已被占用怎么办？

A: 使用带作用域的包名：

```json
{
  "name": "@your-username/wine",
  "version": "1.0.0"
}
```

### Q: 如何发布私有包？

```bash
# 发布到 npm 私有仓库
npm publish --access restricted

# 或使用企业私有 npm 仓库
npm publish --registry https://your-registry.com
```

### Q: 如何更新组件库版本？

```bash
# 1. 修改代码
# 2. 更新版本号（在 lib-package.json）
{
  "version": "1.1.0"
}

# 3. 重新构建和发布
pnpm run lib:build
pnpm run lib:publish
```

### Q: TypeScript 类型支持？

组件库已经包含 TypeScript 类型定义，使用时会自动获得类型提示。

```tsx
import { UIShowcase } from 'wine';
import type { UIShowcaseProps } from 'wine';

const props: UIShowcaseProps = {
  // 自动类型提示
};
```

---

## 📚 下一步

- 查看 [组件库构建指南](./COMPONENT-LIBRARY-GUIDE.md)
- 查看 [组件命名配置](./COMPONENT-NAMING-GUIDE.md)
- 查看 [发布的包内容](./lib-package.json)
