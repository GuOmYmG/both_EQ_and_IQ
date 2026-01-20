import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3003,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'PROCESS_ENV': JSON.stringify({
          WORKERS_CI_COMMIT_SHA: 'unknown',
          WORKERS_CI_BRANCH: 'main'
        })
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          '@mesh2motion': path.resolve(__dirname, '../mesh2motion/src'),
        },
        extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
        // 确保能够从 soullink 的 node_modules 解析依赖
        dedupe: ['three', 'tippy.js', 'jszip', 'file-saver'],
        // 确保模块解析从当前项目的 node_modules 开始
        preserveSymlinks: false
      },
      optimizeDeps: {
        include: ['three', 'tippy.js', 'jszip', 'file-saver']
      }
    };
});
