// ══════════════════════════════════════════════════════════════
// MODUL: BELEGE
// Verwaltung der Belegliste, Details und Archiv-Bridge
// ══════════════════════════════════════════════════════════════
'use strict';

const BelegeModule = (() => {

  const VIEW_HTML = `
    <div class="mod-header">
      <h1 class="mod-title">Deine Belege</h1>
      <p class="mod-sub" id="beleg-list-sub">Verwalte deine digitalen Dokumente</p>
    </div>

    <!-- Filter/Suche -->
    <div class="field sett-mt" style="margin-bottom:16px">
      <input type="text" id="beleg-search" placeholder="Suchen nach Händler, Kat..." oninput="BelegeModule.renderList()">
    </div>

    <div id="beleg-list-container"></div>
  `;

  async function init() {
    const v = document.getElementById('v-belege');
    if (v) v.innerHTML = VIEW_HTML;
    
    BSP.on('pillar:changed', () => { if (BSP.currentView === 'belege') renderList(); });
    BSP.on('beleg:saved', () => { if (BSP.currentView === 'belege') renderList(); });
  }

  async function renderList() {
    const container = document.getElementById('beleg-list-container');
    if (!container) return;

    try {
      const all = await BSP.getBelege();
      const pillar = _currentPillar;
      const search = document.getElementById('beleg-search')?.value?.toLowerCase() || '';

      const filtered = all.filter(b => {
        // Pillar Filter
        const matchesPillar = (pillar === 'business') ? (b.type === 'er' || b.type === 'ar') : (b.type === 'priv');
        if (!matchesPillar) return false;

        // Search Filter
        if (search) {
          return (b.shop?.toLowerCase().includes(search) || b.cat?.toLowerCase().includes(search));
        }
        return true;
      }).sort((a,b) => (b.date || '').localeCompare(a.date || '') || (b.savedAt || 0) - (a.savedAt || 0));

      if (!filtered.length) {
        container.innerHTML = `<div class="empty">Keine Belege in ${pillar} gefunden.</div>`;
        return;
      }

      container.innerHTML = filtered.map(b => `
        <div class="ri" onclick="BelegeModule.openDetail(${b.id})">
          <div class="ri-bar" style="background:${b.type==='er'?'var(--blu)':b.type==='ar'?'var(--ylw)':'var(--silv)'}"></div>
          <div class="ri-th">${b.image ? `<img src="${b.image}">` : '🧾'}</div>
          <div class="ri-inf">
            <div class="ri-sh">${BSP.eh(b.shop)}</div>
            <div class="ri-me">${(b.cat||'').includes('Bewirtung') ? '<span class="badge" style="background:var(--orn);color:#fff;padding:2px 6px;border-radius:4px;font-size:9px;margin-right:4px">Bewirtung 70/30</span>' : ''}<span>${BSP.fd(b.date)}</span> · <span>${b.cat || '—'}</span></div>
          </div>
          <div class="ri-r">
            <div class="ri-r-amt">${BSP.fm(b.brutto)} €</div>
            <div class="ri-r-type">${b.type.toUpperCase()}</div>
          </div>
        </div>
      `).join('');

    } catch(e) {
      console.error('Beleg list error:', e);
    }
  }

  async function openDetail(id) {
    const b = await BSP.dbGet('belege', id);
    if (!b) return;

    // Bei AR: Rechnungssteller (Händler) + Rechnungsempfänger anzeigen
    const isAR = b.type === 'ar';
    const nameLabel = isAR ? 'Rechnungssteller' : (b.type === 'er' ? 'Händler' : 'Händler');
    const nameValue = BSP.eh(b.shop || '—');

    const html = `
      <div class="sh"></div>
      <div class="mod-header" style="text-align:center">
        <div style="font-size:40px;margin-bottom:10px">${b.type==='ar' ? '📄' : b.type==='er' ? '💼' : '🏠'}</div>
        <h2 class="mod-title">${BSP.eh(b.type==='ar' ? (b.empfaenger||b.shop||'—') : (b.shop||'—'))}</h2>
        <p class="mod-sub">${BSP.fd(b.date)} · ${b.belegNr||b.cat || 'Allgemein'}</p>
      </div>

      <div class="card" style="text-align:center">
        <div style="font-size:24px;font-weight:200;color:var(--gold)">${BSP.fm(b.brutto)} €</div>
        <div style="font-size:11px;color:var(--txt3);margin-top:4px">
          Netto: ${BSP.fm(b.net)} € · MwSt (${b.mwstRate}%): ${BSP.fm(b.mwst)} €
        </div>
      </div>

      ${isAR ? `
      <div class="card card-sm">
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--br)">
          <span style="font-size:11px;color:var(--txt3)">Rechnungssteller</span>
          <span style="font-size:12px;color:var(--txt)">${BSP.eh(b.shop||'—')}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:4px 0">
          <span style="font-size:11px;color:var(--gold)">Rechnungsempfänger</span>
          <span style="font-size:12px;color:var(--txt);font-weight:500">${BSP.eh(b.empfaenger||'—')}</span>
        </div>
      </div>` : b.type !== 'priv' ? `
      <div class="card card-sm">
        <div style="display:flex;justify-content:space-between;padding:4px 0">
          <span style="font-size:11px;color:var(--txt3)">${nameLabel}</span>
          <span style="font-size:12px;color:var(--txt)">${nameValue}</span>
        </div>
      </div>` : ''}

      ${b.image ? `<div class="card" style="padding:4px;overflow:hidden"><img src="${b.image}" style="width:100%;border-radius:var(--r12);display:block"></div>` : ''}

      <div class="g2 sett-mt">
        <button class="btn btn-red" style="justify-content:center" onclick="BelegeModule.deleteBeleg(${b.id})">Löschen</button>
        <button class="btn btn-gold" style="justify-content:center" onclick="BelegeModule.archiveBeleg(${b.id})">📦 Archivieren</button>
      </div>
      
      <button class="btn btn-g" style="width:100%;margin-top:10px;justify-content:center" onclick="BSP.closeSheet()">Schließen</button>
    `;

    BSP.showSheet(html);
  }

  async function deleteBeleg(id) {
    if (!confirm('Beleg wirklich löschen?')) return;
    await BSP.dbDel('belege', id);
    BSP.closeSheet();
    BSP.emit('beleg:deleted');
    BSP.toast('Gelöscht', 'ok');
  }

  async function archiveBeleg(id) {
    const b = await BSP.dbGet('belege', id);
    if (!b) return;

    // In das Archiv-Store kopieren
    const archItem = {
      ...b,
      archivedAt: Date.now(),
      sourceId: b.id,
      category: 'Dokumente'
    };
    delete archItem.id;

    await BSP.dbAdd('archiv_dokumente', archItem);
    
    // Original löschen? Der Nutzer wollte es "archivieren" — meistens heißt das verschieben.
    await BSP.dbDel('belege', id);
    
    BSP.closeSheet();
    BSP.emit('beleg:deleted');
    BSP.toast('In das Archiv verschoben 📬', 'ok');
  }

  return { init, renderList, openDetail, deleteBeleg, archiveBeleg };

})();
