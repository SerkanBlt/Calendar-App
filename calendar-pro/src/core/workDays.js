/**
 * workDays.js — Çalışma günleri yardımcıları.
 *
 * Ayar: settings.workDays → JavaScript gün numaraları (0 = Pazar … 6 = Cumartesi).
 * Varsayılan: Pazartesi–Cuma (Cumartesi ve Pazar çalışma dışı).
 * settings.showOffDays → Ay ve Hafta görünümlerinde çalışma dışı günler gösterilsin mi?
 */
import { parseISODate } from './dateUtils.js';

export const DEFAULT_WORK_DAYS = Object.freeze([1, 2, 3, 4, 5]);

/** Geçerli, tekrarsız ve boş olmayan bir gün listesi döner (boşsa tüm günler çalışma günü sayılır). */
export function normalizeWorkDays(value) {
  const days = Array.isArray(value) ? [...new Set(value.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))] : [...DEFAULT_WORK_DAYS];
  return days.length ? days.sort((a, b) => a - b) : [0, 1, 2, 3, 4, 5, 6];
}

/** Hafta başlangıcına göre sıralı gün numaraları (ör. Pzt başlıyorsa [1,2,3,4,5,6,0]). */
export const orderedWeekdays = (weekStartsOn = 1) => Array.from({ length: 7 }, (_, i) => (i + weekStartsOn) % 7);

/** Çalışma dışı günlerin ISO tarih kümesi. */
export function offDaySet(isoDays, workDays) {
  const work = new Set(normalizeWorkDays(workDays));
  return new Set(isoDays.filter((d) => !work.has(parseISODate(d).getDay())));
}

/**
 * Görünümde gösterilecek günler: showOffDays kapalıysa çalışma dışı günler çıkarılır.
 * Hepsi çalışma dışıysa (ör. yalnızca hafta sonunu gösteren bir hafta yok) tüm günler döner.
 */
export function visibleDays(isoDays, settings) {
  if (settings.showOffDays !== false) return isoDays;
  const off = offDaySet(isoDays, settings.workDays);
  const visible = isoDays.filter((d) => !off.has(d));
  return visible.length ? visible : isoDays;
}
