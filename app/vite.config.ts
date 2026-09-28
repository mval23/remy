import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const removedFile = fileURLToPath(new URL('./src/planning/data/removed.json', import.meta.url));
const slotsFile = fileURLToPath(new URL('./src/planning/data/slots.json', import.meta.url));

/**
 * For the recipe menu (menu.html), which only runs on the owner's computer with `npm run dev`:
 * GET /__menu/removed lists deleted recipes, POST {id, removed} deletes or restores one by editing removed.json.
 * GET /__menu/slots lists meals moved to another slot, POST {id, slot} moves one (slot null = back) in slots.json.
 * Not part of the published app (`apply: 'serve'`).
 */
function menuEditor(): Plugin {
  return {
    name: 'remy-menu-editor',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__menu/slots', (req, res) => {
        const read = (): Record<string, string> => JSON.parse(readFileSync(slotsFile, 'utf8'));
        const send = (map: Record<string, string>) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(map));
        };
        if (req.method === 'GET') return send(read());
        if (req.method !== 'POST' || req.headers['x-remy-menu'] !== '1') {
          res.statusCode = 403;
          return res.end();
        }
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          try {
            const { id, slot } = JSON.parse(body) as { id: string; slot: string | null };
            if (!/^[a-z0-9_]+$/.test(id)) throw new Error('bad id');
            if (slot !== null && !['Breakfast', 'Lunch', 'Dinner', 'Afternoon snack', 'Evening sweet'].includes(slot)) throw new Error('bad slot');
            const map = read();
            if (slot) map[id] = slot;
            else delete map[id];
            const sorted = Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)));
            writeFileSync(slotsFile, `${JSON.stringify(sorted, null, 2)}\n`);
            send(sorted);
          } catch {
            res.statusCode = 400;
            res.end();
          }
        });
      });
      server.middlewares.use('/__menu/removed', (req, res) => {
        const read = (): string[] => JSON.parse(readFileSync(removedFile, 'utf8'));
        const send = (list: string[]) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(list));
        };
        if (req.method === 'GET') return send(read());
        // A custom header that only the menu page sends, so another website can't change the file.
        if (req.method !== 'POST' || req.headers['x-remy-menu'] !== '1') {
          res.statusCode = 403;
          return res.end();
        }
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          try {
            const { id, removed } = JSON.parse(body) as { id: string; removed: boolean };
            if (!/^[a-z0-9_]+$/.test(id)) throw new Error('bad id');
            const set = new Set(read());
            if (removed) set.add(id);
            else set.delete(id);
            const list = [...set].sort();
            writeFileSync(removedFile, `${JSON.stringify(list, null, 2)}\n`);
            send(list);
          } catch {
            res.statusCode = 400;
            res.end();
          }
        });
      });
    },
  };
}

// GitHub Pages serves the app from /remy/. Locally it runs from /.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  // The service worker downloads the whole app for offline use, so splitting the main file
  // wouldn't reduce what a phone downloads. Warn only if it grows well past its current size.
  build: { chunkSizeWarningLimit: 700 },
  plugins: [
    react(),
    menuEditor(),
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
        orientation: 'any',
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
  test: { environment: 'node', setupFiles: ['src/test-setup.ts'] },
});
