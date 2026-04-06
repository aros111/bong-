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
    <div class="mod-sub">Deine Daten & App-Konfiguration</div>
  </div>

  <!-- 1. PERSÖNLICHE DATEN -->
  <details class="sett-section" open>
    <summary>👤 Persönliche Daten</summary>
    <div class="sett-grid" style="margin-top:12px">
      <div class="field"><label>Vorname</label><input class="sett-inp" id="s_vorname" type="text" oninput="EinstellungenModule.save()"></div>
      <div class="field"><label>Nachname</label><input class="sett-inp" id="s_nachname" type="text" oninput="EinstellungenModule.save()"></div>
    </div>
    <div class="sett-grid">
      <div class="field"><label>Geburtsdatum</label><input class="sett-inp" id="s_geburtsdatum" type="date" onchange="EinstellungenModule.save()"></div>
      <div class="field"><label>Steuernummer</label><input class="sett-inp" id="s_steuernr" type="text" oninput="EinstellungenModule.save()"></div>
    </div>
    <div class="sett-grid">
      <div class="field"><label>USt-IdNr.</label><input class="sett-inp" id="s_ustidnr" type="text" oninput="EinstellungenModule.save()"></div>
      <div class="field"><label>Familienstand</label>
        <select class="sett-inp" id="s_familienstand" onchange="EinstellungenModule.save()">
          <option value="ledig">Ledig</option>
          <option value="verheiratet">Verheiratet</option>
          <option value="geschieden">Geschieden</option>
          <option value="verwitwet">Verwitwet</option>
        </select>
      </div>
    </div>
    <div class="sett-grid">
      <div class="field"><label>Steuerklasse</label>
        <select class="sett-inp" id="s_stklasse" onchange="EinstellungenModule.save()">
          <option value="1">I</option><option value="2">II</option><option value="3">III</option><option value="4">IV</option><option value="5">V</option><option value="6">VI</option>
        </select>
      </div>
      <div class="field"><label>Kinder (Anzahl)</label><input class="sett-inp" id="s_kinder" type="number" min="0" onchange="EinstellungenModule.save()"></div>
    </div>
    <div class="field sett-mt"><label>Unterhalt / Mon. (€)</label><input class="sett-inp" id="s_unterhalt" type="text" inputmode="decimal" oninput="EinstellungenModule.save()"></div>
  </details>

  <!-- 2. UNTERNEHMEN -->
  <details class="sett-section">
    <summary>🏢 Unternehmen</summary>
    <div class="sett-grid" style="margin-top:12px">
      <div class="field"><label>Firmenname</label><input class="sett-inp" id="s_firmenname" type="text" oninput="EinstellungenModule.save()"></div>
      <div class="field"><label>Berufsbezeichnung</label><input class="sett-inp" id="s_beruf" type="text" oninput="EinstellungenModule.save()"></div>
    </div>
    <div class="field sett-mt"><label>Betriebsstätte / Sitz</label><input class="sett-inp" id="s_adresse" type="text" oninput="EinstellungenModule.save()"></div>
    <div class="field sett-mt"><label>Heimatort (für km-Pauschale)</label><input class="sett-inp" id="s_heimat" type="text" oninput="EinstellungenModule.save()"></div>
    <div class="field sett-mt">
      <label>Unternehmens-Logo</label>
      <div style="display:flex;align-items:center;gap:12px">
        <div id="s_logoPreview" style="width:48px;height:48px;background:var(--br);border-radius:var(--brnd);display:flex;align-items:center;justify-content:center;overflow:hidden"><span style="font-size:10px;color:var(--txt3)">Logo</span></div>
        <button class="btn btn-g" onclick="document.getElementById('s_logoInp').click()">Upload</button>
        <input type="file" id="s_logoInp" hidden accept="image/*" onchange="EinstellungenModule.handleLogo(this)">
      </div>
    </div>
  </details>

  <!-- 3. FINANZIELLES -->
  <details class="sett-section">
    <summary>💰 Finanzielles</summary>
    <div class="sett-grid" style="margin-top:12px">
      <div class="field"><label>Eigener Stundensatz (€/h)</label><input class="sett-inp" id="s_stundensatz" type="text" inputmode="decimal" oninput="EinstellungenModule.save()"></div>
      <div class="field"><label>Steuerberater (€/h)</label><input class="sett-inp" id="s_stbSatz" type="text" inputmode="decimal" oninput="EinstellungenModule.save()"></div>
    </div>
    <div class="field"><label>Gesparte Minuten pro Scan (Ø)</label>
      <div style="display:flex;align-items:center;gap:12px;margin-top:2px">
        <input class="sett-inp" id="s_minProScan" type="range" min="1" max="30" step="1" onchange="EinstellungenModule.save()" oninput="document.getElementById('s_minProScanVal').textContent=this.value" style="flex:1;accent-color:var(--gold)">
        <span id="s_minProScanVal" style="font-size:14px;color:var(--gold);min-width:28px">4</span>
        <span style="font-size:11px;color:var(--txt3)">Min</span>
      </div>
    </div>
  </details>

  <!-- 4. API & SICHERHEIT -->
  <details class="sett-section">
    <summary>🔐 API & Sicherheit</summary>
    <div class="field" style="margin-top:12px"><label>Anthropic API Key</label>
      <div style="position:relative">
        <input class="sett-inp" id="s_apikey" type="password" autocomplete="off" onchange="EinstellungenModule.save()">
        <button onclick="EinstellungenModule.toggleApiKeyVis()" style="position:absolute;right:0;top:0;bottom:0;background:none;border:none;color:var(--txt3);padding:0 10px;cursor:pointer;">👁</button>
      </div>
    </div>
    <div class="field sett-mt"><label>Daten-Verschlüsselung PIN (4-stellig)</label><input class="sett-inp" id="s_pin" type="password" maxlength="4" inputmode="numeric" onchange="EinstellungenModule.save()"></div>
    <div class="field sett-mt"><label>Belegnummer-Format</label>
        <select class="sett-inp" id="s_belegFmt" onchange="EinstellungenModule.save()">
          <option value="A">ER-YYYY-0001</option><option value="B">YYYY-Q1-ER-0001</option><option value="C">YYYY-ER-0001</option>
        </select>
    </div>
  </details>

  <!-- 5. EXPORT -->
  <details class="sett-section">
    <summary>📤 Export</summary>
    <div class="sett-grid" style="margin-top:12px">
      <div class="field"><label>DATEV-Kontonummern</label>
        <select class="sett-inp" id="s_datev" onchange="EinstellungenModule.save()"><option value="0">Aus</option><option value="1">Ein</option></select></div>
      <div class="field"><label>E-Mail Steuerberater</label><input class="sett-inp" id="s_stbEmail" type="email" onchange="EinstellungenModule.save()"></div>
    </div>
  </details>

  <!-- 6. KONTEN -->
  <details class="sett-section" ontoggle="if(this.open) { EinstellungenModule.renderAccounts(); }">
    <summary>💳 Bankkonten</summary>
    <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px" id="s-accounts-list"></div>
    <button class="btn btn-gold" style="width:100%;justify-content:center;margin-top:8px" onclick="if(KontoShell) KontoShell.showAddBank()">+ Bankkonto hinzufügen</button>
  </details>

  <!-- 7. ÜBERGANGS-MODUS -->
  <details class="sett-section">
    <summary style="color:var(--orn)">🔄 Übergangs-Modus</summary>
    <div style="margin-top:12px;font-size:11px;color:var(--txt3);line-height:1.4">
      Aktiviere diesen Modus, wenn Geschäfts- und Privatkonten noch nicht vollständig getrennt sind. Die App fragt bei Buchungen detaillierter nach.
    </div>
    <div class="field sett-mt" style="display:flex;align-items:center;justify-content:space-between">
      <label style="margin:0;color:var(--txt)">Übergangs-Modus aktiv</label><input type="checkbox" id="s_transitionMode" style="width:20px;height:20px;accent-color:var(--orn)" onchange="EinstellungenModule.save()">
    </div>
  </details>

  <!-- 8. BACKUP -->
  <details class="sett-section">
    <summary>💾 Backup</summary>
    <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">
      <button class="btn btn-g" onclick="EinstellungenModule.exportJSON()" style="justify-content:center">⬇️ Lokaler JSON-Export</button>
      <div style="background:var(--s2);border:1px solid var(--br);border-radius:var(--r8);padding:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:12px">☁️ Google Drive</span>
          <span id="s-drive-status-badge" style="font-size:9px;color:var(--orn);border:1px solid var(--orn);padding:2px 4px;border-radius:4px">NICHT VERBUNDEN</span>
        </div>
        <div id="s-drive-last-backup" style="font-size:10px;color:var(--txt3);margin-bottom:8px">Letztes Backup: Noch nie</div>
        <button class="btn btn-g" id="s-drive-connect-btn" onclick="EinstellungenModule.driveConnect()" style="display:none;width:100%;justify-content:center;margin-bottom:6px">🔑 Verbinden</button>
        <button class="btn btn-gold" id="s-drive-backup-btn" onclick="EinstellungenModule.backupDrive()" style="display:none;width:100%;justify-content:center;margin-bottom:6px">☁️ Jetzt sichern</button>
        <button class="btn btn-g" id="s-drive-restore-btn" onclick="EinstellungenModule.restoreFromDrive()" style="display:none;width:100%;justify-content:center;margin-bottom:6px">🔄 Wiederherstellen</button>
        <button class="btn" id="s-drive-disconnect-btn" onclick="EinstellungenModule.driveDisconnect()" style="display:none;width:100%;justify-content:center;color:var(--red)">✕ Trennen</button>
      </div>
    </div>
  </details>

  <!-- 9. APP -->
  <details class="sett-section">
    <summary>⚙️ App & System</summary>
    <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">
      <button class="btn btn-red" onclick="EinstellungenModule.cleanupDatabase()" style="justify-content:center">🗑️ Datenbank bereinigen (Trim)</button>
      <button class="btn btn-red" onclick="EinstellungenModule.resetCounters()" style="justify-content:center">🔄 Zähler zurücksetzen</button>
    </div>
    <div style="margin-top:20px;text-align:center;font-size:10px;color:var(--txt3);line-height:1.6">
      BelegScan Pro v4.4.2<br>Offline-First · DSGVO-konform
    </div>
  </details>
  <div style="height:80px"></div>
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
    // Google Drive: Auth-Callback prüfen (falls OAuth-Redirect)
    await _checkDriveAuthCallback();
    // Drive UI initialisieren
    await _updateDriveUI();
    // iOS-Fallback für Background Sync aktivieren
    _initVisibilityFallback();
    // Wöchentliche Backup-Erinnerung
    await _checkWeeklyReminder();
    // Ausstehende Sync-Queue verarbeiten (beim App-Start)
    if (navigator.onLine) await _processDriveSyncQueue();
  });

  BSP.on('settings:saved', () => {
    // Shell-Widgets aktualisieren
    _updateShellWidgets();
  });

  // Drive UI aktualisieren wenn Einstellungen-View geöffnet wird
  BSP.on('view:changed', async ({ name }) => {
    if (name === 'einstellungen') {
      await _updateDriveUI();
    }
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

  // Transition Switch
  const tsw = document.getElementById('s_transitionMode');
  if (tsw) tsw.checked = s.transitionMode === true;
  
  _renderMismatchList();

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
    transitionMode: document.getElementById('s_transitionMode')?.checked || false,
    stempelName: get('stempelName'),
    stempelText: document.getElementById('s_stempelText')?.value || '',
    stempelColor: get('stempelColor') || '#c8a45a',
    logo: document.getElementById('s_logoPreview')?.dataset.logo || (BSP.state.settings || {}).logo,
    _apiKey: document.getElementById('s_apikey')?.value || '',
    setupDone: '1',
    bankKonten: (BSP.state.settings && BSP.state.settings.bankKonten) ? BSP.state.settings.bankKonten : [
       { id: 'bank_biz_1', bankname: '', kontonr: '', iban: '', blz: '', typ: 'Business', fints_url: '', last_sync: null, sync_enabled: false }
    ]
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

// ── Google Drive Backup – Vollständige Implementierung ──────────
//
// ╔══════════════════════════════════════════════════════════════╗
// ║  KONFIGURATION: Google Cloud OAuth Client-ID               ║
// ║  Erstelle ein Projekt unter: console.cloud.google.com      ║
// ║  → APIs & Services → Credentials → Create OAuth Client ID  ║
// ║  Typ: Web application                                       ║
// ║  Authorized JS origins: https://DEINE-GITHUB-PAGES-URL     ║
// ║  Trage die Client-ID unten ein und ersetze YOUR_GOOGLE_CLIENT_ID ║
// ╚══════════════════════════════════════════════════════════════╝
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID';  // ← HIER EINTRAGEN
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_FOLDER_NAME = 'BelegScan Pro Backup';
const DRIVE_TOKEN_STORE_KEY = 'drive_token';

// Prüft ob Google Drive korrekt konfiguriert ist (Client-ID eingetragen)
function _isDriveConfigured() {
  return GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID' && GOOGLE_CLIENT_ID.length > 10;
}

// Lädt gespeicherten OAuth-Token aus IndexedDB
async function _getDriveToken() {
  try {
    const entry = await BSP.dbGet('einstellungen', DRIVE_TOKEN_STORE_KEY);
    if (!entry || !entry.value) return null;
    const token = entry.value;
    // Ablauf prüfen (1 Stunde)
    if (token.expiresAt && Date.now() > token.expiresAt) return null;
    return token;
  } catch(e) { return null; }
}

// Speichert OAuth-Token sicher in IndexedDB
async function _saveDriveToken(token) {
  token.expiresAt = Date.now() + 3600 * 1000; // 1 Stunde
  await BSP.dbPut('einstellungen', { key: DRIVE_TOKEN_STORE_KEY, value: token });
}

// OAuth2 Implicit Flow (für Web Apps ohne Backend)
async function driveConnect() {
  if (!_isDriveConfigured()) {
    BSP.toast('Google Drive nicht konfiguriert — Client-ID fehlt', 'er');
    return;
  }
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: location.origin + location.pathname,
    response_type: 'token',
    scope: GOOGLE_SCOPES,
    prompt: 'select_account'
  });
  // Token aus URL-Hash lesen nach OAuth-Redirect
  window._driveAuthPending = true;
  window.open('https://accounts.google.com/o/oauth2/auth?' + params.toString(), '_blank', 'width=500,height=600');
  BSP.toast('Bitte Google Drive Fenster abschließen', 'info');
}

