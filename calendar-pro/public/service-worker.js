/**
 * service-worker.js — Offline desteği.
 *
 * Strateji:
 *  - install: uygulama kabuğunu (index.html + build çıktısındaki /assets/* dosyaları) önbelleğe al.
 *    Vite dosya adlarını hash'lediği için asset listesi index.html'den okunur.
 *  - navigate istekleri: network-first, çevrimdışıyken önbellekteki index.html.
 *  - diğer GET istekleri (aynı origin): stale-while-revalidate.
 *  - notificationclick: açık pencereye odaklan veya uygulamayı aç.
 */
const VERSION = 'v1.0.0';
const CACHE_NAME = `calendar-pro-${VERSION}`;
const STATIC_SHELL = ['/', '/index.html', '/manifest.json', '/icons/icon.svg', '/icons/icon-maskable.svg'];

/** index.html içindeki /assets/ referanslarını çıkarır (hash'li JS/CSS). */
async function collectBuildAssets() {
  try {
    const res = await fetch('/index.html', { cache: 'no-store' });
    const text = await res.text();
    const urls = new Set();
    for (const match of text.matchAll(/(?:src|href)="([^"]+)"/g)) {
      const url = match[1];
      if (url.startsWith('/assets/')) urls.add(url);
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
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put('/index.html', fresh.clone());
          return fresh;
        } catch {
          return (await caches.match('/index.html')) || (await caches.match('/')) || Response.error();
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
      return self.clients.openWindow('/');
    })(),
  );
});
