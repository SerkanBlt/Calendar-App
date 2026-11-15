/**
 * exportService.js — JSON dışa/içe aktarma.
 *
 * Dosya biçimi:
 * { app: 'calendar-pro', schema: 1, exportedAt, events: [...], settings: {...} }
 * İçe aktarmada düz bir etkinlik dizisi de kabul edilir. Tüm kayıtlar normalizeEvent'ten geçirilir.
 * Not: Ekler (attachments) ikili veri olduğu için dışa aktarıma dahil edilmez.
 */
import { db, STORES } from '../core/db.js';
import { eventRepo } from '../core/eventRepo.js';
import { settingsRepo } from '../core/settingsRepo.js';
import { store } from '../core/state.js';
import { todayISO } from '../core/dateUtils.js';
import { buildICS, parseICS, planImport } from './icsService.js';

const MAX_ICS_BYTES = 20 * 1024 * 1024;

const SCHEMA = 1;
const IMPORTABLE_SETTINGS = ['theme', 'workDays', 'showOffDays', 'sidebarCollapsed', 'background', 'backgroundFit', 'bgColorMode', 'bgColor1', 'bgColor2', 'weekStartsOn', 'defaultReminder', 'schedulerDays', 'schedulerHourHeight', 'ganttDayWidth', 'ganttShowCriticalPath', 'kanbanLayout', 'fabBottom'];

function download(filename, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Tüm veriyi JSON dosyası olarak indirir. Dışa aktarılan etkinlik sayısını döner. */
export async function exportJSON() {
  const [events, settingsRows] = await Promise.all([db.getAll(STORES.EVENTS), db.getAll(STORES.SETTINGS)]);
  const payload = {
    app: 'calendar-pro',
    schema: SCHEMA,
    exportedAt: new Date().toISOString(),
    events,
    settings: Object.fromEntries(settingsRows.map((r) => [r.key, r.value])),
  };
  download(`calendar-pro-${todayISO()}.json`, JSON.stringify(payload, null, 2));
  return events.length;
}

/** JSON metnini doğrular ve { events, settings } döner. */
export function parseImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Dosya geçerli bir JSON değil.');
  }
  const events = Array.isArray(data) ? data : data?.events;
  if (!Array.isArray(events)) throw new Error('Geçersiz dosya: "events" dizisi bulunamadı.');
  const valid = events.filter((e) => e && typeof e === 'object');
  const settings = !Array.isArray(data) && data.settings && typeof data.settings === 'object' ? data.settings : null;
  return { events: valid, settings };
}

/**
 * Dosyayı içe aktarır.
 * @param {File} file
 * @param {{mode?: 'merge'|'replace'}} options merge: aynı id'liler güncellenir; replace: önce tümü silinir
 */
export async function importJSON(file, { mode = 'merge' } = {}) {
  const { events, settings } = parseImport(await file.text());
  if (mode === 'replace') await eventRepo.replaceAll(events);
  else await eventRepo.mergeMany(events);
  if (settings) {
    const allowed = Object.fromEntries(Object.entries(settings).filter(([k]) => IMPORTABLE_SETTINGS.includes(k)));
    await settingsRepo.setMany(allowed);
  }
  return events.length;
}

/** Etkinlikleri .ics (iCalendar) dosyası olarak indirir. Dışa aktarılan kayıt sayısını döner (0 ise dosya indirilmez). */
export async function exportICS() {
  const events = await db.getAll(STORES.EVENTS);
  if (!events.length) return 0;
  download(`calendar-pro-${todayISO()}.ics`, buildICS(events), 'text/calendar;charset=utf-8');
  return events.length;
}

/**
 * .ics dosyasını mevcut etkinliklerle birleştirir (silme yapmaz; aynı UID'liler güncellenir).
 * @returns {Promise<{added: number, updated: number, skipped: number, unsupportedRecurrence: number,
 *   unknownTimezone: number, addedIds: string[], previous: object[]}>} addedIds/previous: geri alma için
 */
export async function importICS(file) {
  if (file.size > MAX_ICS_BYTES) throw new Error('Dosya çok büyük (en fazla 20 MB).');
  const { events, stats } = parseICS(await file.text());
  if (!events.length) throw new Error(stats.total ? 'Dosyadaki etkinlikler içe aktarılamadı.' : 'Dosyada etkinlik bulunamadı; geçerli bir .ics dosyası seçin.');
  const plan = planImport(events, store.get().events);
  await eventRepo.mergeMany(plan.events);
  return {
    added: plan.added.length,
    updated: plan.updated,
    skipped: stats.skipped,
    unsupportedRecurrence: stats.unsupportedRecurrence,
    unknownTimezone: stats.unknownTimezone,
    addedIds: plan.added,
    previous: plan.previous,
  };
}

/** Dosya seçici açar; kullanıcı vazgeçerse null döner. */
export function pickFile(accept = 'application/json,.json') {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => resolve(input.files?.[0] || null), { once: true });
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.click();
  });
}
