/**
 * vite.config.js — Build yapılandırması.
 *
 * base: './' → tüm asset yolları göreli üretilir. Uygulama hash tabanlı router kullandığı için
 * aynı build hem alan adı kökünde hem de GitHub Pages gibi bir alt klasörde
 * (https://kullanici.github.io/Calendar-App/) ek ayar gerektirmeden çalışır.
 * public/ altındaki manifest.json ve service-worker.js olduğu gibi kopyalanır.
 */
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5173 },
  preview: { port: 4173 },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false,
  },
});
