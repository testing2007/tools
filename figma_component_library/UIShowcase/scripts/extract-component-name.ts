/**
 * 从 TypeScript 文件中提取组件名称
 */

import fs from 'fs';

export interface ComponentInfo {
  fileName: string;
  exportName: string | null;
  functionName: string | null;
  hasMultipleExports: boolean;
  namedExports: string[];
}

export function extractComponentName(filePath: string): ComponentInfo {
  const content = fs.readFileSync(filePath, 'utf8');
  const fileName = filePath.split('/').pop()?.replace('.tsx', '') || '';

  // 提取默认导出的函数名
  const defaultExportMatch = content.match(/export\s+default\s+(?:function\s+)?(\w+)/);
  const functionName = defaultExportMatch?.[1] || null;

  // 提取所有命名导出
  const namedExportMatches = content.matchAll(/export\s+(?:function|const|class)\s+(\w+)/g);
  const namedExports = Array.from(namedExportMatches).map(m => m[1]);

  // 检查是否有 export { ... }
  const exportListMatch = content.match(/export\s*\{\s*([^}]+)\s*\}/);
  if (exportListMatch) {
    const exports = exportListMatch[1]
      .split(',')
      .map(e => e.trim().split(/\s+as\s+/)[0].trim())
      .filter(Boolean);
    namedExports.push(...exports);
  }

  return {
    fileName,
    exportName: functionName,
    functionName,
    hasMultipleExports: namedExports.length > 0,
    namedExports: Array.from(new Set(namedExports))
  };
}

export function getPreferredComponentName(
  componentInfo: ComponentInfo,
  config?: { exportName?: string }
): string {
  // 优先使用配置的名称
  if (config?.exportName) {
    return config.exportName;
  }

  // 使用导出的函数名
  if (componentInfo.exportName) {
    return componentInfo.exportName;
  }

  // 使用文件名
  return componentInfo.fileName;
}
