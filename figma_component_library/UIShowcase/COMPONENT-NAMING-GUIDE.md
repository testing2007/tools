# 组件命名配置指南

## ✅ 问题已解决

之前 `Container.tsx` 的命名问题已经通过配置文件解决了!

- **原文件名**: `Container.tsx`
- **原组件名**: `Container` (太通用)
- **新导出名**: `UIShowcase` (更语义化)

## 📝 如何配置组件名称

编辑 `scripts/component-config.json`:

```json
{
  "components": {
    "Container": {
      "exportName": "UIShowcase",
      "description": "南美团队小程序 UI 组件库展示"
    },
    "Button": {
      "exportName": "PrimaryButton",
      "description": "主按钮组件"
    }
  }
}
```

### 配置说明

- **键名**: 原始文件夹名称 (如 `Container`)
- **exportName**: 导出时使用的组件名称
- **description**: 组件描述(可选)
- **extractSubComponents**: 是否提取子组件(未来功能)

## 🎯 命名策略

脚本会按以下优先级选择组件名:

1. **配置的 exportName** - `component-config.json` 中的自定义名称
2. **代码中的函数名** - `export default function XXX()` 中的 XXX
3. **文件夹名** - 作为最后的回退

## 📦 使用示例

### 安装

```bash
npm install wine
```

### 导入组件

```tsx
import { UIShowcase } from 'wine';

function App() {
  return (
    <div>
      <UIShowcase />
    </div>
  );
}
```

## 🔍 查看组件信息

运行构建脚本后,检查 `lib/manifest.json`:

```json
{
  "components": [
    {
      "name": "UIShowcase",           // 导出名称
      "originalName": "Container",     // 原始文件夹名
      "exportedFunction": "Container", // 代码中的函数名
      "hasAssets": true,
      "files": {
        "main": "Container.tsx",
        "svg": "svg-83rjgddnlz.ts"
      }
    }
  ]
}
```

## 🚀 添加新组件

1. **在 Figma 中导入新组件** 到 `src/imports/NewComponent/`

2. **运行扫描**:
   ```bash
   pnpm run lib:create
   ```

3. **检查组件名称** - 如果需要重命名,编辑 `component-config.json`:
   ```json
   {
     "components": {
       "NewComponent": {
         "exportName": "BetterName"
       }
     }
   }
   ```

4. **重新生成**:
   ```bash
   pnpm run lib:create
   ```

## 💡 最佳实践

### 好的命名 ✅

- `UIShowcase` - 语义清晰
- `PrimaryButton` - 具体明确
- `UserProfileCard` - 描述性强
- `NavigationMenu` - 用途明确

### 不好的命名 ❌

- `Container` - 太通用
- `Component1` - 无意义
- `Temp` - 临时名称
- `NewNew` - 不专业

## 🔧 高级配置

### 批量重命名

如果你有多个组件需要重命名:

```json
{
  "components": {
    "Container": { "exportName": "UIShowcase" },
    "Button1": { "exportName": "PrimaryButton" },
    "Button2": { "exportName": "SecondaryButton" },
    "Card": { "exportName": "InfoCard" },
    "List": { "exportName": "ItemList" }
  }
}
```

### 命名规范

```json
{
  "defaultNaming": {
    "useExportName": true,
    "fallbackToFileName": true
  }
}
```

## 📊 构建日志

运行 `pnpm run lib:create` 时,你会看到:

```
📦 扫描组件目录...
  ✓ 发现组件: Container → UIShowcase
  ✓ 发现组件: Button1 → PrimaryButton
  
✅ 共找到 2 个组件
```

重命名的组件会用 `→` 箭头显示。

## 🎨 示例项目结构

```
src/imports/
├── Container/           # 原始文件夹名
│   ├── Container.tsx    # 原始文件名
│   └── svg-xxx.ts
├── Button1/
│   └── Button1.tsx
└── Card/
    └── Card.tsx

↓ 构建后

lib/components/
├── UIShowcase/          # 使用配置的导出名
│   ├── Container.tsx
│   └── svg-xxx.ts
├── PrimaryButton/
│   └── Button1.tsx
└── InfoCard/
    └── Card.tsx
```

## 🤔 常见问题

### Q: 我可以在不改文件的情况下改组件名吗?

A: 可以! 这正是 `component-config.json` 的作用。

### Q: 配置会影响原始文件吗?

A: 不会。原始文件保持不变,只影响导出的组件库。

### Q: 如果我删除配置会怎样?

A: 会使用代码中的函数名,或回退到文件夹名。

### Q: 支持中文组件名吗?

A: 技术上可以,但不推荐。建议使用英文驼峰命名。

## 📚 相关文档

- [组件库创建指南](./COMPONENT-LIBRARY-GUIDE.md)
- [package.json 配置](./lib-package.json)
- [组件清单](./lib/manifest.json)
