import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";
import { cpSync, existsSync } from "fs";
import { resolve } from "path";
import type { Plugin } from "vite";

/**
 * 每次编译完成后，将 cloudfunctions 复制到产物目录
 * 微信开发者工具需要在产物目录中看到云函数
 */
function copyCloudFunctions(): Plugin {
  const src = resolve(__dirname, "cloudfunctions");
  let outDir = "";

  return {
    name: "copy-cloudfunctions",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    writeBundle() {
      if (!existsSync(src)) return;
      // outDir 类似 dist/dev/mp-weixin
      const dest = resolve(outDir, "cloudfunctions");
      try {
        cpSync(src, dest, { recursive: true });
        console.log("[copy-cloudfunctions] 已复制云函数到", dest);
      } catch (e) {
        // 静默
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uni(), copyCloudFunctions()],
});
