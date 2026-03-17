// ══════════════════════════════════════════════════════════════
// MODUL: VERPFLEGUNG
// Verpflegungspauschalen §9 Abs.4a EStG, Timer für laufende Reise
// Kommuniziert NUR über BSP.* — niemals direkt mit anderen Modulen
// ══════════════════════════════════════════════════════════════
'use strict';

const VerpflegungModule = (() => {

// Pauschalbeträge Inland 2024/2025
const PAUSCHALE = { voll: 28, ab8: 14, unter8: 0 };
let _timerStart = null;
let _timerInterval = null;

const VIEW_HTML = `
<div id="v-verpflegung" class="view">
  <div class="mod-header">
    <div class="mod-title">Verpflegung</div>
    <div class="mod-sub">§9 Abs. 4a EStG · Inland: 14 € (≥8h) · 28 € (Reisetag)</div>
  </div>

  <!-- Jahres-Summary -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
    <div style="background:var(--s1);border:1px solid var(--br);border-radius:var(--r12);padding:14px">
      <div style="font-size:9px;color:var(--txt3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:4px">Tage</div>
      <div id="verp-cnt" style="font-size:24px;font-weight:200;color:var(--txt)">0</div>
    </div>
    <div style="background:var(--s1);border:1px solid var(--br);border-radius:var(--r12);padding:14px">
      <div style="font-size:9px;color:var(--txt3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:4px">Pauschale</div>
      <div id="verp-eur" style="font-size:24px;font-weight:200;color:var(--gold)">0 €</div>
    </div>
  </div>

  <!-- Timer -->
  <div style="background:var(--s1);border:1px solid var(--br);border-radius:var(--r16);padding:16px;margin-bottom:12px">
    <div class="stitle">Laufende Dienstreise</div>
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div id="verp-timer" style="font-size:32px;font-weight:200;letter-spacing:-2px;color:var(--txt);font-family:'DM Mono',monospace">00:00:00</div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-grn btn-sm" id="verp-timer-btn" onclick="VerpflegungModule.timerToggle()">▶ Start</button>
        <button class="btn btn-red btn-sm" onclick="VerpflegungModule.timerStop(true)" style="display:none" id="verp-timer-save">✓ Speichern</button>
      </div>
    </div>
    <div id="verp-timer-hint" style="font-size:10px;color:var(--txt3);margin-top:6px">Timer starten wenn die Dienstreise beginnt</div>
  </div>

  <!-- Manuelle Eingabe -->
  <div style="background:var(--s1);border:1px solid var(--br);border-radius:var(--r16);padding:16px;margin-bottom:12px">
    <div class="stitle">Manuell eintragen</div>
    <div class="sett-grid">
      <div class="field"><label>Datum</label><input class="sett-inp" id="verp-date" type="date"></div>
      <div class="field"><label>Dauer</label>
        <select class="sett-inp" id="verp-dauer" onchange="VerpflegungModule.updatePreview()">
          <option value="voll">Ganzer Tag (28 €)</option>
          <option value="ab8">8–24 Stunden (14 €)</option>
          <option value="unter8">Unter 8 Stunden (0 €)</option>
        </select>
      </div>
    </div>
    <div class="field sett-mt"><label>Ziel / Beschreibung</label><input class="sett-inp" id="verp-ziel" type="text" placeholder="z.B. Kundenbesuch Frankfurt"></div>
    <div style="margin-top:6px;font-size:11px;color:var(--gold)" id="verp-preview"></div>
    <button class="btn btn-gold" style="width:100%;justify-content:center;margin-top:12px" onclick="VerpflegungModule.add()">+ Eintragen</button>
  </div>

  <!-- Liste -->
  <div class="stitle">Einträge (aktuelles Jahr)</div>
  <div id="verp-list"></div>
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
    const dateEl = document.getElementById('verp-date');
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
    updatePreview();
    await render();
  });

  BSP.on('view:changed', ({ name }) => { if (name === 'verpflegung') render(); });
}

function updatePreview() {
  const dauer = document.getElementById('verp-dauer')?.value || 'voll';
  const betrag = PAUSCHALE[dauer] || 0;
  const prev = document.getElementById('verp-preview');
  if (prev) prev.textContent = betrag > 0 ? `Pauschale: ${betrag} €` : 'Kein Abzug möglich (< 8h)';
}

// ── Timer ─────────────────────────────────────────────────────
function timerToggle() {
  if (_timerStart) {
    // Pause
    clearInterval(_timerInterval);
    _timerInterval = null;
    const btn = document.getElementById('verp-timer-btn');
    if (btn) btn.textContent = '▶ Weiter';
  } else {
    _timerStart = Date.now();
    _timerInterval = setInterval(_tickTimer, 1000);
    const saveBtn = document.getElementById('verp-timer-save');
    if (saveBtn) saveBtn.style.display = '';
    const btn = document.getElementById('verp-timer-btn');
    if (btn) btn.textContent = '⏸ Pause';
    const hint = document.getElementById('verp-timer-hint');
    if (hint) hint.textContent = 'Dienstreise läuft …';
  }
}

function _tickTimer() {
  if (!_timerStart) return;
  const elapsed = Math.floor((Date.now() - _timerStart) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const el = document.getElementById('verp-timer');
  if (el) el.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function timerStop(saveIt) {
  clearInterval(_timerInterval);
  _timerInterval = null;

  if (!_timerStart) return;
  const elapsed = Math.floor((Date.now() - _timerStart) / 1000);
  const hours = elapsed / 3600;
  _timerStart = null;

  const el = document.getElementById('verp-timer');
  if (el) el.textContent = '00:00:00';
  const saveBtn = document.getElementById('verp-timer-save');
  if (saveBtn) saveBtn.style.display = 'none';
  const btn = document.getElementById('verp-timer-btn');
  if (btn) btn.textContent = '▶ Start';
  const hint = document.getElementById('verp-timer-hint');
  if (hint) hint.textContent = 'Timer starten wenn die Dienstreise beginnt';

  if (saveIt) {
    let dauer = 'unter8';
    if (hours >= 24) dauer = 'voll';
    else if (hours >= 8) dauer = 'ab8';

    const betrag = PAUSCHALE[dauer];
    if (betrag === 0) {
      BSP.toast('Unter 8h – kein Abzug möglich', 'wr');
      return;
    }
    _saveEntry({
      date: new Date().toISOString().split('T')[0],
      dauer,
      stundenGerundet: Math.round(hours * 10) / 10,
      ziel: 'Über Timer erfasst',
      pauschale: betrag
    });
  }
}

// ── Manuell hinzufügen ────────────────────────────────────────
async function add() {
  const get = id => document.getElementById(id)?.value?.trim() || '';
  const dauer = get('verp-dauer') || 'voll';
  const betrag = PAUSCHALE[dauer] || 0;

  if (betrag === 0) { BSP.toast('Unter 8h – kein Pauschalbetrag', 'wr'); return; }

  const entry = {
    date: get('verp-date') || new Date().toISOString().split('T')[0],
    dauer,
    ziel: get('verp-ziel') || 'Dienstreise',
    pauschale: betrag,
    savedAt: Date.now()
  };

  await _saveEntry(entry);
  const zielEl = document.getElementById('verp-ziel'); if (zielEl) zielEl.value = '';
}

async function _saveEntry(entry) {
  entry.savedAt = entry.savedAt || Date.now();
  try {
    await BSP.dbAdd('verpflegung', entry);
    BSP.toast(`${entry.pauschale} € Pauschale gespeichert ✓`, 'ok');
    await render();
  } catch(e) {
    BSP.toast('Fehler: ' + e.message, 'er');
  }
}

// ── Render ───────────────────────────────────────────────────
async function render() {
  try {
    const all = await BSP.dbGetAll('verpflegung');
    const year = new Date().getFullYear();
    const yearEntries = all.filter(e => e.date && new Date(e.date + 'T00:00:00').getFullYear() === year);
    yearEntries.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));

    const totalEur = yearEntries.reduce((s, e) => s + (e.pauschale || 0), 0);

    const cntEl = document.getElementById('verp-cnt');
    const eurEl = document.getElementById('verp-eur');
    if (cntEl) cntEl.textContent = yearEntries.length;
    if (eurEl) eurEl.textContent = BSP.fm(totalEur) + ' €';

    const list = document.getElementById('verp-list');
    if (!list) return;

    if (!yearEntries.length) {
      list.innerHTML = '<div class="empty">Noch keine Einträge.<br>Timer starten oder manuell eintragen.</div>';
      return;
    }

    const duarLabels = { voll: 'Reisetag', ab8: '≥ 8h', unter8: '< 8h' };
    list.innerHTML = yearEntries.map(e => `
      <div class="ri">
        <div class="ri-bar" style="background:var(--orn)"></div>
        <div class="ri-th" style="font-size:20px">🍽</div>
        <div class="ri-inf">
          <div class="ri-sh">${BSP.eh(e.ziel || 'Dienstreise')}</div>
          <div class="ri-me">
            <span class="badge" style="background:rgba(192,112,48,.12);color:var(--orn)">${duarLabels[e.dauer] || e.dauer}</span>
            <span>${BSP.fd(e.date)}</span>
          </div>
        </div>
        <div class="ri-r">
          <div class="ri-r-amt" style="color:var(--gold)">${e.pauschale} €</div>
        </div>
      </div>`).join('');
  } catch(e) {
    console.warn('Verpflegung render error:', e);
  }
}

return { init, add, render, timerToggle, timerStop, updatePreview };

})();
