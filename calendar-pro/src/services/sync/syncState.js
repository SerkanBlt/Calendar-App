/**
 * syncState.js — Bulut eşitlemenin kalıcı yerel durumu (bu cihaza özeldir; buluta gitmez).
 *
 * `settings` store'unda tek bir ayrılmış satırda (`sync:state`) tutulur. Bu anahtar DEFAULT_SETTINGS'te olmadığı için ayarlar yüklenirken ve
 * JSON yedeğinde yok sayılır; "Tüm verileri sıfırla" ile birlikte silinir (bağlantı da kopar).
 *
 *   {
 *     enabled:       eşitleme bağlı mı
 *     deviceId:      bu cihazın kimliği (bulut belgesine üst veri olarak yazılır)
 *     initial:       bağlandıktan sonra ilk eşitleme henüz yapılmadı (örnek veriler bu ilk eşitlemede atılır)
 *     connectedAt, lastSyncAt: ISO zamanları
 *     tombstones:    silinen etkinliklerin izi { id: ISO }     — yalnızca eşitleme bağlıyken kaydedilir
 *     attTombstones: silinen eklerin izi     { id: ISO }
 *   }
 *
 * Silme izleri depo katmanından (eventRepo/attachmentRepo) `recordDeletes` ile yazılır: silinen kayıt iz bırakmazsa, bulutta duran kopyası
 * bir sonraki eşitlemede geri gelirdi. Eşitleme bağlı değilken iz tutulmaz (gereksiz yazma yok).
 */
import { db, STORES } from '../../core/db.js';
import { createId } from '../../core/utils.js';

const KEY = 'sync:state';
const defaults = () => ({ enabled: false, deviceId: createId(), initial: false, connectedAt: '', lastSyncAt: '', tombstones: {}, attTombstones: {} });

let state = null;
let chain = Promise.resolve();
const listeners = new Set();

const emit = () => listeners.forEach((fn) => fn(state));

/** İki iz haritasını birleştirir (aynı kimlikte yeni olan kalır). */
export function unionTombstones(a, b) {
  const out = { ...a };
  for (const [id, at] of Object.entries(b)) if (!(id in out) || at > out[id]) out[id] = at;
  return out;
}
/**
 * Yazmalar sıraya girer (aynı anda çok silme olsa da son durum kaydedilir). Aynı cihazda birden çok sekme/pencere (ör. tarayıcı sekmesi + yüklü uygulama) olabilir:
 * kaydetmeden önce veritabanındaki satır okunur ve (aynı bağlantı dönemindeyse) silme izleri BİRLEŞTİRİLİR; böylece bir sekmenin kaydettiği izler diğerinin
 * bellekteki eski durumu tarafından ezilmez. `replace: true` bilerek değiştirme demektir (bağlan/kes).
 */
const persist = ({ replace = false } = {}) => {
  chain = chain
    .then(async () => {
      if (!replace && state.enabled) {
        const stored = (await db.get(STORES.SETTINGS, KEY))?.value;
        if (stored?.enabled && stored.connectedAt === state.connectedAt) {
          state.tombstones = unionTombstones(stored.tombstones || {}, state.tombstones);
          state.attTombstones = unionTombstones(stored.attTombstones || {}, state.attTombstones);
        }
      }
      await db.put(STORES.SETTINGS, { key: KEY, value: state });
    })
    .catch(() => {});
  return chain;
};

export async function loadSyncState() {
  const row = await db.get(STORES.SETTINGS, KEY);
  state = { ...defaults(), ...(row?.value && typeof row.value === 'object' ? row.value : {}) };
  state.tombstones = { ...state.tombstones };
  state.attTombstones = { ...state.attTombstones };
  if (!row) await persist();
  emit();
  return state;
}

export const getSyncState = () => state ?? defaults();
export const isSyncEnabled = () => Boolean(state?.enabled);
export const onSyncStateChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Durumu günceller ve kaydeder (`replace: true`: silme izleri de olduğu gibi yazılır; bağlan/kes için). */
export function patchSyncState(patch, options) {
  state = { ...(state ?? defaults()), ...patch };
  emit();
  return persist(options);
}

/** Yerelde silinen etkinlik/ek kimlikleri için iz bırakır (yalnızca eşitleme bağlıysa). */
export function recordDeletes({ events = [], attachments = [] } = {}) {
  if (!state?.enabled || (!events.length && !attachments.length)) return Promise.resolve();
  const now = new Date().toISOString();
  for (const id of events) state.tombstones[id] = now;
  for (const id of attachments) state.attTombstones[id] = now;
  return persist();
}

const dirtyListeners = new Set();
/** Eşitlenecek yerel veri değişti ama store'a yansımadı (ek eklendi/silindi): eşitleme servisi kısa süre sonra yeni tur başlatır. */
export const markDirty = () => dirtyListeners.forEach((fn) => fn());
export const onDirty = (fn) => {
  dirtyListeners.add(fn);
  return () => dirtyListeners.delete(fn);
};

/** "Tüm verileri sıfırla" sonrası: veritabanı zaten temizlendi; bellekteki durumu da başlangıca döndürür (bağlantı kopar). */
export function forgetSyncState() {
  state = defaults();
  emit();
}
