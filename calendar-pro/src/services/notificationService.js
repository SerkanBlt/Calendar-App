/**
 * notificationService.js — Etkinlik hatırlatmaları (Notification API).
 *
 * Her 30 saniyede bir yaklaşan saatli etkinlikleri kontrol eder. Hatırlatma zamanı gelmiş
 * (başlangıç - reminder dakika) ve henüz gönderilmemiş olanlar için bildirim gösterir.
 * Gönderilen bildirimler `notifications` store'una yazılır; böylece sayfa yenilense de tekrar gönderilmez.
 * İzin yoksa veya API desteklenmiyorsa uygulama içi toast'a düşer.
 */
import { db, STORES } from '../core/db.js';
import { store } from '../core/state.js';
import { addDaysISO, todayISO } from '../core/dateUtils.js';
import { eventStart } from '../core/eventModel.js';
import { expandEvents } from './recurrenceService.js';
import { toast } from '../components/toast.js';

const CHECK_INTERVAL_MS = 30_000;
const RETENTION_DAYS = 14;
// Uygulama bir alt klasörde (GitHub Pages) yayınlandığında da doğru çözülsün diye BASE_URL'e göre
const ICON_URL = `${import.meta.env.BASE_URL}icons/icon.svg`;
let timer = null;

export const notificationService = {
  isSupported: () => 'Notification' in window,
  permission: () => ('Notification' in window ? Notification.permission : 'unsupported'),

  async requestPermission() {
    if (!this.isSupported()) return 'unsupported';
    if (Notification.permission === 'default') return Notification.requestPermission();
    return Notification.permission;
  },

  start() {
    this.stop();
    this.check();
    timer = setInterval(() => this.check(), CHECK_INTERVAL_MS);
    pruneOld();
  },

  stop() {
    clearInterval(timer);
    timer = null;
  },

  /** Hatırlatma zamanı gelmiş etkinlikleri bulur ve bildirir. */
  async check() {
    const { events, settings } = store.get();
    if (!settings.notificationsEnabled) return;
    const now = Date.now();
    const today = todayISO();
    const candidates = expandEvents(events, today, addDaysISO(today, 1)).filter((o) => o.startTime && o.reminder > 0 && o.status !== 'done');

    for (const occ of candidates) {
      const start = eventStart(occ).getTime();
      const fireAt = start - occ.reminder * 60_000;
      if (now < fireAt || now >= start) continue;
      const key = `${occ.id}|${occ.startDate}|${occ.startTime}|${occ.reminder}`;
      // eslint-disable-next-line no-await-in-loop
      if (await db.get(STORES.NOTIFICATIONS, key)) continue;
      // eslint-disable-next-line no-await-in-loop
      await db.put(STORES.NOTIFICATIONS, { id: key, eventId: occ.masterId, firedAt: new Date().toISOString() });
      const minutes = Math.max(1, Math.round((start - now) / 60_000));
      show(occ.title, `${minutes} dakika içinde başlıyor · ${occ.startTime}–${occ.endTime}`, key);
    }
  },
};

async function show(title, body, tag) {
  toast(`🔔 ${title} — ${body}`, { type: 'info', duration: 8000 });
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const options = { body, tag, icon: ICON_URL, badge: ICON_URL };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, options);
    else new Notification(title, options);
  } catch {
    try {
      new Notification(title, options);
    } catch {
      /* bazı platformlarda yapıcı desteklenmez; toast zaten gösterildi */
    }
  }
}

/** Eski bildirim kayıtlarını temizler. */
async function pruneOld() {
  try {
    const all = await db.getAll(STORES.NOTIFICATIONS);
    const limit = Date.now() - RETENTION_DAYS * 86400000;
    const stale = all.filter((n) => Date.parse(n.firedAt) < limit).map((n) => n.id);
    if (stale.length) await db.bulkDelete(STORES.NOTIFICATIONS, stale);
  } catch {
    /* temizlik kritik değil */
  }
}
