/**
 * syncService.js — Google Drive ile cihazlar arası eşitleme (orkestrasyon).
 *
 * Akış (bir eşitleme turu): oturum belirteci → Drive'daki dosya listesi → `sync.json` oku → yerel anlık görüntü çıkar → `mergeSnapshots` (saf; bkz. sync/syncCore.js)
 * → sonucu YEREL veritabanına uygula (etkinlikler, ayarlar, ek indirme/silme) → yeni ekleri yükle → belgeyi (değiştiyse) buluta yaz → silinen ek dosyalarını sil → durumu kaydet.
 * Sıra bilinçlidir: ekler belgeden ÖNCE yüklenir (belge hiçbir zaman olmayan bir dosyayı göstermez); yazma başarısız olursa yerel veri zaten korunmuştur ve bir sonraki tur
 * kaldığı yerden devam eder. Bulutta karşılaştır-ve-yaz (If-Match) olmadığı için iki cihaz aynı anda yazarsa bir yazım diğerinin üzerine gelebilir; ama her cihaz kendi
 * değişikliklerini yerelde tuttuğundan bir sonraki turda birleştirme bunları yeniden buluta taşır (kendiliğinden düzelen, sonunda tutarlı yapı).
 *
 * Tetikleyiciler: bağlanınca, açılışta, yerel değişiklikten 5 sn sonra, sekme yeniden görününce (60 sn'den eskiyse), internet gelince, her 5 dakikada bir ve elle ("Şimdi eşitle").
 * Oturum süresi dolup sessiz yenileme olmazsa durum "needs-auth" olur; otomatik denemeler durur ve kullanıcı "Yeniden bağlan"a basana kadar beklenir (açılır pencere
 * tarayıcılarda kullanıcı hareketi ister).
 *
 * İlk eşitlemede, buluttaki veri varsa bu cihazın dokunulmamış ÖRNEK (demo) etkinlikleri atılır; örnek veriler hiçbir zaman eşitlenmez (bkz. core/seed.js).
 */
import { store } from '../core/state.js';
import { eventRepo, attachmentRepo } from '../core/eventRepo.js';
import { settingsRepo } from '../core/settingsRepo.js';
import { isUntouchedSeedEvent } from '../core/seed.js';
import { APP_VERSION } from '../core/version.js';
import { toast } from '../components/toast.js';
import * as drive from './sync/driveClient.js';
import { combineRemotes, emptySnapshot, hasRemoteData, mergeSnapshots, normalizeRemoteDoc, parseClientId, SYNC_SETTING_KEYS, toDocument, TOMBSTONE_TTL_DAYS } from './sync/syncCore.js';
import { ATT_PREFIX, GOOGLE_CLIENT_ID, SYNC_FILE } from './sync/config.js';
import { getSyncState, isSyncEnabled, loadSyncState, onDirty, onSyncStateChange, patchSyncState, unionTombstones } from './sync/syncState.js';

const DEBOUNCE_MS = 5000;
const POLL_MS = 5 * 60_000;
const STALE_MS = 60_000;
const LOCK_NAME = 'calendar-pro-sync';

/** Arayüzün okuduğu durum: phase = 'idle' | 'syncing' | 'offline' | 'needs-auth' | 'error'. */
const status = { phase: 'idle', error: '', progress: '', summary: null };
const listeners = new Set();
let timer = null;
let running = null;
let rerun = false;
let applying = false; // buluttan gelen değişiklikler yazılırken store değişimleri yeni bir eşitleme tetiklemesin
let authToastShown = false;
let started = false;
let channel = null; // aynı cihazdaki diğer sekmeler/pencereler (BroadcastChannel)

const notify = () => listeners.forEach((fn) => fn(getStatus()));
const setStatus = (patch) => {
  Object.assign(status, patch);
  notify();
};

export const getStatus = () => ({ ...status, enabled: isSyncEnabled(), lastSyncAt: getSyncState().lastSyncAt, connectedAt: getSyncState().connectedAt, customClientId: getSyncState().clientId || '' });
export const subscribeStatus = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

