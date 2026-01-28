import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: '/tools/listen/',  // Updated deployment base path
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: false,
    proxy: {
      '/tools/listen-api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tools\/listen-api/, '')
      },
      '/tools/listen/uploads': {
        target: 'http://localhost',  // nginx on port 80
        changeOrigin: true
      }
    }
  }
})
