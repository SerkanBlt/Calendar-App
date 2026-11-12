/**
 * vite.config.js — Build yapılandırması.
 *
 * base: './' → tüm asset yolları göreli üretilir. Uygulama hash tabanlı router kullandığı için
 * aynı build hem alan adı kökünde hem de GitHub Pages gibi bir alt klasörde
 * (https://kullanici.github.io/Calendar-App/) ek ayar gerektirmeden çalışır.
 * public/ altındaki manifest.json ve service-worker.js olduğu gibi kopyalanır.
 *
 * __APP_VERSION__: package.json'daki sürüm numarası koda yerleştirilir (bkz. src/core/version.js).
 */
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: { port: 5173 },
  preview: { port: 4173 },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false,
  },
});
