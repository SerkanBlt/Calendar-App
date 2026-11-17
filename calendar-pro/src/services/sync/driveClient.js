/**
 * driveClient.js — Google Drive istemcisi: Google Identity Services (GIS) ile oturum + Drive REST (appDataFolder).
 *
 * - Yalnızca `drive.appdata` kapsamı istenir: uygulamanın Drive'daki GİZLİ uygulama klasörü. Kullanıcının diğer Drive dosyalarına erişilmez;
 *   dosyalar Drive arayüzünde görünmez ve yalnızca bu uygulamanın OAuth kimliği tarafından okunabilir (kota kullanıcının Drive'ından düşer).
 * - Erişim belirteci (access token) YALNIZCA BELLEKTE tutulur (yaklaşık 1 saat geçerli); sayfa yenilenince sessizce (prompt: 'none') yeniden istenir.
 *   Tarayıcı açılır pencereyi kullanıcı etkileşimi olmadan engellerse AuthError fırlatılır ve arayüz "Yeniden bağlan" düğmesi gösterir.
 * - OAuth istemci kimliği (Client ID) gizli değildir: varsayılanı kod içinde durur (bkz. config.js); kullanıcı Ayarlar'dan kendi kimliğini girebilir. Yetkili JavaScript kaynakları Google Cloud'da tanımlıdır.
 * - Ağ hataları NetworkError, oturum hataları AuthError, Drive'ın döndürdüğü hatalar DriveError olarak ayrışır (arayüz durumları buna göre).
 */
import { DRIVE_API, DRIVE_UPLOAD, DRIVE_SCOPE, GIS_SRC, GOOGLE_CLIENT_ID } from './config.js';

export class AuthError extends Error {
  constructor(message, code = '') {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}
export class NetworkError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NetworkError';
  }
}
export class DriveError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'DriveError';
    this.status = status;
  }
}

let token = { value: '', expiresAt: 0 };
let clientId = GOOGLE_CLIENT_ID; // Ayarlar'dan özel kimlik girilmişse o (bkz. syncService.setCustomClientId)

export const getClientId = () => clientId;
/** Kullanılacak OAuth istemci kimliği ('' = yerleşik). Değişirse eski kimliğin belirteci geçersizdir. */
export function setClientId(id) {
  const next = id || GOOGLE_CLIENT_ID;
  if (next === clientId) return;
  clientId = next;
  clearToken();
}
let gisPromise = null;

export const hasValidToken = () => Boolean(token.value) && Date.now() < token.expiresAt;
export const clearToken = () => {
  token = { value: '', expiresAt: 0 };
};

function loadGis() {
  if (globalThis.google?.accounts?.oauth2) return Promise.resolve();
  gisPromise ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => (globalThis.google?.accounts?.oauth2 ? resolve() : reject(new NetworkError('Google oturum kitaplığı yüklenemedi.')));
    script.onerror = () => {
      gisPromise = null; // sonraki denemede yeniden yüklenebilsin
      script.remove();
      reject(new NetworkError('Google oturum kitaplığı yüklenemedi (çevrimdışı olabilirsiniz).'));
    };
    document.head.appendChild(script);
  });
  return gisPromise;
}

function requestToken(prompt) {
  return new Promise((resolve, reject) => {
    const client = globalThis.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (resp) => {
        if (resp?.error || !resp?.access_token) reject(new AuthError(resp?.error_description || resp?.error || 'Google oturumu açılamadı.', resp?.error || 'no_token'));
        else {
          token = { value: resp.access_token, expiresAt: Date.now() + Math.max(60, Number(resp.expires_in) || 3600 - 60) * 1000 - 60_000 };
          resolve(token.value);
        }
      },
      error_callback: (err) => reject(new AuthError(err?.message || 'Google oturum penceresi açılamadı ya da kapatıldı.', err?.type || 'popup_failed')),
    });
    client.requestAccessToken({ prompt });
  });
}

/**
 * Geçerli bir erişim belirteci döndürür. `interactive: true` (kullanıcı hareketi içinde çağrılmalı) gerekirse Google penceresini açar;
 * aksi halde sessiz yenileme denenir ve olmazsa AuthError fırlatılır.
 */
export async function ensureToken({ interactive = false } = {}) {
  if (hasValidToken()) return token.value;
  await loadGis();
  return requestToken(interactive ? '' : 'none');
}

