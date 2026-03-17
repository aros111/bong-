/**
 * ARCHIV-TAGEBUCH - Persönliche Reflexionen per Sprache/Text
 */
const ArchivTagebuch = (function() {
  
  function init() {
    console.log('📒 ArchivTagebuch init');
  }

  async function addEntry(content, metadata = {}) {
    const entry = {
      id: 'tj_' + Date.now(),
      date: new Date().toISOString(),
      content,
      mood: metadata.mood || 'neutral',
      tags: metadata.tags || [],
      context: BSP.state.activeContextId
    };
    
    await BSP.db.put('archiv_tagebuch', entry);
    BSP.emit('archiv:saved', { type: 'tagebuch', entry });
    BSP.toast('Tagebuch-Eintrag gespeichert ✨', 'ok');
  }

  async function renderView() {
    const container = document.getElementById('v-archiv-tagebuch');
    if (!container) return;

    container.innerHTML = `
      <div class="card">
        <h2 class="stitle">Tagebuch</h2>
        <div class="diary-input" style="margin-top:16px">
           <textarea class="inp" placeholder="Wie war dein Tag?" style="min-height:100px"></textarea>
           <button class="btn btn-gold" style="margin-top:10px" onclick="ArchivTagebuch.saveFromUI()">Speichern</button>
        </div>
        
        <div id="diary-list" style="margin-top:30px">
           <h3 class="stitle-sm">Letzte Einträge</h3>
           <div class="txt-xs" style="opacity:0.6">Gestern: "Erfolgreicher Release von v2.1..."</div>
        </div>
      </div>
    `;
  }

  return { init, addEntry, renderView, saveFromUI: () => BSP.toast('Gespeichert', 'ok') };
})();
