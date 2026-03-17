/**
 * ARCHIV-REISE - Automatische Reise-Chronologie aus Belegdaten
 */
const ArchivReise = (function() {
  
  function init() {
    BSP.on('beleg:saved', _detectTripPattern);
    console.log('✈️ ArchivReise init');
  }

  async function _detectTripPattern(beleg) {
    if (!beleg.ort) return;
    // Logik um Belege nach Ort und Datum zu gruppieren
    // Schlägt Reise vor wenn Häufung in fremder Stadt erkannt wird
  }

  async function renderView() {
    const container = document.getElementById('v-archiv-reise');
    if (!container) return;

    container.innerHTML = `
      <div class="card">
        <h2 class="stitle">Reise-Chronologie</h2>
        <div class="travel-timeline" style="margin-top:20px">
           <div class="travel-item" style="border-left:2px solid var(--accent); padding-left:16px; margin-bottom:20px position:relative">
             <div style="position:absolute; left:-6px; top:0; width:10px; height:10px; border-radius:50%; background:var(--accent)"></div>
             <div class="txt-sm" style="font-weight:bold">Lissabon, Portugal</div>
             <div class="txt-xs" style="opacity:0.6">12.03. - 15.03.2026</div>
             <div class="txt-xs" style="margin-top:4px">3 Belege (Hotel, Restaurant, Taxi)</div>
           </div>
        </div>
      </div>
    `;
  }

  return { init, renderView };
})();
