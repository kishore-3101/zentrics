
import { defineConfig, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const apiProxy: ProxyOptions = {
  target: 'http://localhost:8000',
  changeOrigin: true,
  bypass(req) {
    if (req.headers.accept?.includes('text/html') || req.headers['sec-fetch-dest'] === 'document') {
      return '/index.html';
    }
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    allowedHosts: true,
    port: 5173,
    proxy: {
      '/health': apiProxy,
      '/alerts': apiProxy,
      '/rings': apiProxy,
      '/cases': apiProxy,
      '/metrics': apiProxy,
      '/overview': apiProxy,
      '/simulation': apiProxy,
      '/accounts': apiProxy,
    }
  }
})
