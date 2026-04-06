const CACHE_NAME = 'bong-manager-v4.4.9';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './core.js',
  // Services
  './js/services/db.js',
  './js/services/ai.js',
  './js/services/storage-service.js',
  './js/services/datev.js',
  // Global (frühzeitig geladen)
  './js/feedback.js',
  // Shared
  './js/dashboard.js',
  './js/onboarding.js',
  './js/sprache-universal.js',
  './js/notifications.js',
  './js/input-stift.js',
  // Business
  './js/business/business-shell.js',
  './js/business/scanner.js',
  './js/business/belege.js',
  './js/business/mwst.js',
  './js/business/steuer.js',
  './js/business/fahrt.js',
  './js/business/verpflegung.js',
  './js/business/export.js',
  './js/business/review-workflow.js',
  './js/business/konto-shell.js',
  './js/business/konto-import.js',
  './js/business/konto-abgleich.js',
  './js/business/konto-uebersicht.js',
  './js/business/abo.js',
  './js/business/einstellungen.js',
  './js/business/sprache.js',
  // Privat
  './js/privat/privat-shell.js',
  './js/privat/privat-scan.js',
  './js/privat/privat-spending.js',
  './js/privat/privat-energie.js',
  './js/privat/privat-deals.js',
  // Archiv
  './js/archiv/archiv-shell.js',
  './js/archiv/archiv-scan.js',
  './js/archiv/archiv-docs.js',
  './js/archiv/archiv-fristen.js',
  './js/archiv/archiv-reise.js',
  './js/archiv/archiv-tagebuch.js',
  './js/archiv/archiv-kontext.js',
  './js/archiv/archiv-antwort.js',
  // Leben
  './js/leben/leben-shell.js',
  './js/leben/leben-core.js',
  './js/leben/leben-home.js',
  './js/leben/leben-entwicklung.js',
  './js/leben/leben-inflation.js',
  './js/leben/leben-split.js',
  // PWA
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
    )).then(() => self.clients.claim()).then(() => {
      // Version an alle Clients melden (für BSP.getAktuellerKontext)
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
        clients.forEach(c => c.postMessage({ type: 'bsp:version', version: CACHE_NAME.replace('bong-manager-', '') }));
      });
    })
  );
});

// Fetch: Aus Cache bedienen, sonst aus dem Netz holen
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});

// Background Sync: Google Drive Backup (Chrome/Android)
// iOS Safari unterstützt diese API nicht – dort greift der visibilitychange-Fallback in einstellungen.js
self.addEventListener('sync', e => {
  if (e.tag === 'bsp-drive-backup') {
    e.waitUntil(
      // Alle registrierten Clients aufwecken und Backup auslösen
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
        if (clients && clients.length) {
          // Nachricht an aktiven Client senden – dort führt einstellungenModule backupDrive() aus
          clients[0].postMessage({ type: 'bsp:drive-sync' });
        }
      })
    );
  }
});
