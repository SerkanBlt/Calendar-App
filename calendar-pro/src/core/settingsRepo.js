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

  /** Yalnızca bilinen anahtarları kaydeder. */
  async setMany(patch) {
    const entries = Object.entries(patch).filter(([key]) => key in DEFAULT_SETTINGS);
    if (!entries.length) return;
    await db.bulkPut(STORES.SETTINGS, entries.map(([key, value]) => ({ key, value })));
    store.set((s) => ({ settings: { ...s.settings, ...Object.fromEntries(entries) } }));
  },
};
