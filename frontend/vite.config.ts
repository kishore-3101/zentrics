
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    allowedHosts: true,
    port: 5173,
    proxy: {
      '/health': 'http://localhost:8000',
      '/alerts': 'http://localhost:8000',
      '/rings': 'http://localhost:8000',
      '/cases': 'http://localhost:8000',
      '/metrics': 'http://localhost:8000',
      '/overview': 'http://localhost:8000',
      '/simulation': 'http://localhost:8000',
      '/accounts': 'http://localhost:8000',
    }
  }
})
