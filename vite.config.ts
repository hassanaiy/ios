import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  optimizeDeps: {
    entries: ['index.html'],
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    watch: {
      ignored: [
        '**/android/**',
        '**/functions/**',
        '**/dist/**',
        '**/.aistudio/**',
        '**/.gmp_cache/**',
      ],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
