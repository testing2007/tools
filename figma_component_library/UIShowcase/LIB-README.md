# Wine Component Library

基于 Figma 设计的 React 组件库

## 安装

```bash
npm install wine
# 或
pnpm add wine
```

## 使用

```tsx
import { UIShowcase } from 'wine';

function App() {
  return <UIShowcase />;
}
```

## 可用组件

- `UIShowcase`

共 1 个组件

## 开发

### 构建组件库

```bash
# 创建组件库结构
pnpm run lib:create

# 构建
pnpm run lib:build

# 监听模式
pnpm run lib:watch
```

### 发布

```bash
# 登录 npm
npm login

# 发布
pnpm run lib:publish
```

## 技术栈

- React 18+
- TypeScript
- Tailwind CSS
- tsup (构建工具)

## License

MIT
