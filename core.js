// ══════════════════════════════════════════════════════════════
// BELEGSCAN PRO — CORE
// Einzige Wahrheitsquelle: DB, State, Events, API, Shared Functions
// Kein Modul greift auf ein anderes Modul zu — alles läuft über BSP.*
// ══════════════════════════════════════════════════════════════
'use strict';

const BSP = (() => {

// ── Micro-App Registry ──────────────────────────────────────
const _modules = {};


// ── Event Emitter ─────────────────────────────────────────────
const _events = {};
function on(e, cb) { if (!_events[e]) _events[e] = []; _events[e].push(cb); }
function off(e, cb) { if (_events[e]) _events[e] = _events[e].filter(x => x !== cb); }
function emit(e, d) { if (_events[e]) _events[e].forEach(x => x(d)); }

const state = {
  settings: {},
  scanCount: parseInt(localStorage.getItem('bsp_scanCount')) || 0,
  apiCosts: parseFloat(localStorage.getItem('bsp_apiCosts')) || 0,
  mwstSaldo: 0,
  erCounter: parseInt(localStorage.getItem('bsp_erc')) || 0,
  arCounter: parseInt(localStorage.getItem('bsp_arc')) || 0,
  rcZ52: 0,
  rcZ67: 0,
  // Kontext-Tracking (Aufgabe 2 – Feedback-Modul)
  activePillar: 'business',
  activeView: 'home',
  activeSheet: null,
};

function registerModule(id, module) {
  _modules[id] = module;
  console.log(`[BSP] Module registered: ${id}`);
  emit('module:registered', { id, module });
}

async function safeInit(id, module) {
  try {
    if (module && typeof module.init === 'function') {
      await module.init();
      console.log(`[BOOT] ${id} initialized.`);
    }
  } catch (e) {
    console.error(`[BOOT] ${id} init failed:`, e);
    // Nicht re-throwen, damit andere Module weiterlaufen
    if (state.settings?.debug) toast(`Fehler in ${id}`, 'wr');
  }
}

function getModules() {
  return _modules;
}

// ── Context Graph ─────────────────────────────────────────────
async function getContext() {
  const settings = state.settings || await loadSettings();
  const kontextEntries = await BSP.dbGetAll('kontext');
  const latestKontext = kontextEntries.sort((a,b) => b.savedAt - a.savedAt)[0];
  
  // Letzte Business & Privat Belege für Stimmungs-Analyse
  const belege = await BSP.dbGetAll('belege');
  const recent = belege.sort((a,b) => b.savedAt - a.savedAt).slice(0, 10);
  
  return {
    user: {
      name: settings.name,
      job: settings.beruf,
      children: settings.kinder,
    },
    business: {
      stressLevel: _calcStress(recent),
      goal: settings.businessZiel
    },
    kontext: latestKontext ? latestKontext.text : '',
    timestamp: new Date().toISOString()
  };
}

function _calcStress(recent) {
  const workCount = recent.filter(b => b.type === 'er' || b.type === 'ar').length;
  if (workCount > 7) return 'hoch';
  if (workCount > 4) return 'mittel';
  return 'normal';
}


// ── Verschlüsselungs-Layer (AES-GCM) ────────────────────────
async function _getEncryptionKey() {
  const pin = state.settings.pin || '0000';
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('bsp-salt'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

async function encrypt(data) {
  try {
    const key = await _getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(data))
    );
    return { iv: Array.from(iv), data: Array.from(new Uint8Array(encrypted)) };
  } catch(e) { console.error('Encr Error', e); return data; }
}

async function decrypt(encObj) {
  if (!encObj || !encObj.iv || !encObj.data) return encObj;
  try {
    const key = await _getEncryptionKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(encObj.iv) },
      key, new Uint8Array(encObj.data)
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch(e) { console.error('Decr Error (PIN falsch?)', e); return null; }
}

// ── Monetarisierung-Schicht (Placeholder) ──────────────────
function isPremium() { return true; }
function hasTokens(n = 1) { return true; }
function deductTokens(n = 1) { return true; }

// ── MwSt-Saldo berechnen ────────────────────────────────────
async function _updateMwstSaldo() {
  const all = await BSP.getBelege();
  const now = new Date();
  const year = now.getFullYear();
  const yearBelege = all.filter(b => b.date && new Date(b.date + 'T00:00:00').getFullYear() === year);

  let arMwst = 0, erMwst = 0, rcZ52 = 0, rcZ67 = 0;
  yearBelege.forEach(b => {
    if (b.isReverseCharge) {
      rcZ52 += (b.net || 0);
      rcZ67 += (b.mwst || 0);
    } else if (b.type === 'ar') {
      arMwst += (b.mwst || 0);
    } else if (b.type === 'er') {
      erMwst += (b.mwst || 0);
    }
  });

  state.mwstSaldo = arMwst - erMwst;
  state.rcZ52 = rcZ52;
  state.rcZ67 = rcZ67;
}

// ── Belegnummer ─────────────────────────────────────────────
function nextNr(type) {
  const s = state.settings || {};
  const fmt = s.belegFmt || 'A';
  const y = new Date().getFullYear();
  const q = Math.ceil((new Date().getMonth() + 1) / 3);

  let cnt;
  if (type === 'er') {
    state.erCounter++;
    localStorage.setItem('bsp_erc', state.erCounter);
    cnt = state.erCounter;
  } else {
    state.arCounter++;
    localStorage.setItem('bsp_arc', state.arCounter);
    cnt = state.arCounter;
  }

  const prefix = type.toUpperCase();
  const n = String(cnt).padStart(4, '0');
  if (fmt === 'A') return `${prefix}-${y}-${n}`;
  if (fmt === 'B') return `${y}-Q${q}-${prefix}-${n}`;
  return `${y}-${prefix}-${n}`;
}

// ── Einstellungen laden/speichern ───────────────────────────
async function loadSettings() {
  const rows = await BSP.dbGetAll('einstellungen');
  const s = {};
  rows.forEach(r => { s[r.key] = r.value; });
  state.settings = s;
  state.settings._apiKey = localStorage.getItem('bsp_apikey') || '';
  return s;
}

async function saveSetting(key, value) {
  await BSP.dbPut('einstellungen', { key, value });
  if (!state.settings) state.settings = {};
  state.settings[key] = value;
}

async function saveAllSettings(data) {
  const apiKey = data._apiKey;
  if (apiKey !== undefined) {
    localStorage.setItem('bsp_apikey', apiKey);
    delete data._apiKey;
  }
  for (const [key, value] of Object.entries(data)) {
    await saveSetting(key, value);
  }
  state.settings = { ...state.settings, ...data, _apiKey: apiKey };
  emit('settings:saved', state.settings);
}


// ── Navigation ───────────────────────────────────────────────
function showView(name, params = {}) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('on'));
  document.querySelectorAll('[data-nav]').forEach(n => n.classList.remove('on'));
  const view = document.getElementById('v-' + name);
  if (view) view.classList.add('on');
  const navItem = document.querySelector(`[data-nav="${name}"]`);
  if (navItem) navItem.classList.add('on');
  // Kontext-Tracking
  state.activeView = name;
  emit('view:changed', { name, params });
}

