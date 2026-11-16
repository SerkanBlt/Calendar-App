/**
 * eventModel.js — Etkinlik veri modeli, doğrulama ve sorgu yardımcıları.
 *
 * Model:
 * { id, title, description, date, startDate, endDate, startTime, endTime, color, status,
 *   progress, category, project, critical, recurrence, reminder, dependencies, createdAt, updatedAt }
 * - autoClose: "Zamanı geçince otomatik kapat"; bitiş zamanı geçince durum otomatik Tamamlandı olur.
 * - project: "Gantt projesi" (serbest metin, en çok 80 karakter); Gantt görünümünü proje bazlı gruplar (bkz. services/ganttProjects.js).
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

/** "#abc" / "#aabbcc" / "#aabbccdd" → "#aabbcc" (<input type="color"> biçimi). Geçersizse ''. */
export function normalizeHexColor(value) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(String(value ?? ''));
  if (!m) return '';
  let hex = m[1].toLowerCase();
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join('');
  return `#${hex.slice(0, 6)}`;
}

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
    project: String(e.project ?? '').trim().slice(0, 80), // Gantt projesi: aynı adı taşıyan görevler Gantt'ta bir proje altında gruplanır
    critical: Boolean(e.critical),
    autoClose: Boolean(e.autoClose), // bitiş zamanı geçince durum otomatik "Tamamlandı" olur (bkz. services/autoCloseService.js; tekrarlayan serilerde uygulanmaz)
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

/**
 * Durum değiştirirken birlikte güncellenecek alanlar: Tamamlandı → ilerleme %100; tamamlanmış (%100) bir etkinlik yeniden açılırsa %100 kalmaz
 * (Devam Ediyor → %50, Yapılacak → %0). Diğer durumlarda ilerleme korunur.
 */
export function statusPatch(ev, status) {
  const patch = { status };
  if (status === 'done') patch.progress = 100;
  else if (Number(ev.progress) === 100) patch.progress = status === 'doing' ? 50 : 0;
  return patch;
}

/** Otomatik kapanması gereken etkinlikler: "Zamanı geçince otomatik kapat" açık, tekrarsız, tamamlanmamış ve bitiş zamanı geçmiş (bkz. autoCloseService). */
export function dueForAutoClose(events, now = new Date()) {
  return events.filter((e) => e.autoClose && !e.recurrence && e.status !== 'done' && eventEnd(e) < now);
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
