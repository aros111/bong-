// ══════════════════════════════════════════════════════════════
// MODUL: DASHBOARD
// Zentrale Übersicht über alle Säulen und Cross-Pillar Stats
// ══════════════════════════════════════════════════════════════
'use strict';

const DashboardModule = (() => {

  async function render() {
    const pillar = _currentPillar;
    const list = await BSP.getBelege();
    const now = new Date();
    const year = now.getFullYear();

    // 1. Filter nach aktueller Säule
    const filtered = list.filter(b => {
      if (pillar === 'business') return b.type === 'er' || b.type === 'ar';
      if (pillar === 'privat') return b.type === 'priv';
      return false; // Archiv hat eigene Liste
    });

    // 2. Stats für Widgets berechnen
    const statsBody = document.getElementById('home-stats-body');
    if (statsBody) {
      if (pillar === 'business') {
        const er = filtered.filter(b => b.type === 'er');
        const ar = filtered.filter(b => b.type === 'ar');
        const erSum = er.reduce((s, b) => s + (b.brutto || 0), 0);
        const arSum = ar.reduce((s, b) => s + (b.brutto || 0), 0);
        
        statsBody.innerHTML = `
          <div style="display:flex; justify-content:space-between; margin-bottom:8px">
            <span style="color:var(--blu); font-size:12px">Ausgaben (ER)</span>
            <span style="color:var(--blu); font-weight:400">${BSP.fm(erSum)} €</span>
          </div>
          <div style="display:flex; justify-content:space-between">
            <span style="color:var(--ylw); font-size:12px">Einnahmen (AR)</span>
            <span style="color:var(--ylw); font-weight:400">${BSP.fm(arSum)} €</span>
          </div>
        `;
      } else if (pillar === 'privat') {
        const total = filtered.reduce((s, b) => s + (b.brutto || 0), 0);
        statsBody.innerHTML = `
          <div style="display:flex; justify-content:space-between">
            <span style="color:var(--txt2); font-size:12px">Privatausgaben Gesamt</span>
            <span style="color:var(--gold); font-weight:400">${BSP.fm(total)} €</span>
          </div>
        `;
      }
    }

    // 3. Letzte Einträge
    const recentList = document.getElementById('home-recent-list');
    if (recentList) {
      const top = filtered.sort((a,b) => (b.savedAt || 0) - (a.savedAt || 0)).slice(0, 5);
      if (!top.length) {
        recentList.innerHTML = '<div class="empty">Noch keine Belege vorhanden.</div>';
      } else {
        recentList.innerHTML = top.map(b => `
          <div class="ri" onclick="BelegeModule.openDetail(${b.id})">
            <div class="ri-bar" style="background:${b.type==='er'?'var(--blu)':b.type==='ar'?'var(--ylw)':'var(--silv)'}"></div>
            <div class="ri-th">${b.image ? `<img src="${b.image}">` : '🧾'}</div>
            <div class="ri-inf">
              <div class="ri-sh">${BSP.eh(b.shop)}</div>
              <div class="ri-me">${BSP.fd(b.date)} · ${b.cat || '—'}</div>
            </div>
            <div class="ri-r"><div class="ri-r-amt">${BSP.fm(b.brutto)} €</div></div>
          </div>
        `).join('');
      }
    }

    // 4. Archiv Mini-Widget (wenn im Archiv Modus)
    if (pillar === 'archiv') {
      const docs = await BSP.dbGetAll('archiv_dokumente');
      const fristen = await BSP.dbGetAll('archiv_fristen');
      if (recentList) {
        recentList.innerHTML = `
          <div class="card" onclick="BSP.showView('archiv-docs')">
            <div style="display:flex; justify-content:space-between"><span>Dokumente</span><span>${docs.length}</span></div>
          </div>
          <div class="card" onclick="BSP.showView('archiv-fristen')" style="margin-top:10px">
            <div style="display:flex; justify-content:space-between"><span>Fristen</span><span>${fristen.length}</span></div>
          </div>
        `;
      }
    }
    
    _updateHeader();
  }

  return { render };

})();
