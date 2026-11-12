/**
 * dateUtils.js — Tarih/saat yardımcıları.
 *
 * Uygulama genelinde tarihler "YYYY-MM-DD", saatler "HH:MM" formatında saklanır.
 * Bu format yerel saat diliminde yorumlanır; böylece DST/UTC kaymaları yaşanmaz.
 */

export const LOCALE = 'tr-TR';
export const pad = (n) => String(n).padStart(2, '0');

const toDate = (value) => (typeof value === 'string' ? parseISODate(value) : new Date(value));

export function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseISODate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isValidISODate(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  return toISODate(parseISODate(str)) === str;
}

export function isValidTime(str) {
  return typeof str === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(str);
}

export const todayISO = () => toISODate(new Date());

export function addDays(date, n) {
  const d = toDate(date);
  d.setDate(d.getDate() + n);
  return d;
}

export const addDaysISO = (date, n) => toISODate(addDays(date, n));

/** Ay ekler; hedef ayda gün yoksa ayın son gününe sıkıştırır (31 Oca + 1 ay = 28/29 Şub). */
export function addMonths(date, n) {
  const d = toDate(date);
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), last));
  return target;
}

export function startOfWeek(date, weekStartsOn = 1) {
  const d = toDate(date);
  const diff = (d.getDay() - weekStartsOn + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

export function startOfMonth(date) {
  const d = toDate(date);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** b - a, gün cinsinden (takvim günü; saat dilimi kaymalarından etkilenmez). */
export function diffDays(a, b) {
  const da = toDate(a);
  const db = toDate(b);
  const ua = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const ub = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((ub - ua) / 86400000);
}

/** Başlangıçtan itibaren `count` günlük ISO tarih dizisi. */
export function rangeDays(startISO, count) {
  return Array.from({ length: count }, (_, i) => addDaysISO(startISO, i));
}

export function timeToMinutes(time) {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Dakikayı "HH:MM"e çevirir (0–1439 aralığına sıkıştırılır). */
export function minutesToTime(minutes) {
  const m = Math.max(0, Math.min(1439, Math.round(minutes)));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

export function combineDateTime(dateStr, timeStr) {
  const d = parseISODate(dateStr);
  if (timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  }
  return d;
}

export function nowMinutes() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

export function isWeekend(date) {
  const day = toDate(date).getDay();
  return day === 0 || day === 6;
}

const formatterCache = new Map();

/** Intl.DateTimeFormat önbellekli biçimlendirme. */
export function formatDate(date, options = { day: 'numeric', month: 'long', year: 'numeric' }) {
  const key = JSON.stringify(options);
  if (!formatterCache.has(key)) formatterCache.set(key, new Intl.DateTimeFormat(LOCALE, options));
  return formatterCache.get(key).format(toDate(date));
}

/** Hafta başlangıcına göre sıralı gün adları. */
export function weekdayNames(weekStartsOn = 1, style = 'short') {
  // 4 Ocak 2026 bir Pazar günüdür.
  return Array.from({ length: 7 }, (_, i) =>
    formatDate(new Date(2026, 0, 4 + ((i + weekStartsOn) % 7)), { weekday: style }),
  );
}

/** "3 gün sonra", "dün" gibi göreli ifade. */
export function relativeDayLabel(dateStr) {
  const diff = diffDays(todayISO(), dateStr);
  if (diff === 0) return 'Bugün';
  if (diff === 1) return 'Yarın';
  if (diff === -1) return 'Dün';
  return diff > 0 ? `${diff} gün sonra` : `${-diff} gün önce`;
}
