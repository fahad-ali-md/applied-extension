/**
 * Rollup configuration for building Puppeteer for browser
 * This is needed for Chrome extension usage of Puppeteer
 */
import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import commonjs from '@rollup/plugin-commonjs'

export default {
  input: 'src/background/puppeteerExtractor.ts',
  output: {
    format: 'esm',
    dir: 'build/background',
    entryFileNames: 'puppeteerExtractor.js',
    chunkFileNames: '[name].js',
  },
  external: ['chromium-bidi/lib/cjs/bidiMapper/BidiMapper.js'],
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'bundler',
        allowSyntheticDefaultImports: true,
      },
    }),
    nodeResolve({
      browser: true,
      resolveOnly: ['puppeteer-core'],
    }),
    commonjs(),
  ],
}
