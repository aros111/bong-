/**
 * LEBEN-SPLIT - Beleg-Teilung zwischen Business und Privat
 */
const LebenSplit = (function() {
  
  function init() {
    // Registriert Views etc.
    console.log('✂️ LebenSplit init');
  }

  function renderView() {
    const container = document.getElementById('v-leben-split');
    if (!container) return;
    
    container.innerHTML = `
      <div class="card">
        <h2 class="stitle">Beleg-Split</h2>
        <p class="txt-sm">Teile Ausgaben zwischen Business und Privat auf.</p>
        
        <div class="split-selection" style="margin-top:20px">
          <div class="field">
            <label>Business-Anteil (%)</label>
            <input type="range" id="split-range" min="0" max="100" value="50" oninput="document.getElementById('split-val').textContent = this.value + '%'">
            <div id="split-val" style="text-align:center; font-weight:bold">50%</div>
          </div>
          
          <button class="btn btn-gold" style="margin-top:20px" onclick="LebenSplit.applySplit()">Split anwenden</button>
        </div>
        
        <div id="split-history" style="margin-top:30px">
          <h3 class="stitle-sm">Letzte Splits</h3>
          <div id="split-list" class="txt-xs" style="opacity:0.6">Noch keine aktiven Splits.</div>
        </div>
      </div>
    `;
  }

  async function applySplit() {
    const val = parseInt(document.getElementById('split-range').value);
    // Logik um den aktuell fokussierten Beleg zu holen (Mock für jetzt)
    BSP.toast(`Split mit ${val}% Business gespeichert`, 'ok');
  }

  return { init, renderView, applySplit };
})();
