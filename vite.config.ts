/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'

// BASE задаётся в GitHub Actions (/<repo>/), локально — корень.
const base = process.env.BASE ?? '/'

export default defineConfig({
  base,
  plugins: [
    preact(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}', '**/*{latin,cyrillic}*.woff2'],
        globIgnores: ['**/*vietnamese*', '**/*math*', '**/*symbols*'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        name: 'You&Me',
        short_name: 'You&Me',
        description: 'Календарь, хотелки, планы, вопрос дня и карты — на двоих',
        lang: 'ru',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f1013',
        theme_color: '#0f1013',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  build: { target: 'es2022', chunkSizeWarningLimit: 800 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
})