function closeAllOverlays() {
  const overlays = ['scanner-overlay', 'onboarding', 'shell-api-input-wrap'];
  overlays.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  document.querySelectorAll('.toast').forEach(t => t.remove());
  
  // Modul-spezifische Closes (um Kamera zu stoppen)
  if (typeof ScannerModule !== 'undefined' && ScannerModule.close) ScannerModule.close();
  if (typeof PrivatScanModule !== 'undefined' && PrivatScanModule.close) PrivatScanModule.close();
  if (typeof ArchivScanModule !== 'undefined' && ArchivScanModule.close) ArchivScanModule.close();
  if (typeof SpracheUniversal !== 'undefined' && SpracheUniversal.close) SpracheUniversal.close();
  if (typeof StiftModule !== 'undefined' && StiftModule.close) StiftModule.close();
}

// ── Sheet (Bottom Modal) ─────────────────────────────────────
function showSheet(htmlContent) {
  // Bestehende Sheets entfernen
  const existingSheet = document.getElementById('bsp-sheet');
  if (existingSheet) existingSheet.remove();
  const existingBackdrop = document.getElementById('bsp-sheet-backdrop');
  if (existingBackdrop) existingBackdrop.remove();

  // Backdrop
  const backdrop = document.createElement('div');
  backdrop.id = 'bsp-sheet-backdrop';
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:500;opacity:0;transition:opacity .3s ease';
  backdrop.addEventListener('click', () => closeSheet());
  document.body.appendChild(backdrop);

  // Sheet-Panel
  const sheet = document.createElement('div');
  sheet.id = 'bsp-sheet';
  sheet.style.cssText = [
    'position:fixed',
    'left:0','right:0','bottom:0',
    'background:var(--bg2,#fff)',
    'border-radius:20px 20px 0 0',
    'z-index:501',
    'max-height:90dvh',
    'overflow-y:auto',
    'padding:0 16px',
    'padding-bottom:calc(env(safe-area-inset-bottom, 0px) + 16px)',
    'transform:translateY(100%)',
    'transition:transform .3s ease',
    'box-shadow:0 -4px 32px rgba(0,0,0,0.18)'
  ].join(';');

  // Drag-Handle
  sheet.innerHTML = '<div style="width:40px;height:4px;background:var(--br,#ddd);border-radius:2px;margin:12px auto 4px;"></div>' + htmlContent;
  document.body.appendChild(sheet);

  // Animiert einblenden
  requestAnimationFrame(() => {
    backdrop.style.opacity = '1';
    sheet.style.transform = 'translateY(0)';
  });
}