function schedule(ms, options = {}) {
  clearTimeout(timer);
  timer = setTimeout(() => runSync(options), ms);
}

/** Yerel anlık görüntü: dokunulmamış örnek etkinlikler hariç; ek üst verisi (blob olmadan); eşitlenen ayarlar. */
async function buildLocalSnapshot() {
  const state = getSyncState();
  const snap = emptySnapshot();
  for (const e of store.get().events) if (!isUntouchedSeedEvent(e)) snap.events[e.id] = e;
  for (const a of await attachmentRepo.listAll()) snap.attachments[a.id] = { eventId: a.eventId, name: a.name, type: a.type, size: a.size, createdAt: a.createdAt };
  for (const row of await settingsRepo.rowsFor(SYNC_SETTING_KEYS)) snap.settings[row.key] = { value: row.value, updatedAt: row.updatedAt || '' };
  snap.tombstones = { ...state.tombstones };
  snap.attTombstones = { ...state.attTombstones };
  return snap;
}

const prune = (map) => {
  const cutoff = new Date(Date.now() - TOMBSTONE_TTL_DAYS * 86_400_000).toISOString();
  return Object.fromEntries(Object.entries(map).filter(([, at]) => at >= cutoff));
};

async function doSync({ interactive, announce }) {
  setStatus({ phase: 'syncing', error: '', progress: 'Google Drive\'a bağlanılıyor…' });
  try {
    await drive.ensureToken({ interactive });
    setStatus({ progress: 'Buluttaki veriler okunuyor…' });
    const files = await drive.listFiles();
    const docFiles = files.filter((f) => f.name === SYNC_FILE).sort((a, b) => String(b.modifiedTime).localeCompare(String(a.modifiedTime)));
    const attFiles = new Map();
    for (const f of files) if (f.name.startsWith(ATT_PREFIX) && !attFiles.has(f.name.slice(ATT_PREFIX.length))) attFiles.set(f.name.slice(ATT_PREFIX.length), f);

    const remotes = [];
    for (const f of docFiles) remotes.push(normalizeRemoteDoc(await drive.readJson(f.id)));
    const remote = remotes.length > 1 ? combineRemotes(remotes) : remotes[0] ?? emptySnapshot();

    // İlk eşitleme: bulutta veri varsa bu cihazın örnek verileri gerçek takvime karışmasın
    if (getSyncState().initial && hasRemoteData(remote)) {
      const seeds = store.get().events.filter(isUntouchedSeedEvent).map((e) => e.id);
      if (seeds.length) {
        applying = true;
        try {
          await eventRepo.removeSilently(seeds);
        } finally {
          applying = false;
        }
      }
    }

    const local = await buildLocalSnapshot();
    const stamps = new Map(Object.values(local.events).map((e) => [e.id, e.updatedAt]));
    const result = mergeSnapshots(local, remote);
    const { toLocal, toRemote, merged } = result;
    const summary = { eventsDown: 0, eventsRemoved: 0, eventsUp: 0, attDown: 0, attUp: 0, attMissing: 0, attFailed: 0 };

    // ---- yerel veritabanına uygula (eşitleme sırasında kullanıcı aynı kaydı değiştirdiyse ona dokunulmaz; sonraki tur halleder)
    applying = true;
    try {
      const current = new Map(store.get().events.map((e) => [e.id, e]));
      const unchanged = (id) => !current.has(id) || !stamps.has(id) || current.get(id).updatedAt === stamps.get(id);
      const upsert = toLocal.upsertEvents.filter((e) => unchanged(e.id));
      const removeIds = toLocal.removeEventIds.filter(unchanged);
      await eventRepo.applyRemote({ upsert, removeIds });
      summary.eventsDown = upsert.length;
      summary.eventsRemoved = removeIds.length;
      await settingsRepo.applyRemote(toLocal.settings);
      await attachmentRepo.removeLocal(toLocal.removeAttachmentIds);
      let i = 0;
      for (const meta of toLocal.downloadAttachments) {
        setStatus({ progress: `Ekler indiriliyor (${++i}/${toLocal.downloadAttachments.length})…` });
        const file = attFiles.get(meta.id);
        if (!file) {
          summary.attMissing++;
          continue;
        }
        try {
          const blob = await drive.readBlob(file.id);
          await attachmentRepo.putRaw({ id: meta.id, eventId: meta.eventId, name: meta.name, type: meta.type, size: meta.size, blob: new Blob([blob], { type: meta.type }), createdAt: meta.createdAt });
          summary.attDown++;
        } catch (err) {
          if (err instanceof drive.AuthError || err instanceof drive.NetworkError) throw err;
          summary.attFailed++;
        }
      }
    } finally {
      applying = false;
    }

    // ---- yeni ekleri yükle (belgeden önce); yüklenemeyen belgede gösterilmez, sonraki tur yeniden dener
    const merged2 = { ...merged, attachments: { ...merged.attachments } };
    let removedFromIndex = 0;
    let n = 0;
    for (const id of toRemote.uploadAttachmentIds) {
      setStatus({ progress: `Ekler yükleniyor (${++n}/${toRemote.uploadAttachmentIds.length})…` });
      try {
        const rec = await attachmentRepo.getById(id);
        if (!rec) throw new Error('yerel ek bulunamadı');
        if (!attFiles.has(id)) attFiles.set(id, await drive.createFile(ATT_PREFIX + id, rec.blob, rec.type));
        summary.attUp++;
      } catch (err) {
        if (err instanceof drive.AuthError || err instanceof drive.NetworkError) throw err;
        delete merged2.attachments[id];
        removedFromIndex++;
        summary.attFailed++;
      }
    }

    // ---- belgeyi yaz (değiştiyse ya da yinelenen dosya varsa)
    summary.eventsUp = Object.keys(local.events).filter((id) => merged.events[id] === local.events[id] && (!remote.events[id] || remote.events[id].updatedAt < local.events[id].updatedAt)).length;
    if (result.remoteChanged || removedFromIndex || docFiles.length > 1) {
      setStatus({ progress: 'Buluta yazılıyor…' });
      const body = JSON.stringify(toDocument(merged2, { deviceId: getSyncState().deviceId, appVersion: APP_VERSION }));
      if (docFiles[0]) await drive.updateFile(docFiles[0].id, body, 'application/json');
      else await drive.createFile(SYNC_FILE, body, 'application/json');
      for (const extra of docFiles.slice(1)) await drive.deleteFile(extra.id);
    }
    for (const id of toRemote.deleteAttachmentIds) if (attFiles.has(id)) await drive.deleteFile(attFiles.get(id).id);

    if (summary.eventsDown || summary.eventsRemoved || summary.attDown || Object.keys(toLocal.settings).length || toLocal.removeAttachmentIds.length) channel?.postMessage('applied');

    // ---- durumu kaydet (eşitleme sırasında yeni silme izleri eklenmiş olabilir: birleştirilir)
    const cur = getSyncState();
    await patchSyncState({
      tombstones: prune(unionTombstones(cur.tombstones, result.tombstones)),
      attTombstones: prune(unionTombstones(cur.attTombstones, result.attTombstones)),
      lastSyncAt: new Date().toISOString(),
      initial: false,
    });
    authToastShown = false;
    channel?.postMessage('state');
    setStatus({ phase: 'idle', progress: '', error: '', summary });
    if (announce) toast(describe(summary), { type: summary.attFailed || summary.attMissing ? 'warning' : 'success', duration: 4500 });
    return summary;
  } catch (err) {
    applying = false;
    if (err instanceof drive.AuthError) {
      setStatus({ phase: 'needs-auth', progress: '', error: 'Google oturumu gerekiyor.' });
      if (!interactive && !authToastShown) {
        authToastShown = true;
        toast('Google Drive eşitlemesi için yeniden oturum açmanız gerekiyor', { type: 'warning', duration: 15000, action: { label: 'Yeniden bağlan', onClick: () => runSync({ interactive: true, announce: true }) } });
      } else if (interactive) toast(`Google oturumu açılamadı: ${err.message}`, { type: 'error', duration: 6000 });
    } else if (err instanceof drive.NetworkError) setStatus({ phase: 'offline', progress: '', error: err.message });
    else {
      setStatus({ phase: 'error', progress: '', error: err.message || 'Bilinmeyen hata' });
      if (interactive || announce) toast(`Eşitleme başarısız: ${err.message}`, { type: 'error', duration: 7000 });
    }
    return null;
  }
}

