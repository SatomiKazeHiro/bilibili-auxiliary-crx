import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';

function copyManifest() {
  return {
    name: 'copy-manifest',
    writeBundle() {
      const manifestPath = resolve(__dirname, 'src/manifest.json');
      const outPath = resolve(__dirname, 'dist/manifest.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      writeFileSync(outPath, JSON.stringify(manifest, null, 2));
      console.log('[vite-plugin-manifest] copied manifest.json');
    }
  };
}

export default defineConfig({
  plugins: [react(), copyManifest()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/main.js'),
        history: resolve(__dirname, 'src/features/history/history.css'),
        video: resolve(__dirname, 'src/features/video/video.css'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'history.css') return 'history.css';
          if (assetInfo.name === 'video.css') return 'video.css';
          return '[name][extname]';
        }
      }
    }
  }
});