// Wird beim App-Start geprüft: Hat der OAuth-Redirect einen Token hinterlassen?
async function _checkDriveAuthCallback() {
  const hash = location.hash;
  if (!hash.includes('access_token=')) return;
  const params = new URLSearchParams(hash.substring(1));
  const accessToken = params.get('access_token');
  const tokenType = params.get('token_type') || 'Bearer';
  if (accessToken) {
    await _saveDriveToken({ accessToken, tokenType });
    // Hash aus URL entfernen
    history.replaceState(null, '', location.pathname);
    BSP.toast('✓ Google Drive verbunden!', 'ok');
    await _updateDriveUI();
    // Direkt erstes Backup anlegen
    await backupDrive();
  }
}

// Google Drive Verbindung trennen
async function driveDisconnect() {
  if (!confirm('Google Drive Verbindung wirklich trennen?')) return;
  await BSP.dbDelete('einstellungen', DRIVE_TOKEN_STORE_KEY);
  await BSP.dbDelete('einstellungen', 'drive_last_backup');
  await _updateDriveUI();
  BSP.toast('Google Drive getrennt', 'ok');
}

// Drive-Ordner finden oder erstellen
async function _getOrCreateDriveFolder(token, parentId = 'root') {
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${DRIVE_FOLDER_NAME}'+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&fields=files(id,name)`,
    { headers: { Authorization: `${token.tokenType} ${token.accessToken}` } }
  );
  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) return searchData.files[0].id;

  // Ordner anlegen
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `${token.tokenType} ${token.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    })
  });
  const folder = await createRes.json();
  return folder.id;
}

// Datei in Google Drive hochladen (Multipart)
async function _uploadToDrive(token, folderId, fileName, content, mimeType = 'application/json') {
  const boundary = '-------bsp_boundary_' + Date.now();
  const metadata = JSON.stringify({ name: fileName, parents: [folderId] });

  let body;
  if (content instanceof Blob) {
    // Blob: als ArrayBuffer
    const arr = await content.arrayBuffer();
    body = new Blob([
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${metadata}\r\n`,
      `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
      arr,
      `\r\n--${boundary}--`
    ]);
  } else {
    // String/JSON
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    body = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n${contentStr}\r\n--${boundary}--`;
  }

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
    method: 'POST',
    headers: {
      Authorization: `${token.tokenType} ${token.accessToken}`,
      'Content-Type': `multipart/related; boundary="${boundary}"`
    },
    body
  });
  if (!res.ok) throw new Error(`Drive Upload Fehler: ${res.status}`);
  return await res.json();
}

