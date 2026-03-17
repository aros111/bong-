// ══════════════════════════════════════════════════════════════
// SERVICE WORKER — BelegScan Pro v2
// Cached alle App-Dateien für Offline-Betrieb
// Cache-Version erhöhen wenn Dateien sich ändern
// ══════════════════════════════════════════════════════════════

const CACHE = 'bsp-v2-1';

const STATIC = [
  './',
  './index.html',
  './core.js',
  './style.css',
  './manifest.json',
  './js/einstellungen.js',
  './js/scanner.js',
  './js/sprache.js',
  './js/belege.js',
  './js/mwst.js',
  './js/fahrt.js',
  './js/verpflegung.js',
  './js/steuer.js',
  './js/export.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400&family=DM+Mono:wght@300&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      // Kern-Dateien cachen, Fehler ignorieren für optionale Dateien
      return cache.addAll(STATIC.map(url => new Request(url, { cache: 'reload' }))).catch(() => {
        return Promise.all(STATIC.map(url =>
          cache.add(url).catch(err => console.warn('SW cache skip:', url, err))
        ));
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Nur GET cachen
  if (e.request.method !== 'GET') return;

  // API-Calls nicht cachen
  if (e.request.url.includes('anthropic.com') ||
      e.request.url.includes('googleapis.com/upload') ||
      e.request.url.includes('drive.google.com')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
