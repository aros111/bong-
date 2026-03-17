/**
 * LEBEN-HOME - Übersicht Dashboard für den Lebensbegleiter
 */
const LebenHome = (function() {
  
  function init() {
    BSP.on('view:changed', ({ name }) => {
      if (name === 'leben-home') render();
    });
    console.log('🏠 LebenHome init');
  }

  async function render() {
    const container = document.getElementById('v-leben-home');
    if (!container) return;

    const ctx = await LebenCore.getLebenKontext();
    
    container.innerHTML = `
      <div class="home-hero">
        <div class="home-title" style="font-size:24px; font-weight:200; border-bottom:1px solid var(--br); padding-bottom:16px; width:100%; text-align:center">Dein Begleiter</div>
      </div>

      <div class="home-stats" style="margin-top:20px">
        <div class="stat-card" onclick="BSP.showView('leben-inflation')">
          <div class="sc-lbl">Inflation</div>
          <div class="sc-val" style="color:var(--accent)">14.3%</div>
          <div class="sc-sub">Persönlicher Index</div>
        </div>
        <div class="stat-card" onclick="BSP.showView('leben-entwicklung')">
          <div class="sc-lbl">Entwicklung</div>
          <div class="sc-val" style="color:var(--accent2)">🌱 Aktiv</div>
          <div class="sc-sub">3 Projekte erkannt</div>
        </div>
      </div>

      <div class="recent-section" style="margin-top:24px">
        <h3 class="stitle-sm">Vorschläge der KI</h3>
        <div class="card" style="margin-top:10px; border-style:dashed; opacity:0.8">
           <div class="txt-sm">💡 <b>Split-Vorschlag:</b> Dein Einkauf bei "Apple Store" (849€) könnte zu 70% beruflich absetzbar sein.</div>
           <button class="btn btn-sm btn-gold" style="margin-top:10px" onclick="LebenSplit.renderView(); BSP.showView('leben-split')">Details prüfen</button>
        </div>
      </div>
    `;
  }

  return { init, render };
})();
