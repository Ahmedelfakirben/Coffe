import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';

// Plugin para generar automáticamente version.json en cada build/despliegue
function autoVersionPlugin(buildId: string) {
  return {
    name: 'auto-version-plugin',
    buildStart() {
      const versionFile = path.resolve(__dirname, 'public/version.json');
      const data = {
        version: '1.1.2',
        buildId,
        buildTime: new Date().toISOString()
      };
      try {
        fs.writeFileSync(versionFile, JSON.stringify(data, null, 2), 'utf-8');
      } catch (err) {
        console.warn('No se pudo actualizar public/version.json:', err);
      }
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  const buildId = `${Date.now()}`;

  return {
    define: {
      __APP_BUILD_ID__: JSON.stringify(isProd ? buildId : 'dev'),
    },
    plugins: [
      react(),
      ...(isProd ? [autoVersionPlugin(buildId)] : []),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'coffee-icon.svg', 'pwa-icon-192.png', 'pwa-icon-512.png'],
        manifest: {
        name: 'LIN-Caisse - Gestion Café',
        short_name: 'LIN-Caisse',
        description: 'Système de point de vente pour caféria',
        theme_color: '#f59e0b',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Limpiar automáticamente cachés antiguas de versiones previas
        cleanupOutdatedCaches: true,
        // Activar inmediatamente al instalar, sin esperar a cerrar pestañas
        skipWaiting: true,
        clientsClaim: true,
        // Incluir html en precaché para que navigateFallback funcione perfectamente
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/version\.json/],
        runtimeCaching: [
          {
            // version.json SIEMPRE directo a la red sin caché
            urlPattern: /version\.json/,
            handler: 'NetworkOnly'
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 // 1 hour
              },
              networkTimeoutSeconds: 10,
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    modulePreload: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-ui': ['lucide-react', 'react-hot-toast', 'react-rnd', 'react-zoom-pan-pinch'],
          'vendor-utils': ['date-fns', 'xlsx'],
        },
      },
    },
  },
};
});
