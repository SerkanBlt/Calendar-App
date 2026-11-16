/**
 * holidays.js — Tatil günleri (saf fonksiyonlar; DOM/IndexedDB yok).
 *
 * Tatiller `settings.holidays` içinde saklanır: [{ id, date: 'YYYY-MM-DD', name, yearly }].
 *  - yearly = true  → "Her yıl tekrarla": her yıl aynı ay-gün tatildir (ör. 29 Ekim). 29 Şubat yalnızca artık yıllarda vardır.
 *  - yearly = false → değişken/tek seferlik: yalnızca `date` tarihinin kendi yılı için geçerlidir (ör. 2026 Ramazan Bayramı).
 * Tatil günleri "çalışma dışı (off)" sayılır: Ay/Hafta görünümünde soluk gösterilir, "Çalışma dışı günleri gizle" açıkken Hafta görünümünden kalkar
 * (bkz. workDays.js). Bir tarih için en çok BİR kayıt tutulur: aynı ay-gün için her yıl tekrarlı kayıt eklenince o ay-günün tek seferlik kayıtları
 * (her yıl) kendiliğinden birleşir; her yıl tekrarlı bir tatilin zaten kapsadığı güne tek seferlik kayıt eklenmez.
 *
 * GRUPLAR: her tatil bir gruba aittir (`group`: grup kimliği). Hazır gruplar Resmî (mavi), Dini (yeşil) ve Özel (mor)'dür (adları sabit, renkleri değiştirilebilir, silinemez);
 * kullanıcı başka gruplar ekleyebilir, adını/rengini değiştirebilir, silebilir (silinen grubun tatilleri Özel'e taşınır). Gruplar `settings.holidayGroups` içinde saklanır;
 * tatil günü, grubunun renginde gösterilir. Grubu olmayan/bilinmeyen kayıtlar Özel sayılır.
 */
import { addDaysISO, diffDays, isValidISODate } from './dateUtils.js';
import { normalizeHexColor } from './eventModel.js';

export const MAX_HOLIDAYS = 500;
export const MAX_RANGE_DAYS = 60; // tek seferde eklenebilecek ardışık gün sayısı (ör. 9 günlük bayram tatili)
export const DEFAULT_HOLIDAY_NAME = 'Tatil';
export const MAX_GROUPS = 20;

/** Hazır tatil grupları (silinemez; renkleri değiştirilebilir). */
export const DEFAULT_HOLIDAY_GROUPS = Object.freeze([
  Object.freeze({ id: 'official', name: 'Resmî', color: '#4f8cff', preset: true }),
  Object.freeze({ id: 'religious', name: 'Dini', color: '#3ecf8e', preset: true }),
  Object.freeze({ id: 'custom', name: 'Özel', color: '#7c6cff', preset: true }),
]);
export const DEFAULT_GROUP_ID = 'custom';
const FALLBACK_COLOR = '#a0a8b8';

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
    out.push({ id: typeof h.id === 'string' && h.id ? h.id : stableId({ yearly, date: h.date }), date: h.date, name: String(h.name ?? '').trim().slice(0, 80), yearly, group: typeof h.group === 'string' ? h.group.slice(0, 40) : '' });
    if (out.length >= MAX_HOLIDAYS) break;
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** `year` yılındaki tatil günleri: tarih → { date, name, yearly, entries }. Aynı güne düşen kayıtların adları " · " ile birleşir. */
export function holidaysInYear(holidays, year, groups) {
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
    const group = holidayGroupOf(groups, v.entries[0].group); // bir tarih için tek kayıt tutulur; birden çoksa ilki
    v.group = group.id;
    v.groupName = group.name;
    v.color = group.color;
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
export function holidayInfoFor(holidays, isoDays, groups) {
  const out = new Map();
  const years = new Map();
  for (const d of isoDays) {
    const y = Number(d.slice(0, 4));
    if (!years.has(y)) years.set(y, holidaysInYear(holidays, y, groups));
    const info = years.get(y).get(d);
    if (info) out.set(d, info);
  }
  return out;
}

/** O tarihte geçerli tatil bilgisi ya da null. */
export const holidayOn = (holidays, iso, groups) => holidaysInYear(holidays, Number(iso.slice(0, 4)), groups).get(iso) ?? null;

/**
 * Tatil ekler: `date`'ten `endDate`'e (dahil; yoksa tek gün) her gün için bir kayıt.
 * Kurallar: her yıl tekrarlı kayıt eklenince aynı ay-günün tek seferlik kayıtları birleşir; zaten tatil olan güne (her yıl tekrarlı bir kayıt kapsıyorsa
 * ya da aynı tarihli kayıt varsa) yeni kayıt eklenmez, yalnızca adı güncellenir.
 * @returns {{list: object[], added: number, updated: number}}
 */
export function addHolidays(holidays, { date, endDate = date, name = '', yearly = false, group = '' }) {
  let list = normalizeHolidays(holidays);
  if (!isValidISODate(date)) return { list, added: 0, updated: 0 };
  const last = isValidISODate(endDate) && endDate >= date ? endDate : date;
  const count = Math.min(MAX_RANGE_DAYS, diffDays(date, last) + 1);
  const label = String(name ?? '').trim().slice(0, 80);
  const groupId = typeof group === 'string' ? group.slice(0, 40) : '';
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
        if (groupId) existing.group = groupId;
        updated++;
      } else {
        list.push({ id: `y:${day}`, date: day, name: label, yearly: true, group: groupId });
        added++;
      }
    } else {
      const covering = list.find((h) => (h.yearly ? monthDay(h.date) === monthDay(day) : h.date === day));
      if (covering) {
        if (label) covering.name = label;
        if (groupId) covering.group = groupId;
        updated++;
      } else {
        list.push({ id: `d:${day}`, date: day, name: label, yearly: false, group: groupId });
        added++;
      }
    }
  }
  return { list: normalizeHolidays(list.slice(0, MAX_HOLIDAYS)), added, updated };
}

