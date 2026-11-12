/**
 * service-worker.js — Offline desteği.
 *
 * Tüm yollar service worker'ın kapsamına (scope) göre çözülür; böylece uygulama hem alan adının
 * kökünde (https://site/) hem de bir alt klasörde (https://kullanici.github.io/Calendar-App/) çalışır.
 *
 * Strateji:
 *  - install: uygulama kabuğunu (index.html + build çıktısındaki assets/* dosyaları) önbelleğe al.
 *    Vite dosya adlarını hash'lediği için asset listesi index.html'den okunur.
 *  - navigate istekleri: network-first, çevrimdışıyken önbellekteki index.html.
 *  - diğer GET istekleri (aynı origin): stale-while-revalidate.
 *  - notificationclick: açık pencereye odaklan veya uygulamayı aç.
 */
const VERSION = 'v1.9.0'; // uygulama sürümüyle birlikte artırılır; eski önbellekler temizlenir
const CACHE_NAME = `calendar-pro-${VERSION}`;
const SCOPE = self.registration.scope; // ör. https://kullanici.github.io/Calendar-App/
const at = (path) => new URL(path, SCOPE).href;
const INDEX_URL = at('index.html');
const STATIC_SHELL = ['./', 'index.html', 'manifest.json', 'icons/icon.svg', 'icons/icon-maskable.svg'].map(at);

/** index.html içindeki assets/ referanslarını çıkarır (hash'li JS/CSS). */
async function collectBuildAssets() {
  try {
    const res = await fetch(INDEX_URL, { cache: 'no-store' });
    const text = await res.text();
    const urls = new Set();
    for (const match of text.matchAll(/(?:src|href)="([^"]+)"/g)) {
      const url = new URL(match[1], INDEX_URL);
      if (url.origin === self.location.origin && url.href.startsWith(at('assets/'))) urls.add(url.href);
    }
    return [...urls];
  } catch {
    return [];
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const assets = await collectBuildAssets();
      await cache.addAll([...STATIC_SHELL, ...assets]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('calendar-pro-') && k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(SCOPE)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put(INDEX_URL, fresh.clone());
          return fresh;
        } catch {
          return (await caches.match(INDEX_URL)) || (await caches.match(SCOPE)) || Response.error();
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = all.find((c) => 'focus' in c);
      if (existing) return existing.focus();
      return self.clients.openWindow(SCOPE);
    })(),
  );
});
