import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Stable framework code in its own chunk so the 1y-immutable asset
          // cache (nginx.conf) survives app deploys for repeat visitors.
          vendor: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query', 'axios', 'zustand'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://backend:8000', ws: true },
    },
  },
})