function describe(s) {
  const parts = [];
  if (s.eventsDown || s.eventsRemoved) parts.push(`↓ ${s.eventsDown + s.eventsRemoved} etkinlik`);
  if (s.eventsUp) parts.push(`↑ ${s.eventsUp} etkinlik`);
  if (s.attDown || s.attUp) parts.push(`${s.attDown + s.attUp} ek`);
  let text = parts.length ? `Eşitlendi: ${parts.join(' · ')}` : 'Eşitlendi: her şey güncel';
  if (s.attMissing || s.attFailed) text += ` — ${s.attMissing + s.attFailed} ek aktarılamadı, sonraki turda yeniden denenecek`;
  return text;
}

/**
 * Bir eşitleme turu çalıştırır (tek uçuş: biri sürerken gelen istek tur bitince bir kez daha çalışır). Sekmeler arası Web Locks ile tek tur.
 * @param {{interactive?: boolean, announce?: boolean}} [options] interactive: Google penceresi açılabilir (kullanıcı hareketi içinden); announce: sonucu toast ile bildir
 */
export function runSync(options = {}) {
  if (!isSyncEnabled()) return Promise.resolve(null);
  if (running) {
    rerun = true;
    return running;
  }
  const task = () => doSync({ interactive: Boolean(options.interactive), announce: Boolean(options.announce) });
  running = (globalThis.navigator?.locks ? navigator.locks.request(LOCK_NAME, { ifAvailable: true }, (lock) => (lock ? task() : null)) : task()).finally(() => {
    running = null;
    if (rerun) {
      rerun = false;
      schedule(1500);
    }
  });
  return running;
}

