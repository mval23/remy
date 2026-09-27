import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Generates the app icons (favicon, home-screen and install icons) from public/icon.svg.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0.2, resizeOptions: { background: '#1C6843' } },
    apple: { ...minimal2023Preset.apple, padding: 0.2, resizeOptions: { background: '#1C6843' } },
  },
  images: ['public/icon.svg'],
});
