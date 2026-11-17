/**
 * syncCore.js — Bulut eşitlemenin saf birleştirme çekirdeği (DOM, IndexedDB ve ağ yok; birim testlidir).
 *
 * Cihazlar arası eşitleme tek bir "eşitleme belgesi" (Drive'daki sync.json) üzerinden yapılır. Belge ve yerel anlık görüntü aynı biçimdedir:
 *   {
 *     events:        { [id]: etkinlik }                  — her etkinlikte `updatedAt` (ISO)
 *     tombstones:    { [id]: silinmeZamanı (ISO) }        — silinen etkinliklerin izi
 *     attachments:   { [id]: { eventId, name, type, size, createdAt } } — ek üst verisi (içerik ayrı dosyada; değişmez)
 *     attTombstones: { [id]: silinmeZamanı }             — silinen eklerin izi
 *     settings:      { [anahtar]: { value, updatedAt } }  — yalnızca SYNC_SETTING_KEYS
 *   }
 *
 * KURALLAR (merge sıradan bağımsızdır: iki cihaz aynı girdileri farklı sırayla birleştirse de aynı sonuca varır)
 *  - Etkinlik: iki sürüm varsa `updatedAt`'i yeni olan kazanır (alan düzeyinde birleştirme yoktur). Bir tarafta yoksa diğeri eklenir.
 *  - Silme: etkinlik silinince iz (tombstone) bırakılır. İz, etkinliğin son değişikliğinden yeni ya da eşitse etkinlik silinir; etkinlik silinmeden SONRA
 *    başka bir cihazda değiştirilmişse etkinlik kazanır (yeniden doğar, iz kalkar). İzler TOMBSTONE_TTL_DAYS gün sonra budanır.
 *  - Ek: değişmezdir (yalnızca eklenir/silinir). Bir tarafta olup diğerinde olmayan ek yüklenir/indirilir; izi olan ya da etkinliği silinmiş ek silinir.
 *  - Ayar: anahtar başına `updatedAt`'i yeni olan kazanır. Eşitlenmeyen (cihaza özel) ayarlar SYNC_SETTING_KEYS dışındadır.
 * Saatler cihaz saatidir: çok sapmış bir saat o cihazın değişikliklerini haksız yere kazandırabilir (belgelerde belirtilir).
 */

export const SYNC_SCHEMA = 1;
export const TOMBSTONE_TTL_DAYS = 120;

/** Eşitlenen ayarlar. Cihaza özel olanlar (kenar çubuğu, düğme konumu, görünüm yakınlaştırmaları, arka plan, bildirim izni…) eşitlenmez. */
export const SYNC_SETTING_KEYS = Object.freeze(['theme', 'weekStartsOn', 'workDays', 'showOffDays', 'holidayGroups', 'holidays', 'defaultReminder']);

const EPOCH = '1970-01-01T00:00:00.000Z';
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.length > 0;
const stamp = (v) => (isStr(v) ? v : EPOCH);
const later = (a, b) => (a === undefined ? b : b === undefined ? a : a >= b ? a : b);

export const emptySnapshot = () => ({ events: {}, tombstones: {}, attachments: {}, attTombstones: {}, settings: {} });

const cleanMap = (value, keep) => {
  const out = {};
  if (isObj(value)) for (const [k, v] of Object.entries(value)) if (isStr(k) && keep(v, k)) out[k] = v;
  return out;
};

/**
 * Ham (Drive'dan okunan) belgeyi doğrular ve temizler. Bozuk girdileri atar; bu uygulamadan DAHA YENİ bir şema sürümünü reddeder
 * (eski sürüm yeni biçimi yanlış yorumlayıp buluttaki veriyi bozmasın).
 */