/** Kullanılan Google OAuth istemci kimliği: özel (Ayarlar'dan girilmiş) ya da yerleşik. */
export const getClientInfo = () => ({ custom: getSyncState().clientId || '', effective: drive.getClientId(), builtIn: GOOGLE_CLIENT_ID });

/**
 * Özel OAuth istemci kimliğini kaydeder ('' = yerleşik kimliğe dön). Bağlıyken değiştirilemez (önce bağlantı kesilmeli): bulut verisi istemci kimliğine/projesine bağlıdır,
 * farklı kimlikler birbirinin Drive uygulama klasörünü göremez. Kimlik bulutta saklanmaz; aynı veriyi paylaşacak her cihazda ayrıca girilmelidir.
 * @returns {Promise<{ok: boolean, reason?: 'enabled'|'invalid', id?: string}>}
 */
export async function setCustomClientId(value) {
  if (isSyncEnabled()) return { ok: false, reason: 'enabled' };
  const parsed = parseClientId(value);
  if (!parsed.ok) return { ok: false, reason: 'invalid' };
  await patchSyncState({ clientId: parsed.id });
  drive.setClientId(parsed.id);
  channel?.postMessage('state');
  notify();
  return { ok: true, id: parsed.id };
}

/** Bağlan'a basılmadan önce Google oturum betiğini yükler (yalnızca Bulut eşitleme bölümü görüntülenince çağrılır; diğer kullanıcılar Google'a hiç istek yapmaz). */
export const preloadSignIn = () => drive.preloadGis();

