/**
 * LEBEN-INFLATION - Persönlicher Preisindex
 */
const LebenInflation = (function() {
  
  function init() {
    console.log('📈 LebenInflation init');
  }

  async function renderView() {
    const container = document.getElementById('v-leben-inflation');
    if (!container) return;

    // Daten aus privat-deals holen
    const preise = await BSP.db.getAll('privat_preise');
    const rate = _calculateRate(preise);

    container.innerHTML = `
      <div class="card">
        <h2 class="stitle">Deine Inflation</h2>
        <div class="inflation-hero" style="text-align:center; padding:20px 0">
           <div style="font-size:42px; font-weight:200; color:${rate > 5 ? 'var(--red)' : 'var(--grn)'}">${rate}%</div>
           <div class="txt-sm">Persönlicher Preisindex</div>
        </div>
        
        <div class="inflation-details txt-xs" style="margin-top:20px; border-top:1px solid var(--br); padding-top:16px">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px">
            <span>Offizieller VPI</span>
            <span style="opacity:0.6">~5.9%</span>
          </div>
          <div style="display:flex; justify-content:space-between">
            <span>Real-Kaufkraft</span>
            <span style="color:var(--red)">- ${rate}%</span>
          </div>
        </div>
      </div>
    `;
  }

  function _calculateRate(preise) {
    if (!preise || preise.length === 0) return 12.4; // Mock-Basiswert
    // Hier würde die echte Differenz-Logik über Zeit laufen
    return 14.3;
  }

  return { init, renderView };
})();
