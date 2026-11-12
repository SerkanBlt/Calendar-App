/**
 * eventModel.js — Etkinlik veri modeli, doğrulama ve sorgu yardımcıları.
 *
 * Model:
 * { id, title, description, date, startDate, endDate, startTime, endTime, color, status,
 *   progress, category, critical, recurrence, reminder, dependencies, createdAt, updatedAt }
 *
 * - startTime boşsa etkinlik "tüm gün" kabul edilir.
 * - date alanı geriye dönük uyumluluk için startDate'in kopyasıdır.
 * - dependencies: Gantt bağımlılıkları (önce bitmesi gereken etkinlik id'leri).
 * - reminder: dakika cinsinden hatırlatma (0 = yok).
 * - seriesId / originalDate: tekrarlayan serinin tek bir örneği ayrı düzenlendiğinde oluşan kaydın bağlantısı.
 */
import { combineDateTime, isValidISODate, isValidTime, minutesToTime, parseISODate, timeToMinutes, todayISO } from './dateUtils.js';
import { clamp, createId } from './utils.js';
import { normalizeRecurrence } from '../services/recurrenceService.js';

export const STATUSES = Object.freeze(['todo', 'doing', 'done']);

export const STATUS_LABELS = Object.freeze({
  todo: 'Yapılacak',
  doing: 'Devam Ediyor',
  done: 'Tamamlandı',
});

export const EVENT_COLORS = Object.freeze(['#7c6cff', '#4f8cff', '#22c3a6', '#3ecf8e', '#f5b84b', '#ff8a4c', '#ff5d6c', '#e45cc4']);

export const REMINDER_OPTIONS = Object.freeze([
  { value: 0, label: 'Hatırlatma yok' },
  { value: 5, label: '5 dakika önce' },
  { value: 15, label: '15 dakika önce' },
  { value: 60, label: '1 saat önce' },
]);

const REMINDER_VALUES = REMINDER_OPTIONS.map((o) => o.value);
const COLOR_RE = /^#[0-9a-f]{3,8}$/i;

/**
 * Ham girdiyi geçerli bir etkinlik nesnesine dönüştürür.
 * @param {object} input Kısmi alanlar
 * @param {object|null} existing Güncellenen mevcut kayıt (createdAt korunur)
 */
export function normalizeEvent(input = {}, existing = null) {
  const now = new Date().toISOString();
  const e = { ...(existing || {}), ...input };
  const id = typeof e.id === 'string' && e.id ? e.id : createId();

  const startDate = isValidISODate(e.startDate) ? e.startDate : isValidISODate(e.date) ? e.date : todayISO();
  let endDate = isValidISODate(e.endDate) ? e.endDate : startDate;
  if (endDate < startDate) endDate = startDate;

  let startTime = isValidTime(e.startTime) ? e.startTime : '';
  let endTime = isValidTime(e.endTime) ? e.endTime : '';
  if (!startTime) endTime = '';
  else if (!endTime) endTime = minutesToTime(timeToMinutes(startTime) + 60);
  if (startTime && startDate === endDate && timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    endTime = minutesToTime(timeToMinutes(startTime) + 30);
    if (endTime === startTime) startTime = minutesToTime(timeToMinutes(startTime) - 30);
  }

  const dependencies = Array.isArray(e.dependencies)
    ? [...new Set(e.dependencies.filter((d) => typeof d === 'string' && d && d !== id))]
    : [];

  return {
    id,
    title: String(e.title ?? '').trim().slice(0, 200) || 'Adsız etkinlik',
    description: String(e.description ?? '').slice(0, 5000),
    date: startDate,
    startDate,
    endDate,
    startTime,
    endTime,
    color: COLOR_RE.test(e.color) ? e.color : EVENT_COLORS[0],
    status: STATUSES.includes(e.status) ? e.status : 'todo',
    progress: clamp(Math.round(Number(e.progress) || 0), 0, 100),
    category: String(e.category ?? '').trim().slice(0, 60),
    critical: Boolean(e.critical),
    recurrence: normalizeRecurrence(e.recurrence),
    reminder: REMINDER_VALUES.includes(Number(e.reminder)) ? Number(e.reminder) : 0,
    dependencies,
    // Tek seferlik değiştirilmiş örnekler: ait olduğu seri ve serideki orijinal tarih
    seriesId: typeof e.seriesId === 'string' && e.seriesId !== id ? e.seriesId : '',
    originalDate: isValidISODate(e.originalDate) ? e.originalDate : '',
    createdAt: typeof e.createdAt === 'string' ? e.createdAt : now,
    updatedAt: now,
  };
}

export const isAllDay = (ev) => !ev.startTime;

/** Zaman ızgarasında saat bloğu olarak çizilebilir mi? (saatli ve tek günlük) */
export const isTimed = (ev) => Boolean(ev.startTime) && ev.startDate === ev.endDate;

export function eventStart(ev) {
  return combineDateTime(ev.startDate, ev.startTime || '00:00');
}

export function eventEnd(ev) {
  if (!ev.startTime) {
    const d = parseISODate(ev.endDate);
    d.setHours(23, 59, 59, 999);
    return d;
  }
  return combineDateTime(ev.endDate, ev.endTime || ev.startTime);
}

/** Tamamlanmamış ve bitiş zamanı geçmiş (tekrarlamayan) görev. */
export function isOverdue(ev, now = new Date()) {
  return ev.status !== 'done' && !ev.recurrence && eventEnd(ev) < now;
}

export function compareByStart(a, b) {
  return eventStart(a) - eventStart(b) || a.title.localeCompare(b.title, 'tr');
}

/** Etkinliğin belirli bir günü kapsayıp kapsamadığı. */
export const coversDate = (ev, iso) => ev.startDate <= iso && ev.endDate >= iso;
