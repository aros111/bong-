/**
 * LEBEN-CORE - Zentrale Logik für die Lebensbegleiter-Säule
 */
const LebenCore = (function() {
  const STORES = ['leben_entwicklung', 'leben_inflation', 'archiv_reisen', 'archiv_tagebuch'];

  function init() {
    BSP.on('beleg:saved', _onBelegSaved);
    BSP.on('privat:saved', _onPrivatSaved);
    BSP.on('kontext:updated', _onKontextUpdated);
    console.log('🌱 LebenCore init');
  }

  async function _onBelegSaved(beleg) {
    if (!beleg) return;
    const isAbsetzbar = await checkAbsetzbarkeit(beleg);
    if (isAbsetzbar) {
      BSP.emit('absetzbar:erkannt', { beleg });
      BSP.toast('Absetzbarkeit erkannt! 💡', 'ok');
    }
  }

  async function _onPrivatSaved(beleg) {
    // Check auf Hobby-Muster (geplant)
    BSP.emit('hobby:muster', { beleg });
  }

  function _onKontextUpdated() {
    // Logik anpassen wenn Kontext sich ändert
  }

  // --- API ---

  async function getLebenKontext() {
    const entwicklung = await BSP.db.getAll('leben_entwicklung');
    const inflation = await BSP.db.getAll('leben_inflation');
    return { entwicklung, inflation };
  }

  async function checkAbsetzbarkeit(beleg, kontext = null) {
    // Grundlegende KI-Logik oder Heuristik
    const keywords = ['software', 'buch', 'kurs', 'seminar', 'hardware', 'ki', 'ai', 'cloud'];
    const desc = (beleg.beschreibung || '').toLowerCase();
    const shop = (beleg.haendler || '').toLowerCase();
    return keywords.some(k => desc.includes(k) || shop.includes(k));
  }

  async function splitBeleg(beleg, bizPct, privPct) {
    if (!beleg) return;
    
    const bizPart = { ...beleg, split: { bizPct, privPct }, type: 'biz_split' };
    const privPart = { ...beleg, split: { bizPct, privPct }, type: 'priv_split' };
    
    // In beide Stores speichern
    await BSP.db.put('belege', bizPart);
    await BSP.db.put('privat_belege', privPart);
    
    BSP.emit('beleg:split', { beleg, bizPart, privPart });
    BSP.toast('Beleg erfolgreich aufgeteilt! ✂️', 'ok');
  }

  return {
    init,
    getLebenKontext,
    checkAbsetzbarkeit,
    splitBeleg
  };
})();
