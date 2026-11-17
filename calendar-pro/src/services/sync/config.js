/**
 * config.js — Bulut eşitleme sabitleri.
 *
 * GOOGLE_CLIENT_ID: Google Cloud'da oluşturulan "Web uygulaması" OAuth istemci kimliği. GİZLİ DEĞİLDİR (tarayıcı kodunda görünür; güvenlik, Google'da
 * tanımlı "Yetkili JavaScript kaynakları" ile sağlanır). Başka bir kimlik kullanmak için derleme sırasında VITE_GOOGLE_CLIENT_ID ortam değişkeni verilebilir.
 * Yetkili kaynaklar: yayın adresi (https://serkanblt.github.io) ve geliştirme (http://localhost:5173).
 */
export const GOOGLE_CLIENT_ID = import.meta.env?.VITE_GOOGLE_CLIENT_ID || '130178296499-883vksmje6127ure7ji455lhsvjj8i9b.apps.googleusercontent.com';

/** Yalnızca uygulamanın gizli klasörü (Drive'daki diğer dosyalara erişilmez). */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
export const GIS_SRC = 'https://accounts.google.com/gsi/client';
export const DRIVE_API = 'https://www.googleapis.com/drive/v3';
export const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

export const SYNC_FILE = 'sync.json'; // etkinlikler, izler, ek üst verisi, ayarlar
export const ATT_PREFIX = 'att-'; // ek içerikleri: att-<ekId>