export function normalizeRemoteDoc(raw) {
  if (raw == null) return emptySnapshot();
  if (!isObj(raw)) throw new Error('Buluttaki eşitleme dosyası okunamadı (beklenmeyen biçim).');
  if (Number(raw.schema) > SYNC_SCHEMA) throw new Error('Buluttaki veri bu uygulamadan daha yeni bir sürümle oluşturulmuş. Uygulamayı güncelleyip yeniden deneyin.');
  const iso = (v) => isStr(v);
  return {
    events: cleanMap(raw.events, (e, id) => isObj(e) && e.id === id && iso(e.updatedAt)),
    tombstones: cleanMap(raw.tombstones, (t) => iso(t)),
    attachments: cleanMap(raw.attachments, (a) => isObj(a) && isStr(a.eventId)),
    attTombstones: cleanMap(raw.attTombstones, (t) => iso(t)),
    settings: cleanMap(raw.settings, (s, key) => isObj(s) && SYNC_SETTING_KEYS.includes(key) && 'value' in s),
  };
}

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Yerel anlık görüntüyü uzak belgeyle birleştirir.
 * @param {object} local   yerel anlık görüntü (aynı biçim; ek üst verisinde blob yok)
 * @param {object} remote  uzak belge (normalizeRemoteDoc'tan geçmiş)
 * @param {{now?: string, ttlDays?: number}} [options]
 * @returns {{
 *   merged: object,                       // buluta yazılacak yeni belge içeriği
 *   remoteChanged: boolean,               // merged, remote'tan farklı mı (yazmak gerekir mi)
 *   toLocal: { upsertEvents: object[], removeEventIds: string[], settings: object, downloadAttachments: object[], removeAttachmentIds: string[] },
 *   toRemote: { uploadAttachmentIds: string[], deleteAttachmentIds: string[] },
 *   tombstones: object, attTombstones: object   // birleştirilmiş izler (yerel duruma yazılır)
 * }}
 */
export function mergeSnapshots(local, remote, { now = new Date().toISOString(), ttlDays = TOMBSTONE_TTL_DAYS } = {}) {
  const cutoff = new Date(new Date(now).getTime() - ttlDays * 86_400_000).toISOString();
  const merged = emptySnapshot();
  const toLocal = { upsertEvents: [], removeEventIds: [], settings: {}, downloadAttachments: [], removeAttachmentIds: [] };
  const toRemote = { uploadAttachmentIds: [], deleteAttachmentIds: [] };
  let remoteChanged = false;

  // ---- etkinlikler
  const ids = new Set([...Object.keys(local.events), ...Object.keys(remote.events), ...Object.keys(local.tombstones), ...Object.keys(remote.tombstones)]);
  for (const id of ids) {
    const L = local.events[id];
    const R = remote.events[id];
    const tomb = later(local.tombstones[id], remote.tombstones[id]);
    const live = L && R ? (L.updatedAt >= R.updatedAt ? L : R) : L || R;

    if (tomb && (!live || tomb >= live.updatedAt)) {
      if (tomb >= cutoff) merged.tombstones[id] = tomb;
      if (L) toLocal.removeEventIds.push(id);
      if (R || remote.tombstones[id] !== merged.tombstones[id]) remoteChanged = true;
      continue;
    }
    // etkinlik yaşıyor (iz yoksa ya da etkinlik izden sonra değiştirilmişse); iz kalkar
    merged.events[id] = live;
    if (remote.tombstones[id]) remoteChanged = true;
    if (live === R && (!L || R.updatedAt > L.updatedAt)) toLocal.upsertEvents.push(R);
    if (!R || (L && L.updatedAt > R.updatedAt)) remoteChanged = true;
  }

  // ---- ekler
  const aIds = new Set([...Object.keys(local.attachments), ...Object.keys(remote.attachments), ...Object.keys(local.attTombstones), ...Object.keys(remote.attTombstones)]);
  for (const id of aIds) {
    const Lm = local.attachments[id];
    const Rm = remote.attachments[id];
    const meta = Lm || Rm;
    let tomb = later(local.attTombstones[id], remote.attTombstones[id]);
    // Etkinliği silinmiş (ve yeniden doğmamış) ekin kendisi de silinir
    if (!tomb && meta && !merged.events[meta.eventId] && merged.tombstones[meta.eventId]) tomb = merged.tombstones[meta.eventId];
    if (tomb) {
      if (tomb >= cutoff) merged.attTombstones[id] = tomb;
      if (Lm) toLocal.removeAttachmentIds.push(id);
      if (Rm) toRemote.deleteAttachmentIds.push(id);
      if (Rm || remote.attTombstones[id] !== merged.attTombstones[id]) remoteChanged = true;
      continue;
    }
    merged.attachments[id] = meta;
    if (Lm && !Rm) {
      toRemote.uploadAttachmentIds.push(id);
      remoteChanged = true;
    } else if (!Lm && Rm) toLocal.downloadAttachments.push({ id, ...Rm });
  }

  // ---- ayarlar
  for (const key of SYNC_SETTING_KEYS) {
    const L = local.settings[key];
    const R = remote.settings[key];
    if (!L && !R) continue;
    const lt = stamp(L?.updatedAt);
    const rt = stamp(R?.updatedAt);
    if (L && (!R || lt > rt)) {
      merged.settings[key] = { value: L.value, updatedAt: lt };
      if (!R || !sameJson(L.value, R.value) || lt !== rt) remoteChanged = true;
    } else {
      merged.settings[key] = { value: R.value, updatedAt: rt };
      if (!L || (rt > lt && !sameJson(L.value, R.value))) toLocal.settings[key] = { value: R.value, updatedAt: rt };
    }
  }

  // Bulutta bulunmayan ama budanan izler de belgeden düşer
  if (!sameJson(Object.keys(remote.tombstones).sort(), Object.keys(merged.tombstones).sort()) || !sameJson(Object.keys(remote.attTombstones).sort(), Object.keys(merged.attTombstones).sort())) remoteChanged = true;

  return { merged, remoteChanged, toLocal, toRemote, tombstones: merged.tombstones, attTombstones: merged.attTombstones };
}

/** Birden çok uzak belgeyi (iki cihaz aynı anda ilk dosyayı oluşturduysa) tek belgede birleştirir. */
export function combineRemotes(docs, options) {
  return docs.reduce((acc, doc) => mergeSnapshots(acc, doc, options).merged, emptySnapshot());
}

/** Buluta yazılacak belge: şema sürümü ve üst veriyle. */
export const toDocument = (merged, { deviceId = '', appVersion = '', now = new Date().toISOString() } = {}) => ({ schema: SYNC_SCHEMA, updatedAt: now, deviceId, appVersion, ...merged });

/** Uzak belgede hiç veri var mı (ilk bağlanışta örnek verilerin atılıp atılmayacağına karar vermek için). */
export const hasRemoteData = (doc) => Object.keys(doc.events).length > 0 || Object.keys(doc.settings).length > 0 || Object.keys(doc.attachments).length > 0;