function closeSheet() {
  const sheet = document.getElementById('bsp-sheet');
  const backdrop = document.getElementById('bsp-sheet-backdrop');
  if (sheet) {
    sheet.style.transform = 'translateY(100%)';
    setTimeout(() => sheet.remove(), 310);
  }
  if (backdrop) {
    backdrop.style.opacity = '0';
    setTimeout(() => backdrop.remove(), 310);
  }
}

// ── Scrim (Lade-Overlay) ─────────────────────────────────────
function showScrim(text = 'Bitte warten…') {
  let scrim = document.getElementById('bsp-scrim');
  if (!scrim) {
    scrim = document.createElement('div');
    scrim.id = 'bsp-scrim';
    scrim.style.cssText = [
      'position:fixed','inset:0',
      'background:rgba(0,0,0,0.72)',
      'z-index:900',
      'display:flex','flex-direction:column',
      'align-items:center','justify-content:center',
      'gap:16px',
      'pointer-events:all'
    ].join(';');
    // Spinner
    scrim.innerHTML = `
      <div style="width:44px;height:44px;border:3px solid rgba(255,255,255,0.2);border-top-color:#fff;border-radius:50%;animation:bsp-spin .9s linear infinite"></div>
      <div id="bsp-scrim-text" style="color:#fff;font-size:14px;font-weight:300;letter-spacing:.3px;text-align:center;padding:0 32px;line-height:1.5"></div>
    `;
    // Keyframe einmalig einfügen
    if (!document.getElementById('bsp-scrim-css')) {
      const st = document.createElement('style');
      st.id = 'bsp-scrim-css';
      st.textContent = '@keyframes bsp-spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(st);
    }
    document.body.appendChild(scrim);
  }
  const textEl = document.getElementById('bsp-scrim-text');
  if (textEl) textEl.textContent = text;
  scrim.style.display = 'flex';
}

function hideScrim() {
  const scrim = document.getElementById('bsp-scrim');
  if (scrim) scrim.style.display = 'none';
}

