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

/**
 * ISO 8601 hafta numarası ve hafta yılı: hafta Pazartesi başlar; 1. hafta, yılın ilk Perşembesini (= 4 Ocak'ı) içeren haftadır.
 * Yıl başı/sonu günleri komşu yılın haftasına ait olabilir (ör. 2026-12-31 → 2026 hafta 53, 2027-01-01 → 2026 hafta 53, 2024-12-30 → 2025 hafta 1).
 * @returns {{week: number, year: number}}
 */
export function isoWeekInfo(date) {
  const d = toDate(date);
  const thursday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3 - ((d.getDay() + 6) % 7)); // bu haftanın Perşembesi
  const jan4 = new Date(thursday.getFullYear(), 0, 4);
  const firstThursday = new Date(jan4.getFullYear(), 0, 4 + 3 - ((jan4.getDay() + 6) % 7));
  return { week: 1 + Math.round(diffDays(firstThursday, thursday) / 7), year: thursday.getFullYear() };
}

/** ISO 8601 hafta numarası (1–53). */
export const isoWeek = (date) => isoWeekInfo(date).week;

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

const EPOCH_DAY = '1970-01-01';
/** Takvim günü + saat → "dakika damgası" (DST'den etkilenmez; yalnızca farklar anlamlıdır). */
const minuteStamp = (dateStr, timeStr) => diffDays(EPOCH_DAY, dateStr) * 1440 + timeToMinutes(timeStr);

/**
 * Başlangıç değişince bitişi, aradaki süre korunacak biçimde kaydırır (etkinlik formundaki "bağ").
 * `prev`: değişimden ÖNCEKİ { startDate, startTime, endDate, endTime }; `next`: yeni { startDate, startTime }.
 * Süre = prev bitişi − prev başlangıcı (negatifse 0 sayılır). Gece yarısını aşan bitiş bir sonraki güne, öncesine düşen bir önceki güne taşınır.
 * Herhangi bir değer boş/geçersizse (ör. kullanıcı saati siliyor) `null` döner: çağıran bitişe dokunmaz.
 * @returns {{endDate: string, endTime: string} | null}
 */
export function shiftEnd(prev, next) {
  if (![prev.startDate, prev.endDate, next.startDate].every(isValidISODate)) return null;
  if (![prev.startTime, prev.endTime, next.startTime].every(isValidTime)) return null;
  const duration = Math.max(0, minuteStamp(prev.endDate, prev.endTime) - minuteStamp(prev.startDate, prev.startTime));
  const end = minuteStamp(next.startDate, next.startTime) + duration;
  const day = Math.floor(end / 1440);
  return { endDate: addDaysISO(EPOCH_DAY, day), endTime: minutesToTime(end - day * 1440) };
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

/** "15.Kas" — gün numarası ve kısa ay adı (ör. başlıktaki "Bugün: 15.Kas" düğmesi). */
export function dayMonthShort(date = new Date()) {
  const d = toDate(date);
  return `${d.getDate()}.${formatDate(d, { month: 'short' })}`;
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
