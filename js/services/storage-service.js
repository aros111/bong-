// ══════════════════════════════════════════════════════════════
// SERVICE: STORAGE
// Abstrakte Schicht über IndexedDB – kein Modul greift direkt auf
// IndexedDB zu. Alles läuft über BSP.storage.*
//
// Vorbereitung für spätere Capacitor-SQLite-Integration:
// Wenn Capacitor eingebaut wird, ändert sich NUR diese Datei.
// Alle anderen Module bleiben unberührt.
//
// Montiert als: BSP.storage.save/get/delete/getAll/saveBlob/getBlob
// ══════════════════════════════════════════════════════════════
'use strict';

(() => {
  /**
   * BSP.storage – Einheitlicher Speicher-Service
   *
   * Jede Methode gibt ein Promise zurück.
   * Jeder Fehler wird gefangen und als klare Fehlermeldung geworfen.
   * Kein lautloses Versagen.
   */
  BSP.storage = {

    /**
     * Speichert einen Eintrag (neu anlegen via add).
     * @param {string} store - Name des IndexedDB-Stores
     * @param {Object} item  - Datensatz (ohne id für autoIncrement)
     * @returns {Promise<number>} - Vergebene ID
     */
    async save(store, item) {
      try {
        return await BSP.dbAdd(store, item);
      } catch (e) {
        console.error(`[BSP.storage.save] Store="${store}"`, e);
        throw new Error(`Speichern fehlgeschlagen (${store}): ${e.message}`);
      }
    },

    /**
     * Liest einen einzelnen Eintrag nach Key.
     * @param {string} store - Name des IndexedDB-Stores
     * @param {*} key        - Primärschlüssel (meist number)
     * @returns {Promise<Object|undefined>}
     */
    async get(store, key) {
      try {
        return await BSP.dbGet(store, key);
      } catch (e) {
        console.error(`[BSP.storage.get] Store="${store}", key=${key}`, e);
        throw new Error(`Lesen fehlgeschlagen (${store}[${key}]): ${e.message}`);
      }
    },

    /**
     * Liest ALLE Einträge aus einem Store.
     * @param {string} store - Name des IndexedDB-Stores
     * @returns {Promise<Array>}
     */
    async getAll(store) {
      try {
        return await BSP.dbGetAll(store) || [];
      } catch (e) {
        console.error(`[BSP.storage.getAll] Store="${store}"`, e);
        throw new Error(`Auslesen fehlgeschlagen (${store}): ${e.message}`);
      }
    },

    /**
     * Aktualisiert oder legt an (put = upsert).
     * @param {string} store - Name des IndexedDB-Stores
     * @param {Object} item  - Datensatz mit id
     * @returns {Promise<number>} - ID des Eintrags
     */
    async put(store, item) {
      try {
        return await BSP.dbPut(store, item);
      } catch (e) {
        console.error(`[BSP.storage.put] Store="${store}"`, e);
        throw new Error(`Aktualisieren fehlgeschlagen (${store}): ${e.message}`);
      }
    },

    /**
     * Physisches Löschen eines Eintrags aus IndexedDB.
     * Für Soft-Delete: item.deleted = true setzen und put() verwenden.
     * @param {string} store - Name des IndexedDB-Stores
     * @param {*} id         - Primärschlüssel
     * @returns {Promise<void>}
     */
    async delete(store, id) {
      try {
        await BSP.dbDelete(store, id);
      } catch (e) {
        console.error(`[BSP.storage.delete] Store="${store}", id=${id}`, e);
        throw new Error(`Löschen fehlgeschlagen (${store}[${id}]): ${e.message}`);
      }
    },

    /**
     * Speichert einen Blob im 'blobs'-Store (für Bilder).
     * @param {string} blobId - Eindeutige ID (z.B. belegNr + '_S1')
     * @param {Blob}   blob   - Bild-Blob
     * @returns {Promise<string>} - Gespeicherte blobId
     */
    async saveBlob(blobId, blob) {
      try {
        if (!(blob instanceof Blob)) throw new Error('Kein gültiger Blob übergeben');
        await BSP.dbPut('blobs', { id: blobId, blob, savedAt: Date.now() });
        return blobId;
      } catch (e) {
        console.error(`[BSP.storage.saveBlob] id="${blobId}"`, e);
        throw new Error(`Blob speichern fehlgeschlagen (${blobId}): ${e.message}`);
      }
    },

    /**
     * Lädt einen Blob und gibt eine ObjectURL zurück.
     * WICHTIG: Caller ist verantwortlich für URL.revokeObjectURL() nach Verwendung!
     * @param {string} blobId - Eindeutige ID
     * @returns {Promise<{url: string, blob: Blob}|null>}
     */
    async getBlob(blobId) {
      try {
        const entry = await BSP.dbGet('blobs', blobId);
        if (!entry || !entry.blob) return null;
        const url = URL.createObjectURL(entry.blob);
        return { url, blob: entry.blob };
      } catch (e) {
        console.error(`[BSP.storage.getBlob] id="${blobId}"`, e);
        return null; // Fallback: Bild nicht vorhanden ist kein fataler Fehler
      }
    },

    /**
     * Löscht einen Blob aus dem Store.
     * @param {string} blobId
     * @returns {Promise<void>}
     */
    async deleteBlob(blobId) {
      try {
        await BSP.dbDelete('blobs', blobId);
      } catch (e) {
        // Fehler beim Blob-Löschen ist nicht kritisch – ignorieren
        console.warn(`[BSP.storage.deleteBlob] id="${blobId}"`, e);
      }
    }
  };

  // ── Abwärtskompatibilität: Alte BSP.dbAdd etc. als Wrapper ────────
  // Bestehende Module die noch BSP.dbAdd() nutzen funktionieren weiterhin.
  // Sie werden NICHT gebrochen. Migration kann schrittweise erfolgen.
  // Die alten Methoden bleiben dauerhaft erhalten.

  console.log('[BSP] storage-service.js injected. BSP.storage ready.');
})();
