import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the app from /remy/. Locally it runs from /.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  // The service worker downloads the whole app for offline use, so splitting the main file
  // wouldn't reduce what a phone downloads. Warn only if it grows well past its current size.
  build: { chunkSizeWarningLimit: 700 },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: 'Remy: your personal chef',
        short_name: 'Remy',
        description: 'Plans a week of meals you enjoy, one grocery list, and one prep day.',
        theme_color: '#1C6843',
        background_color: '#F2F5F0',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The app itself works offline. Fonts are cached after the first visit.
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Shows phone reminders (see public/push-sw.js).
        importScripts: ['push-sw.js'],
        navigateFallback: `${base}index.html`,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  server: { port: 5173 },
  preview: { port: 4173 },
  test: { environment: 'node' },
});
