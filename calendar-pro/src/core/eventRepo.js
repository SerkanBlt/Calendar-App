/**
 * eventRepo.js — Etkinlik ve ek (attachment) repository'si.
 *
 * Veritabanı ile store arasındaki tek yazma noktasıdır:
 * her mutasyon önce IndexedDB'ye yazılır, ardından store.events güncellenir.
 */
import { db, STORES } from './db.js';
import { store } from './state.js';
import { addDaysISO, diffDays } from './dateUtils.js';
import { compareByStart, normalizeEvent } from './eventModel.js';
import { createId } from './utils.js';

function commit(events) {
  store.set({ events: [...events].sort(compareByStart) });
}

const current = () => store.get().events;

export const eventRepo = {
  async loadAll() {
    const list = await db.getAll(STORES.EVENTS);
    commit(list);
    return list;
  },

  getById(id) {
    return current().find((e) => e.id === id) || null;
  },

  /** Oluşturur veya günceller (id varsa mevcut kayıtla birleştirir). */
  async save(input) {
    const existing = input.id ? this.getById(input.id) : null;
    const event = normalizeEvent(input, existing);
    await db.put(STORES.EVENTS, event);
    commit([...current().filter((e) => e.id !== event.id), event]);
    return event;
  },

  async update(id, patch) {
    const existing = this.getById(id);
    if (!existing) throw new Error('Etkinlik bulunamadı.');
    return this.save({ ...existing, ...patch, id });
  },

  /**
   * Siler; ekleri ve diğer etkinliklerdeki bağımlılık referanslarını temizler.
   * Bir seri silinirse, seriden ayrılmış tek seferlik örnekler de silinir.
   * @returns {object[]} silinen kayıtlar (geri alma için)
   */
  async remove(id) {
    const target = this.getById(id);
    if (!target) return [];
    const removed = [target, ...current().filter((e) => e.seriesId === id)];
    const ids = new Set(removed.map((e) => e.id));
    await db.bulkDelete(STORES.EVENTS, [...ids]);
    for (const e of removed) await attachmentRepo.removeByEvent(e.id);
    const dependents = current()
      .filter((e) => !ids.has(e.id) && e.dependencies.some((d) => ids.has(d)))
      .map((e) => ({ ...e, dependencies: e.dependencies.filter((d) => !ids.has(d)) }));
    if (dependents.length) await db.bulkPut(STORES.EVENTS, dependents);
    const byId = new Map(dependents.map((e) => [e.id, e]));
    commit(current().filter((e) => !ids.has(e.id)).map((e) => byId.get(e.id) || e));
    return removed;
  },

  /** Seri kuralının exdates listesini günceller (yardımcı). */
  async setExcluded(masterId, date, excluded) {
    const master = this.getById(masterId);
    if (!master?.recurrence) throw new Error('Tekrarlayan seri bulunamadı.');
    const set = new Set(master.recurrence.exdates ?? []);
    if (excluded) set.add(date);
    else set.delete(date);
    return this.save({ ...master, recurrence: { ...master.recurrence, exdates: [...set] } });
  },

  /** Serinin yalnızca bir örneğini siler (tarihi exdates'e ekler). */
  excludeOccurrence(occ) {
    return this.setExcluded(occ.masterId, occ.startDate, true);
  },

  /** Silinmiş bir örneği seriye geri ekler. */
  includeOccurrence(masterId, date) {
    return this.setExcluded(masterId, date, false);
  },

  /**
   * Serinin tek bir örneğini bağımsız bir kayda dönüştürür ve değişiklikleri ona uygular.
   * Seri o tarihi artık üretmez; yeni kayıt `seriesId` + `originalDate` ile seriye bağlı kalır.
   * İki yazma tek transaction'da yapılır.
   */
  async detachOccurrence(occ, changes = {}) {
    const master = this.getById(occ.masterId);
    if (!master?.recurrence) throw new Error('Tekrarlayan seri bulunamadı.');
    const updatedMaster = normalizeEvent(
      { ...master, recurrence: { ...master.recurrence, exdates: [...(master.recurrence.exdates ?? []), occ.startDate] } },
      master,
    );
    const { id: _ignored, createdAt: _c, ...base } = master;
    const single = normalizeEvent({
      ...base,
      startDate: occ.startDate,
      endDate: occ.endDate,
      ...changes,
      id: undefined,
      recurrence: null,
      dependencies: [],
      seriesId: master.id,
      originalDate: occ.startDate,
    });
    await db.bulkPut(STORES.EVENTS, [updatedMaster, single]);
    commit([...current().filter((e) => e.id !== master.id), updatedMaster, single]);
    return single;
  },

  /** Ayrılmış bir örneği siler ve serideki orijinal tarihini geri getirir. */
  async reattach(id) {
    const single = this.getById(id);
    if (!single?.seriesId) return null;
    const master = this.getById(single.seriesId);
    await this.remove(id);
    if (master?.recurrence) await this.includeOccurrence(master.id, single.originalDate);
    return master;
  },

  /** Ham kayıtları doğrulayıp ekler/üzerine yazar (import, seed). */
  async mergeMany(list) {
    const events = list.map((e) => normalizeEvent(e));
    await db.bulkPut(STORES.EVENTS, events);
    const ids = new Set(events.map((e) => e.id));
    commit([...current().filter((e) => !ids.has(e.id)), ...events]);
    return events;
  },

  async replaceAll(list) {
    await db.clear(STORES.EVENTS);
    store.set({ events: [] });
    return this.mergeMany(list);
  },

  /**
   * Bir görünümdeki örneğin (occurrence) taşınması/boyutlandırılması.
   * scope = 'single': yalnızca bu örnek ayrılır ve değiştirilir.
   * scope = 'series': gün farkı kadar ana etkinliğe (tüm seriye) uygulanır.
   */
  async applyOccurrenceChange(occ, changes, scope = 'series') {
    const master = this.getById(occ.masterId || occ.id);
    if (!master) throw new Error('Etkinlik bulunamadı.');
    if (!master.recurrence) return this.update(master.id, changes);
    if (scope === 'single') return this.detachOccurrence(occ, changes);

    const newStart = changes.startDate ?? occ.startDate;
    const newEnd = changes.endDate ?? occ.endDate;
    const shift = diffDays(occ.startDate, newStart);
    const span = Math.max(0, diffDays(newStart, newEnd));
    const startDate = addDaysISO(master.startDate, shift);
    return this.update(master.id, {
      ...changes,
      startDate,
      endDate: addDaysISO(startDate, span),
      // Hariç tutulan tarihler seriyle birlikte kayar
      recurrence: shift ? { ...master.recurrence, exdates: (master.recurrence.exdates ?? []).map((d) => addDaysISO(d, shift)) } : master.recurrence,
    });
  },
};

export const attachmentRepo = {
  listByEvent: (eventId) => db.getAllByIndex(STORES.ATTACHMENTS, 'eventId', eventId),

  async add(eventId, file) {
    const record = {
      id: createId(),
      eventId,
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      blob: file,
      createdAt: new Date().toISOString(),
    };
    await db.put(STORES.ATTACHMENTS, record);
    return record;
  },

  remove: (id) => db.delete(STORES.ATTACHMENTS, id),

  async removeByEvent(eventId) {
    const list = await this.listByEvent(eventId);
    if (list.length) await db.bulkDelete(STORES.ATTACHMENTS, list.map((a) => a.id));
  },
};
