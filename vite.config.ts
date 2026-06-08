import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

/**
 * Stub the Anthropic SDK's Node-only modules (tool runner, environment worker,
 * file-system util). They pull in `node:fs`, `node:crypto`, etc. transitively
 * via `Beta.Environments.Work` even though we never use those resources.
 * Without this plugin, Vite fails to bundle the SDK for the browser.
 */
function stubAnthropicNodeModules(): Plugin {
  // Empty class+function dummies so any named import from a stubbed module
  // resolves without breaking the consumer.
  const STUB = `
// Stubbed for browser — Anthropic SDK Node-only module not used in browser bundle.
class _Stub {}
function _stubFn() { throw new Error('Anthropic SDK Node-only feature not available in browser build'); }
export { _Stub as EnvironmentWorker, _Stub as WorkPoller, _Stub as Work, _Stub as default };
export const betaAgentToolset20260401 = _stubFn;
export const atomicWriteFile = _stubFn;
export const confineToRoot = _stubFn;
export const DIR_CREATE_MODE = 0o755;
export const fsErrorMessage = (e) => String(e);
`;
  const STUB_PATH_RE =
    /[\\/]@anthropic-ai[\\/]sdk[\\/](tools[\\/]agent-toolset|lib[\\/]environments|helpers[\\/]beta[\\/]environments|resources[\\/]beta[\\/]environments[\\/]work)/;
  return {
    name: 'stub-anthropic-node-modules',
    enforce: 'pre',
    load(id) {
      if (STUB_PATH_RE.test(id)) return STUB;
      return null;
    },
  };
}

export default defineConfig({
  plugins: [
    stubAnthropicNodeModules(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Waypoint PIT',
        short_name: 'Waypoint PIT',
        description: 'Unsheltered Point-in-Time Count — Miami-Dade Homeless Trust',
        theme_color: '#22C55E',
        background_color: '#F3F4F6',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        // Don't serve the SPA shell for API calls (e.g. the AI proxy).
        navigateFallbackDenylist: [/^\/api\//],
        // Take control immediately on a new deploy instead of waiting for every
        // tab to close — otherwise a returning user can be stranded on a stale
        // (and possibly broken) cached shell. Pairs with registerType:autoUpdate.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // App bundle includes Mapbox + React Query + i18n + draw tools — comfortably
        // larger than the 2 MiB default. Bump the precache cap so the field PWA
        // can install fully offline.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.mapbox\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mapbox-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
