import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// In development the API runs on :3001 and Vite proxies /api to it, so the browser
// sees a single origin (cookies stay first-party, no CORS needed). In production the
// Express server serves the built app and the API from the same origin.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: false } },
  },
  preview: { proxy: { '/api': 'http://localhost:3001' } },
})
