import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    // The source entry lets Vite cache shader strings separately from engine code.
    alias: [{ find: /^three$/, replacement: fileURLToPath(new URL('./node_modules/three/src/Three.js', import.meta.url)) }],
  },
  build: {
    target: 'es2022',
    rolldownOptions: {
      output: {
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            { name: 'three-shaders', test: /three[\\/]src[\\/]renderers[\\/]shaders[\\/](?:ShaderChunk|ShaderLib[\\/])/, priority: 2 },
            { name: 'three', test: /node_modules[\\/]three/, priority: 1 },
          ],
        },
      },
    },
  },
});
