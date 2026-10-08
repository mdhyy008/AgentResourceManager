import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

/**
 * 三段式构建：main / preload / renderer 各自独立打包。
 *
 * main 与 preload 走 externalizeDepsPlugin，把 package.json 里的 dependencies
 * （目前只有 yaml）留成运行时 require，不打进产物；renderer 由 Vite 正常打包。
 * 目录沿用 electron-vite 的默认约定（src/main、src/preload、src/renderer）。
 */
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    plugins: [react()],
  },
});
