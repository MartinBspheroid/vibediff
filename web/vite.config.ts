/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import Icons from 'unplugin-icons/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Compiles only the Solar icons we import into the bundle (no runtime CDN
    // fetch) so the single-binary build stays fully offline.
    Icons({ compiler: 'jsx', jsx: 'react' }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8888',
        changeOrigin: true,
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Keep Vitest scoped to unit tests; Playwright owns e2e/ (separate runner).
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  }
})
