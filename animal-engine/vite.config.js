import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";
import fs from "node:fs";
import path from "node:path";

function copyMiniProgramAssets() {
  function copyDir(name) {
    const inputDir = process.env.UNI_INPUT_DIR || process.cwd();
    const outputDir = process.env.UNI_OUTPUT_DIR;
    if (!outputDir) {
      return;
    }

    const from = path.resolve(inputDir, name);
    const to = path.resolve(outputDir, name);
    if (!fs.existsSync(from)) {
      return;
    }

    // tabbar 图标和原生 custom-tab-bar 都必须真实存在于小程序包内。
    fs.cpSync(from, to, { recursive: true });
  }

  function copyAssets() {
    copyDir("static");
    copyDir("custom-tab-bar");
  }

  return {
    name: "copy-mini-program-assets",
    buildStart: copyAssets,
    closeBundle: copyAssets
  };
}

export default defineConfig({
  plugins: [uni(), copyMiniProgramAssets()]
});
