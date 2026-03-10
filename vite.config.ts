import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react'

import manifest from './src/manifest'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    build: {
      emptyOutDir: true,
      outDir: 'build',
      rollupOptions: {
        output: {
          chunkFileNames: 'assets/chunk-[hash].js',
        },
        // Exclude puppeteerExtractor from main build (it's built separately with Rollup)
        external: ['./puppeteerExtractor.js'],
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      hmr: {
        port: 5173,
      },
      // Watch for file changes
      watch: {
        usePolling: false,
        interval: 1000,
      },
    },
    plugins: [crx({ manifest }), react()],
    legacy: {
      skipWebSocketTokenCheck: true,
    },
    // Enable better HMR for extensions
    optimizeDeps: {
      include: ['react', 'react-dom'],
      exclude: ['puppeteer-core'],
    },
  }
})
