// ══════════════════════════════════════════════════════════════
// MODUL: FEEDBACK
// Aufgaben 3+4+5 – Globaler Feedback-Button, Sheet, Übersicht, Prompt-Generator
//
// Kommuniziert NUR über BSP.* — kein direkter Zugriff auf andere Module
// DB-Store: feedback_eintraege (IndexedDB v3)
// Gemountet als: BSP.feedback
// ══════════════════════════════════════════════════════════════
'use strict';

const FeedbackModule = (() => {

// ── Konsolen-Abfang-System ────────────────────────────────────
const _logBuffer = [];
const _orig = { log: console.log, warn: console.warn, error: console.error };
['log','warn','error'].forEach(lvl => {
  console[lvl] = (...args) => {
    _logBuffer.push({ lvl, msg: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '), ts: Date.now() });
    if (_logBuffer.length > 50) _logBuffer.shift();
    _orig[lvl](...args);
  };
});
window.onerror = (msg, src, line, col, err) => {
  _logBuffer.push({ lvl:'exception', msg:`${msg} @ ${src}:${line}:${col}`, ts: Date.now() });
  if (typeof BSP !== 'undefined' && !BSP.cfg('disableAutoFeedback', false)) {
    if (typeof FeedbackModule !== 'undefined' && FeedbackModule._triggerAutoFeedback) {
      FeedbackModule._triggerAutoFeedback(msg);
    }
  }
};

// ── State ─────────────────────────────────────────────────────
let _recognition = null;    // Web Speech API Instanz
let _isRecording = false;
let _tooltipShown = localStorage.getItem('bsp_fb_tooltip') === '1';
let _sheetTyp = 'Änderungswunsch';
let _sheetPrio = 'Mittel';
let _currentScreenshot = null;
let _activeTab = 'Neu';
let _currentKontext = null;
let _currentKontextText = '';

let _swipeStartX = 0;
let _swipeCurrentX = 0;
let _swipeEl = null;

// ── Typ- und Prio-Farben ──────────────────────────────────────
const TYP_COLORS = {
  'Bug':              { bg: 'rgba(192,64,64,.12)',  border: 'rgba(192,64,64,.3)',  text: 'var(--red)' },
  'Änderungswunsch':  { bg: 'rgba(74,128,192,.12)', border: 'rgba(74,128,192,.3)', text: 'var(--blu)' },
  'Idee':             { bg: 'rgba(58,175,112,.12)', border: 'rgba(58,175,112,.3)', text: 'var(--grn)' },
  'Lob':              { bg: 'rgba(200,164,90,.12)', border: 'rgba(200,164,90,.3)', text: 'var(--gold)'},
};
const PRIO_COLORS = {
  'Hoch':    { color: 'var(--red)',  label: '🔴 Hoch' },
  'Mittel':  { color: 'var(--orn)',  label: '🟡 Mittel' },
  'Niedrig': { color: 'var(--grn)', label: '🟢 Niedrig' },
};

// ── Init ──────────────────────────────────────────────────────
function init() {
  _mountButton();
  // SW-Version in localStorage cachen (für getAktuellerKontext)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(reg => {
      const scope = reg.scope || '';
      const vMatch = scope.match(/v[\d.]+/);
      if (!vMatch) localStorage.setItem('bsp_sw_version', 'v4.3.0');
    }).catch(() => {});
  }
  localStorage.setItem('bsp_sw_version', 'v4.3.0');
  // Pillar-Tracking: wenn _setPillar aufgerufen wird, state.activePillar setzen
  BSP.on('pillar:changed', ({ pillar }) => { BSP.state.activePillar = pillar; });
  // Badge am Start updaten
  _updateBadge();
}

async function _updateBadge() {
  const all = (await BSP.dbGetAll('feedback_eintraege')) || [];
  const count = all.filter(e => e.status === 'Offen').length;
  
  const btn = document.getElementById('bsp-feedback-btn');
  if (!btn) return;

  let badge = document.getElementById('bsp-fb-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'bsp-fb-badge';
    badge.style.cssText = 'position:absolute;top:-4px;right:-4px;background:var(--red);color:#fff;font-size:10px;font-weight:bold;min-width:20px;height:20px;border-radius:10px;display:flex;align-items:center;justify-content:center;border:2px solid #2A6ADB';
    btn.appendChild(badge);
  }
  
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

// ── AUFGABE 3 – Floating Button ───────────────────────────────
function _mountButton() {
  if (document.getElementById('bsp-feedback-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'bsp-feedback-btn';
  btn.setAttribute('aria-label', 'Feedback & Ideen');
  btn.style.cssText = [
    'position:fixed',
    'bottom:calc(72px + env(safe-area-inset-bottom, 0px) + 8px)',
    'right:16px',
    'width:48px',
    'height:48px',
    'border-radius:50%',
    'background:#2A6ADB',
    'border:none',
    'box-shadow:0 4px 16px rgba(42,106,219,.45)',
    'cursor:pointer',
    'z-index:190',  // unter Scrim (z:900) und Sheet (z:500), über Nav (z:100)
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'transition:transform .22s cubic-bezier(.34,1.5,.64,1), opacity .2s',
    'opacity:1',
  ].join(';');

  // Sprechblasen-Icon (SVG) mit Stift
  btn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    <line x1="14" y1="9" x2="17" y2="6"/>
    <line x1="14" y1="9" x2="11" y2="12"/>
    <line x1="11" y1="12" x2="10" y2="14"/>
  </svg>`;

  btn.addEventListener('click', _onBtnClick);
  btn.addEventListener('pointerdown', () => { btn.style.transform = 'scale(0.92)'; });
  btn.addEventListener('pointerup', () => { btn.style.transform = 'scale(1)'; });

  document.body.appendChild(btn);

  // Tooltip beim ersten Mal (einmalig, 3 Sek)
  if (!_tooltipShown) {
    setTimeout(() => {
      const tip = document.createElement('div');
      tip.id = 'bsp-feedback-tooltip';
      tip.style.cssText = [
        'position:fixed',
        'bottom:calc(72px + env(safe-area-inset-bottom,0px) + 62px)',
        'right:8px',
        'background:#2A6ADB',
        'color:#fff',
        'font-size:11px',
        'font-weight:500',
        'padding:6px 12px',
        'border-radius:8px',
        'z-index:191',
        'white-space:nowrap',
        'box-shadow:0 2px 10px rgba(42,106,219,.4)',
        'pointer-events:none',
        'animation:fb-tip-in .3s ease',
      ].join(';');
      tip.textContent = '💬 Feedback & Ideen';
      if (!document.getElementById('bsp-fb-tip-css')) {
        const st = document.createElement('style');
        st.id = 'bsp-fb-tip-css';
        st.textContent = '@keyframes fb-tip-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}';
        document.head.appendChild(st);
      }
      document.body.appendChild(tip);
      setTimeout(() => { tip.style.opacity = '0'; tip.style.transition = 'opacity .4s'; setTimeout(() => tip.remove(), 400); }, 3000);
    }, 1200);
    _tooltipShown = true;
    localStorage.setItem('bsp_fb_tooltip', '1');
  }
}

// Deaktivieren wenn Mikrofon im Einsatz
function _setInactive(inactive) {
  const btn = document.getElementById('bsp-feedback-btn');
  if (!btn) return;
  btn.style.opacity = inactive ? '0.35' : '1';
  btn.style.pointerEvents = inactive ? 'none' : 'auto';
}

// ── AUFGABE 4 – Feedback-Sheet ────────────────────────────────
async function _onBtnClick() {
  const spracheAktiv = typeof SpracheUniversal !== 'undefined' && SpracheUniversal.isActive && SpracheUniversal.isActive();
  if (spracheAktiv) { BSP.toast('Spracheingabe aktiv – erst beenden', 'wr'); return; }

  _sheetTyp = 'Änderungswunsch';
  _sheetPrio = 'Mittel';
  _activeTab = 'Neu';

  if (typeof BSP !== 'undefined') BSP.showScrim('Erfasse Kontext…');
  _currentScreenshot = null;
  if (typeof window.html2canvas !== 'undefined') {
    try {
      const canvas = await window.html2canvas(document.body, { useCORS: true, logging: false });
      _currentScreenshot = canvas.toDataURL('image/jpeg', 0.6);
    } catch(e) { _orig.warn('html2canvas failed', e); }
  }
  if (typeof BSP !== 'undefined') BSP.hideScrim();

  _currentKontext = BSP.getAktuellerKontext();
  const pillarLabel = { business: 'Business', privat: 'Privat', archiv: 'Archiv', leben: 'Leben' };
  _currentKontextText = `${pillarLabel[_currentKontext.saeuler] || _currentKontext.saeuler} → ${_currentKontext.modul}`;

  _renderMasterSheet();
  _setInactive(true);
}

function _renderMasterSheet(prefill = '') {
  const isNeu = _activeTab === 'Neu';

  let rawContent = isNeu ? _buildTabNeuHtml(prefill) : `<div id="fb-list-container" style="min-height:200px;text-align:center;padding-top:40px;color:var(--txt3)">Lade Feedbacks…</div>`;

  const html = `
    <div class="sh"></div>
    <div style="font-size:17px;font-weight:200;letter-spacing:-.5px;margin-bottom:12px">Feedback & Ideen</div>
    
    <!-- TABS -->
    <div style="display:flex;gap:8px;margin-bottom:16px;background:var(--bg2);padding:4px;border-radius:100px">
      <button onclick="FeedbackModule._switchTab('Neu')"
        style="flex:1;padding:8px;border:none;border-radius:100px;background:${isNeu?'#2A6ADB':'transparent'};
        color:${isNeu?'#fff':'var(--txt2)'};font-size:12px;font-weight:600;cursor:pointer;transition:all .2s;box-shadow:${isNeu?'0 2px 8px rgba(0,0,0,.1)':'none'}">
        ✨ Neu
      </button>
      <button onclick="FeedbackModule._switchTab('Feedbacks')"
        style="flex:1;padding:8px;border:none;border-radius:100px;background:${!isNeu?'#2A6ADB':'transparent'};
        color:${!isNeu?'#fff':'var(--txt2)'};font-size:12px;font-weight:600;cursor:pointer;transition:all .2s;box-shadow:${!isNeu?'0 2px 8px rgba(0,0,0,.1)':'none'}">
        📋 Meine Feedbacks
      </button>
    </div>

    <div id="fb-tab-content">
      ${rawContent}
    </div>
  `;

  const existingSheet = document.getElementById('fb-master-wrapper');
  if (existingSheet) {
    existingSheet.innerHTML = html;
  } else {
    BSP.showSheet(`<div id="fb-master-wrapper">${html}</div>`);
  }

  if (!isNeu) {
    _loadFeedbacksIntoList();
  }
}

function _switchTab(tab) {
  _activeTab = tab;
  _stopMic();
  _renderMasterSheet();
}

function _buildTabNeuHtml(prefill = '') {
  const typen = ['Bug', 'Änderungswunsch', 'Idee', 'Lob'];
  const prios = ['Hoch', 'Mittel', 'Niedrig'];

  const typBtns = typen.map(t => {
    const c = TYP_COLORS[t];
    const isActive = t === _sheetTyp;
    return `<button id="fb-typ-${t.replace(/[^a-z]/gi,'')}"
      style="flex:1;padding:10px 4px;border:2px solid ${isActive ? c.border : 'var(--br)'};
      border-radius:var(--r8);background:${isActive ? c.bg : 'var(--bg3)'};
      color:${isActive ? c.text : 'var(--txt2)'};font-size:11px;cursor:pointer;transition:all .15s"
      onclick="FeedbackModule._selectTyp('${BSP.eh(t)}')">${BSP.eh(t)}</button>`;
  }).join('');

  const prioBtns = prios.map(p => {
    const c = PRIO_COLORS[p];
    const isActive = p === _sheetPrio;
    return `<button id="fb-prio-${p}"
      style="flex:1;padding:8px 4px;border:2px solid ${isActive ? c.color : 'var(--br)'};
      border-radius:var(--r8);background:${isActive ? c.color + '18' : 'var(--bg3)'};
      color:${isActive ? c.color : 'var(--txt2)'};font-size:11px;cursor:pointer;transition:all .15s"
      onclick="FeedbackModule._selectPrio('${p}')">${c.label}</button>`;
  }).join('');

  return `
    <!-- Kontext-Info (nicht editierbar) -->
    <div style="background:rgba(42,106,219,.08);border:1px solid rgba(42,106,219,.2);border-radius:var(--r8);
      padding:10px 12px;margin-bottom:16px;display:flex;align-items:center;gap:8px">
      <span style="font-size:16px">📍</span>
      <div>
        <div style="font-size:10px;color:#2A6ADB;text-transform:uppercase;letter-spacing:.5px;font-weight:600">Aktueller Kontext (automatisch)</div>
        <div style="font-size:12px;color:var(--txt)">${BSP.eh(_currentKontextText)}</div>
        <div style="font-size:10px;color:var(--txt3)">${_currentKontext.version} · ${new Date(_currentKontext.zeitstempel).toLocaleTimeString('de-DE')}</div>
      </div>
    </div>

    <!-- Typ-Auswahl -->
    <div style="font-size:10px;font-weight:600;color:var(--txt3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">Typ</div>
    <div style="display:flex;gap:6px;margin-bottom:14px">${typBtns}</div>

    <!-- Priorität -->
    <div style="font-size:10px;font-weight:600;color:var(--txt3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">Priorität</div>
    <div style="display:flex;gap:6px;margin-bottom:14px">${prioBtns}</div>

    <!-- Screenshot Toggle -->
    ${_currentScreenshot ? `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;background:var(--bg2);padding:10px;border-radius:var(--r8);border:1px solid var(--br)">
      <input type="checkbox" id="fb-inc-screenshot" checked style="accent-color:#2A6ADB;width:16px;height:16px;flex-shrink:0">
      <label for="fb-inc-screenshot" style="font-size:12px;color:var(--txt);flex:1">Screenshot mitschicken</label>
      <img src="${_currentScreenshot}" style="height:32px;border-radius:4px;border:1px solid var(--br)">
    </div>
    ` : ''}

    <!-- Eingabe -->
    <div style="font-size:10px;font-weight:600;color:var(--txt3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">Dein Feedback</div>
    <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
      <button id="fb-mic-btn"
        style="width:40px;height:40px;flex-shrink:0;border-radius:50%;background:var(--bg3);border:1px solid var(--br);
        color:var(--txt2);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;
        transition:all .2s"
        onclick="FeedbackModule._toggleMic()">🎙️</button>
      <div style="font-size:10px;color:var(--txt3);line-height:1.4">Tippen oder Sprache –<br>Transkription erscheint im Textfeld</div>
    </div>
    <div id="fb-rec-indicator" style="display:none;font-size:11px;color:var(--red);margin-bottom:4px;animation:bsp-spin 1s linear infinite;text-align:center">
      ● Aufnahme läuft…
    </div>
    <textarea id="fb-text" rows="4"
      style="width:100%;background:var(--bg3);border:1px solid var(--br);border-radius:var(--r8);
      padding:10px 12px;color:var(--txt);font-size:13px;font-family:Inter,sans-serif;
      font-weight:300;outline:none;resize:vertical;box-sizing:border-box;line-height:1.5;margin-bottom:16px"
      placeholder="Was ist aufgefallen? Was würde dir helfen?">${BSP.eh(prefill)}</textarea>

    <!-- Speichern -->
    <button onclick="FeedbackModule._saveEntry()"
      style="width:100%;padding:16px;border:none;border-radius:var(--r16);background:#2A6ADB;
      color:#fff;font-size:15px;font-weight:500;cursor:pointer;letter-spacing:.2px;
      display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:8px">
      💾 Feedback speichern
    </button>
    <button class="btn btn-g" style="width:100%;justify-content:center"
      onclick="BSP.closeSheet();FeedbackModule._onSheetClose()">Abbrechen</button>
    <div style="height:140px;flex-shrink:0;pointer-events:none"></div>
  `;
}

// Typ / Prio-Auswahl (live in Sheet)
function _selectTyp(typ) {
  _sheetTyp = typ;
  const typen = ['Bug', 'Änderungswunsch', 'Idee', 'Lob'];
  typen.forEach(t => {
    const btn = document.getElementById('fb-typ-' + t.replace(/[^a-z]/gi, ''));
    if (!btn) return;
    const c = TYP_COLORS[t];
    const isActive = t === typ;
    btn.style.borderColor = isActive ? c.border : 'var(--br)';
    btn.style.background  = isActive ? c.bg   : 'var(--bg3)';
    btn.style.color       = isActive ? c.text : 'var(--txt2)';
  });
}

function _selectPrio(prio) {
  _sheetPrio = prio;
  ['Hoch', 'Mittel', 'Niedrig'].forEach(p => {
    const btn = document.getElementById('fb-prio-' + p);
    if (!btn) return;
    const c = PRIO_COLORS[p];
    const isActive = p === prio;
    btn.style.borderColor = isActive ? c.color : 'var(--br)';
    btn.style.background  = isActive ? c.color + '18' : 'var(--bg3)';
    btn.style.color       = isActive ? c.color : 'var(--txt2)';
  });
}

// ── Mikrofon (Spracheingabe) ─────────────────────────────────
function _toggleMic() {
  if (_isRecording) { _stopMic(); return; }
  _startMic();
}

function _startMic() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) { BSP.toast('Sprache nicht unterstützt', 'wr'); return; }

  _recognition = new SpeechRecognition();
  _recognition.lang = 'de-DE';
  _recognition.continuous = true;
  _recognition.interimResults = true;

  const micBtn = document.getElementById('fb-mic-btn');
  const recInd = document.getElementById('fb-rec-indicator');
  const textarea = document.getElementById('fb-text');
  if (micBtn) { micBtn.textContent = '⏹️'; micBtn.style.background = 'rgba(192,64,64,.15)'; micBtn.style.borderColor = 'var(--red)'; }
  if (recInd) recInd.style.display = 'block';

  let baseText = textarea ? textarea.value : '';

  _recognition.onresult = e => {
    let interim = '';
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) final += e.results[i][0].transcript;
      else interim += e.results[i][0].transcript;
    }
    if (final) baseText += (baseText ? ' ' : '') + final.trim();
    if (textarea) textarea.value = baseText + (interim ? ' ' + interim : '');
  };

  _recognition.onerror = () => { _stopMic(); };
  _recognition.onend = () => { if (_isRecording) _recognition.start(); }; // Continuous

  _recognition.start();
  _isRecording = true;
}

function _stopMic() {
  if (_recognition) { _recognition.onend = null; _recognition.stop(); _recognition = null; }
  _isRecording = false;
  const micBtn = document.getElementById('fb-mic-btn');
  const recInd = document.getElementById('fb-rec-indicator');
  if (micBtn) { micBtn.textContent = '🎙️'; micBtn.style.background = 'var(--bg3)'; micBtn.style.borderColor = 'var(--br)'; }
  if (recInd) recInd.style.display = 'none';
}

// ── Speichern ────────────────────────────────────────────────
async function _saveEntry() {
  _stopMic();
  const textarea = document.getElementById('fb-text');
  const text = (textarea ? textarea.value : '').trim();
  if (!text) { BSP.toast('Bitte zuerst Feedback eingeben', 'wr'); return; }

  let logsToSave = [..._logBuffer];
  logsToSave = logsToSave.sort((a,b) => {
    const isErrA = a.lvl==='error'||a.lvl==='exception';
    const isErrB = b.lvl==='error'||b.lvl==='exception';
    if (isErrA && !isErrB) return -1;
    if (!isErrA && isErrB) return 1;
    return b.ts - a.ts; // neuere zuerst
  }).slice(0, 20).sort((a,b) => a.ts - b.ts); // wieder chronologisch

  const incScreenshot = document.getElementById('fb-inc-screenshot')?.checked;

  const kontext = BSP.getAktuellerKontext();
  const eintrag = {
    text,
    kontext_saeuler: kontext.saeuler,
    kontext_modul:   kontext.modul,
    kontext_aktion:  kontext.aktion,
    zeitstempel:     kontext.zeitstempel,
    app_version:     kontext.version,
    typ:             _sheetTyp,
    prioritaet:      _sheetPrio,
    status:          'Offen',
    screenshot_b64:  (incScreenshot && _currentScreenshot) ? _currentScreenshot : null,
    konsolen_log:    logsToSave
  };

  await BSP.dbAdd('feedback_eintraege', eintrag);
  
  _stopMic();
  _updateBadge(); // Badge updaten

  // Nach dem Speichern automatisch in Tab "Meine Feedbacks" springen
  _activeTab = 'Feedbacks';
  _renderMasterSheet();

  BSP.toast('Feedback gespeichert – Danke! 💙', 'ok');
  BSP.emit('feedback:saved');
}

function _onSheetClose() {
  _stopMic();
  _setInactive(false);
}

// ── Tab 2: Listen-Übersicht ──────────────────────────────────
async function _loadFeedbacksIntoList() {
  const container = document.getElementById('fb-list-container');
  if (!container) return;

  const all = (await BSP.dbGetAll('feedback_eintraege')) || [];
  all.sort((a, b) => (b.zeitstempel || '').localeCompare(a.zeitstempel || ''));

  const count = all.length;
  const offen = all.filter(e => e.status === 'Offen').length;

  const listHTML = all.length === 0
    ? '<div class="empty" style="padding:24px 0;text-align:center;color:var(--txt3)">Noch keine Einträge.</div>'
    : all.map(e => _renderEintrag(e)).join('');

  container.innerHTML = `
    <div style="font-size:12px;color:var(--txt3);margin-bottom:16px">${count} gespeicherte Einträge · ${offen} offen</div>
    
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:24px;overflow-x:hidden">
      ${listHTML}
    </div>

    <!-- Prompt-Generator Bereich -->
    <button onclick="FeedbackModule._generatePrompt()"
      style="width:100%;padding:16px;border:none;border-radius:var(--r16);background:#2A6ADB;
      color:#fff;font-size:15px;font-weight:500;cursor:pointer;letter-spacing:.2px;
      display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:16px">
      ⚡ Prompt generieren
    </button>
    <textarea id="fb-prompt-output" rows="8"
      style="display:none;width:100%;background:var(--bg2);border:1px solid var(--br);border-radius:var(--r8);
      padding:10px;color:var(--txt);font-size:11px;font-family:'DM Mono',monospace;
      resize:vertical;box-sizing:border-box;outline:none;line-height:1.6;margin-bottom:8px"></textarea>
    <button id="fb-copy-btn" onclick="FeedbackModule._copyPrompt()"
      style="display:none;width:100%;padding:12px;border:1px solid #2A6ADB;border-radius:var(--r8);
      background:transparent;color:#2A6ADB;font-size:13px;cursor:pointer;margin-bottom:8px">
      📋 Prompt kopieren
    </button>
    
    <button class="btn btn-g" style="width:100%;justify-content:center;margin-bottom:24px" onclick="BSP.closeSheet();FeedbackModule._onSheetClose()">Schließen</button>
    <div style="height:140px;flex-shrink:0;pointer-events:none"></div>
  `;
}

function _renderEintrag(e) {
  const c  = TYP_COLORS[e.typ]  || TYP_COLORS['Idee'];
  const pc = PRIO_COLORS[e.prioritaet] || PRIO_COLORS['Mittel'];
  const d  = e.zeitstempel ? new Date(e.zeitstempel).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '–';
  const pillarLabel = { business: 'Business', privat: 'Privat', archiv: 'Archiv', leben: 'Leben' };

  const screenshotThumb = e.screenshot_b64 ? `<img src="${e.screenshot_b64}" style="width:100%;border-radius:4px;border:1px solid var(--br);margin-bottom:8px">` : '';
  const hasLog = e.konsolen_log && e.konsolen_log.length > 0;

  return `
    <div class="fb-item-wrap" style="position:relative;margin-bottom:2px;border-radius:var(--r12);overflow:hidden">
      <!-- Background Delete Icon -->
      <div style="position:absolute;top:0;right:0;bottom:0;width:100px;background:var(--red);color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;border-radius:var(--r12)">
        🗑️
      </div>
      
      <!-- Foreground Content -->
      <div class="fb-item-front" data-id="${e.id}"
        style="position:relative;background:var(--bg3);border:1px solid var(--br);border-radius:var(--r12);padding:12px;z-index:2;transform:translateX(0)"
        ontouchstart="FeedbackModule._ts(event)" ontouchmove="FeedbackModule._tm(event)" ontouchend="FeedbackModule._te(event)"
        onclick="FeedbackModule._toggleDetails(${e.id})">
        
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;align-items:center">
          <span style="background:${c.bg};border:1px solid ${c.border};color:${c.text};font-size:9px;padding:2px 8px;border-radius:100px;font-weight:600">${BSP.eh(e.typ||'–')}</span>
          <span style="color:${pc.color};font-size:9px;font-weight:600">${pc.label}</span>
          <span style="font-size:9px;color:var(--txt3);margin-left:auto">${d}</span>
        </div>
        <div style="font-size:10px;color:#2A6ADB;margin-bottom:6px">
          📍 ${pillarLabel[e.kontext_saeuler]||e.kontext_saeuler||'?'} → ${BSP.eh(e.kontext_modul||'?')}
        </div>
        <!-- Summary Text -->
        <div style="font-size:12px;color:var(--txt);line-height:1.5;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${BSP.eh(e.text||'')}</div>
        
        <!-- Details (Hidden Default) -->
        <div id="fb-det-${e.id}" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--br)">
          <div style="font-size:12px;color:var(--txt);line-height:1.5;margin-bottom:8px;white-space:pre-wrap">${BSP.eh(e.text||'')}</div>
          ${e.screenshot_b64 ? `<div style="margin-bottom:8px">${screenshotThumb}</div>` : ''}
          ${hasLog ? `
            <div style="font-size:10px;color:var(--txt3);margin-bottom:4px">Konsolen-Log:</div>
            <div style="background:var(--bg2);color:var(--txt2);font-family:monospace;font-size:9px;padding:8px;border-radius:4px;max-height:120px;overflow-y:auto;white-space:pre-wrap">${e.konsolen_log.map(l => `[${l.lvl}] ${BSP.eh(l.msg)}`).join('\n')}</div>
          ` : ''}
          <div style="font-size:10px;color:var(--txt3);text-align:right;margin-top:8px">Wischen zum Löschen ⬅️</div>
        </div>
      </div>
    </div>
  `;
}

function _toggleDetails(id) {
  const det = document.getElementById('fb-det-' + id);
  if (det) {
    det.style.display = det.style.display === 'none' ? 'block' : 'none';
  }
}

// ── Swipe to delete Logic ─────────────────────────────────────
function _ts(e) {
  _swipeEl = e.currentTarget;
  _swipeStartX = e.touches[0].clientX;
  _swipeEl.style.transition = 'none';
}
function _tm(e) {
  if (!_swipeEl) return;
  _swipeCurrentX = e.touches[0].clientX - _swipeStartX;
  if (_swipeCurrentX < 0) { // only swipe left
    _swipeEl.style.transform = `translateX(${_swipeCurrentX}px)`;
  }
}
function _te(e) {
  if (!_swipeEl) return;
  _swipeEl.style.transition = 'transform 0.2s ease-out';
  if (_swipeCurrentX < -80) { // Delete threshold
    _swipeEl.style.transform = `translateX(-100%)`;
    const id = parseInt(_swipeEl.dataset.id);
    setTimeout(() => {
      _deleteOne(id);
    }, 200); // Wait for animation
  } else {
    _swipeEl.style.transform = `translateX(0)`; // Snap back
  }
  _swipeEl = null;
}

// ── Einzelnen Eintrag löschen ─────────────────────────────────
async function _deleteOne(id) {
  await BSP.dbDelete('feedback_eintraege', id);
  BSP.toast('Eintrag gelöscht', 'ok');
  _updateBadge();
  _loadFeedbacksIntoList(); // Refresh list
}

// ── Prompt-Generator ─────────────────────────────────────────
async function _generatePrompt() {
  const all = (await BSP.dbGetAll('feedback_eintraege')) || [];
  const offen = all.filter(e => e.status !== 'Erledigt');

  if (offen.length === 0) {
    BSP.toast('Keine offenen Einträge', 'wr');
    return;
  }

  const now = new Date().toLocaleDateString('de-DE');
  const version = BSP.getAktuellerKontext().version;

  // Gruppieren nach Typ und Modul
  const bugs    = offen.filter(e => e.typ === 'Bug').sort((a,b) => _prioSort(a) - _prioSort(b));
  const changes = offen.filter(e => e.typ === 'Änderungswunsch').sort((a,b) => _prioSort(a) - _prioSort(b));
  const ideas   = offen.filter(e => e.typ === 'Idee');
  const lobs    = offen.filter(e => e.typ === 'Lob');

  let prompt = `FEEDBACK-BASIERTER PROMPT – Generiert am ${now}\n`;
  prompt += `App-Version: ${version}\n`;
  prompt += `Gesamt: ${offen.length} Einträge (${bugs.length} Bugs, ${changes.length} Änderungen, ${ideas.length} Ideen, ${lobs.length} Lob)\n`;
  prompt += `\n${'═'.repeat(60)}\n`;

  // Fehlersammlung für Konsolen-Log
  const allErrors = [];
  offen.forEach(e => {
    if (e.konsolen_log) {
      e.konsolen_log.forEach(log => {
        if (log.lvl === 'error' || log.lvl === 'exception') {
          const normStr = log.msg.replace(/@.*/, '').trim(); 
          allErrors.push({ norm: normStr, orig: log.msg, ts: log.ts, id: e.id });
        }
      });
    }
  });

  const errGroups = {};
  allErrors.forEach(err => {
    if (!errGroups[err.norm]) errGroups[err.norm] = [];
    errGroups[err.norm].push(err);
  });

  const groupedErrorsText = Object.entries(errGroups)
    .filter(([norm, arr]) => arr.length > 0)
    .sort((a,b) => b[1].length - a[1].length)
    .map(([norm, arr]) => {
      const isRecurring = arr.length > 1;
      return `  - ${isRecurring ? '[WIEDERKEHRENDER FEHLER] ' + arr.length + 'x : ' : ''}${arr[0].orig}`;
    }).join('\n');

  if (groupedErrorsText) {
    prompt += `\n🚨 KONSOLEN-FEHLER beim Feedback-Zeitpunkt:\n${'─'.repeat(40)}\n${groupedErrorsText}\n`;
  }

  if (bugs.length > 0) {
    prompt += `\n🔴 KRITISCH – BUGS:\n${'─'.repeat(40)}\n`;
    const byModule = _groupByModule(bugs);
    for (const [modul, items] of Object.entries(byModule)) {
      prompt += `\n  Modul: ${modul.toUpperCase()}\n`;
      items.forEach((e, i) => {
        prompt += `  ${i+1}. [${e.prioritaet}] ${e.text}\n`;
        prompt += `     Kontext: ${e.kontext_saeuler} → ${e.kontext_modul} | ${e.zeitstempel?.slice(0,16) || '–'}\n`;
      });
    }
  }

  if (changes.length > 0) {
    prompt += `\n🔵 ÄNDERUNGSWÜNSCHE:\n${'─'.repeat(40)}\n`;
    const byModule = _groupByModule(changes);
    for (const [modul, items] of Object.entries(byModule)) {
      prompt += `\n  Modul: ${modul.toUpperCase()}\n`;
      items.forEach((e, i) => {
        prompt += `  ${i+1}. [${e.prioritaet}] ${e.text}\n`;
        prompt += `     Kontext: ${e.kontext_saeuler} → ${e.kontext_modul} | ${e.zeitstempel?.slice(0,16) || '–'}\n`;
      });
    }
  }

  if (ideas.length > 0) {
    prompt += `\n🟢 IDEEN:\n${'─'.repeat(40)}\n`;
    ideas.forEach((e, i) => {
      prompt += `  ${i+1}. [${e.prioritaet}] ${e.text}\n`;
      prompt += `     Kontext: ${e.kontext_saeuler} → ${e.kontext_modul} | ${e.zeitstempel?.slice(0,16) || '–'}\n`;
    });
  }

  if (lobs.length > 0) {
    prompt += `\n💛 LOB:\n${'─'.repeat(40)}\n`;
    lobs.forEach((e, i) => {
      prompt += `  ${i+1}. ${e.text}\n`;
    });
  }

  prompt += `\n${'═'.repeat(60)}\n`;
  prompt += `KONTEXT PRO EINTRAG:\n`;
  offen.forEach((e, i) => {
    const pillarLabel = { business: 'Business', privat: 'Privat', archiv: 'Archiv', leben: 'Leben' };
    prompt += `  ${i+1}. [${e.typ}/${e.prioritaet}] ${pillarLabel[e.kontext_saeuler]||e.kontext_saeuler} → ${e.kontext_modul} → ${e.kontext_aktion} | ${e.zeitstempel?.slice(0,16) || '–'}\n`;
  });

  // Status aller einbezogenen Einträge auf "In Prompt aufgenommen" setzen
  for (const e of offen) {
    if (e.status === 'Offen') {
      e.status = 'In Prompt aufgenommen';
      await BSP.dbPut('feedback_eintraege', e);
    }
  }

  // Nach Generierung Badge anpassen (sind jetzt "In Prompt aufgenommen", nicht "Offen")
  _updateBadge();

  // Im Sheet anzeigen
  const outputEl = document.getElementById('fb-prompt-output');
  const copyBtn  = document.getElementById('fb-copy-btn');
  if (outputEl) {
    outputEl.value = prompt;
    outputEl.style.display = 'block';
  }
  if (copyBtn) copyBtn.style.display = 'block';
  BSP.toast('Prompt generiert ✓', 'ok');
}

function _groupByModule(items) {
  return items.reduce((acc, e) => {
    const key = e.kontext_modul || 'unbekannt';
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});
}

function _prioSort(e) {
  return { 'Hoch': 0, 'Mittel': 1, 'Niedrig': 2 }[e.prioritaet] ?? 1;
}

// ── Kopieren ─────────────────────────────────────────────────
async function _copyPrompt() {
  const el = document.getElementById('fb-prompt-output');
  if (!el || !el.value) return;
  try {
    await navigator.clipboard.writeText(el.value);
    BSP.toast('Prompt kopiert ✓', 'ok');
  } catch {
    el.select(); document.execCommand('copy');
    BSP.toast('Prompt kopiert ✓', 'ok');
  }
}

// ── Auto-Trigger bei Absturz ──────────────────────────────────
async function _triggerAutoFeedback(errMessage) {
  if (document.getElementById('bsp-sheet')) return;
  
  _sheetTyp = 'Bug';
  _sheetPrio = 'Hoch';
  _activeTab = 'Neu';
  
  _currentScreenshot = null;
  if (typeof window.html2canvas !== 'undefined') {
    try {
      const canvas = await window.html2canvas(document.body, { useCORS: true, logging: false });
      _currentScreenshot = canvas.toDataURL('image/jpeg', 0.6);
    } catch(e) {}
  }

  _currentKontext = BSP.getAktuellerKontext();
  const pillarLabel = { business: 'Business', privat: 'Privat', archiv: 'Archiv', leben: 'Leben' };
  _currentKontextText = `${pillarLabel[_currentKontext.saeuler] || _currentKontext.saeuler} → ${_currentKontext.modul}`;

  _renderMasterSheet("Automatisch erkannter Fehler – bitte kurz beschreiben was du gerade gemacht hast.");
  _setInactive(true);
}

// ── Public API ────────────────────────────────────────────────
return {
  init,
  _switchTab,
  _selectTyp, _selectPrio,
  _toggleMic,
  _saveEntry, _onSheetClose,
  _deleteOne,
  _ts, _tm, _te, _toggleDetails,
  _generatePrompt, _copyPrompt,
  _setInactive,
  _triggerAutoFeedback,
};

})();
