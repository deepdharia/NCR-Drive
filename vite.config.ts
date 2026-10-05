import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
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
