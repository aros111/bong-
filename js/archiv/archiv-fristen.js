// ══════════════════════════════════════════════════════════════
// MODUL: ARCHIV FRISTEN
// Tracker für Verträge, Kündigungsfristen und Termine
// ══════════════════════════════════════════════════════════════
'use strict';

const ArchivFristen = (() => {

  const VIEW_HTML = `
    <div class="mod-header">
      <h1 class="mod-title">Fristen-Tracker</h1>
      <p class="mod-sub">Verpasse nie wieder einen Kündigungstermin</p>
    </div>

    <!-- Neuer Vertrag/Frist -->
    <div class="card">
      <div class="stitle">Vertrag/Termin hinzufügen</div>
      <div class="field"><label>Name (z.B. Fitnessstudio)</label><input id="fr-name" class="sett-inp" type="text" placeholder="Bezeichnung"></div>
      <div class="g2 sett-mt">
        <div class="field"><label>Kategorie</label>
          <select id="fr-cat" class="sett-inp">
            <option>Abo</option><option>Versicherung</option><option>Behörde</option><option>Sonstiges</option>
          </select>
        </div>
        <div class="field"><label>Frist (Datum)</label><input id="fr-date" class="sett-inp" type="date"></div>
      </div>
      <button class="btn btn-gold" style="width:100%;margin-top:12px;justify-content:center" onclick="ArchivFristen.save()">✓ Überwachen</button>
    </div>

    <!-- Aktive Fristen -->
    <div class="card">
      <div class="stitle">Kommende Termine</div>
      <div id="fr-list"></div>
    </div>
  `;

  function init() {
    BSP.on('view:changed', ({ name }) => {
      if (name === 'archiv-fristen') {
        const v = document.getElementById('v-archiv-fristen');
        if (v) { v.innerHTML = VIEW_HTML; renderList(); }
      }
    });
  }

  async function save() {
    const name = document.getElementById('fr-name').value.trim();
    const cat = document.getElementById('fr-cat').value;
    const date = document.getElementById('fr-date').value;

    if (!name || !date) return BSP.toast('Bitte Felder ausfüllen', 'wr');

    const item = { name, cat, date, savedAt: Date.now() };
    await BSP.dbAdd('archiv_fristen', item);
    
    document.getElementById('fr-name').value = '';
    renderList();
    BSP.toast('Frist gespeichert 🔔', 'ok');
  }

  async function renderList() {
    const container = document.getElementById('fr-list');
    if (!container) return;

    const all = await BSP.dbGetAll('archiv_fristen');
    if (!all.length) {
      container.innerHTML = '<div class="empty">Keine aktiven Fristen.</div>';
      return;
    }

    const sorted = all.sort((a,b) => a.date.localeCompare(b.date));

    container.innerHTML = sorted.map(f => {
      const days = Math.ceil((new Date(f.date) - new Date()) / 864e5);
      const col = days < 7 ? 'var(--red)' : days < 30 ? 'var(--orn)' : 'var(--grn)';
      
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--br)">
          <div>
            <div style="font-size:13px;color:var(--txt)">${BSP.eh(f.name)}</div>
            <div style="font-size:10px;color:var(--txt3)">${f.cat} · ${BSP.fd(f.date)}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:12px;font-weight:400;color:${col}">${days < 0 ? 'Abgelaufen' : 'In ' + days + ' Tagen'}</div>
            <button class="txt-btn" style="color:var(--red);font-size:9px" onclick="ArchivFristen.deleteFrist(${f.id})">Entfernen</button>
          </div>
        </div>
      `;
    }).join('');
  }

  async function deleteFrist(id) {
    await BSP.dbDel('archiv_fristen', id);
    renderList();
    BSP.toast('Gelöscht', 'ok');
  }

  return { init, save, renderList, deleteFrist };

})();
ArchivFristen.init();
