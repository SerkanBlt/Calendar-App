/**
 * autoCloseService.js — "Zamanı geçince otomatik kapat".
 *
 * Etkinlikte "Zamanı geçince otomatik kapat" (`autoClose`) açıksa, bitiş zamanı geçtiğinde durumu otomatik olarak "Tamamlandı" (ilerleme %100) olur.
 *  - Bitiş zamanı: saatli etkinlikte bitiş saati, tüm gün/çok günlü etkinlikte bitiş gününün sonu (bkz. eventModel.eventEnd).
 *  - Tekrarlayan seriler dışında kalır (durum seri düzeyindedir; tek örnek "Yalnızca bu" ile ayrılırsa o kayıt kendi başına otomatik kapanabilir).
 *  - Zaten tamamlanmış etkinliğe dokunulmaz; kullanıcı bir etkinliği sonradan yeniden açarsa (Yapılacak/Devam Ediyor) bitiş zamanı geçmiş olduğundan
 *    yeniden kapanır — bunu istemiyorsa o etkinlikte seçeneği kapatır.
 * Açılışta ve her 30 saniyede bir (ayrıca sekme yeniden görününce) denetlenir; kapanan etkinlikler tek bir bildirimle (toast) duyurulur.
 */
import { store } from '../core/state.js';
import { dueForAutoClose } from '../core/eventModel.js';
import { eventRepo } from '../core/eventRepo.js';
import { toast } from '../components/toast.js';

const CHECK_INTERVAL_MS = 30_000;
let timer = null;
let running = false;

export const autoCloseService = {
  start() {
    this.stop();
    this.check();
    timer = setInterval(() => this.check(), CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);
  },

  stop() {
    clearInterval(timer);
    timer = null;
    document.removeEventListener('visibilitychange', onVisible);
  },

  /** Zamanı geçmiş "otomatik kapat" etkinliklerini tamamlandı yapar. @returns {Promise<number>} kapatılan etkinlik sayısı */
  async check(now = new Date()) {
    if (running) return 0;
    running = true;
    try {
      const due = dueForAutoClose(store.get().events, now);
      const closed = [];
      for (const ev of due) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await eventRepo.update(ev.id, { status: 'done', progress: 100 });
          closed.push(ev);
        } catch {
          /* etkinlik bu arada silinmiş olabilir; sonraki denetimde yeniden denenir */
        }
      }
      if (closed.length) {
        toast(closed.length === 1 ? `"${closed[0].title}" zamanı geçtiği için otomatik kapatıldı` : `${closed.length} etkinlik zamanı geçtiği için otomatik kapatıldı`, { type: 'info', duration: 6000 });
      }
      return closed.length;
    } finally {
      running = false;
    }
  },
};

function onVisible() {
  if (document.visibilityState === 'visible') autoCloseService.check();
}
