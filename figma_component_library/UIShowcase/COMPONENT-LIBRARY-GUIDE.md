# 组件库创建指南

这个项目提供了自动化脚本,可以将 `src/imports` 中的 Figma 组件转换成独立的 npm 组件库。

## 🚀 快速开始

### 1. 创建组件库结构

```bash
pnpm run lib:create
```

这个命令会:
- 扫描 `src/imports` 目录下的所有组件
- 创建 `lib/` 目录结构
- 复制所有组件文件
- 生成入口文件 `lib/index.ts`
- 生成类型定义 `lib/types.ts`
- 生成配置文件 (`tsup.config.ts`, `tsconfig.lib.json`, `lib-package.json`)

### 2. 构建组件库

```bash
pnpm run lib:build
```

这个命令会:
- 安装必要的依赖 (`tsup`, `typescript`, `tsx`)
- 使用 tsup 构建组件库
- 生成 `dist/` 目录,包含编译后的代码和类型定义

### 3. 发布到 npm

```bash
# 首先登录 npm
npm login

# 然后发布
pnpm run lib:publish
```

## 📁 生成的文件结构

```
your-project/
├── lib/                          # 组件库源码
│   ├── index.ts                  # 主入口文件
│   ├── types.ts                  # 类型定义
│   ├── manifest.json             # 组件清单
│   └── components/               # 组件目录
│       └── Container/
│           ├── Container.tsx
│           └── svg-xxx.ts
├── dist/                         # 构建输出
│   ├── index.js                  # 编译后的 JS
│   ├── index.d.ts                # 类型声明
│   ├── package.json              # npm 包配置
│   └── README.md                 # 使用文档
├── scripts/                      # 构建脚本
│   ├── create-component-library.ts
│   └── publish-library.ts
├── tsup.config.ts               # 构建配置
├── tsconfig.lib.json            # TypeScript 配置
├── lib-package.json             # npm 包信息
└── LIB-README.md                # 组件库文档
```

## 🛠 自定义配置

### 修改包名

编辑 `lib-package.json`:

```json
{
  "name": "@your-org/your-library-name",
  "version": "1.0.0"
}
```

### 添加更多导出

编辑生成的 `lib/index.ts`:

```typescript
// 自动生成的导出
export { default as Container } from './components/Container/Container';

// 添加自定义导出
export * from './types';
export { components } from './components';
```

### 配置构建选项

编辑 `tsup.config.ts`:

```typescript
export default defineConfig({
  entry: ['lib/index.ts'],
  format: ['esm', 'cjs'],  // 添加 CommonJS 支持
  dts: true,
  minify: true,            // 启用压缩
  // ... 更多配置
});
```

## 📦 使用组件库

安装后使用:

```tsx
import { Container } from '@your-org/your-library-name';

function App() {
  return <Container />;
}
```

## 🔄 工作流程

### 开发新组件

1. 在 `src/imports` 中添加新组件
2. 运行 `pnpm run lib:create` 重新生成
3. 运行 `pnpm run lib:build` 构建
4. 测试组件
5. 更新版本号
6. 发布

### 版本管理

更新 `lib-package.json` 中的版本号:

```json
{
  "version": "1.1.0"
}
```

遵循语义化版本:
- **MAJOR** (1.0.0): 不兼容的 API 变更
- **MINOR** (0.1.0): 向后兼容的功能新增
- **PATCH** (0.0.1): 向后兼容的问题修正

## 💡 高级用法

### 分包导出

如果想让用户可以单独导入组件:

```json
// lib-package.json
{
  "exports": {
    ".": "./index.js",
    "./Container": "./components/Container/Container.js"
  }
}
```

使用:

```tsx
import Container from '@your-org/your-library-name/Container';
```

### 添加样式

如果组件需要 CSS:

1. 创建 `lib/styles.css`
2. 在 `tsup.config.ts` 中添加:

```typescript
export default defineConfig({
  entry: ['lib/index.ts', 'lib/styles.css'],
  // ...
});
```

### 添加文档站点

使用 Storybook 或 VitePress:

```bash
# Storybook
pnpm add -D @storybook/react @storybook/react-vite storybook

# VitePress
pnpm add -D vitepress
```

## 🔍 故障排查

### 构建失败

1. 检查 TypeScript 配置
2. 确保所有依赖已安装
3. 查看 `tsup` 输出的错误信息

### 发布失败

1. 确认已登录 npm: `npm whoami`
2. 检查包名是否被占用
3. 确认权限是否正确

### 类型定义问题

确保 `tsconfig.lib.json` 配置正确:

```json
{
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true
  }
}
```

## 📚 参考资源

- [tsup 文档](https://tsup.egoist.dev/)
- [npm 发布指南](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [TypeScript 配置](https://www.typescriptlang.org/tsconfig)
- [语义化版本](https://semver.org/lang/zh-CN/)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request!

## 📄 License

MIT
