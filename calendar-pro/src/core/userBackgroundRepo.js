/**
 * userBackgroundRepo.js — Kullanıcının yüklediği arka plan görselleri (IndexedDB "backgrounds" store'u).
 *
 * Kayıt: { id, name, blob, type, size, width, height, createdAt }
 * Store'da (state.userBackgrounds) görüntüleme için hafif kopyalar tutulur: { id, name, url, width, height }
 * `url`, Blob'dan üretilen object URL'dir; görsel silinince serbest bırakılır.
 */
import { db, STORES } from './db.js';
import { store } from './state.js';
import { createId } from './utils.js';
import { prepareBackgroundImage } from '../services/imageService.js';

const objectUrls = new Map();

function toView(record) {
  if (!objectUrls.has(record.id)) objectUrls.set(record.id, URL.createObjectURL(record.blob));
  return { id: record.id, name: record.name, url: objectUrls.get(record.id), width: record.width, height: record.height, createdAt: record.createdAt };
}

const byCreated = (a, b) => a.createdAt.localeCompare(b.createdAt);

/** Dosya adından okunur bir etiket üretir ("IMG_2041.jpeg" → "IMG_2041"). */
function labelFrom(fileName) {
  const base = String(fileName || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return (base || 'Görselim').slice(0, 40);
}

export const userBackgroundRepo = {
  async loadAll() {
    const records = (await db.getAll(STORES.BACKGROUNDS)).sort(byCreated);
    store.set({ userBackgrounds: records.map(toView) });
  },

  /** Görseli hazırlar (gerekirse küçültür), kaydeder ve görünüm kaydını döner. */
  async add(file) {
    const { blob, width, height } = await prepareBackgroundImage(file);
    const record = {
      id: createId(),
      name: labelFrom(file.name),
      blob,
      type: blob.type,
      size: blob.size,
      width,
      height,
      createdAt: new Date().toISOString(),
    };
    await db.put(STORES.BACKGROUNDS, record);
    const view = toView(record);
    store.set((s) => ({ userBackgrounds: [...s.userBackgrounds, view] }));
    return view;
  },

  /** Siler; geri alma için ham kaydı döner. */
  async remove(id) {
    const record = await db.get(STORES.BACKGROUNDS, id);
    await db.delete(STORES.BACKGROUNDS, id);
    const url = objectUrls.get(id);
    if (url) {
      objectUrls.delete(id);
      // Görsel hâlâ ekranda olabilir; bir sonraki çizimden sonra serbest bırak
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    store.set((s) => ({ userBackgrounds: s.userBackgrounds.filter((b) => b.id !== id) }));
    return record;
  },

  /** Silinmiş bir kaydı geri yükler ("Geri al"). */
  async restore(record) {
    if (!record) return;
    await db.put(STORES.BACKGROUNDS, record);
    store.set((s) => ({ userBackgrounds: [...s.userBackgrounds.filter((b) => b.id !== record.id), toView(record)].sort(byCreated) }));
  },
};
