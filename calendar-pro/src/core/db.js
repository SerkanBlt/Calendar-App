/**
 * db.js — IndexedDB erişim katmanı (Promise tabanlı ince sarmalayıcı).
 *
 * Store'lar:
 *  - events        (keyPath: id, index: startDate, status)
 *  - settings      (keyPath: key)
 *  - notifications (keyPath: id)  → gönderilmiş hatırlatmaların kaydı
 *  - attachments   (keyPath: id, index: eventId) → etkinlik ekleri (Blob)
 *  - backgrounds   (keyPath: id) → kullanıcının yüklediği arka plan görselleri (Blob) — v2
 */

const DB_NAME = 'calendar-pro';
const DB_VERSION = 2; // v2: backgrounds store eklendi

export const STORES = Object.freeze({
  EVENTS: 'events',
  SETTINGS: 'settings',
  NOTIFICATIONS: 'notifications',
  ATTACHMENTS: 'attachments',
  BACKGROUNDS: 'backgrounds',
});

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('Bu tarayıcı IndexedDB desteklemiyor.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.EVENTS)) {
        const events = db.createObjectStore(STORES.EVENTS, { keyPath: 'id' });
        events.createIndex('startDate', 'startDate');
        events.createIndex('status', 'status');
      }
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(STORES.NOTIFICATIONS)) db.createObjectStore(STORES.NOTIFICATIONS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.ATTACHMENTS)) {
        const att = db.createObjectStore(STORES.ATTACHMENTS, { keyPath: 'id' });
        att.createIndex('eventId', 'eventId');
      }
      if (!db.objectStoreNames.contains(STORES.BACKGROUNDS)) db.createObjectStore(STORES.BACKGROUNDS, { keyPath: 'id' });
    };
    req.onsuccess = () => {
      const db = req.result;
      // Başka bir sekme daha yeni bir sürüme yükseltmek isterse bağlantıyı bırak (yükseltmeyi engelleme)
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Veritabanı güncelleniyor; uygulamanın açık olduğu diğer sekmeleri kapatıp sayfayı yenileyin.'));
  });
  return dbPromise;
}

/** Tek transaction içinde iş yapar; transaction tamamlanınca `fn` dönüş değerinin sonucu çözülür. */
async function withStore(storeName, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = fn(store);
    tx.oncomplete = () => resolve(request && 'result' in request ? request.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction iptal edildi.'));
  });
}

export const db = {
  get: (store, key) => withStore(store, 'readonly', (s) => s.get(key)),
  getAll: (store) => withStore(store, 'readonly', (s) => s.getAll()),
  getAllByIndex: (store, index, value) => withStore(store, 'readonly', (s) => s.index(index).getAll(value)),
  put: (store, value) => withStore(store, 'readwrite', (s) => s.put(value)),
  delete: (store, key) => withStore(store, 'readwrite', (s) => s.delete(key)),
  clear: (store) => withStore(store, 'readwrite', (s) => s.clear()),
  /** Birden fazla kaydı tek transaction'da yazar. */
  bulkPut: (store, values) =>
    withStore(store, 'readwrite', (s) => {
      values.forEach((v) => s.put(v));
      return null;
    }),
  bulkDelete: (store, keys) =>
    withStore(store, 'readwrite', (s) => {
      keys.forEach((k) => s.delete(k));
      return null;
    }),
};
