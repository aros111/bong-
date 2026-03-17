// ══════════════════════════════════════════════════════════════
// MODUL: EINSTELLUNGEN
// Alle persönlichen Daten, Unternehmensinfos, API-Config, Stempel
// Kommuniziert NUR über BSP.* — niemals direkt mit anderen Modulen
// ══════════════════════════════════════════════════════════════
'use strict';

const EinstellungenModule = (() => {

// ── HTML für das Einstellungen-View ─────────────────────────
const VIEW_HTML = `
<div id="v-einstellungen" class="view">
  <div class="mod-header">
    <div class="mod-title">Einstellungen</div>
    <div class="mod-sub">Deine Daten, deine Steuern</div>
  </div>

  <!-- ═══ PERSÖNLICHE DATEN ════════════════════════════════ -->
  <div class="sett-section">
    <div class="stitle">👤 Persönliche Daten (Finanzamt)</div>
    <div class="sett-grid">
      <div class="field"><label>Vorname</label>
        <input class="sett-inp" id="s_vorname" type="text" placeholder="Max"></div>
      <div class="field"><label>Nachname</label>
        <input class="sett-inp" id="s_nachname" type="text" placeholder="Mustermann"></div>
    </div>
    <div class="sett-grid">
      <div class="field"><label>Geburtsdatum</label>
        <input class="sett-inp" id="s_geburtsdatum" type="date"></div>
      <div class="field"><label>Steuernummer</label>
        <input class="sett-inp" id="s_steuernr" type="text" placeholder="XXX/XXX/XXXXX" inputmode="numeric"></div>
    </div>
    <div class="sett-grid">
      <div class="field"><label>USt-IdNr.</label>
        <input class="sett-inp" id="s_ustidnr" type="text" placeholder="DE123456789"></div>
      <div class="field"><label>Familienstand</label>
        <select class="sett-inp" id="s_familienstand">
          <option value="ledig">Ledig</option>
          <option value="verheiratet">Verheiratet</option>
          <option value="geschieden">Geschieden</option>
          <option value="verwitwet">Verwitwet</option>
        </select></div>
    </div>
    <div class="sett-grid">
      <div class="field"><label>Steuerklasse</label>
        <select class="sett-inp" id="s_stklasse">
          <option value="1">Klasse I</option>
          <option value="2">Klasse II</option>
          <option value="3">Klasse III</option>
          <option value="4">Klasse IV</option>
          <option value="5">Klasse V</option>
          <option value="6">Klasse VI</option>
        </select></div>
      <div class="field"><label>Kinder (Anzahl)</label>
        <input class="sett-inp" id="s_kinder" type="number" placeholder="0" min="0" max="20" inputmode="numeric"></div>
    </div>
    <div class="field sett-mt"><label>Unterhalt / Mon. (€)</label>
      <input class="sett-inp" id="s_unterhalt" type="text" placeholder="0,00" inputmode="decimal"></div>
  </div>

  <!-- ═══ UNTERNEHMENSDATEN ══════════════════════════════════ -->
  <div class="sett-section">
    <div class="stitle">🏢 Unternehmen</div>
    <div class="sett-grid">
      <div class="field"><label>Firmenname</label>
        <input class="sett-inp" id="s_firmenname" type="text" placeholder="Max Mustermann IT Service"></div>
      <div class="field"><label>Berufsbezeichnung</label>
        <input class="sett-inp" id="s_beruf" type="text" placeholder="z.B. UX Designer"></div>
    </div>
    <div class="field sett-mt"><label>Betriebsstätte / Sitz</label>
      <input class="sett-inp" id="s_adresse" type="text" placeholder="Musterstraße 1, 12345 Berlin"></div>
    <div class="field sett-mt"><label>Heimatort (für km-Pauschale)</label>
      <input class="sett-inp" id="s_heimat" type="text" placeholder="z.B. Berlin-Mitte"></div>
    <div class="field sett-mt">
      <label>Unternehmens-Logo</label>
      <div style="display:flex;align-items:center;gap:12px">
        <div id="s_logoPreview" style="width:48px;height:48px;background:var(--br);border-radius:var(--brnd);display:flex;align-items:center;justify-content:center;overflow:hidden">
          <span style="font-size:10px;color:var(--txt3)">Logo</span>
        </div>
        <button class="btn btn-g" onclick="document.getElementById('s_logoInp').click()">Upload</button>
        <input type="file" id="s_logoInp" hidden accept="image/*" onchange="EinstellungenModule.handleLogo(this)">
      </div>
    </div>
  </div>

  <!-- ═══ FINANZIELLES ══════════════════════════════════════ -->
  <div class="sett-section">
    <div class="stitle">💰 Finanzielles</div>
    <div class="sett-grid">
      <div class="field"><label>Eigener Stundensatz (€/h)</label>
        <input class="sett-inp" id="s_stundensatz" type="text" placeholder="80" inputmode="decimal"></div>
      <div class="field"><label>Steuerberater (€/h)</label>
        <input class="sett-inp" id="s_stbSatz" type="text" placeholder="120" inputmode="decimal"></div>
    </div>
    <div class="field"><label>Gesparte Minuten pro Scan (Ø)</label>
      <div style="display:flex;align-items:center;gap:12px;margin-top:2px">
        <input class="sett-inp" id="s_minProScan" type="range" min="1" max="30" step="1" value="4" style="flex:1;accent-color:var(--gold)">
        <span id="s_minProScanVal" style="font-size:14px;font-weight:300;color:var(--gold);min-width:28px">4</span>
        <span style="font-size:11px;color:var(--txt3)">Min</span>
      </div>
    </div>
  </div>

  <!-- ═══ API & SICHERHEIT ══════════════════════════════════ -->
  <div class="sett-section">
    <div class="stitle">🔐 API & Sicherheit</div>
    <div class="field"><label>Anthropic API Key</label>
      <div style="position:relative">
        <input class="sett-inp" id="s_apikey" type="password" placeholder="sk-ant-…" autocomplete="off">
        <button onclick="EinstellungenModule.toggleApiKeyVis()" style="position:absolute;right:0;top:0;bottom:0;background:none;border:none;color:var(--txt3);padding:0 10px;cursor:pointer;font-size:13px">👁</button>
      </div>
    </div>
    <div class="field sett-mt"><label>Daten-Verschlüsselung PIN (4-stellig)</label>
      <input class="sett-inp" id="s_pin" type="password" maxlength="4" placeholder="0000" inputmode="numeric">
      <div style="font-size:10px;color:var(--txt3);margin-top:5px;line-height:1.5">Wird lokal für die AES-GCM Verschlüsselung sensibler Daten genutzt.</div>
    </div>
  </div>
    <div class="sett-grid sett-mt">
      <div class="field"><label>Belegnummer-Format</label>
        <select class="sett-inp" id="s_belegFmt">
          <option value="A">ER-2026-0001 (empfohlen)</option>
          <option value="B">2026-Q1-ER-0001</option>
          <option value="C">2026-ER-0001</option>
        </select></div>
      <div class="field"><label>DATEV-Kontonummern</label>
        <select class="sett-inp" id="s_datev">
          <option value="0">Nein (Standard)</option>
          <option value="1">Ja, in CSV Export</option>
        </select></div>
    </div>
    <div class="sett-grid sett-mt">
      <div class="field"><label>Voranmeldungs-Rhythmus</label>
        <select class="sett-inp" id="s_voranmeldungRhythmus">
          <option value="monatlich">Monatlich (10. d. Folgemonats)</option>
          <option value="quartal">Quartalsweise (10. Apr/Jul/Okt/Jan)</option>
          <option value="halbjahr">Halbjährlich (10. Jul / 10. Jan)</option>
          <option value="jaehrlich">Jährlich (31. Mai Folgejahr)</option>
        </select></div>
      <div class="field"><label>E-Mail Steuerberater (optional)</label>
        <input class="sett-inp" id="s_stbEmail" type="email" placeholder="steuerberater@kanzlei.de"></div>
    </div>
  </div>

  <!-- ═══ FIRMENSTEMPEL ═════════════════════════════════════ -->
  <div class="sett-section">
    <div class="stitle">🔏 Firmenstempel (für PDF-Export)</div>
    <div class="field"><label>Firmenname / Dein Name</label>
      <input class="sett-inp" id="s_stempelName" type="text" placeholder="Max Mustermann – UX Design"></div>
    <div class="field sett-mt"><label>Freitext (z.B. Adresse, Steuernr.)</label>
      <textarea class="sett-inp" id="s_stempelText" rows="2" placeholder="Musterstr. 1 · 12345 Berlin · USt-IdNr DE123456789" style="resize:none;line-height:1.5"></textarea></div>
    <div class="sett-grid sett-mt">
      <div class="field"><label>Stempelfarbe</label>
        <div style="display:flex;align-items:center;gap:10px">
          <input type="color" id="s_stempelColor" value="#c8a45a" style="width:40px;height:28px;border:none;background:none;cursor:pointer;padding:0">
          <span id="s_stempelColorVal" style="font-size:12px;color:var(--txt3);">#c8a45a</span>
        </div>
      </div>
      <div class="field"><label>Vorschau</label>
        <div id="s_stempelPreview" style="font-size:9px;line-height:1.4;color:#c8a45a;font-weight:300;letter-spacing:.3px">Max Mustermann<br>Musterstr. 1 · 12345 Berlin</div>
      </div>
    </div>
  </div>

  <!-- ═══ BACKUP ════════════════════════════════════════════ -->
  <div class="sett-section">
    <div class="stitle">💾 Backup & Datensicherung</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <button class="btn btn-g" onclick="EinstellungenModule.exportJSON()" style="justify-content:center">
        ⬇️ Lokaler JSON-Export (Download)
      </button>
      <button class="btn btn-g" id="s_driveBtn" onclick="EinstellungenModule.backupDrive()" style="justify-content:center">
        ☁️ In Google Drive speichern
      </button>
      <button class="btn btn-red" onclick="EinstellungenModule.resetCounters()" style="justify-content:center">
        🔄 Belegnummer-Zähler zurücksetzen
      </button>
    </div>
  </div>

  <!-- ═══ SPEICHERN ═════════════════════════════════════════ -->
  <div style="margin-top:20px;margin-bottom:20px">
    <button class="btn btn-gold" onclick="EinstellungenModule.save()" style="width:100%;justify-content:center;font-size:14px;padding:14px">
      ✓ Einstellungen speichern
    </button>
  </div>

  <!-- ═══ APP-INFO ══════════════════════════════════════════ -->
  <div style="text-align:center;font-size:10px;color:var(--txt3);padding-bottom:20px;line-height:1.8">
    BelegScan Pro v2.0 · Modulare Architektur<br>
    Daten bleiben auf deinem Gerät · DSGVO-konform
  </div>
</div>
`;

// ── Modul initialisieren ─────────────────────────────────────
function init() {
  // HTML in Shell einfügen
  const container = document.getElementById('module-views');
  if (container) {
    const tmp = document.createElement('div');
    tmp.innerHTML = VIEW_HTML;
    container.appendChild(tmp.firstElementChild);
  }

  // Event-Listener
  _bindEvents();

  // Settings laden wenn core bereit
  BSP.on('core:ready', async () => {
    await _loadIntoForm();
  });

  BSP.on('settings:saved', () => {
    // Shell-Widgets aktualisieren
    _updateShellWidgets();
  });
}

// ── Form-Events binden ────────────────────────────────────────
function _bindEvents() {
  // Slider: Minuten pro Scan
  document.addEventListener('input', e => {
    if (e.target.id === 's_minProScan') {
      const val = document.getElementById('s_minProScanVal');
      if (val) val.textContent = e.target.value;
    }
    // Stempel-Farbe Live-Vorschau
    if (e.target.id === 's_stempelColor') {
      _updateStempelPreview();
      const valEl = document.getElementById('s_stempelColorVal');
      if (valEl) valEl.textContent = e.target.value;
    }
    // Stempel-Name/-Text Live-Vorschau
    if (['s_stempelName', 's_stempelText'].includes(e.target.id)) {
      _updateStempelPreview();
    }
  });
}

// ── Formular befüllen ────────────────────────────────────────
async function _loadIntoForm() {
  const s = BSP.state.settings || {};

  const ids = [
    'vorname','nachname','geburtsdatum','steuernr','ustidnr','stklasse','familienstand',
    'kinder','unterhalt','firmenname','beruf','adresse','heimat',
    'stundensatz','stbSatz','belegFmt','datev','stbEmail',
    'voranmeldungRhythmus','pin',
    'stempelName','stempelText','stempelColor'
  ];

  ids.forEach(id => {
    const el = document.getElementById('s_' + id);
    if (!el) return;
    const v = s[id];
    if (v !== undefined && v !== null) el.value = v;
  });

  // Minuten-Slider
  const sliderEl = document.getElementById('s_minProScan');
  const sliderVal = document.getElementById('s_minProScanVal');
  if (sliderEl && s.minProScan) {
    sliderEl.value = s.minProScan;
    if (sliderVal) sliderVal.textContent = s.minProScan;
  }

  // API Key (aus localStorage)
  const apiEl = document.getElementById('s_apikey');
  if (apiEl) apiEl.value = BSP.state.settings._apiKey || '';

  // Stempel-Farbe Wert anzeigen
  const colorValEl = document.getElementById('s_stempelColorVal');
  if (colorValEl && s.stempelColor) colorValEl.textContent = s.stempelColor;

  // Logo Preview
  if (s.logo) {
    const lp = document.getElementById('s_logoPreview');
    if (lp) lp.innerHTML = `<img src="${s.logo}" style="width:100%;height:100%;object-fit:cover">`;
  }

  _updateStempelPreview();
}

// ── Logo-Upload ──────────────────────────────────────────────
async function handleLogo(input) {
  if (!input.files || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = async e => {
    const dataUrl = e.target.result;
    const compressed = await BSP.compressImage(dataUrl, 100, 20); // Logo sehr klein halten
    const lp = document.getElementById('s_logoPreview');
    if (lp) lp.innerHTML = `<img src="${compressed}" style="width:100%;height:100%;object-fit:cover">`;
    // Direkt speichern? Nein, beim Klick auf global Save. Wir merken es uns im Element.
    lp.dataset.logo = compressed;
  };
  reader.readAsDataURL(input.files[0]);
}

// ── Stempel-Vorschau ─────────────────────────────────────────
function _updateStempelPreview() {
  const prev = document.getElementById('s_stempelPreview');
  if (!prev) return;
  const name = document.getElementById('s_stempelName')?.value || BSP.eh('—');
  const text = (document.getElementById('s_stempelText')?.value || '').replace(/\n/g, '<br>');
  const col = document.getElementById('s_stempelColor')?.value || '#c8a45a';
  prev.style.color = col;
  prev.innerHTML = `<strong>${BSP.eh(name)}</strong><br>${text}`;
}

// ── Einstellungen speichern ───────────────────────────────────
async function save() {
  const get = id => {
    const el = document.getElementById('s_' + id);
    return el ? el.value : null;
  };

  const data = {
    vorname: get('vorname'),
    nachname: get('nachname'),
    geburtsdatum: get('geburtsdatum'),
    steuernr: get('steuernr'),
    ustidnr: get('ustidnr'),
    stklasse: get('stklasse'),
    familienstand: get('familienstand'),
    kinder: parseInt(get('kinder')) || 0,
    unterhalt: parseFloat((get('unterhalt') || '0').replace(',', '.')) || 0,
    firmenname: get('firmenname'),
    beruf: get('beruf'),
    adresse: get('adresse'),
    heimat: get('heimat'),
    stundensatz: parseFloat((get('stundensatz') || '0').replace(',', '.')) || 80,
    stbSatz: parseFloat((get('stbSatz') || '0').replace(',', '.')) || 120,
    minProScan: parseInt(get('minProScan')) || 4,
    belegFmt: get('belegFmt') || 'A',
    datev: get('datev') || '0',
    stbEmail: get('stbEmail'),
    voranmeldungRhythmus: get('voranmeldungRhythmus') || 'monatlich',
    pin: get('pin') || '0000',
    stempelName: get('stempelName'),
    stempelText: document.getElementById('s_stempelText')?.value || '',
    stempelColor: get('stempelColor') || '#c8a45a',
    logo: document.getElementById('s_logoPreview')?.dataset.logo || (BSP.state.settings || {}).logo,
    _apiKey: document.getElementById('s_apikey')?.value || '',
    setupDone: '1'
  };

  // Pflichtfeld-Check
  if (!data.vorname && !data.nachname && !data.steuernr) {
    BSP.toast('Bitte mindestens Name und Steuernummer eintragen', 'wr');
  }

  try {
    await BSP.saveAllSettings(data);
    BSP.toast('Einstellungen gespeichert ✓', 'ok');
    _updateShellWidgets();
  } catch(e) {
    BSP.toast('Fehler: ' + e.message, 'er');
  }
}

// ── API Key Sichtbarkeit umschalten ──────────────────────────
function toggleApiKeyVis() {
  const inp = document.getElementById('s_apikey');
  if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
}

// ── JSON-Backup-Export ───────────────────────────────────────
async function exportJSON() {
  try {
    const belege = await BSP.dbGetAll('belege');
    const fahrten = await BSP.dbGetAll('fahrten');
    const verpflegung = await BSP.dbGetAll('verpflegung');
    const einst = await BSP.dbGetAll('einstellungen');

    const backup = {
      version: 2,
      exportedAt: new Date().toISOString(),
      belege,
      fahrten,
      verpflegung,
      einstellungen: einst,
    };

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `belegscan-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    BSP.toast('Backup erstellt ✓', 'ok');
  } catch(e) {
    BSP.toast('Fehler beim Export: ' + e.message, 'er');
  }
}

// ── Google Drive Backup ──────────────────────────────────────
async function backupDrive() {
  BSP.toast('Google Drive Backup – coming soon', 'wr');
  // TODO: Google Drive OAuth + File Upload
  // Implementierung in einer späteren Phase:
  // 1. gapi.auth2 OAuth Flow
  // 2. JSON-Datei als Multipart-Upload an drive.files.create
  // 3. Datei in 'BelegScan Pro Backup' Ordner ablegen
}

// ── Zähler zurücksetzen ──────────────────────────────────────
function resetCounters() {
  if (!confirm('Belegnummer-Zähler wirklich zurücksetzen?\n\nVorsicht: Dies kann zu doppelten Belegnummern führen (GoBD-Hinweis).')) return;
  BSP.state.erCounter = 0;
  BSP.state.arCounter = 0;
  localStorage.setItem('bsp_erc', '0');
  localStorage.setItem('bsp_arc', '0');
  BSP.toast('Zähler zurückgesetzt', 'ok');
}

// ── Shell-Widgets aktualisieren ──────────────────────────────
function _updateShellWidgets() {
  const s = BSP.state.settings || {};

  // Name in Header
  const nameEl = document.getElementById('shell-name');
  if (nameEl && (s.vorname || s.nachname)) {
    nameEl.textContent = [s.vorname, s.nachname].filter(Boolean).join(' ');
  }

  // Beruf anzeigen
  const berufEl = document.getElementById('shell-beruf');
  if (berufEl && s.beruf) berufEl.textContent = s.beruf;

  // Stundensatz → Zeitersparnis neuberechnen
  const ts = BSP.getTimeSaved();
  const timeEl = document.getElementById('shell-time-saved');
  if (timeEl) timeEl.textContent = ts.formatted;

  const costEl = document.getElementById('shell-cost-saved');
  const cc = BSP.getCostComparison();
  if (costEl) costEl.textContent = `${BSP.fm(cc.saved)} € gespart`;
}

// ── Öffentliche API des Moduls ────────────────────────────────
return { init, save, toggleApiKeyVis, handleLogo, exportJSON, backupDrive, resetCounters };

})();
