// ══════════════════════════════════════════════════════════════
// MODUL: PRIVAT ENERGIE
// Tracker für Strom- und Gasverbrauch (Zählerstände)
// ══════════════════════════════════════════════════════════════
'use strict';

const PrivatEnergie = (() => {

  const VIEW_HTML = `
    <div class="mod-header">
      <h1 class="mod-title">Energie-Tracker</h1>
      <p class="mod-sub">Überwache deinen Strom- und Gasverbrauch</p>
    </div>

    <!-- Neuer Zählerstand -->
    <div class="card">
      <div class="stitle">Zählerstand erfassen</div>
      <div class="g2">
        <div class="field"><label>Typ</label>
          <select id="en-type" class="sett-inp">
            <option value="strom">Strom (kWh)</option>
            <option value="gas">Gas (m³)</option>
          </select>
        </div>
        <div class="field"><label>Stand</label><input id="en-val" class="sett-inp" type="number" step="0.1" placeholder="0.0"></div>
      </div>
      <div class="field sett-mt"><label>Datum</label><input id="en-date" class="sett-inp" type="date"></div>
      <button class="btn btn-gold" style="width:100%;margin-top:12px;justify-content:center" onclick="PrivatEnergie.save()">Speichern</button>
    </div>

    <!-- Verbrauchs-Historie -->
    <div class="card">
      <div class="stitle">Historie & Trend</div>
      <div id="en-history"></div>
    </div>
  `;

  function init() {
    BSP.on('view:changed', ({ name }) => {
      if (name === 'privat-energie') {
        const v = document.getElementById('v-privat-energie');
        if (v) { 
          v.innerHTML = VIEW_HTML; 
          document.getElementById('en-date').value = new Date().toISOString().split('T')[0];
          renderHistory(); 
        }
      }
    });
  }

  async function save() {
    const type = document.getElementById('en-type').value;
    const val = parseFloat(document.getElementById('en-val').value);
    const date = document.getElementById('en-date').value;

    if (isNaN(val) || !date) return BSP.toast('Bitte alle Felder ausfüllen', 'wr');

    const entry = { type, value: val, date, savedAt: Date.now() };
    await BSP.dbAdd('privat_energie', entry);
    
    document.getElementById('en-val').value = '';
    renderHistory();
    BSP.toast(`${type.charAt(0).toUpperCase() + type.slice(1)} gespeichert`, 'ok');
  }

  async function renderHistory() {
    const list = await BSP.dbGetAll('privat_energie');
    const container = document.getElementById('en-history');
    if (!container) return;

    if (!list.length) {
      container.innerHTML = '<div class="empty">Noch keine Zählerstände erfasst.</div>';
      return;
    }

    const sorted = list.sort((a,b) => b.date.localeCompare(a.date));

    container.innerHTML = sorted.map(e => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--br)">
        <div>
          <div style="font-size:13px;color:var(--txt)">${e.type === 'strom' ? '⚡️ Strom' : '🔥 Gas'}</div>
          <div style="font-size:10px;color:var(--txt3)">${BSP.fd(e.date)}</div>
        </div>
        <div style="font-size:14px;font-family:'DM Mono',monospace;color:var(--gold)">
          ${e.value.toFixed(1)} ${e.type === 'strom' ? 'kWh' : 'm³'}
        </div>
      </div>
    `).join('');
  }

  return { init, save, renderHistory };

})();
PrivatEnergie.init();
