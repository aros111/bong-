// ══════════════════════════════════════════════════════════════
// MODUL: PRIVAT DEALS (v2.0)
// Intelligentes Einkaufs-Timing & Preisdatenbank
// ══════════════════════════════════════════════════════════════
'use strict';

const PrivatDeals = (() => {

  const VIEW_HTML = `
    <div class="mod-header">
      <h1 class="mod-title">Smart Shopping</h1>
      <p class="mod-sub">Wann lohnt sich der nächste Einkauf?</p>
    </div>

    <!-- Deal-Radar -->
    <div class="card" style="background:var(--bg2); border:1px solid var(--gold)">
      <div style="font-size:12px; color:var(--gold); font-weight:bold; margin-bottom:8px">🔥 AKTUELLER DEAL-RADAR</div>
      <div id="deals-radar-content" style="font-size:14px; color:var(--txt)">
        Analysiere deine Belege nach Zyklen...
      </div>
    </div>

    <div class="stitle" style="margin-top:24px">Persönlicher Preis-Index</div>
    <div id="deals-list" class="list-container"></div>
    
    <button class="btn btn-g" style="width:100%; margin-top:24px; justify-content:center" onclick="PrivatDeals.rebuildDB()">
      🔄 Preis-Index synchronisieren
    </button>
  `;

  function init() {
    BSP.on('view:changed', ({ name }) => {
      if (name === 'privat-deals') {
        const v = document.getElementById('v-privat-deals');
        if (v) { v.innerHTML = VIEW_HTML; render(); }
      }
    });

    // Automatisches Rebuild bei neuem Beleg
    BSP.on('beleg:saved', (b) => {
      if (b.type === 'priv') rebuildDB();
    });
  }

  async function render() {
    const prices = await BSP.dbGetAll('privat_preise');
    const radarEl = document.getElementById('deals-radar-content');
    const listEl = document.getElementById('deals-list');

    if (!radarEl || !listEl) return;

    if (!prices.length) {
      listEl.innerHTML = '<div class="empty">Scanne privat Belege mit Einzelpositionen, um den Index aufzubauen.</div>';
      return;
    }

    // Radar Logic: Finde Produkte, die historisch bald günstig sein müssten
    _renderRadar(prices, radarEl);

    // Liste gruppieren nach Produkt
    const grouped = _groupPrices(prices);
    listEl.innerHTML = Object.entries(grouped).map(([name, data]) => `
      <div class="ri" style="display:flex; justify-content:space-between; align-items:center">
        <div>
          <div style="font-weight:500; font-size:14px">${eh(name)}</div>
          <div style="font-size:11px; color:var(--txt3)">Zuletzt: ${BSP.fm(data.lastPrice)} € bei ${eh(data.lastShop)}</div>
        </div>
        <div style="text-align:right">
          <div style="color:var(--gold); font-weight:bold">${BSP.fm(data.bestPrice)} €</div>
          <div style="font-size:10px; color:var(--txt3)">Bestpreis</div>
        </div>
      </div>
    `).join('');
  }

  function _groupPrices(prices) {
    const g = {};
    prices.forEach(p => {
      if (!g[p.product]) g[p.product] = { bestPrice: p.price, lastPrice: p.price, lastShop: p.shop, history: [] };
      if (p.price < g[p.product].bestPrice) g[p.product].bestPrice = p.price;
      g[p.product].history.push(p);
    });
    return g;
  }

  async function _renderRadar(prices, el) {
    if (prices.length < 5) {
      el.textContent = 'Brauche mehr Daten für Trend-Analysen...';
      return;
    }
    // Simple Heuristik: Wenn ein Produkt mehrfach gekauft wurde, zeige den Bestpreis
    const grouped = _groupPrices(prices);
    const topDeal = Object.entries(grouped)
      .filter(([_, d]) => d.history.length > 2)
      .sort((a,b) => (a[1].lastPrice - a[1].bestPrice) - (b[1].lastPrice - b[1].bestPrice))[0];

    if (topDeal) {
      el.innerHTML = `Basierend auf deinen Belegen: <b>${eh(topDeal[0])}</b> war historisch bei <b>${eh(topDeal[1].lastShop)}</b> am günstigsten (${BSP.fm(topDeal[1].bestPrice)} €).`;
    } else {
      el.textContent = 'Warte auf zyklische Muster...';
    }
  }

  async function rebuildDB() {
    BSP.toast('Synchronisiere Preis-Index...', 'info');
    const belege = await BSP.getBelege('priv');
    
    // Bestehende Einträge löschen (einfacher Rebuild)
    const existing = await BSP.dbGetAll('privat_preise');
    for (const p of existing) await BSP.dbDelete('privat_preise', p.id);

    // Belege parsen
    for (const b of belege) {
      if (b.items && b.items.length) {
        for (const item of b.items) {
          await BSP.dbAdd('privat_preise', {
            product: item.name,
            price: item.price,
            shop: b.shop,
            date: b.date
          });
        }
      }
    }
    
    if (BSP.currentView === 'privat-deals') render();
    BSP.toast('Preis-Index aktualisiert', 'ok');
  }

  return { init, render, rebuildDB };

})();
PrivatDeals.init();