/** Google Drive'a bağlanır (kullanıcı hareketi içinden çağrılmalı) ve ilk eşitlemeyi yapar. */
export async function connect() {
  setStatus({ phase: 'syncing', error: '', progress: 'Google ile bağlanılıyor…' });
  try {
    await drive.ensureToken({ interactive: true });
  } catch (err) {
    setStatus({ phase: 'idle', progress: '', error: '' });
    toast(err instanceof drive.AuthError ? 'Google bağlantısı iptal edildi ya da reddedildi' : `Bağlanılamadı: ${err.message}`, { type: 'warning', duration: 6000 });
    return false;
  }
  await patchSyncState({ enabled: true, initial: true, connectedAt: new Date().toISOString(), lastSyncAt: '', tombstones: {}, attTombstones: {} }, { replace: true });
  await runSync({ interactive: true, announce: true });
  return true;
}

/** Bağlantıyı keser: erişim Google'da iptal edilir, yerel eşitleme durumu silinir. Yerel veriye ve buluttaki kopyaya dokunulmaz. */
export async function disconnect() {
  clearTimeout(timer);
  await drive.revokeToken().catch(() => {});
  await patchSyncState({ enabled: false, initial: false, lastSyncAt: '', connectedAt: '', tombstones: {}, attTombstones: {} }, { replace: true });
  channel?.postMessage('state');
  authToastShown = false;
  setStatus({ phase: 'idle', error: '', progress: '', summary: null });
}

/** Buluttaki TÜM eşitleme verilerini siler ve bağlantıyı keser (kullanıcı hareketi içinden). Yerel veri kalır. */
export async function deleteCloudData() {
  setStatus({ phase: 'syncing', error: '', progress: 'Bulut verisi siliniyor…' });
  try {
    await drive.ensureToken({ interactive: true });
    for (const f of await drive.listFiles()) await drive.deleteFile(f.id);
  } catch (err) {
    setStatus({ phase: isSyncEnabled() ? 'error' : 'idle', progress: '', error: err.message });
    toast(`Bulut verisi silinemedi: ${err.message}`, { type: 'error', duration: 7000 });
    return false;
  }
  await disconnect();
  return true;
}

/** Uygulama açılışında bir kez: durumu yükler ve tetikleyicileri kurar. */
export async function startSync() {
  if (started) return;
  started = true;
  await loadSyncState();
  drive.setClientId(getSyncState().clientId);
  onSyncStateChange(() => {
    drive.setClientId(getSyncState().clientId); // başka sekmede/sıfırlamayla değişmiş olabilir
    notify();
  });
  const localChanged = () => {
    if (applying || !isSyncEnabled() || status.phase === 'needs-auth') return;
    if (running) rerun = true;
    else schedule(DEBOUNCE_MS);
  };
  store.subscribe((s, prev) => {
    if (s.events !== prev.events || s.settings !== prev.settings) localChanged();
  });
  onDirty(localChanged); // ek eklendi/silindi (store'a yansımayan değişiklikler)
  // Aynı cihazdaki diğer sekme/pencere eşitlemeyle veriyi değiştirdi: bellekteki durum veritabanından yenilenir (yeni bir eşitleme tetiklenmeden)
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel('calendar-pro-sync');
    channel.onmessage = async (e) => {
      if (e.data === 'applied') {
        applying = true;
        try {
          await eventRepo.loadAll();
          await settingsRepo.load();
        } finally {
          applying = false;
        }
      }
      await loadSyncState(); // bağlantı/son eşitleme/silme izleri
      notify();
    };
  }
  const auto = (reason) => {
    if (!isSyncEnabled() || status.phase === 'needs-auth' || running) return;
    schedule(reason === 'online' ? 500 : 800);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - Date.parse(getSyncState().lastSyncAt || 0) > STALE_MS) auto('visible');
  });
  window.addEventListener('online', () => auto('online'));
  setInterval(() => document.visibilityState === 'visible' && auto('poll'), POLL_MS);
  if (isSyncEnabled()) schedule(1500);
  notify();
}

/** Sekme/oturum bayrağı (testler için): arayüz durumunu sıfırlar. */
export const __resetForTests = () => {
  authToastShown = false;
};
