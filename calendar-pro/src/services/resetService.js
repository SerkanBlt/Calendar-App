/**
 * resetService.js — Uygulamayı ilk kurulum haline döndürür.
 *
 * Silinenler: etkinlikler, ekler, gönderilmiş hatırlatma kayıtları, kullanıcının yüklediği arka planlar ve tüm ayarlar.
 * Kullanıcı onayı ve yedek alma seçeneği arayüzde sorulur (bkz. core/actions.js → resetData); bu servis yalnızca siler.
 *
 * Veritabanı tek transaction'da temizlenir. `seeded` işareti korunur: aksi halde bir sonraki açılışta örnek veriler
 * yeniden yüklenir ve "sıfırlanmış" uygulama boş görünmez. `cp-theme` / `cp-bg` (localStorage) ayarlarla birlikte
 * theme.js ve backgrounds.js tarafından varsayılana güncellenir (store aboneliği).
 */
import { db } from '../core/db.js';
import { DEFAULT_SETTINGS, store } from '../core/state.js';
import { userBackgroundRepo } from '../core/userBackgroundRepo.js';

export async function resetAllData() {
  await db.wipe([{ key: 'seeded', value: true }]);
  // Bellekteki durum veritabanıyla aynı anda güncellenir; görünümler ve tema/arka plan abonelikleri tek seferde tepki verir
  store.set({ events: [], userBackgrounds: [], settings: { ...DEFAULT_SETTINGS, seeded: true } });
  userBackgroundRepo.releaseAll();
}
