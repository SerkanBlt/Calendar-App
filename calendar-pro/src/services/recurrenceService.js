/**
 * recurrenceService.js — Tekrarlayan etkinlik kuralları.
 *
 * Kural modeli: { freq: 'daily'|'weekly'|'monthly'|'yearly', interval: number, until: 'YYYY-MM-DD'|'', count: number,
 *                exdates: string[] }
 * exdates: serinin üretmeyeceği örnek tarihleri (tek seferlik silinen veya ayrı bir kayda dönüştürülen örnekler).
 * Tek bir örneği değiştirmek, o tarihi exdates'e ekleyip `seriesId` ile seriye bağlı bağımsız bir kayıt oluşturur.
 * Veritabanında yalnızca "ana" (master) etkinlik saklanır; görünümler bir tarih aralığı için
 * `expandEvents` ile sanal tekrarlar (occurrence) üretir.
 *
 * Occurrence alanları: ana etkinliğin tüm alanları + { id, masterId, isRecurring, startDate, endDate, date }
 * Tekrarlar için id = `${masterId}@${startDate}`.
 */
import { addDays, addMonths, diffDays, isValidISODate, parseISODate, toISODate } from '../core/dateUtils.js';

export const FREQUENCIES = Object.freeze({
  daily: 'Günlük',
  weekly: 'Haftalık',
  monthly: 'Aylık',
  yearly: 'Yıllık',
});

const UNIT_LABELS = { daily: 'gün', weekly: 'hafta', monthly: 'ay', yearly: 'yıl' };
const MAX_ITERATIONS = 20000;

/** Gelen değeri geçerli bir kurala dönüştürür; geçersizse null (tekrar yok). */
export function normalizeRecurrence(rule) {
  if (!rule || typeof rule !== 'object' || !FREQUENCIES[rule.freq]) return null;
  const interval = Math.min(365, Math.max(1, parseInt(rule.interval, 10) || 1));
  const count = Math.max(0, parseInt(rule.count, 10) || 0);
  const exdates = Array.isArray(rule.exdates) ? [...new Set(rule.exdates.filter(isValidISODate))].sort() : [];
  return {
    freq: rule.freq,
    interval,
    until: isValidISODate(rule.until) ? rule.until : '',
    count,
    exdates,
  };
}

/** İnsan okunur açıklama: "Her 2 haftada bir · 31 Ara'ya kadar" */
export function describeRecurrence(rule) {
  if (!rule) return 'Tekrar yok';
  const base = rule.interval === 1 ? FREQUENCIES[rule.freq] : `Her ${rule.interval} ${UNIT_LABELS[rule.freq]}da bir`;
  const parts = [base];
  if (rule.until) parts.push(`${rule.until} tarihine kadar`);
  if (rule.count) parts.push(`${rule.count} kez`);
  return parts.join(' · ');
}

function stepDate(start, freq, n) {
  switch (freq) {
    case 'daily':
      return addDays(start, n);
    case 'weekly':
      return addDays(start, n * 7);
    case 'monthly':
      return addMonths(start, n);
    case 'yearly':
      return addMonths(start, n * 12);
    default:
      return start;
  }
}

/** Günlük/haftalık kurallarda aralığın başına hızlıca atlamak için başlangıç indeksini hesaplar. */
function firstIndexNear(startISO, rangeStart, rule) {
  const periodDays = rule.freq === 'daily' ? 1 : rule.freq === 'weekly' ? 7 : 0;
  if (!periodDays) return 0;
  const diff = diffDays(startISO, rangeStart);
  if (diff <= 0) return 0;
  return Math.max(0, Math.floor(diff / (periodDays * rule.interval)) - 1);
}

/**
 * Etkinlikleri [rangeStart, rangeEnd] (dahil) aralığındaki görünür örneklere açar.
 * @param {object[]} events Ana etkinlikler
 * @param {string} rangeStart YYYY-MM-DD
 * @param {string} rangeEnd YYYY-MM-DD
 */
export function expandEvents(events, rangeStart, rangeEnd) {
  const out = [];
  for (const ev of events) {
    if (!ev.recurrence) {
      if (ev.startDate <= rangeEnd && ev.endDate >= rangeStart) {
        out.push({ ...ev, masterId: ev.id, isRecurring: false });
      }
      continue;
    }
    const rule = ev.recurrence;
    const excluded = new Set(rule.exdates || []);
    const span = diffDays(ev.startDate, ev.endDate);
    const start = parseISODate(ev.startDate);
    let k = firstIndexNear(ev.startDate, rangeStart, rule);
    for (let i = 0; i < MAX_ITERATIONS; i++, k++) {
      if (rule.count && k >= rule.count) break;
      const occStart = toISODate(stepDate(start, rule.freq, k * rule.interval));
      if (rule.until && occStart > rule.until) break;
      if (occStart > rangeEnd) break;
      if (excluded.has(occStart)) continue; // silinmiş veya ayrı kayda dönüştürülmüş örnek
      const occEnd = toISODate(addDays(occStart, span));
      if (occEnd >= rangeStart) {
        out.push({
          ...ev,
          id: `${ev.id}@${occStart}`,
          masterId: ev.id,
          isRecurring: true,
          startDate: occStart,
          endDate: occEnd,
          date: occStart,
        });
      }
    }
  }
  return out;
}
