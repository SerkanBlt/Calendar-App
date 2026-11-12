/**
 * version.js — Uygulama sürümü.
 *
 * Tek kaynak package.json'daki "version" alanıdır; Vite derleme sırasında __APP_VERSION__ olarak
 * koda yerleştirir (bkz. vite.config.js). Sürüm numarası semver'e göre artırılır:
 *   MAJOR — uyumsuz değişiklik (ör. veri biçimi değişip eski veriler taşınamıyorsa)
 *   MINOR — yeni özellik
 *   PATCH — hata düzeltmesi
 * Her yayında CHANGELOG.md'ye de bir satır eklenir.
 */
// eslint-disable-next-line no-undef
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
