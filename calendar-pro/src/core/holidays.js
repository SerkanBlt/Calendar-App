/**
 * holidays.js — Tatil günleri (saf fonksiyonlar; DOM/IndexedDB yok).
 *
 * Tatiller `settings.holidays` içinde saklanır: [{ id, date: 'YYYY-MM-DD', name, yearly }].
 *  - yearly = true  → "Her yıl tekrarla": her yıl aynı ay-gün tatildir (ör. 29 Ekim). 29 Şubat yalnızca artık yıllarda vardır.
 *  - yearly = false → değişken/tek seferlik: yalnızca `date` tarihinin kendi yılı için geçerlidir (ör. 2026 Ramazan Bayramı).
 * Tatil günleri "çalışma dışı (off)" sayılır: Ay/Hafta görünümünde soluk gösterilir, "Çalışma dışı günleri gizle" açıkken Hafta görünümünden kalkar
 * (bkz. workDays.js). Bir tarih için en çok BİR kayıt tutulur: aynı ay-gün için her yıl tekrarlı kayıt eklenince o ay-günün tek seferlik kayıtları
 * (her yıl) kendiliğinden birleşir; her yıl tekrarlı bir tatilin zaten kapsadığı güne tek seferlik kayıt eklenmez.
 */
import { addDaysISO, diffDays, isValidISODate } from './dateUtils.js';

export const MAX_HOLIDAYS = 500;
export const MAX_RANGE_DAYS = 60; // tek seferde eklenebilecek ardışık gün sayısı (ör. 9 günlük bayram tatili)
export const DEFAULT_HOLIDAY_NAME = 'Tatil';

const leapYear = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const monthDay = (iso) => iso.slice(5);
const stableId = (h) => `${h.yearly ? 'y' : 'd'}:${h.date}`;

/** Ham değeri geçerli, tekil ve tarihe göre sıralı bir tatil listesine çevirir. */
export function normalizeHolidays(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const h of list) {
    if (!h || typeof h !== 'object' || !isValidISODate(h.date)) continue;
    const yearly = Boolean(h.yearly);
    const key = yearly ? `Y${monthDay(h.date)}` : h.date;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: typeof h.id === 'string' && h.id ? h.id : stableId({ yearly, date: h.date }), date: h.date, name: String(h.name ?? '').trim().slice(0, 80), yearly });
    if (out.length >= MAX_HOLIDAYS) break;
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** `year` yılındaki tatil günleri: tarih → { date, name, yearly, entries }. Aynı güne düşen kayıtların adları " · " ile birleşir. */
export function holidaysInYear(holidays, year) {
  const map = new Map();
  for (const h of normalizeHolidays(holidays)) {
    let iso = null;
    if (h.yearly) {
      if (monthDay(h.date) === '02-29' && !leapYear(year)) continue;
      iso = `${String(year).padStart(4, '0')}-${monthDay(h.date)}`;
    } else if (Number(h.date.slice(0, 4)) === year) iso = h.date;
    if (!iso) continue;
    const hit = map.get(iso);
    if (hit) hit.entries.push(h);
    else map.set(iso, { date: iso, entries: [h] });
  }
  for (const v of map.values()) {
    v.name = [...new Set(v.entries.map((e) => e.name).filter(Boolean))].join(' · ') || DEFAULT_HOLIDAY_NAME;
    v.yearly = v.entries.some((e) => e.yearly);
  }
  return map;
}

/** `isoDays` içinde tatile denk gelen günler (Set). Yıl sınırını aşan aralıklar da doğru çalışır. */
export function holidayDaySet(holidays, isoDays) {
  const out = new Set();
  if (!isoDays.length || !normalizeHolidays(holidays).length) return out;
  const years = new Map();
  for (const d of isoDays) {
    const y = Number(d.slice(0, 4));
    if (!years.has(y)) years.set(y, holidaysInYear(holidays, y));
    if (years.get(y).has(d)) out.add(d);
  }
  return out;
}

/** `isoDays` için tarih → tatil bilgisi (ad ipuçları ve etiketler için). */
export function holidayInfoFor(holidays, isoDays) {
  const out = new Map();
  const years = new Map();
  for (const d of isoDays) {
    const y = Number(d.slice(0, 4));
    if (!years.has(y)) years.set(y, holidaysInYear(holidays, y));
    const info = years.get(y).get(d);
    if (info) out.set(d, info);
  }
  return out;
}

/** O tarihte geçerli tatil bilgisi ya da null. */
export const holidayOn = (holidays, iso) => holidaysInYear(holidays, Number(iso.slice(0, 4))).get(iso) ?? null;

/**
 * Tatil ekler: `date`'ten `endDate`'e (dahil; yoksa tek gün) her gün için bir kayıt.
 * Kurallar: her yıl tekrarlı kayıt eklenince aynı ay-günün tek seferlik kayıtları birleşir; zaten tatil olan güne (her yıl tekrarlı bir kayıt kapsıyorsa
 * ya da aynı tarihli kayıt varsa) yeni kayıt eklenmez, yalnızca adı güncellenir.
 * @returns {{list: object[], added: number, updated: number}}
 */
export function addHolidays(holidays, { date, endDate = date, name = '', yearly = false }) {
  let list = normalizeHolidays(holidays);
  if (!isValidISODate(date)) return { list, added: 0, updated: 0 };
  const last = isValidISODate(endDate) && endDate >= date ? endDate : date;
  const count = Math.min(MAX_RANGE_DAYS, diffDays(date, last) + 1);
  const label = String(name ?? '').trim().slice(0, 80);
  let added = 0;
  let updated = 0;
  for (let i = 0; i < count; i++) {
    const day = addDaysISO(date, i);
    if (yearly) {
      const md = monthDay(day);
      const existing = list.find((h) => h.yearly && monthDay(h.date) === md);
      list = list.filter((h) => h.yearly || monthDay(h.date) !== md); // aynı ay-günün tek seferlik kayıtları artık gereksiz
      if (existing) {
        existing.name = label || existing.name;
        updated++;
      } else {
        list.push({ id: `y:${day}`, date: day, name: label, yearly: true });
        added++;
      }
    } else {
      const covering = list.find((h) => (h.yearly ? monthDay(h.date) === monthDay(day) : h.date === day));
      if (covering) {
        if (label) covering.name = label;
        updated++;
      } else {
        list.push({ id: `d:${day}`, date: day, name: label, yearly: false });
        added++;
      }
    }
  }
  return { list: normalizeHolidays(list.slice(0, MAX_HOLIDAYS)), added, updated };
}

export function removeHoliday(holidays, id) {
  return normalizeHolidays(holidays).filter((h) => h.id !== id);
}

/** Bir kaydı düzenler (tarih, ad, tekrar): eskisi kaldırılır, yenisi `addHolidays` kurallarıyla eklenir. */
export function updateHoliday(holidays, id, { date, name, yearly }) {
  const rest = removeHoliday(holidays, id);
  return addHolidays(rest, { date, name, yearly });
}
