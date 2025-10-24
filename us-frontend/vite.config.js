/**
 * Vite配置文件 - 前端开发服务器配置
 * @file vite.config.js
 * @author LiqPass Team
 * @description 配置开发服务器代理设置，用于本地开发环境
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite配置定义 - 开发服务器代理设置
 */
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/catalog': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/orders': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/claim': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/healthz': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
