#!/usr/bin/env tsx

/**
 * 组件库发布脚本
 * 自动化发布流程
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

interface PublishOptions {
  publish?: boolean;
  skipInstall?: boolean;
  tag?: string;
}

class LibraryPublisher {
  private libPackageJsonPath: string;
  private packageJsonPath: string;

  constructor() {
    this.libPackageJsonPath = path.join(ROOT_DIR, 'lib-package.json');
    this.packageJsonPath = path.join(ROOT_DIR, 'package.json');
  }

  /**
   * 执行命令
   */
  exec(command: string, options: Record<string, any> = {}): boolean {
    console.log(`🔧 执行: ${command}`);
    try {
      execSync(command, {
        stdio: 'inherit',
        cwd: ROOT_DIR,
        ...options
      });
      return true;
    } catch (error) {
      console.error(`❌ 命令执行失败: ${command}`);
      return false;
    }
  }

  /**
   * 检查必要文件
   */
  checkFiles(): void {
    console.log('📋 检查必要文件...\n');

    const requiredFiles = [
      'lib/index.ts',
      'lib-package.json',
      'tsup.config.ts'
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(ROOT_DIR, file);
      if (!fs.existsSync(filePath)) {
        console.error(`❌ 缺少必要文件: ${file}`);
        console.log('💡 请先运行: pnpm run lib:create\n');
        process.exit(1);
      }
    }

    console.log('✅ 所有必要文件存在\n');
  }

  /**
   * 安装依赖
   */
  installDependencies(): void {
    console.log('📦 安装构建依赖...\n');

    if (!this.exec('pnpm add -D tsup typescript tsx @types/react @types/react-dom')) {
      process.exit(1);
    }

    console.log('\n✅ 依赖安装完成\n');
  }

  /**
   * 构建组件库
   */
  build(): void {
    console.log('🔨 构建组件库...\n');

    if (!this.exec('pnpm tsup')) {
      console.error('❌ 构建失败');
      process.exit(1);
    }

    console.log('\n✅ 构建完成\n');
  }

  /**
   * 准备发布文件
   */
  preparePublish(): void {
    console.log('📦 准备发布文件...\n');

    const distDir = path.join(ROOT_DIR, 'dist');
    if (!fs.existsSync(distDir)) {
      console.error('❌ dist 目录不存在');
      process.exit(1);
    }

    const libPackageJson = JSON.parse(fs.readFileSync(this.libPackageJsonPath, 'utf8'));
    fs.writeFileSync(
      path.join(distDir, 'package.json'),
      JSON.stringify(libPackageJson, null, 2)
    );

    const readmePath = path.join(ROOT_DIR, 'LIB-README.md');
    if (fs.existsSync(readmePath)) {
      fs.copyFileSync(readmePath, path.join(distDir, 'README.md'));
    }

    console.log('✅ 发布文件准备完成\n');
  }

  /**
   * 发布到 npm
   */
  publish(tag: string = 'latest'): void {
    console.log(`📤 发布到 npm (tag: ${tag})...\n`);

    const distDir = path.join(ROOT_DIR, 'dist');

    console.log('⚠️  即将发布组件库到 npm');
    console.log('请确认:');
    console.log('  1. 已登录 npm (npm login)');
    console.log('  2. 版本号正确');
    console.log('  3. 包名未被占用\n');

    if (!this.exec(`cd ${distDir} && npm publish --tag ${tag}`)) {
      console.error('❌ 发布失败');
      process.exit(1);
    }

    console.log('\n✅ 发布成功!\n');
  }

  /**
   * 完整发布流程
   */
  async run(options: PublishOptions = {}): Promise<void> {
    console.log('🚀 开始组件库发布流程...\n');

    this.checkFiles();

    if (!options.skipInstall) {
      this.installDependencies();
    }

    this.build();
    this.preparePublish();

    if (options.publish) {
      this.publish(options.tag);
    } else {
      console.log('💡 使用 --publish 参数来发布到 npm');
      console.log('或手动执行: cd dist && npm publish\n');
    }

    console.log('✨ 完成!\n');
  }
}

const args = process.argv.slice(2);
const options: PublishOptions = {
  publish: args.includes('--publish'),
  skipInstall: args.includes('--skip-install'),
  tag: args.find(arg => arg.startsWith('--tag='))?.split('=')[1] || 'latest'
};

const publisher = new LibraryPublisher();
publisher.run(options).catch(console.error);
