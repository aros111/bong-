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
  rcZ67: 0
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

// ── Headless AI Layer ───────────────────────────────────────
const AI = (() => {
  const API_URL = 'https://api.anthropic.com/v1/messages';
  const MODEL_HAIKU = 'claude-3-5-haiku-20241022';
  const MODEL_SONNET = 'claude-3-5-sonnet-20241022';

  const COST_TABLE = {
    'claude-3-5-haiku-20241022': { input: 0.25, output: 1.25 },
    'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 }
  };

  async function process({ prompt, imageB64, images = [], model, maxTokens = 1024 }) {
    const apiKey = (state.settings && state.settings._apiKey) || localStorage.getItem('bsp_apikey') || '';
    if (!apiKey) throw new Error('API Key fehlt');

    const content = [];
    
    // Handle single or multiple images
    const allImages = images.length ? images : (imageB64 ? [imageB64] : []);
    
    allImages.forEach(img => {
      const mediaType = img.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
      const data = img.replace(/^data:[^;]+;base64,/, '');
      content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data } });
    });

    content.push({ type: 'text', text: prompt });

    const usedModel = model || (allImages.length ? MODEL_HAIKU : MODEL_SONNET);

    const resp = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: usedModel,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content }]
      })
    });

    if (!resp.ok) {
      if (resp.status === 401) throw new Error('API Key ungültig oder abgelaufen');
      throw new Error(`API Fehler ${resp.status}`);
    }

    const data = await resp.json();
    const text = data.content?.filter(c => c.type === 'text').map(c => c.text).join('') || '';

    // Kosten & Stats
    const usage = data.usage || {};
    const costTable = COST_TABLE[usedModel] || COST_TABLE[MODEL_HAIKU];
    const cost = ((usage.input_tokens || 0) / 1e6 * costTable.input) +
                 ((usage.output_tokens || 0) / 1e6 * costTable.output);

    state.apiCosts += cost;
    localStorage.setItem('bsp_apiCosts', state.apiCosts);
    emit('api:used', { cost, model: usedModel });

    return text;
  }

  return { process };
})();

// Zentrale Wrapper-Funktion für alle Scans
async function callClaude(params) {
  if (!(state.settings?._apiKey || localStorage.getItem('bsp_apikey'))) {
    throw new Error('Bitte zuerst API-Key in den Einstellungen eintragen');
  }
  return AI.process(params);
}

// Redundante ask-Funktion für Abwärtskompatibilität
async function ask(params) { return AI.process(params); }

// ── Bild komprimieren ────────────────────────────────────────
function b64toBlob(b64Data) {
  const parts = b64Data.split(',');
  const contentType = parts[0].split(':')[1].split(';')[0];
  const byteCharacters = atob(parts[1]);
  const byteArrays = [];
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
    }
    byteArrays.push(new Uint8Array(byteNumbers));
  }
  return new Blob(byteArrays, {type: contentType});
}

function compressImage(dataUrl, maxPx = 600, maxKB = 100) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let currentMaxPx = maxPx;
      
      const attempt = (px) => {
        const scale = Math.min(1, px / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

        let q = 0.6; // Startqualität wie gefordert
        let result;
        do {
          result = canvas.toDataURL('image/jpeg', q);
          if (result.length * 3 / 4 <= maxKB * 1024) return result;
          q -= 0.05;
        } while (q >= 0.35); // Hard limit 0.35

        return null; // Zu groß bei dieser Auflösung
      };

      let finalResult = attempt(currentMaxPx);
      
      // Wenn bei 0.35 noch zu groß, Auflösung iterativ reduzieren
      while (!finalResult && currentMaxPx > 200) {
        currentMaxPx -= 100;
        finalResult = attempt(currentMaxPx);
      }

      if (finalResult) {
        resolve(finalResult);
      } else {
        reject(new Error("Bild konnte nicht ausreichend komprimiert werden – bitte in besserer Beleuchtung neu fotografieren oder näher heranzoomen."));
      }
    };
    img.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
    img.src = dataUrl;
  });
}

// ── Navigation ───────────────────────────────────────────────
function showView(name, params = {}) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('on'));
  document.querySelectorAll('[data-nav]').forEach(n => n.classList.remove('on'));
  const view = document.getElementById('v-' + name);
  if (view) view.classList.add('on');
  const navItem = document.querySelector(`[data-nav="${name}"]`);
  if (navItem) navItem.classList.add('on');
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

// ── Öffentliche API ──────────────────────────────────────────
return {
  state,
  on, off, emit,
  registerModule, getModules, getContext,
  loadSettings, saveSetting, saveAllSettings,
  AI, callClaude, ask, compressImage, b64toBlob,
  encrypt, decrypt,
  isPremium, hasTokens, deductTokens,
  fm, fd, eh, fmK, cfg, toast, nextNr, showView,
  getTimeSaved, getCostComparison, getNextDeadline,
  gps, geocode, osrmRoute,
  init, safeInit, closeAllOverlays,
  _updateMwstSaldo
};

})();

// Globale Shortcuts für Module
const toast = BSP.toast.bind(BSP);
const fm = BSP.fm.bind(BSP);
const fd = BSP.fd.bind(BSP);
const eh = BSP.eh.bind(BSP);

// Global Export
window.BSP = BSP;
