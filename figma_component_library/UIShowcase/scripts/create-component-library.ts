#!/usr/bin/env tsx

/**
 * 组件库构建脚本
 * 自动扫描 src/imports 目录,生成组件库结构
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractComponentName, getPreferredComponentName, type ComponentInfo } from './extract-component-name';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const IMPORTS_DIR = path.join(ROOT_DIR, 'src', 'imports');
const LIB_DIR = path.join(ROOT_DIR, 'lib');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const CONFIG_PATH = path.join(ROOT_DIR, 'scripts', 'component-config.json');

interface Component {
  name: string;
  exportName: string;
  originalName: string;
  path: string;
  mainFile: string;
  svgFile: string | null;
  hasAssets: boolean;
  componentInfo: ComponentInfo;
}

interface ComponentConfig {
  components?: Record<string, {
    exportName?: string;
    description?: string;
    extractSubComponents?: boolean;
  }>;
  defaultNaming?: {
    useExportName?: boolean;
    fallbackToFileName?: boolean;
  };
}

class ComponentLibraryBuilder {
  private components: Component[] = [];
  private config: ComponentConfig = {};

  /**
   * 加载配置
   */
  loadConfig(): void {
    if (fs.existsSync(CONFIG_PATH)) {
      try {
        this.config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        console.log('📋 已加载组件配置\n');
      } catch (error) {
        console.warn('⚠️  配置文件加载失败,使用默认配置\n');
      }
    }
  }

  /**
   * 扫描组件目录
   */
  scanComponents(): void {
    console.log('📦 扫描组件目录...');

    if (!fs.existsSync(IMPORTS_DIR)) {
      console.error('❌ imports 目录不存在');
      return;
    }

    const entries = fs.readdirSync(IMPORTS_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const componentPath = path.join(IMPORTS_DIR, entry.name);
        const componentFiles = fs.readdirSync(componentPath);

        const tsxFile = componentFiles.find(f => f.endsWith('.tsx'));
        const svgFile = componentFiles.find(f => f.startsWith('svg-'));

        if (tsxFile) {
          const tsxPath = path.join(componentPath, tsxFile);
          const componentInfo = extractComponentName(tsxPath);
          const componentConfig = this.config.components?.[entry.name];
          const exportName = getPreferredComponentName(componentInfo, componentConfig);

          this.components.push({
            name: exportName,
            exportName: exportName,
            originalName: entry.name,
            path: componentPath,
            mainFile: tsxFile,
            svgFile: svgFile || null,
            hasAssets: svgFile !== null,
            componentInfo
          });

          if (exportName !== entry.name) {
            console.log(`  ✓ 发现组件: ${entry.name} → ${exportName}`);
          } else {
            console.log(`  ✓ 发现组件: ${exportName}`);
          }

          if (componentInfo.hasMultipleExports) {
            console.log(`    ℹ️  包含命名导出: ${componentInfo.namedExports.join(', ')}`);
          }
        }
      }
    }

    console.log(`\n✅ 共找到 ${this.components.length} 个组件\n`);
  }

  /**
   * 创建 lib 目录结构
   */
  createLibStructure(): void {
    console.log('📁 创建组件库目录结构...');

    if (fs.existsSync(LIB_DIR)) {
      fs.rmSync(LIB_DIR, { recursive: true });
    }

    fs.mkdirSync(LIB_DIR, { recursive: true });
    fs.mkdirSync(path.join(LIB_DIR, 'components'), { recursive: true });

    console.log('✅ 目录结构创建完成\n');
  }

  /**
   * 复制组件文件
   */
  copyComponents(): void {
    console.log('📋 复制组件文件...');

    for (const component of this.components) {
      const targetDir = path.join(LIB_DIR, 'components', component.exportName);
      fs.mkdirSync(targetDir, { recursive: true });

      const sourceFiles = fs.readdirSync(component.path);
      for (const file of sourceFiles) {
        const sourcePath = path.join(component.path, file);
        const targetPath = path.join(targetDir, file);
        fs.copyFileSync(sourcePath, targetPath);
      }

      if (component.exportName !== component.originalName) {
        console.log(`  ✓ 复制: ${component.originalName} → ${component.exportName}`);
      } else {
        console.log(`  ✓ 复制: ${component.exportName}`);
      }
    }

    console.log('✅ 组件文件复制完成\n');
  }

  /**
   * 生成主入口文件
   */
  generateIndex(): void {
    console.log('📝 生成入口文件...');

    const imports = this.components.map(c =>
      `export { default as ${c.exportName} } from './components/${c.exportName}/${c.mainFile.replace('.tsx', '')}';`
    ).join('\n');

    const indexContent = `/**
 * 自动生成的组件库入口文件
 * 生成时间: ${new Date().toISOString()}
 */

${imports}

export const components = {
${this.components.map(c => `  ${c.exportName},`).join('\n')}
};
`;

    fs.writeFileSync(path.join(LIB_DIR, 'index.ts'), indexContent);
    console.log('✅ index.ts 生成完成\n');
  }

  /**
   * 生成类型定义
   */
  generateTypes(): void {
    console.log('📝 生成类型定义...');

    const typesContent = `/**
 * 组件库类型定义
 */

import React from 'react';
${this.components.map(c => `import ${c.exportName} from './components/${c.exportName}/${c.mainFile.replace('.tsx', '')}';`).join('\n')}

${this.components.map(c => `export type ${c.exportName}Props = React.ComponentProps<typeof ${c.exportName}>;`).join('\n')}

export interface ComponentLibrary {
${this.components.map(c => `  ${c.exportName}: typeof ${c.exportName};`).join('\n')}
}
`;

    fs.writeFileSync(path.join(LIB_DIR, 'types.ts'), typesContent);
    console.log('✅ types.ts 生成完成\n');
  }

  /**
   * 生成组件清单
   */
  generateManifest(): void {
    console.log('📝 生成组件清单...');

    const manifest = {
      name: 'wine',
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      components: this.components.map(c => ({
        name: c.exportName,
        originalName: c.originalName !== c.exportName ? c.originalName : undefined,
        exportedFunction: c.componentInfo.functionName,
        hasAssets: c.hasAssets,
        hasMultipleExports: c.componentInfo.hasMultipleExports,
        namedExports: c.componentInfo.namedExports.length > 0 ? c.componentInfo.namedExports : undefined,
        files: {
          main: c.mainFile,
          svg: c.svgFile
        }
      }))
    };

    fs.writeFileSync(
      path.join(LIB_DIR, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    console.log('✅ manifest.json 生成完成\n');
  }

  /**
   * 生成 package.json
   */
  generatePackageJson(): void {
    console.log('📝 生成 package.json...');

    const packageJson = {
      name: 'wine',
      version: '1.0.0',
      description: '基于 Figma 设计的 React 组件库',
      type: 'module',
      main: './index.js',
      module: './index.js',
      types: './index.d.ts',
      exports: {
        '.': {
          import: './index.js',
          types: './index.d.ts'
        },
        './components/*': './components/*'
      },
      files: [
        '*',
        'components/**/*'
      ],
      peerDependencies: {
        react: '>=18.0.0',
        'react-dom': '>=18.0.0'
      },
      keywords: [
        'react',
        'components',
        'figma',
        'ui',
        'tailwind'
      ],
      license: 'MIT'
    };

    fs.writeFileSync(
      path.join(ROOT_DIR, 'lib-package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    console.log('✅ lib-package.json 生成完成\n');
  }

  /**
   * 生成 tsup 配置
   */
  generateTsupConfig(): void {
    console.log('📝 生成 tsup 配置...');

    const tsupConfig = `import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['lib/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  external: ['react', 'react-dom'],
  outDir: 'dist',
});
`;

    fs.writeFileSync(path.join(ROOT_DIR, 'tsup.config.ts'), tsupConfig);
    console.log('✅ tsup.config.ts 生成完成\n');
  }

  /**
   * 生成 TypeScript 配置
   */
  generateTsConfig(): void {
    console.log('📝 生成 TypeScript 配置...');

    const tsConfig = {
      compilerOptions: {
        target: 'ES2020',
        useDefineForClassFields: true,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx',
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
        declaration: true,
        declarationMap: true
      },
      include: ['lib/**/*'],
      exclude: ['node_modules', 'dist']
    };

    fs.writeFileSync(
      path.join(ROOT_DIR, 'tsconfig.lib.json'),
      JSON.stringify(tsConfig, null, 2)
    );

    console.log('✅ tsconfig.lib.json 生成完成\n');
  }

  /**
   * 生成 README
   */
  generateReadme(): void {
    console.log('📝 生成 README...');

    const readme = `# Wine Component Library

基于 Figma 设计的 React 组件库

## 安装

\`\`\`bash
npm install wine
# 或
pnpm add wine
\`\`\`

## 使用

\`\`\`tsx
import { ${this.components[0]?.name || 'Container'} } from 'wine';

function App() {
  return <${this.components[0]?.name || 'Container'} />;
}
\`\`\`

## 可用组件

${this.components.map(c => `- \`${c.name}\``).join('\n')}

共 ${this.components.length} 个组件

## 开发

### 构建组件库

\`\`\`bash
# 创建组件库结构
pnpm run lib:create

# 构建
pnpm run lib:build

# 监听模式
pnpm run lib:watch
\`\`\`

### 发布

\`\`\`bash
# 登录 npm
npm login

# 发布
pnpm run lib:publish
\`\`\`

## 技术栈

- React 18+
- TypeScript
- Tailwind CSS
- tsup (构建工具)

## License

MIT
`;

    fs.writeFileSync(path.join(ROOT_DIR, 'LIB-README.md'), readme);
    console.log('✅ LIB-README.md 生成完成\n');
  }

  /**
   * 执行完整构建流程
   */
  async build(): Promise<void> {
    console.log('🚀 开始构建组件库...\n');

    this.loadConfig();
    this.scanComponents();

    if (this.components.length === 0) {
      console.error('❌ 没有找到任何组件,退出构建');
      process.exit(1);
    }

    this.createLibStructure();
    this.copyComponents();
    this.generateIndex();
    this.generateTypes();
    this.generateManifest();
    this.generatePackageJson();
    this.generateTsupConfig();
    this.generateTsConfig();
    this.generateReadme();

    console.log('✨ 组件库构建完成!\n');
    console.log('📦 下一步:');
    console.log('  1. 检查 lib/ 目录');
    console.log('  2. 安装依赖: pnpm add -D tsup typescript tsx');
    console.log('  3. 构建: pnpm run lib:build');
    console.log('  4. 发布: pnpm run lib:publish\n');
  }
}

const builder = new ComponentLibraryBuilder();
builder.build().catch(console.error);
