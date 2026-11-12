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
import { todayISO } from '../core/dateUtils.js';

const SCHEMA = 1;
const IMPORTABLE_SETTINGS = ['theme', 'workDays', 'showOffDays', 'sidebarCollapsed', 'background', 'backgroundFit', 'weekStartsOn', 'defaultReminder', 'schedulerDays', 'schedulerHourHeight', 'ganttDayWidth', 'ganttShowCriticalPath'];

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