// ── Hilfsfunktionen ───────────────────────────────────────────
function fm(v) { return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0); }
function fd(d) { return d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'; }
function eh(s) { const div = document.createElement('div'); div.textContent = s; return div.innerHTML; }
function fmK(v) { return v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v; }
function cfg(k, def) { return state.settings[k] !== undefined ? state.settings[k] : def; }

function toast(m, t = 'info') {
  const b = document.createElement('div');
  b.className = `toast t-${t}`;
  b.textContent = m;
  document.body.appendChild(b);
  setTimeout(() => b.classList.add('on'), 10);
  setTimeout(() => { b.classList.remove('on'); setTimeout(() => b.remove(), 400); }, 3000);
}

// ── App-Start ───────────────────────────────────────────────
async function init() {
  await BSP.initDB();
  await loadSettings();
  await _updateMwstSaldo();
  const s = state.settings || {};
  if (!s.setupDone) {
    const ob = document.getElementById('onboarding');
    if (ob) ob.classList.add('on');
  }
  emit('core:ready', state);
}

// ── Zeitersparnis & Deadlines ────────────────────────────────
function getNextDeadline() {
  const rhythmus = (state.settings && state.settings.voranmeldungRhythmus) || 'monatlich';
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  let deadline;
  if (rhythmus === 'monatlich') deadline = new Date(y, m + 1, 10);
  else if (rhythmus === 'quartal') {
    const nextQEnd = [3, 6, 9, 12].find(qm => (m + 1) <= qm);
    deadline = nextQEnd ? new Date(y, nextQEnd, 10) : new Date(y + 1, 0, 10);
  } else if (rhythmus === 'halbjahr') deadline = m < 6 ? new Date(y, 6, 10) : new Date(y + 1, 0, 10);
  else deadline = new Date(y + 1, 4, 31);
  const daysLeft = Math.max(0, Math.ceil((deadline - now) / 864e5));
  return { deadline, daysLeft, rhythmus };
}

function getTimeSaved() {
  const totalMin = state.scanCount * (parseFloat(state.settings?.minProScan) || 4);
  return { minutes: totalMin, hours: Math.floor(totalMin / 60), remainingMin: totalMin % 60, formatted: `${Math.floor(totalMin / 60)}h ${totalMin % 60}m` };
}

function getCostComparison() {
  const stbSatz = parseFloat(state.settings?.stbSatz) || 120;
  const stbCost = (state.scanCount * (parseFloat(state.settings?.minProScan) || 4) / 60) * stbSatz;
  return { apiCosts: state.apiCosts, stbCosts: stbCost, saved: stbCost - state.apiCosts };
}

// ── GPS & Routing ────────────────────────────────────────────
function gps() {
  return new Promise(res => {
    navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lon: p.coords.longitude }), e => res(null));
  });
}