// ── Hauptfunktion: Komplettes Backup ─────────────────────────────
async function backupDrive() {
  if (!_isDriveConfigured()) {
    BSP.toast('Google Drive nicht konfiguriert — bitte Client-ID eintragen', 'wr');
    return;
  }
  const token = await _getDriveToken();
  if (!token) {
    BSP.toast('Bitte zuerst Google Drive verbinden', 'wr');
    await _updateDriveUI();
    return;
  }

  const btn = document.getElementById('s-drive-backup-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Sicherung...'; }

  try {
    BSP.showScrim('Google Drive Backup läuft...');
    const folderId = await _getOrCreateDriveFolder(token);

    // Monatsordner (YYYY-MM)
    const monthStr = new Date().toISOString().slice(0, 7);
    const monthFolderId = await _getOrCreateDriveFolder(token, folderId); // vereinfacht: direkt im Hauptordner

    // Backup-Datum Prefix für Dateien
    const dateStr = new Date().toISOString().slice(0, 10);

    // 1. Alle Belege als JSON
    const belege = await BSP.dbGetAll('belege') || [];
    await _uploadToDrive(token, folderId, `${dateStr}_belege.json`,
      belege.map(b => ({ ...b, image: undefined, images: undefined })) // Bilder separat
    );

    // 2. Kontoauszug-Buchungen
    const buchungen = await BSP.dbGetAll('konto_buchungen') || [];
    await _uploadToDrive(token, folderId, `${dateStr}_buchungen.json`, buchungen);

    // 3. Fahrten
    const fahrten = await BSP.dbGetAll('fahrten') || [];
    await _uploadToDrive(token, folderId, `${dateStr}_fahrten.json`, fahrten);

    // 4. Einstellungen (ohne sensible Tokens)
    const einst = await BSP.dbGetAll('einstellungen') || [];
    const einstSafe = einst.filter(e => e.key !== DRIVE_TOKEN_STORE_KEY);
    await _uploadToDrive(token, folderId, `${dateStr}_einstellungen.json`, einstSafe);

    // 5. Belegbilder (als Blob, mit Belegnummer als Dateiname)
    const belegerMitBilder = belege.filter(b => b.belegNr && (b.image || (b.images && b.images.length)));
    let imgCount = 0;
    for (const b of belegerMitBilder) {
      const allImages = (b.images && b.images.length > 0) ? b.images : (b.image ? [b.image] : []);
      for (let i = 0; i < allImages.length; i++) {
        try {
          const imgData = allImages[i];
          if (!imgData) continue;
          const sanitizedNr = b.belegNr.replace(/[\/\\:*?"<>|]/g, '_');
          const suffix = allImages.length > 1 ? `_S${i + 1}` : '';
          const fileName = `${sanitizedNr}${suffix}.jpg`;
          const blob = typeof imgData === 'string'
            ? BSP.b64toBlob(imgData)
            : imgData;
          await _uploadToDrive(token, folderId, fileName, blob, 'image/jpeg');
          imgCount++;
        } catch(imgErr) {
          console.warn('[BSP] Bild-Upload fehlgeschlagen:', imgErr);
        }
      }
    }

    // Backup-Zeitstempel speichern
    const now = Date.now();
    await BSP.dbPut('einstellungen', { key: 'drive_last_backup', value: now });
    BSP.state.settings = BSP.state.settings || {};
    BSP.state.settings.drive_last_backup = now;

    BSP.toast(`✓ Backup abgeschlossen (${belege.length} Belege, ${imgCount} Bilder)`, 'ok');
    await _updateDriveUI();

    // Nächsten Background Sync zurücksetzen
    await _clearDriveSyncQueue();

  } catch(e) {
    console.error('[BSP] Drive Backup Fehler:', e);
    // Bei Token-Abgelauf: neu verbinden
    if (e.message.includes('401') || e.message.includes('403')) {
      await BSP.dbDelete('einstellungen', DRIVE_TOKEN_STORE_KEY);
      BSP.toast('Google Drive Session abgelaufen – bitte neu verbinden', 'wr');
    } else {
      BSP.toast('Drive Backup Fehler: ' + e.message, 'er');
    }
    // Fehlgeschlagenen Sync in Queue einreihen (wird beim nächsten Online-Event nachgeholt)
    await _enqueueDriveSync();
  } finally {
    BSP.hideScrim();
    if (btn) { btn.disabled = false; btn.textContent = '☁️ Jetzt sichern'; }
  }
}

// ── Restore aus Google Drive ─────────────────────────────────────
async function restoreFromDrive() {
  if (!_isDriveConfigured()) {
    BSP.toast('Google Drive nicht konfiguriert', 'er');
    return;
  }
  const token = await _getDriveToken();
  if (!token) {
    BSP.toast('Bitte zuerst Google Drive verbinden', 'wr');
    return;
  }
  if (!confirm('Alle lokalen Daten werden durch das Google Drive Backup überschrieben. Fortfahren?')) return;

  BSP.showScrim('Stelle Backup wieder her...');
  try {
    // Neueste Backup-Datei suchen
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name+contains+'belege.json'+and+trashed=false&orderBy=modifiedTime+desc&pageSize=1&fields=files(id,name,modifiedTime)`,
      { headers: { Authorization: `${token.tokenType} ${token.accessToken}` } }
    );
    const searchData = await searchRes.json();
    if (!searchData.files || !searchData.files.length) {
      BSP.hideScrim();
      BSP.toast('Kein Backup in Google Drive gefunden', 'wr');
      return;
    }

    const fileId = searchData.files[0].id;
    const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `${token.tokenType} ${token.accessToken}` } }
    );
    const belege = await fileRes.json();

    if (!Array.isArray(belege)) throw new Error('Ungültiges Backup-Format');

    // Belege importieren
    for (const b of belege) {
      try { await BSP.dbPut('belege', b); } catch(e) {}
    }

    BSP.toast(`✓ ${belege.length} Belege wiederhergestellt`, 'ok');
    BSP.emit('beleg:saved', {});
  } catch(e) {
    BSP.toast('Restore Fehler: ' + e.message, 'er');
  } finally {
    BSP.hideScrim();
  }
}

// ── Background Sync Queue (für Offline-Fälle) ────────────────────
async function _enqueueDriveSync() {
  try {
    await BSP.dbAdd('drive_sync', { queuedAt: Date.now(), type: 'full_backup' });
    // Background Sync API (Chrome/Android)
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      const reg = await navigator.serviceWorker.ready;
      await reg.sync.register('bsp-drive-backup');
      console.log('[BSP] Background Sync bsp-drive-backup registriert');
    }
  } catch(e) {
    console.warn('[BSP] Background Sync nicht verfügbar (iOS?):', e.message);
  }
}

async function _clearDriveSyncQueue() {
  try {
    const items = await BSP.dbGetAll('drive_sync');
    for (const item of items) await BSP.dbDelete('drive_sync', item.id);
  } catch(e) {}
}

// Prüft ob ausstehende Syncs in der Queue sind und führt sie aus
async function _processDriveSyncQueue() {
  try {
    const queue = await BSP.dbGetAll('drive_sync');
    if (!queue || !queue.length) return;
    const token = await _getDriveToken();
    if (!token) return; // Kein Token → nicht möglich
    if (!navigator.onLine) return; // Offline → warten
    console.log('[BSP] Drive Sync Queue: ' + queue.length + ' ausstehende Backups');
    await backupDrive();
  } catch(e) {
    console.warn('[BSP] Drive Sync Queue Fehler:', e);
  }
}

// ── iOS-Fallback: Backup bei visibilitychange ────────────────────
// Wenn App in Vordergrund kommt und letztes Backup > 1 Stunde alt: sichern
function _initVisibilityFallback() {
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    // Queue-Einträge verarbeiten (iOS-Fallback für ausstehende Syncs)
    await _processDriveSyncQueue();
    // Automatisches Backup wenn > 1 Stunde seit letztem Backup
    const token = await _getDriveToken();
    if (!token) return;
    if (!navigator.onLine) return;
    const lastBackupEntry = await BSP.dbGet('einstellungen', 'drive_last_backup');
    const lastBackup = lastBackupEntry?.value || 0;
    const oneHour = 60 * 60 * 1000;
    if (Date.now() - lastBackup > oneHour) {
      console.log('[BSP] iOS Fallback: Auto-Backup nach 1h');
      await backupDrive();
    }
  });
}

// ── Wöchentliche Erinnerung ──────────────────────────────────────
async function _checkWeeklyReminder() {
  const lastBackupEntry = await BSP.dbGet('einstellungen', 'drive_last_backup');
  const lastBackup = lastBackupEntry?.value || 0;
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - lastBackup > sevenDays) {
    setTimeout(() => {
      BSP.toast('⚠️ Letztes Backup älter als 7 Tage – bitte jetzt sichern', 'wr');
    }, 3000); // 3 Sekunden nach App-Start
  }
}

// ── Drive UI aktualisieren ───────────────────────────────────────
async function _updateDriveUI() {
  const configured = _isDriveConfigured();
  const token = await _getDriveToken();
  const connected = !!token;

  const badge = document.getElementById('s-drive-status-badge');
  const notConfigured = document.getElementById('s-drive-not-configured');
  const connectBtn = document.getElementById('s-drive-connect-btn');
  const backupBtn = document.getElementById('s-drive-backup-btn');
  const restoreBtn = document.getElementById('s-drive-restore-btn');
  const disconnectBtn = document.getElementById('s-drive-disconnect-btn');
  const lastBackupEl = document.getElementById('s-drive-last-backup');

  if (!configured) {
    if (notConfigured) notConfigured.style.display = 'block';
    if (badge) { badge.textContent = 'NICHT KONFIGURIERT'; badge.style.color = 'var(--red)'; badge.style.borderColor = 'var(--red)'; badge.style.background = 'rgba(200,64,64,0.1)'; }
    if (connectBtn) connectBtn.style.display = 'none';
    if (backupBtn) backupBtn.style.display = 'none';
    if (restoreBtn) restoreBtn.style.display = 'none';
    if (disconnectBtn) disconnectBtn.style.display = 'none';
    return;
  }

  if (notConfigured) notConfigured.style.display = 'none';

  if (connected) {
    if (badge) { badge.textContent = '✓ VERBUNDEN'; badge.style.color = 'var(--grn)'; badge.style.borderColor = 'var(--grn)'; badge.style.background = 'rgba(64,200,64,0.1)'; }
    if (connectBtn) connectBtn.style.display = 'none';
    if (backupBtn) backupBtn.style.display = 'flex';
    if (restoreBtn) restoreBtn.style.display = 'flex';
    if (disconnectBtn) disconnectBtn.style.display = 'flex';
  } else {
    if (badge) { badge.textContent = 'NICHT VERBUNDEN'; badge.style.color = 'var(--orn)'; badge.style.borderColor = 'var(--orn)'; badge.style.background = 'rgba(255,166,0,0.1)'; }
    if (connectBtn) connectBtn.style.display = 'flex';
    if (backupBtn) backupBtn.style.display = 'none';
    if (restoreBtn) restoreBtn.style.display = 'none';
    if (disconnectBtn) disconnectBtn.style.display = 'none';
  }

  // Letztes Backup anzeigen
  if (lastBackupEl) {
    const lastBackupEntry = await BSP.dbGet('einstellungen', 'drive_last_backup');
    const lastBackup = lastBackupEntry?.value;
    if (lastBackup) {
      const diff = Date.now() - lastBackup;
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);
      const timeStr = days > 0 ? `vor ${days} Tag${days > 1 ? 'en' : ''}` : hours > 0 ? `vor ${hours} Std.` : 'gerade eben';
      lastBackupEl.textContent = `Letztes Backup: ${timeStr}`;
      lastBackupEl.style.color = days >= 7 ? 'var(--orn)' : 'var(--txt3)';
    } else {
      lastBackupEl.textContent = 'Letztes Backup: Noch nie';
    }
  }
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

// ── Übergangs-Modus Klassifizierer ────────────────────────────
  async function startTransitionCheck(txns, callback) {
     const s = BSP.state.settings || {};
     if (!s.transitionMode) {
        if(callback) callback(txns);
        return;
     }
     
     const targets = txns.filter(t => t.status === 'offen' || t.status === 'possible_conflict');
     if (targets.length === 0) {
        if(callback) callback(txns);
        return;
     }

     let currentIndex = 0;
     
     const showNext = () => {
        if (currentIndex >= targets.length) {
           BSP.closeSheet();
           BSP.toast('Übergangs-Check abgeschlossen', 'ok');
           if(callback) callback(txns);
           return;
        }
        
        const t = targets[currentIndex];
        
        const html = `
          <div class="sh"></div>
          <div class="mod-header" style="text-align:center">
            <div style="font-size:10px;color:var(--orn);text-transform:uppercase;margin-bottom:8px;font-weight:600">Übergangs-Modus (Konto-Check ${currentIndex+1}/${targets.length})</div>
            <h2 class="mod-title">${BSP.eh(t.empfaenger || 'Unbekannt')}</h2>
            <div style="font-size:24px;font-weight:600;color:${t.betrag > 0 ? 'var(--gold)':'var(--txt)'};margin:8px 0">${BSP.fm(Math.abs(t.betrag))} €</div>
            <p class="mod-sub">${BSP.fd(t.datum)}</p>
          </div>
          
          <div style="margin-top:20px">
            <div style="font-size:11px;color:var(--txt3);margin-bottom:8px;text-align:center">1. Über welches Bankkonto lief diese Buchung tatsächlich?</div>
            <div style="display:flex;gap:8px">
               <button class="btn btn-g" id="btn-konto-biz" style="flex:1;justify-content:center;border:2px solid var(--br)" onclick="EinstellungenModule._transSelect('kontoTyp', 'Business', this)">Geschäftskonto</button>
               <button class="btn btn-g" id="btn-konto-priv" style="flex:1;justify-content:center;border:2px solid var(--br)" onclick="EinstellungenModule._transSelect('kontoTyp', 'Privat', this)">Privatkonto</button>
            </div>
            
            <div style="font-size:11px;color:var(--txt3);margin-top:20px;margin-bottom:8px;text-align:center">2. Ist dies eine Betriebsausgabe oder rein Privat?</div>
            <div style="display:flex;gap:8px">
               <button class="btn btn-g" id="btn-ausgabe-biz" style="flex:1;justify-content:center;border:2px solid var(--br)" onclick="EinstellungenModule._transSelect('ausgabenTyp', 'Business', this)">Betriebsausgabe</button>
               <button class="btn btn-g" id="btn-ausgabe-priv" style="flex:1;justify-content:center;border:2px solid var(--br)" onclick="EinstellungenModule._transSelect('ausgabenTyp', 'Privat', this)">Rein Privat</button>
            </div>
          </div>
          
          <div style="margin-top:30px">
             <button class="btn btn-gold" id="btn-trans-next" style="width:100%;justify-content:center;opacity:0.3;pointer-events:none" onclick="EinstellungenModule._transNext()">Weiter ✓</button>
          </div>
        `;
        
        BSP.showSheet(html);
        BSP.state._transCtx = { t, kDone: false, aDone: false };
     };
     
     showNext();
  }

  function _transNext() {
      const ctx = BSP.state._transCtx;
      if(ctx.t.tags.kontoTyp !== ctx.t.tags.ausgabenTyp) {
         ctx.t.tags.mismatch = true;
      }
      // Der "currentIndex" der lokalen Instanz wird referenziert, da JS Closures über _transNext nicht sicher funken.
      // Besser: Wir mutieren das Objekt und lassen den Caller wissen, aber startTransitionCheck wartet nicht asynchron.
      // Ich modifiziere startTransitionCheck um globalen State zu nutzen, ODER ich gebe _transNext mit callback zurück.
  }

  // Da ich _transNext als globale Injection fixen muss, lege ich die Controller-Funktionen offen:
  function _transSelect(field, val, btn) {
      const ctx = BSP.state._transCtx;
      ctx.t.tags[field] = val;
      
      if(field === 'kontoTyp') {
         document.getElementById('btn-konto-biz').style.borderColor = 'var(--br)';
         document.getElementById('btn-konto-priv').style.borderColor = 'var(--br)';
         ctx.kDone = true;
      } else {
         document.getElementById('btn-ausgabe-biz').style.borderColor = 'var(--br)';
         document.getElementById('btn-ausgabe-priv').style.borderColor = 'var(--br)';
         ctx.aDone = true;
         if(val === 'Privat') ctx.t.status = 'privat';
      }
      btn.style.borderColor = 'var(--gold)';
      
      if (ctx.kDone && ctx.aDone) {
         const nextBtn = document.getElementById('btn-trans-next');
         nextBtn.style.opacity = '1';
         nextBtn.style.pointerEvents = 'auto';
      }
  }

  async function _renderMismatchList() {
     const list = document.getElementById('mismatch-list');
     const container = document.getElementById('mismatch-container');
     const totalEl = document.getElementById('mismatch-total');
     if (!list || !container) return;
     
     const kData = (await BSP.dbGetAll('konto')) || [];
     const mismatches = kData.filter(k => k.tags && k.tags.mismatch);
     
     if (mismatches.length === 0) {
        container.style.display = 'none';
        return;
     }
     
     container.style.display = 'block';
     let sum = 0;
     let html = '';
     
     mismatches.forEach(m => {
        sum += Math.abs(m.betrag);
        html += `
        <div style="background:var(--s1);border-left:3px solid var(--red);padding:10px;margin-bottom:6px;border-radius:0 var(--r8) var(--r8) 0;display:flex;justify-content:space-between;align-items:center">
           <div>
              <div style="font-size:12px;font-weight:600">${BSP.eh(m.empfaenger)}</div>
              <div style="font-size:10px;color:var(--txt3)">${BSP.fd(m.datum)} · ${m.tags.ausgabenTyp}ausgabe auf ${m.tags.kontoTyp}konto</div>
           </div>
           <div style="font-family:'DM Mono';color:var(--txt);font-size:13px">${BSP.fm(Math.abs(m.betrag))} €</div>
        </div>`;
     });
     
     list.innerHTML = html;
     if(totalEl) totalEl.textContent = 'Gesamt zu korrigieren: ' + BSP.fm(sum) + ' €';
  }

// ── Datenbank bereinigen (Physisches Löschen gelöschter Einträge) ──
async function _cleanupDeletedEntries() {
  const STORES = ['belege', 'konto', 'konto_buchungen', 'abos', 'fahrten', 'verpflegung', 'archiv_dokumente', 'archiv_fristen', 'archiv_vertraege'];
  let totalPurged = 0;

  for (const store of STORES) {
    try {
      const items = await BSP.dbGetAll(store);
      if (!items || !items.length) continue;
      const toDelete = items.filter(item => item.deleted === true);
      for (const item of toDelete) {
        if (item.id !== undefined) {
          await BSP.dbDelete(store, item.id);
          totalPurged++;
        }
      }
    } catch(e) {
      // Store existiert evtl. nicht – ignorieren
    }
  }

  return totalPurged;
}

// ── Öffentliche cleanup-Funktion (aufgerufen vom Button) ──
async function cleanupDatabase() {
  const btn = document.getElementById('s_dbCleanupBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Bereinige...'; }
  try {
    const count = await _cleanupDeletedEntries();
    if (count === 0) {
      BSP.toast('Keine gelöschten Einträge gefunden.', 'info');
    } else {
      BSP.toast(count + ' Einträge dauerhaft entfernt ✓', 'ok');
    }
  } catch(e) {
    BSP.toast('Bereinigung fehlgeschlagen: ' + e.message, 'er');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🗑️ Datenbank bereinigen – gelöschte Einträge dauerhaft entfernen'; }
  }
}

// ── Öffentliche API des Moduls ────────────────────────────────
return {
  init, save, toggleApiKeyVis, handleLogo, exportJSON,
  backupDrive, driveConnect, driveDisconnect, restoreFromDrive,
  resetCounters, cleanupDatabase,
  startTransitionCheck, _transNext, _transSelect
};


})();