export function removeHoliday(holidays, id) {
  return normalizeHolidays(holidays).filter((h) => h.id !== id);
}

/** Bir kaydı düzenler (tarih, ad, tekrar, grup): eskisi kaldırılır, yenisi `addHolidays` kurallarıyla eklenir. */
export function updateHoliday(holidays, id, { date, name, yearly, group }) {
  const rest = removeHoliday(holidays, id);
  return addHolidays(rest, { date, name, yearly, group });
}

// ---------------------------------------------------------------------------
// Gruplar
// ---------------------------------------------------------------------------

/** Ham grup listesini geçerli hâle getirir: hazır gruplar her zaman vardır (adları sabit; renkleri korunur), kullanıcı grupları sonda. */
export function normalizeHolidayGroups(list) {
  const input = Array.isArray(list) ? list.filter((g) => g && typeof g === 'object') : [];
  const out = DEFAULT_HOLIDAY_GROUPS.map((preset) => {
    const saved = input.find((g) => g.id === preset.id);
    return { id: preset.id, name: preset.name, color: normalizeHexColor(saved?.color) || preset.color, preset: true };
  });
  const seen = new Set(out.map((g) => g.id));
  for (const g of input) {
    if (typeof g.id !== 'string' || !g.id || seen.has(g.id) || out.length >= MAX_GROUPS) continue;
    seen.add(g.id);
    out.push({ id: g.id.slice(0, 40), name: String(g.name ?? '').trim().slice(0, 40) || 'Grup', color: normalizeHexColor(g.color) || FALLBACK_COLOR, preset: false });
  }
  return out;
}

/** Bir tatil kaydının grubu: bilinmeyen/boş grup Özel'dir. */
export function holidayGroupOf(groups, id) {
  const list = normalizeHolidayGroups(groups);
  return list.find((g) => g.id === id) ?? list.find((g) => g.id === DEFAULT_GROUP_ID);
}

export const holidayGroupColor = (groups, id) => holidayGroupOf(groups, id).color;

/** Yeni kullanıcı grubu ekler. @returns {{list: object[], id: string}} */
export function addHolidayGroup(groups, { name, color }) {
  const list = normalizeHolidayGroups(groups);
  const label = String(name ?? '').trim().slice(0, 40);
  if (!label || list.length >= MAX_GROUPS) return { list, id: '' };
  const slug = label.toLocaleLowerCase('tr').replace(/[^a-z0-9ğüşıöç]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'grup';
  let id = `g-${slug}`;
  for (let n = 2; list.some((g) => g.id === id); n++) id = `g-${slug}-${n}`;
  list.push({ id, name: label, color: normalizeHexColor(color) || FALLBACK_COLOR, preset: false });
  return { list, id };
}

/** Grubun rengini (her grup) ve adını (yalnızca kullanıcı grupları) değiştirir. */
export function updateHolidayGroup(groups, id, { name, color }) {
  return normalizeHolidayGroups(groups).map((g) => {
    if (g.id !== id) return g;
    return {
      ...g,
      color: color !== undefined ? normalizeHexColor(color) || g.color : g.color,
      name: !g.preset && name !== undefined ? String(name).trim().slice(0, 40) || g.name : g.name,
    };
  });
}

/** Kullanıcı grubunu siler (hazır gruplar silinemez). */
export function removeHolidayGroup(groups, id) {
  return normalizeHolidayGroups(groups).filter((g) => g.preset || g.id !== id);
}

/** Bir grubun tatillerini başka gruba taşır (grup silinirken Özel'e). */
export function reassignHolidayGroup(holidays, fromId, toId = DEFAULT_GROUP_ID) {
  return normalizeHolidays(holidays).map((h) => (h.group === fromId ? { ...h, group: toId } : h));
}
