const CACHE_NAME = 'bong-manager-v3.8.0';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './core.js',
  './js/dashboard.js',
  './js/business/scanner.js',
  './js/privat/privat-scan.js',
  './js/archiv/archiv-scan.js',
  './manifest.json'
];

// Installation: Cache aufbauen und sofort die Kontrolle übernehmen
self.addEventListener('install', e => {
  self.skipWaiting(); // Zwingt den Browser, den neuen SW sofort zu aktivieren
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))
  );
});

// Aktivierung: Alte Caches löschen und direkt auf Clients anwenden
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Fetch: Aus Cache bedienen, sonst aus dem Netz holen
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
