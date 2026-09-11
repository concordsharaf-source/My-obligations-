import { fileURLToPath, URL } from 'node:url'
import process from 'node:process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * `BASE_PATH` lets the same build be deployed at a sub-path (GitHub Pages)
 * or at the root (custom domain / Capacitor / TWA) without touching the code.
 */
const basePath = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base: basePath,
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src/pwa',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: [
        'favicon.svg',
        'favicon.ico',
        'apple-touch-icon.png',
        'robots.txt',
        'icons/*.png',
      ],
      manifest: {
        name: 'التزاماتي — لا تنسَ ما عليك... ولا ما لك',
        short_name: 'التزاماتي',
        description:
          'تطبيق شخصي لإدارة الالتزامات والديون والأقساط والفواتير والمواعيد، مع نظام ميزانية متكامل. يعمل بدون إنترنت.',
        lang: 'ar',
        dir: 'rtl',
        start_url: './',
        scope: './',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
        orientation: 'portrait',
        theme_color: '#0f766e',
        background_color: '#f8fafc',
        categories: ['finance', 'productivity', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          {
            name: 'إضافة التزام',
            short_name: 'إضافة',
            description: 'إضافة التزام جديد بسرعة',
            url: './#/new',
          },
          {
            name: 'الديون',
            short_name: 'الديون',
            description: 'ديون عليّ وديون لي',
            url: './#/debts',
          },
          {
            name: 'ميزانيتي',
            short_name: 'ميزانيتي',
            description: 'الدخل والالتزامات والمتبقي',
            url: './#/budget',
          },
          {
            name: 'التقويم',
            short_name: 'التقويم',
            url: './#/calendar',
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
      injectManifest: {
        globPatterns: ['**/*.{js,mjs,cjs,css,html,svg,png,ico,webmanifest,woff2,json}'],
        globIgnores: ['**/node_modules/**'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: false,
    allowedHosts: true,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          db: ['dexie', 'dexie-react-hooks'],
        },
      },
    },
  },
})
