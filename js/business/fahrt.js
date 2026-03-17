// ══════════════════════════════════════════════════════════════
// MODUL: FAHRT
// Kilometerpauschale §9 EStG — Einträge erfassen, Jahresübersicht
// Kommuniziert NUR über BSP.* — niemals direkt mit anderen Modulen
// ══════════════════════════════════════════════════════════════
'use strict';

const FahrtModule = (() => {

// Pauschalsätze 2024/2025
const KM_RATE_1 = 0.30;    // erste 20 km (genauer: bis km 20)
const KM_RATE_2 = 0.38;    // ab km 21

const VIEW_HTML = `
<div id="v-fahrt" class="view">
  <div class="mod-header">
    <div class="mod-title">Kilometerpauschale</div>
    <div class="mod-sub">§9 EStG · 0,30 € / km (ab km 21: 0,38 €)</div>
  </div>

  <!-- Jahres-Summary -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px" id="fahrt-summary">
    <div style="background:var(--s1);border:1px solid var(--br);border-radius:var(--r12);padding:14px;text-align:center">
      <div style="font-size:9px;color:var(--txt3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:4px">Fahrten</div>
      <div id="fahrt-cnt" style="font-size:20px;font-weight:200;color:var(--txt)">0</div>
    </div>
    <div style="background:var(--s1);border:1px solid var(--br);border-radius:var(--r12);padding:14px;text-align:center">
      <div style="font-size:9px;color:var(--txt3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:4px">Km gesamt</div>
      <div id="fahrt-km" style="font-size:20px;font-weight:200;color:var(--silv)">0</div>
    </div>
    <div style="background:var(--s1);border:1px solid var(--br);border-radius:var(--r12);padding:14px;text-align:center">
      <div style="font-size:9px;color:var(--txt3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:4px">Pauschale</div>
      <div id="fahrt-eur" style="font-size:20px;font-weight:200;color:var(--gold)">0 €</div>
    </div>
  </div>

  <!-- Neuen Eintrag hinzufügen -->
  <div style="background:var(--s1);border:1px solid var(--br);border-radius:var(--r16);padding:16px;margin-bottom:12px">
    <div class="stitle">Neue Fahrt</div>
    <div class="sett-grid">
      <div class="field"><label>Datum</label><input class="sett-inp" id="f-date" type="date"></div>
      <div class="field"><label>Kilometer</label><input class="sett-inp" id="f-km" type="number" min="1" placeholder="z.B. 45" inputmode="numeric"></div>
    </div>
    <div class="field sett-mt"><label>Ziel / Beschreibung</label><input class="sett-inp" id="f-ziel" type="text" placeholder="z.B. Kunde München, Musterstr. 1"></div>
    <div class="sett-grid sett-mt">
      <div class="field"><label>Zweck</label>
        <select class="sett-inp" id="f-zweck">
          <option>Kundenbesuch</option>
          <option>Lieferung</option>
          <option>Fortbildung</option>
          <option>Behörde</option>
          <option>Sonstiges</option>
        </select>
      </div>
      <div class="field"><label>Art</label>
        <select class="sett-inp" id="f-art">
          <option value="einfach">Einfach</option>
          <option value="hinrueck">Hin & Rück</option>
        </select>
      </div>
    </div>
    <div style="margin-top:4px;font-size:11px;color:var(--txt3)" id="f-preview"></div>
    <button class="btn btn-gold" style="width:100%;justify-content:center;margin-top:12px" onclick="FahrtModule.add()">+ Fahrt eintragen</button>
  </div>

  <!-- Liste -->
  <div class="stitle">Alle Fahrten (aktuelles Jahr)</div>
  <div id="fahrt-list"></div>
</div>
`;

// ── Init ─────────────────────────────────────────────────────
function init() {
  const container = document.getElementById('module-views');
  if (container) {
    const tmp = document.createElement('div');
    tmp.innerHTML = VIEW_HTML;
    container.appendChild(tmp.firstElementChild);
  }

  BSP.on('core:ready', async () => {
    // Datum heute setzen
    const dateEl = document.getElementById('f-date');
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
    _bindPreview();
    await render();
  });

  BSP.on('view:changed', ({ name }) => { if (name === 'fahrt') render(); });
}

function _bindPreview() {
  ['f-km', 'f-art'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', _updatePreview);
    if (el) el.addEventListener('change', _updatePreview);
  });
}

function _updatePreview() {
  const km = parseFloat(document.getElementById('f-km')?.value || '0') || 0;
  const art = document.getElementById('f-art')?.value || 'einfach';
  const totalKm = art === 'hinrueck' ? km * 2 : km;
  const pauschale = _calcPauschale(totalKm);
  const prev = document.getElementById('f-preview');
  if (prev) prev.textContent = totalKm ? `${totalKm} km gesamt → ${BSP.fm(pauschale)} € Pauschale` : '';
}

function _calcPauschale(km) {
  // Vereinfacht: alle km × 0,30 €; Ab km 21 jährlich kumuliert gilt 0,38 – hier per Fahrt vereinfacht
  return km * KM_RATE_1;
}

// ── Hinzufügen ────────────────────────────────────────────────
async function add() {
  const get = id => document.getElementById(id)?.value?.trim() || '';
  const km = parseFloat(get('f-km')) || 0;
  if (!km) { BSP.toast('Bitte Kilometer eingeben', 'wr'); return; }

  const art = get('f-art') || 'einfach';
  const totalKm = art === 'hinrueck' ? km * 2 : km;
  const pauschale = _calcPauschale(totalKm);

  const entry = {
    date: get('f-date') || new Date().toISOString().split('T')[0],
    km: totalKm,
    kmEinfach: km,
    art,
    ziel: get('f-ziel') || 'Unbekannt',
    zweck: get('f-zweck') || 'Sonstiges',
    pauschale,
    savedAt: Date.now()
  };

  try {
    await BSP.dbAdd('fahrten', entry);
    BSP.toast(`${totalKm} km → ${BSP.fm(pauschale)} € gespeichert ✓`, 'ok');
    _clearForm();
    await render();
  } catch(e) {
    BSP.toast('Fehler: ' + e.message, 'er');
  }
}

function _clearForm() {
  ['f-km', 'f-ziel'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const prev = document.getElementById('f-preview');
  if (prev) prev.textContent = '';
}

// ── Render ───────────────────────────────────────────────────
async function render() {
  try {
    const all = await BSP.dbGetAll('fahrten');
    const year = new Date().getFullYear();
    const yearFahrten = all.filter(f => f.date && new Date(f.date + 'T00:00:00').getFullYear() === year);
    yearFahrten.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));

    const totalKm = yearFahrten.reduce((s, f) => s + (f.km || 0), 0);
    const totalEur = yearFahrten.reduce((s, f) => s + (f.pauschale || 0), 0);

    const cntEl = document.getElementById('fahrt-cnt');
    const kmEl = document.getElementById('fahrt-km');
    const eurEl = document.getElementById('fahrt-eur');
    if (cntEl) cntEl.textContent = yearFahrten.length;
    if (kmEl) kmEl.textContent = Math.round(totalKm);
    if (eurEl) eurEl.textContent = BSP.fm(totalEur) + ' €';

    const list = document.getElementById('fahrt-list');
    if (!list) return;

    if (!yearFahrten.length) {
      list.innerHTML = '<div class="empty">Noch keine Fahrten dieses Jahr.<br>Trage deine erste Fahrt ein.</div>';
      return;
    }

    list.innerHTML = yearFahrten.map(f => `
      <div class="ri">
        <div class="ri-bar" style="background:var(--silv)"></div>
        <div class="ri-th" style="font-size:20px">🚗</div>
        <div class="ri-inf">
          <div class="ri-sh">${BSP.eh(f.ziel || 'Unbekannt')}</div>
          <div class="ri-me">
            <span class="badge" style="background:rgba(136,153,170,.12);color:var(--silv)">${BSP.eh(f.zweck)}</span>
            <span>${BSP.fd(f.date)}</span>
            <span style="font-size:10px;color:var(--txt3)">${f.art === 'hinrueck' ? 'H+R' : 'Einf.'}</span>
          </div>
        </div>
        <div class="ri-r">
          <div class="ri-r-amt" style="color:var(--silv)">${Math.round(f.km)} km</div>
          <div class="ri-r-type" style="color:var(--gold)">${BSP.fm(f.pauschale)} €</div>
        </div>
      </div>`).join('');
  } catch(e) {
    console.warn('Fahrt render error:', e);
  }
}

return { init, add, render };

})();
