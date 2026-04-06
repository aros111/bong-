'use strict';

(() => {
  let _db = null;
  let _dbReadyResolve;
  const _dbReady = new Promise(res => _dbReadyResolve = res);

  BSP.initDB = function() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('bsp_v3', 6); // Upgrade zu Version 6 für Konto All-In-One Matcher

      req.onupgradeneeded = e => {
        const db = e.target.result;

        if (!db.objectStoreNames.contains('belege')) {
          const s = db.createObjectStore('belege', { keyPath: 'id', autoIncrement: true });
          s.createIndex('type', 'type');
          s.createIndex('date', 'date');
          s.createIndex('shop', 'shop');
          s.createIndex('savedAt', 'savedAt');
        }

        if (!db.objectStoreNames.contains('fahrten')) {
          const s = db.createObjectStore('fahrten', { keyPath: 'id', autoIncrement: true });
          s.createIndex('date', 'date');
        }

        if (!db.objectStoreNames.contains('verpflegung')) {
          const s = db.createObjectStore('verpflegung', { keyPath: 'id', autoIncrement: true });
          s.createIndex('date', 'date');
        }

        if (!db.objectStoreNames.contains('einstellungen')) {
          db.createObjectStore('einstellungen', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('konto_buchungen')) {
          const s = db.createObjectStore('konto_buchungen', { keyPath: 'id', autoIncrement: true });
          s.createIndex('datum', 'datum');
          s.createIndex('bankId', 'bankId');
        }
        
        // ═══ Version 4: Bankverwaltung für Konto Modul ═══
        if (!db.objectStoreNames.contains('konto_banken')) {
          const banken = db.createObjectStore('konto_banken', { keyPath: 'id' });
          banken.createIndex('typ', 'typ'); // geschaeftskonto | privatkonto
        }

        if (!db.objectStoreNames.contains('privat_belege')) {
          const s = db.createObjectStore('privat_belege', { keyPath: 'id', autoIncrement: true });
          s.createIndex('date', 'date');
        }
        if (!db.objectStoreNames.contains('privat_energie')) {
          db.createObjectStore('privat_energie', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('privat_ziele')) {
          db.createObjectStore('privat_ziele', { keyPath: 'id', autoIncrement: true });
        }
        
        if (!db.objectStoreNames.contains('privat_preise')) {
          const s = db.createObjectStore('privat_preise', { keyPath: 'id', autoIncrement: true });
          s.createIndex('product', 'product');
        }

        if (!db.objectStoreNames.contains('archiv_dokumente')) {
          const s = db.createObjectStore('archiv_dokumente', { keyPath: 'id', autoIncrement: true });
          s.createIndex('date', 'date');
          s.createIndex('sender', 'sender');
        }
        if (!db.objectStoreNames.contains('archiv_fristen')) {
          const s = db.createObjectStore('archiv_fristen', { keyPath: 'id', autoIncrement: true });
          s.createIndex('deadline', 'deadline');
        }
        if (!db.objectStoreNames.contains('archiv_vertraege')) {
          db.createObjectStore('archiv_vertraege', { keyPath: 'id', autoIncrement: true });
        }

        if (!db.objectStoreNames.contains('kontext')) {
          const s = db.createObjectStore('kontext', { keyPath: 'id', autoIncrement: true });
          s.createIndex('savedAt', 'savedAt');
        }

        if (!db.objectStoreNames.contains('pending_scans')) {
          db.createObjectStore('pending_scans', { keyPath: 'id', autoIncrement: true });
        }

        // Blob-Store für Bilddaten (BSP.storage.saveBlob/getBlob)
        if (!db.objectStoreNames.contains('blobs')) {
          const blobStore = db.createObjectStore('blobs', { keyPath: 'id' });
          blobStore.createIndex('savedAt', 'savedAt');
        }

        // Drive-Sync-Queue
        if (!db.objectStoreNames.contains('drive_sync')) {
          db.createObjectStore('drive_sync', { keyPath: 'id', autoIncrement: true });
        }

        // ═══ Version 2: pending_review Store (Aufgabe 3 – Kern-Kreislauf) ═══
        // Speichert ungeklärte Buchungen für die interaktive Durcharbeitung.
        // Status: 'offen' | 'später_klären' | 'abgeschlossen'
        if (!db.objectStoreNames.contains('pending_review')) {
          const pr = db.createObjectStore('pending_review', { keyPath: 'id', autoIncrement: true });
          pr.createIndex('status', 'status');
          pr.createIndex('kontoId', 'kontoId');
          pr.createIndex('datum', 'datum');
          pr.createIndex('ts', 'ts'); // Zeitstempel letzter Änderung (für 14-Tage-Rot-Logik)
        }

        // ═══ Version 3: feedback_eintraege Store ═══
        if (!db.objectStoreNames.contains('feedback_eintraege')) {
          const fb = db.createObjectStore('feedback_eintraege', { keyPath: 'id', autoIncrement: true });
          fb.createIndex('typ', 'typ');          // Bug | Änderungswunsch | Idee | Lob
          fb.createIndex('status', 'status');    // Offen | In Prompt aufgenommen | Erledigt
          fb.createIndex('prioritaet', 'prioritaet'); // Hoch | Mittel | Niedrig
          fb.createIndex('zeitstempel', 'zeitstempel');
        }
      };

      req.onsuccess = e => {
        _db = e.target.result;
        _dbReadyResolve();
        resolve();
      };

      req.onerror = () => reject(req.error);
    });
  };

  BSP.dbGetAll = async function(store) {
    await _dbReady;
    return new Promise((res, rej) => {
      const r = _db.transaction(store, 'readonly').objectStore(store).getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  };

  BSP.dbAdd = async function(store, item) {
    await _dbReady;
    return new Promise((res, rej) => {
      const r = _db.transaction(store, 'readwrite').objectStore(store).add(item);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  };

  BSP.dbPut = async function(store, item) {
    await _dbReady;
    return new Promise((res, rej) => {
      const r = _db.transaction(store, 'readwrite').objectStore(store).put(item);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  };

  BSP.dbDelete = async function(store, id) {
    await _dbReady;
    return new Promise((res, rej) => {
      const r = _db.transaction(store, 'readwrite').objectStore(store).delete(id);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  };

  BSP.dbGet = async function(store, key) {
    await _dbReady;
    return new Promise((res, rej) => {
      const r = _db.transaction(store, 'readonly').objectStore(store).get(key);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  };

  // ── Belege: typisierte Shortcuts ────────────────────────────
  BSP.getBelege = async function(type) {
    const all = await BSP.dbGetAll('belege');
    return type ? all.filter(b => b.type === type) : all;
  };

  BSP.addBeleg = async function(item) {
    if (!['er', 'ar', 'priv'].includes(item.type)) throw new Error('Ungültiger Beleg-Typ');
    item.shop = String(item.shop || 'Unbekannt').trim();
    item.date = item.date || new Date().toISOString().split('T')[0];
    item.brutto = parseFloat(item.brutto) || 0;
    if (item.type !== 'priv') {
      item.net = parseFloat(item.net) || 0;
      item.mwst = parseFloat(item.mwst) || 0;
      item.mwstRate = parseFloat(item.mwstRate) || 19;
    }
    item.items = Array.isArray(item.items) ? item.items : [];
    item.savedAt = Date.now();

    const id = await BSP.dbAdd('belege', item);
    item.id = id;

    BSP.state.scanCount++;
    localStorage.setItem('bsp_scanCount', BSP.state.scanCount);
    if (BSP._updateMwstSaldo) await BSP._updateMwstSaldo();

    BSP.emit('beleg:saved', item);
    BSP.emit('mwst:updated', { saldo: BSP.state.mwstSaldo });
    BSP.emit('stats:updated');

    return id;
  };

  BSP.updateBeleg = async function(item) {
    await BSP.dbPut('belege', item);
    if (BSP._updateMwstSaldo) await BSP._updateMwstSaldo();
    BSP.emit('beleg:saved', item);
    BSP.emit('mwst:updated', { saldo: BSP.state.mwstSaldo });
  };

  BSP.deleteBeleg = async function(id) {
    await BSP.dbDelete('belege', id);
    if (BSP._updateMwstSaldo) await BSP._updateMwstSaldo();
    BSP.emit('beleg:deleted', { id });
    BSP.emit('mwst:updated', { saldo: BSP.state.mwstSaldo });
  };

  console.log('[BSP] db.js injected.');
})();
