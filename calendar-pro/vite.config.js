/**
 * vite.config.js — Build yapılandırması.
 * public/ altındaki manifest.json ve service-worker.js olduğu gibi kopyalanır.
 */
import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173 },
  preview: { port: 4173 },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false,
  },
});
