import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // Load .env file based on `mode` (e.g. development, production)
  const env = loadEnv(mode, process.cwd(), '');

  // If VITE_API_URL is set in .env, use it, otherwise use default for dev proxy
  const API_URL = env.VITE_API_URL || 'http://localhost:3001';

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: API_URL,
          changeOrigin: true,
        },
        '/health': {
          target: API_URL,
          changeOrigin: true,
        },
      },
    },
  }
})