/** Erişimi Google tarafında da iptal eder (Bağlantıyı kes). Başarısız olsa da yerel bağlantı kopar. */
export async function revokeToken() {
  const value = token.value;
  clearToken();
  if (!value || !globalThis.google?.accounts?.oauth2?.revoke) return;
  await new Promise((resolve) => {
    try {
      globalThis.google.accounts.oauth2.revoke(value, () => resolve());
      setTimeout(resolve, 3000);
    } catch {
      resolve();
    }
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function errorMessage(res) {
  try {
    const body = await res.json();
    return body?.error?.message || `Drive hatası (${res.status})`;
  } catch {
    return `Drive hatası (${res.status})`;
  }
}

/** Yetkilendirilmiş istek: 401'de belirteci yeniler (bir kez), 429/5xx'te üstel bekleyerek yeniden dener. */
async function api(url, { method = 'GET', headers = {}, body } = {}) {
  let refreshed = false;
  for (let attempt = 0; ; attempt++) {
    const accessToken = await ensureToken({ interactive: false });
    let res;
    try {
      res = await fetch(url, { method, headers: { Authorization: `Bearer ${accessToken}`, ...headers }, body, signal: globalThis.AbortSignal?.timeout?.(120_000) });
    } catch (err) {
      if (attempt < 2) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
      throw new NetworkError('Google Drive\'a ulaşılamıyor (internet bağlantısı yok ya da istek zaman aşımına uğradı).');
    }
    if (res.status === 401 && !refreshed) {
      refreshed = true;
      clearToken();
      continue;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await sleep(600 * 2 ** attempt);
      continue;
    }
    if (res.status === 403 && attempt < 2) {
      const text = await res.clone().text();
      if (/rateLimitExceeded|userRateLimitExceeded/.test(text)) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
    }
    if (res.status === 401) throw new AuthError('Google oturumu geçersiz; yeniden bağlanın.', 'unauthorized');
    if (!res.ok) throw new DriveError(await errorMessage(res), res.status);
    return res;
  }
}

/** Uygulama klasöründeki tüm dosyalar: [{ id, name, size, modifiedTime }]. */
export async function listFiles() {
  const out = [];
  let pageToken = '';
  do {
    const qs = new URLSearchParams({ spaces: 'appDataFolder', pageSize: '1000', fields: 'nextPageToken,files(id,name,size,modifiedTime)' });
    if (pageToken) qs.set('pageToken', pageToken);
    const body = await (await api(`${DRIVE_API}/files?${qs}`)).json();
    out.push(...(body.files || []));
    pageToken = body.nextPageToken || '';
  } while (pageToken);
  return out;
}

export const readJson = async (id) => (await api(`${DRIVE_API}/files/${encodeURIComponent(id)}?alt=media`)).json();
export const readBlob = async (id) => (await api(`${DRIVE_API}/files/${encodeURIComponent(id)}?alt=media`)).blob();

/** Google oturum betiğini önceden yükler (kullanıcı "Bağlan"a basınca açılır pencere, kullanıcı hareketinin süresi dolmadan açılabilsin). */
export const preloadGis = () => loadGis().catch(() => {});

const RESUMABLE_FROM = 4 * 1024 * 1024; // Drive: çoklu-parça yükleme küçük dosyalar (≤ 5 MB) içindir; büyük ekler devam ettirilebilir yüklemeyle gider

/** Devam ettirilebilir yükleme (tek PUT): oturum açılır, içerik oturum adresine yazılır. */
async function createResumable(name, data, mime) {
  const init = await api(`${DRIVE_UPLOAD}/files?uploadType=resumable&fields=id,name`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(data.size) },
    body: JSON.stringify({ name, parents: ['appDataFolder'] }),
  });
  const session = init.headers.get('Location');
  if (!session) throw new DriveError('Drive yükleme oturumu başlatılamadı.');
  return (await api(session, { method: 'PUT', headers: { 'Content-Type': mime }, body: data })).json();
}

/** Uygulama klasöründe yeni dosya oluşturur (küçükse multipart, 4 MB üstü devam ettirilebilir). @returns {Promise<{id: string, name: string}>} */
export async function createFile(name, data, mime = 'application/octet-stream') {
  if (data instanceof Blob && data.size > RESUMABLE_FROM) return createResumable(name, data, mime);
  const boundary = `cp-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const meta = JSON.stringify({ name, parents: ['appDataFolder'] });
  const body = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`, data, `\r\n--${boundary}--`]);
  const res = await api(`${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,name`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
  return res.json();
}

export async function updateFile(id, data, mime = 'application/json') {
  await api(`${DRIVE_UPLOAD}/files/${encodeURIComponent(id)}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': mime }, body: data });
}

/** Dosyayı siler; zaten yoksa (404) sessizce geçer. */
export async function deleteFile(id) {
  try {
    await api(`${DRIVE_API}/files/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch (err) {
    if (!(err instanceof DriveError && err.status === 404)) throw err;
  }
}
