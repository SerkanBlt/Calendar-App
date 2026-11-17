/**
 * settingsRepo.js — Kullanıcı ayarlarının kalıcı saklanması (settings store'u, key/value).
 */
import { db, STORES } from './db.js';
import { DEFAULT_SETTINGS, store } from './state.js';

export const settingsRepo = {
  async load() {
    const rows = await db.getAll(STORES.SETTINGS);
    const settings = { ...DEFAULT_SETTINGS };
    rows.forEach(({ key, value }) => {
      if (key in DEFAULT_SETTINGS) settings[key] = value;
    });
    store.set({ settings });
    return settings;
  },

  async set(key, value) {
    return this.setMany({ [key]: value });
  },

  /** Yalnızca bilinen anahtarları kaydeder. Her satıra `updatedAt` yazılır (bulut eşitlemede anahtar başına son değişiklik kazanır). */
  async setMany(patch) {
    const entries = Object.entries(patch).filter(([key]) => key in DEFAULT_SETTINGS);
    if (!entries.length) return;
    const updatedAt = new Date().toISOString();
    await db.bulkPut(STORES.SETTINGS, entries.map(([key, value]) => ({ key, value, updatedAt })));
    store.set((s) => ({ settings: { ...s.settings, ...Object.fromEntries(entries) } }));
  },

  /** Kayıtlı ayar satırları ({key, value, updatedAt}) — yalnızca istenen anahtarlar (bulut eşitleme anlık görüntüsü için). */
  async rowsFor(keys) {
    const rows = await db.getAll(STORES.SETTINGS);
    return rows.filter((r) => keys.includes(r.key) && r.key in DEFAULT_SETTINGS);
  },

  /** Buluttan gelen ayarları zaman damgalarıyla birlikte yerel olarak uygular ({ anahtar: { value, updatedAt } }). */
  async applyRemote(map) {
    const entries = Object.entries(map).filter(([key]) => key in DEFAULT_SETTINGS);
    if (!entries.length) return;
    await db.bulkPut(STORES.SETTINGS, entries.map(([key, { value, updatedAt }]) => ({ key, value, updatedAt })));
    store.set((s) => ({ settings: { ...s.settings, ...Object.fromEntries(entries.map(([key, { value }]) => [key, value])) } }));
  },
};
