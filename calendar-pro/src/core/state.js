/**
 * state.js — Uygulama durumu (store) ve olay yolu (bus).
 *
 * Store tek doğruluk kaynağıdır: görünüm, imleç tarihi, etkinlik listesi ve ayarlar.
 * Mutasyonlar yalnızca repository katmanı ve router üzerinden yapılır;
 * view'lar store'u okur ve değişikliklerde yeniden çizilir.
 */
import { todayISO } from './dateUtils.js';

export const DEFAULT_SETTINGS = Object.freeze({
  theme: 'dark', // 'dark' | 'light' | 'system' | özel tema adı (bkz. core/theme.js)
  background: 'standard', // arka plan adı (bkz. core/backgrounds.js)
  sidebarCollapsed: false, // kenar çubuğu ikon modunda mı (logoya tıklanınca değişir)
  backgroundFit: 'fill', // görsel yerleşimi: fill | fit | stretch | tile | center
  weekStartsOn: 1, // 0 = Pazar, 1 = Pazartesi
  defaultReminder: 15,
  notificationsEnabled: false,
  schedulerDays: 7,
  schedulerHourHeight: 56,
  ganttDayWidth: 36,
  ganttShowCriticalPath: true,
  seeded: false,
});

function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    get: () => state,
    /** Kısmi güncelleme: nesne veya (prev) => nesne. */
    set(patch) {
      const prev = state;
      const next = typeof patch === 'function' ? patch(prev) : patch;
      state = { ...prev, ...next };
      listeners.forEach((fn) => fn(state, prev));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export const store = createStore({
  ready: false,
  view: 'dashboard',
  cursor: todayISO(),
  events: [],
  settings: { ...DEFAULT_SETTINGS },
  userBackgrounds: [], // kullanıcının yüklediği arka planlar (bkz. core/userBackgroundRepo.js)
});

/** Bileşenler arası gevşek bağlı iletişim için basit pub/sub. */
function createBus() {
  const handlers = new Map();
  return {
    on(type, fn) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(fn);
      return () => handlers.get(type).delete(fn);
    },
    emit(type, payload) {
      handlers.get(type)?.forEach((fn) => fn(payload));
    },
  };
}

export const bus = createBus();
