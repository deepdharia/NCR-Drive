import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';
import { createHash } from 'node:crypto';

function offlineBuild(): Plugin {
  return {
    name: 'ncr-offline-build',
    apply: 'build',
    generateBundle(_, bundle) {
      const assets = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', ...Object.keys(bundle).map((name) => '/' + name)];
      const version = createHash('sha256').update(JSON.stringify(assets)).digest('hex').slice(0, 12);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const CACHE = 'ncr-drive-${version}';
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('ncr-drive-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/index.html')));
  } else {
    event.respondWith(caches.match(event.request, { ignoreVary: true }).then(cached => cached || fetch(event.request)));
  }
});
` });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), offlineBuild()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      // Vite 8 is rolldown-based: split the big vendor libs out of the app
      // chunk so no single chunk trips the 500 kB warning on mobile loads.
      // (Rolldown types only accept the function form of manualChunks.)
      rolldownOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/three')) return 'vendor-three';
            if (id.includes('node_modules/react-dom')) return 'vendor-react';
            if (/node_modules\/react\//.test(id)) return 'vendor-react';
            if (id.includes('node_modules/lucide-react') || id.includes('node_modules/motion'))
              return 'vendor-ui';
          },
        },
      },
    },
  };
});
