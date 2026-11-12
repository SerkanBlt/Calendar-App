/**
 * router.js — Hash tabanlı yönlendirici.
 *
 * URL biçimi: #/<view>?date=YYYY-MM-DD
 * Router, URL'yi tek doğruluk kaynağı olarak kullanır ve store'a yazar;
 * böylece sayfa yenilendiğinde görünüm ve tarih korunur, geri/ileri tuşları çalışır.
 */
import { store } from './state.js';
import { isValidISODate } from './dateUtils.js';

export const ROUTES = ['dashboard', 'month', 'week', 'day', 'scheduler', 'timeline', 'gantt', 'kanban'];

function parse(hash) {
  const cleaned = hash.replace(/^#\/?/, '');
  const [path, query = ''] = cleaned.split('?');
  const view = ROUTES.includes(path) ? path : 'dashboard';
  const date = new URLSearchParams(query).get('date');
  return { view, date: isValidISODate(date) ? date : null };
}

function apply() {
  const { view, date } = parse(location.hash);
  const { cursor } = store.get();
  store.set({ view, cursor: date ?? cursor });
}

export const router = {
  start() {
    window.addEventListener('hashchange', apply);
    apply();
  },
  /** Görünüm ve/veya tarih değiştirir. Belirtilmeyen alanlar mevcut değeri korur. */
  go({ view, date } = {}) {
    const state = store.get();
    const hash = `#/${view ?? state.view}?date=${date ?? state.cursor}`;
    if (location.hash === hash) apply();
    else location.hash = hash;
  },
};
