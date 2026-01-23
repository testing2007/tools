import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: '/listen/',  // Deployment base path
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: false
  }
})
