// BelegScan Pro – Service Worker
// WHY: Ermöglicht Offline-Nutzung und PWA-Installation auf iOS/Android.
// Strategie: Network-first, Cache als Fallback.
// Bei neuem Deploy: V erhöhen → Browser lädt alles neu.

const V = 'bsp-v4';
const ASSETS = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400&family=DM+Mono:wght@300&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// Install: App-Shell cachen
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(V).then(cache => cache.addAll(ASSETS).catch(() => {}))
  );
});

// Activate: Alte Caches löschen
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: Network-first, Cache als Fallback
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Anthropic API nie cachen – immer live
  if (e.request.url.includes('anthropic.com')) return;
  if (e.request.url.includes('fonts.googleapis.com')) return;

  e.respondWith(
    fetch(e.request)
      .then(resp => {
        // Erfolgreiche Antwort im Cache speichern
        const clone = resp.clone();
        caches.open(V).then(cache => cache.put(e.request, clone));
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});
