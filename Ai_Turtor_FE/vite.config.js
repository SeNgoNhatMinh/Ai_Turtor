import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const commitHash = (() => {
  try { return execSync('git rev-parse --short HEAD').toString().trim(); }
  catch { return 'unknown'; }
})();

// https://vite.dev/config/
// Force restart
export default defineConfig({
  // Force config reload for newly installed packages
  plugins: [
    react(),
    globalThis.process?.env?.ANALYZE === 'true' && visualizer({
      filename: 'dist/bundle-report.html',
      gzipSize: true,
      brotliSize: true,
      open: false,
    }),
  ].filter(Boolean),
  define: {
    __APP_COMMIT_HASH__: JSON.stringify(commitHash),
  },
  resolve: {
    alias: {
      "@": path.resolve(fileURLToPath(new URL('.', import.meta.url)), "./src"),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8085',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8085',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/components/**/*.test.{js,jsx}'],
    css: true,
    restoreMocks: true,
    testTimeout: 20000,
    fileParallelism: false,
  },
})