function geocode(lat, lon) {
  return fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`).then(r => r.json()).catch(() => null);
}

function osrmRoute(start, end) { return Promise.resolve({ km: 0 }); }

// ── Kontext-Snapshot (Aufgabe 2 – Feedback-Modul) ────────────
// Liefert jederzeit den vollständigen App-Zustand für Feedback-Einträge.
// Der Nutzer muss nichts eingeben – alles wird automatisch erfasst.
function getAktuellerKontext() {
  // App-Version aus SW-Cache-Name lesen (via postMessage nicht sync möglich)
  // → Fallback auf localStorage oder Default
  const version = localStorage.getItem('bsp_sw_version') || 'v4.2.0';
  return {
    saeuler: state.activePillar || 'business',
    modul: state.activeView || 'home',
    aktion: state.activeSheet || state.activeView || 'home',
    version,
    zeitstempel: new Date().toISOString(),
  };
}

// ── Übergangs-Modus (Aufgabe 5) ─────────────────────────────
// Einzige Wahrheitsquelle. Kein anderes Modul entscheidet das selbst.
function isTransitionModeActive() {
  return state.settings.transitionMode === true;
}

// Transition-Banner oben in der Shell ein-/ausblenden
function _syncTransitionBanner() {
  let banner = document.getElementById('bsp-transition-banner');
  if (isTransitionModeActive()) {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'bsp-transition-banner';
      banner.style.cssText = [
        'position:fixed','top:0','left:0','right:0',
        'background:rgba(192,112,48,0.92)',
        'color:#fff','font-size:11px','font-weight:500',
        'text-align:center','padding:5px 16px',
        'z-index:9000','letter-spacing:.3px'
      ].join(';');
      banner.textContent = '⚠️ Übergangs-Modus aktiv – Konten noch nicht vollständig getrennt';
      document.body.prepend(banner);
    }
  } else if (banner) {
    banner.remove();
  }
}

// ── PendingReview API (Aufgabe 3) ────────────────────────────
// Alle Zugriffe auf pending_review Store laufen über diese Funktionen.
async function prAdd(item) {
  item.ts = Date.now();
  item.status = item.status || 'offen';
  const id = await BSP.dbAdd('pending_review', item);
  emit('pending_review:changed');
  return id;
}

async function prGetAll() {
  return (await BSP.dbGetAll('pending_review')) || [];
}

async function prUpdate(item) {
  item.ts = Date.now();
  await BSP.dbPut('pending_review', item);
  emit('pending_review:changed');
}

async function prDelete(id) {
  await BSP.dbDelete('pending_review', id);
  emit('pending_review:changed');
}

// Anzahl offener + später_klären Einträge
async function prCountOpen() {
  const all = await prGetAll();
  return all.filter(p => p.status === 'offen' || p.status === 'später_klären').length;
}

// Einträge die >14 Tage auf später_klären stehen → Badge wird rot
async function prCountStale() {
  const all = await prGetAll();
  const limit = Date.now() - 14 * 864e5;
  return all.filter(p => p.status === 'später_klären' && p.ts && p.ts < limit).length;
}

// Dashboard-Badge mit Anzahl und Farbe (orange / rot)
async function updatePendingBadge() {
  const count = await prCountOpen();
  const stale = await prCountStale();
  const badgeEl = document.getElementById('pending-review-badge');
  if (!badgeEl) return;
  if (count === 0) {
    badgeEl.style.display = 'none';
  } else {
    badgeEl.style.display = 'flex';
    badgeEl.textContent = count;
    badgeEl.style.background = stale > 0 ? 'var(--red)' : 'var(--orn)';
  }
}

// ── Öffentliche API ──────────────────────────────────────────
return {
  state,
  on, off, emit,
  registerModule, getModules, getContext,
  loadSettings, saveSetting, saveAllSettings,
  encrypt, decrypt,
  isPremium, hasTokens, deductTokens,
  fm, fd, eh, fmK, cfg, toast, nextNr, showView,
  getTimeSaved, getCostComparison, getNextDeadline,
  gps, geocode, osrmRoute,
  init, safeInit, closeAllOverlays,
  showSheet, closeSheet,
  showScrim, hideScrim,
  _updateMwstSaldo,
  // Aufgabe 5 – Transition Mode
  isTransitionModeActive, _syncTransitionBanner,
  // Aufgabe 3 – PendingReview
  prAdd, prGetAll, prUpdate, prDelete, prCountOpen, prCountStale, updatePendingBadge,
  // Aufgabe 2 – Kontext-Tracking (Feedback)
  getAktuellerKontext,
};

})();

// Globale Shortcuts für Module
const toast = BSP.toast.bind(BSP);
const fm = BSP.fm.bind(BSP);
const fd = BSP.fd.bind(BSP);
const eh = BSP.eh.bind(BSP);

// Global Export
  // ── Zentrale KI-Analyse für Sprache und manuellen Text ──────────────
  BSP.analysiereEingabeText = async function(text, modus) {
    if (typeof BSP.showScrim === 'function') BSP.showScrim('🤖 KI analysiert Eingabe...');
    
    let prompt = '';
    if (modus === 'business') {
      prompt = `Du bist ein Buchhalter-Assistent für deutsche Freiberufler. Der Nutzer hat folgendes eingegeben oder gesprochen:
"${text}"
Extrahiere daraus einen strukturierten Beleg mit allen relevanten Feldern.
Für Ausgaben (ER): Händler/Abo-Name, Datum, Betrag in EUR, Typ (er), MwSt-Satz (19, 7 oder 0), Kategorie aus SKR03.
Für Einnahmen (AR): Rechnungsempfänger (Kunde), Betrag in EUR, Typ (ar), Zweck (Leistungsbeschreibung), Datum, MwSt-Satz.
Datum: Heute ist ${new Date().toISOString().split('T')[0]}, falls "heute", "gestern" oder keine Angabe vorliegt, rechne es um bzw. setze null, wenn unklar ist.
Für Felder, die nicht aus dem Text abgeleitet werden können, nutze leere Strings. Erfinde absolut keine Informationen!
GIB EXAKT DIESES JSON-FORMAT ZURÜCK (Ohne Markdowns):
{
  "shop": "", // bei ER der Händler, bei AR der Rechnungsempfänger
  "empfaengerAdresse": "", // bei AR: Die vollständige Postadresse des Rechnungsempfängers
  "date": "YYYY-MM-DD",
  "brutto": 12.34, // Als Zahl, nicht als String.
  "mwstRate": 19,
  "category": "Bürobedarf",
  "type": "er" // ODER "ar"
}`;
    } else {
      prompt = `Du bist ein persönlicher Assistent für Privatausgaben. Der Nutzer hat folgendes eingegeben oder gesprochen:
"${text}"
Extrahiere daraus einen privaten Beleg. 
Datum ist heute (${new Date().toISOString().split('T')[0]}), wenn nicht anders erwähnt ("gestern" etc. umrechnen).
Erfinde absolut keine Daten. Gib fehlenden Feldern einen leeren String "".
GIB EXAKT DIESES JSON-FORMAT ZURÜCK (Ohne Markdowns):
{
  "shop": "Händler",
  "date": "YYYY-MM-DD",
  "brutto": 12.34, 
  "category": "Lebensmittel" // Aus Katalog: Lebensmittel, Restaurant, Elektronik, Freizeit, Sonstiges
}`;
    }

    try {
      if(!BSP.callClaude) throw new Error('API nicht geladen (callClaude fehlt).');
      const raw = await BSP.callClaude({ prompt, model: 'claude-sonnet-4-5' });
      let parsed = null;
      try { parsed = JSON.parse(raw.trim()); } catch(e) {}
      if (!parsed) {
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) parsed = JSON.parse(m[0]);
      }
      if (!parsed) throw new Error('Unlesbare KI-Antwort');

      if (typeof BSP.hideScrim === 'function') BSP.hideScrim();

      // Formular basierend auf Modus vorbefüllen
      if (modus === 'business' && typeof ScannerModule !== 'undefined' && ScannerModule.prefillFromAI) {
        ScannerModule.prefillFromAI(parsed);
      } else if (modus === 'privat' && typeof PrivatScanModule !== 'undefined' && PrivatScanModule.prefillFromAI) {
        PrivatScanModule.prefillFromAI(parsed);
      } else {
        BSP.toast('ScannerModule nicht verfügbar (Vorbefüllen gescheitert)', 'er');
        console.error('Konnte Formular nicht befüllen', parsed);
      }

    } catch(e) {
      if (typeof BSP.hideScrim === 'function') BSP.hideScrim();
      BSP.toast('KI Analyse fehlgeschlagen: ' + e.message, 'er');
      console.error(e);
    }
  };

window.BSP = BSP;

// Transition-Banner direkt nach core:ready synchronisieren
BSP.on('core:ready', () => BSP._syncTransitionBanner());
BSP.on('settings:saved', () => BSP._syncTransitionBanner());
BSP.on('pending_review:changed', () => BSP.updatePendingBadge());

