import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    port: 5173,
    proxy: {
      // In dev, proxy /api/* → local Flask on 5000
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // Ensure the SPA fallback works on Vercel
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
})
