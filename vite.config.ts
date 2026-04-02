import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
  plugins: [tailwindcss(), react()],
  build: {
    minify: process.env.NODE_ENV === 'production',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
    },
    outDir: 'dist',
  },
  // Use '/' for Vercel, './' for Electron
  base: process.env.VERCEL ? '/' : './',
  server: {
    cors: true,
    port: 5173,
  },
})
