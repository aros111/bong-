// ══════════════════════════════════════════════════════════════
// MODUL: SCANNER
// Foto-Scan mit Kamera/Galerie + KI-Analyse via BSP.ask()
// Kommuniziert NUR über BSP.* — feuert beleg:saved nach Speichern
// ══════════════════════════════════════════════════════════════
'use strict';

const ScannerModule = (() => {

let _camStream = null;
let _pages = []; // Array von {b64, thumb}
let _lastResult = null;
let _scanMode = 'er'; // 'er' | 'ar' | 'manual'

// ── HTML-Template des Scanner-Overlays ──────────────────────
const OVERLAY_HTML = `
<div class="sh" style="margin:12px auto 8px"></div>
<div style="display:flex;align-items:center;justify-content:space-between;padding:0 16px 12px">
  <!-- Typ-Auswahl -->
  <div style="display:flex;background:var(--s2);border:1px solid var(--br);border-radius:100px;padding:2px;gap:2px" id="sc-seg">
    <button class="sc-type-btn on" id="sc-t-er" onclick="ScannerModule.setType('er')">Eingang</button>
    <button class="sc-type-btn" id="sc-t-ar" onclick="ScannerModule.setType('ar')">Ausgang</button>
    <button class="sc-type-btn" id="sc-t-manual" onclick="ScannerModule.setType('manual')">Manuell</button>
  </div>
  <button onclick="ScannerModule.close()" style="background:var(--s3);border:1px solid var(--br);color:var(--txt2);width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0">×</button>
</div>

<!-- Kamera-Bereich -->
<div id="sc-cam-wrap" style="position:relative;background:#000;min-height:200px;overflow:hidden">
  <video id="sc-video" autoplay playsinline muted style="width:100%;display:none;max-height:260px;object-fit:cover"></video>
  <img id="sc-preview" style="width:100%;display:none;max-height:260px;object-fit:contain;background:#111" alt="Vorschau">
  <!-- Platzhalter -->
  <div id="sc-ph" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;color:var(--txt3);gap:10px">
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="opacity:.4">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
    <div style="font-size:12px;font-weight:300">Beleg fotografieren oder aus Galerie wählen</div>
    <!-- Buttons im Platzhalter -->
    <div style="display:flex;gap:8px;margin-top:4px">
      <button class="btn btn-gold btn-sm" onclick="ScannerModule.startCam()">📷 Kamera</button>
      <label class="btn btn-g btn-sm" style="cursor:pointer">
        🖼️ Galerie <input id="sc-file" type="file" accept="image/*" style="display:none" onchange="ScannerModule.loadFile(this)">
      </label>
    </div>
  </div>
  <!-- Kamera-Overlay-Buttons -->
  <div id="sc-cam-btns" style="display:none;position:absolute;bottom:10px;left:50%;transform:translateX(-50%);display:none;gap:12px;align-items:center">
    <button class="btn btn-g btn-sm" onclick="ScannerModule.stopCam()">⏹ Stopp</button>
    <button onclick="ScannerModule.capture()" id="sc-shutter"
      style="width:56px;height:56px;border-radius:50%;background:var(--txt);border:3px solid var(--br2);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .1s">
      <div style="width:38px;height:38px;border-radius:50%;background:var(--txt);border:2px solid #333"></div>
    </button>
    <div style="color:var(--txt);font-size:10px;background:rgba(0,0,0,0.5);padding:2px 8px;border-radius:10px" id="sc-page-counter">Seite 1</div>
  </div>
</div>

<!-- Multi-Page Prompt -->
<div id="sc-multi-prompt" style="display:none;padding:16px;background:var(--bg3);border-bottom:1px solid var(--br);text-align:center">
  <div style="font-size:13px;margin-bottom:12px;color:var(--accent2)">Seite hinzugefügt! Noch eine Seite scannen?</div>
  <div style="display:flex;gap:12px;justify-content:center">
    <button class="btn btn-g btn-sm" onclick="ScannerModule.startCam()">➕ Weitere Seite</button>
    <button class="btn btn-gold btn-sm" onclick="ScannerModule.finishCapture()">✨ Fertig & Analyse</button>
  </div>
</div>

<!-- Fortschritts-Bar -->
<div id="sc-prog-wrap" style="display:none;padding:10px 16px">
  <div style="background:var(--s3);border-radius:4px;height:3px;overflow:hidden;margin-bottom:6px">
    <div id="sc-prog-fill" style="height:100%;background:var(--gold);width:0%;transition:width .3s"></div>
  </div>
  <div id="sc-prog-log" style="font-size:11px;color:var(--txt3);text-align:center">Bereit</div>
</div>

<!-- Ergebnis-Felder (Business ER/AR) -->
<div id="sc-res-biz" style="display:none;padding:0 16px 16px">
  <div class="g2 sett-mt">
    <div class="field"><label>Händler</label><input id="sc-shop" class="sett-inp" type="text" list="sc-shop-list" oninput="ScannerModule.suggestShops(this.value)">
      <datalist id="sc-shop-list"></datalist></div>
    <div class="field"><label>Datum</label><input id="sc-date" class="sett-inp" type="date"></div>
  </div>
  <div class="g2 sett-mt">
    <div class="field"><label>Brutto (€)</label><input id="sc-brutto" class="sett-inp" type="text" inputmode="decimal" oninput="ScannerModule.calcMwst()"></div>
    <div class="field"><label>Netto (€)</label><input id="sc-net" class="sett-inp" type="text" inputmode="decimal" readonly style="opacity:.7"></div>
  </div>
  <div class="g2 sett-mt">
    <div class="field"><label>MwSt (€)</label><input id="sc-mwst" class="sett-inp" type="text" inputmode="decimal" readonly style="opacity:.7"></div>
    <div class="field"><label>MwSt-Satz</label>
      <select id="sc-rate" class="sett-inp" onchange="ScannerModule.calcMwst()">
        <option value="19">19% (Standard)</option>
        <option value="7">7% (ermäßigt)</option>
        <option value="0">0% (Reverse Charge)</option>
      </select>
    </div>
  </div>
  <div class="g2 sett-mt">
    <div class="field"><label>Kategorie</label>
      <select id="sc-cat" class="sett-inp">
        <option>Bürobedarf</option><option>Software</option><option>Hardware</option>
        <option>Beratung</option><option>Marketing</option><option>Reisen</option>
        <option>Fortbildung</option><option>Fahrzeug</option><option>Telefon/Internet</option>
        <option>Bewirtung</option><option>Restaurant</option><option>Lebensmittel</option>
        <option>Gesundheit</option><option>Sonstiges</option>
      </select>
    </div>
    <div class="field"><label>Zahlung</label>
      <select id="sc-pay" class="sett-inp">
        <option>Karte</option><option>Bar</option><option>Überweisung</option><option>Online</option>
      </select>
    </div>
  </div>
  <div class="field sett-mt"><label>Belegnr. extern (optional)</label><input id="sc-bleg-ext" class="sett-inp" type="text" placeholder="z.B. RE-2026-0042"></div>
  
  <!-- Beleg-Split (Business <-> Privat) -->
  <div class="field sett-mt" style="background:rgba(200,164,90,.05);border-color:rgba(200,164,90,.2)">
    <label style="color:var(--gold)">Privat-Anteil (%)</label>
    <div style="display:flex;align-items:center;gap:12px">
      <input id="sc-split-pct" class="sett-inp" type="number" value="0" min="0" max="100" oninput="ScannerModule.updateSplit()">
      <div id="sc-split-val" style="font-size:12px;color:var(--txt2);white-space:nowrap">0,00 € Privat</div>
    </div>
  </div>
  
  <!-- Reverse Charge -->
  <div id="sc-rc-hint" style="display:none;background:rgba(192,112,48,.08);border:1px solid rgba(192,112,48,.25);border-radius:var(--r8);padding:10px 12px;margin-top:8px;font-size:11px;color:var(--orn)">
    ⚠️ Reverse Charge erkannt — Beleg wird gemäß UStVA Z.52/67 separat ausgewiesen
  </div>

  <!-- Erkannte Positionen -->
  <div id="sc-items-sec" style="display:none;margin-top:10px">
    <div class="stitle">Erkannte Positionen</div>
    <div id="sc-items-body"></div>
  </div>

  <!-- Buttons -->
  <div style="display:flex;gap:8px;margin-top:14px">
    <button class="btn btn-g" style="flex:.5" onclick="ScannerModule.reset()">↺ Neu</button>
    <button class="btn btn-gold" style="flex:1;justify-content:center" onclick="ScannerModule.save()">✓ Speichern</button>
  </div>
</div>

<!-- Ergebnis-Felder (Privat) -->
<div id="sc-res-priv" style="display:none;padding:0 16px 16px">
  <div class="g2 sett-mt">
    <div class="field"><label>Händler</label><input id="sc-p-shop" class="sett-inp" type="text"></div>
    <div class="field"><label>Datum</label><input id="sc-p-date" class="sett-inp" type="date"></div>
  </div>
  <div class="g2 sett-mt">
    <div class="field"><label>Betrag (€)</label><input id="sc-p-brutto" class="sett-inp" type="text" inputmode="decimal"></div>
    <div class="field"><label>Kategorie</label>
      <select id="sc-p-cat" class="sett-inp">
        <option>Lebensmittel</option><option>Restaurant</option><option>Elektronik</option>
        <option>Kleidung</option><option>Tanken</option><option>Haushalt</option>
        <option>Gesundheit</option><option>Freizeit</option><option>Reise</option><option>Sonstiges</option>
      </select>
    </div>
  </div>
  <div style="display:flex;gap:8px;margin-top:14px">
    <button class="btn btn-g" style="flex:.5" onclick="ScannerModule.reset()">↺ Neu</button>
    <button class="btn btn-gold" style="flex:1;justify-content:center" onclick="ScannerModule.save()">✓ Speichern</button>
  </div>
</div>
`;

// ── Init ─────────────────────────────────────────────────────
function init() {
  // Overlay-Inhalt einhängen
  const ovl = document.getElementById('scan-ovl');
  if (ovl) {
    ovl.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:300;flex-direction:column;overflow-y:auto;padding-top:env(safe-area-inset-top,0px)';
    const sheet = document.createElement('div');
    sheet.style.cssText = 'background:var(--s1);border-radius:var(--r24) var(--r24) 0 0;margin-top:auto;max-height:95vh;overflow-y:auto;position:relative;';
    sheet.innerHTML = OVERLAY_HTML;
    ovl.appendChild(sheet);
    ovl.addEventListener('click', e => { if (e.target === ovl) close(); });
  }

  // CSS für sc-type-btn einfügen
  if (!document.getElementById('sc-css')) {
    const st = document.createElement('style');
    st.id = 'sc-css';
    st.textContent = `.sc-type-btn{font-family:'Inter',sans-serif;font-size:11px;font-weight:300;padding:5px 12px;border:none;border-radius:100px;cursor:pointer;color:var(--txt3);background:transparent;transition:all .2s;letter-spacing:.2px}.sc-type-btn.on{background:var(--s3);color:var(--gold)}`;
    document.head.appendChild(st);
  }
}

// ── Öffnen / Schließen ───────────────────────────────────────
function open() {
  const ovl = document.getElementById('scan-ovl');
  if (ovl) { ovl.style.display = 'flex'; ovl.scrollTop = 0; }
  setType('er');
  // Datum heute setzen
  const today = new Date().toISOString().split('T')[0];
  ['sc-date', 'sc-p-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = today;
  });
}

function openManuell() { open(); setType('manual'); }

function close() {
  stopCam();
  const ovl = document.getElementById('scan-ovl');
  if (ovl) ovl.style.display = 'none';
}

// ── Scan-Typ setzen ──────────────────────────────────────────
function setType(t) {
  _scanMode = t;
  const isManual = t === 'manual';
  const isBiz = t === 'er' || t === 'ar';

  // Segment-Buttons
  ['er', 'ar', 'manual'].forEach(x => {
    const btn = document.getElementById('sc-t-' + x);
    if (btn) btn.classList.toggle('on', x === t);
  });

  // Sichtbarkeit
  const seg = document.getElementById('sc-seg');
  // bei manual: Segment trotzdem zeigen (Nutzer kann Typ wechseln)

  const camWrap = document.getElementById('sc-cam-wrap');
  if (camWrap) camWrap.style.display = isManual ? 'none' : 'block';

  const progWrap = document.getElementById('sc-prog-wrap');
  if (progWrap) progWrap.style.display = 'none';

  const resBiz = document.getElementById('sc-res-biz');
  const resPriv = document.getElementById('sc-res-priv'); // nur für privaten Modus via Sprache/manuel

  // Im Biz-Scanner: immer biz-Felder
  // Im manuellen Modus auch biz-Felder
  if (resBiz) resBiz.style.display = (isBiz || isManual) ? 'block' : 'none';
  if (resPriv) resPriv.style.display = 'none';

  // Bei manual: Felder direkt zeigen
  if (isManual) {
    const today = new Date().toISOString().split('T')[0];
    const dateEl = document.getElementById('sc-date');
    if (dateEl && !dateEl.value) dateEl.value = today;
  } else if (isBiz) {
    // Felder erst nach Scan zeigen
    if (resBiz) resBiz.style.display = 'none';
    const ph = document.getElementById('sc-ph');
    if (ph) ph.style.display = 'flex';
  }
}

// ── Kamera ────────────────────────────────────────────────────
async function startCam() {
  try {
    _camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } }
    });
    const v = document.getElementById('sc-video');
    if (v) { v.srcObject = _camStream; v.style.display = 'block'; }
    const ph = document.getElementById('sc-ph');
    if (ph) ph.style.display = 'none';
    const btns = document.getElementById('sc-cam-btns');
    if (btns) btns.style.display = 'flex';
    const prevEl = document.getElementById('sc-preview');
    if (prevEl) prevEl.style.display = 'none';
  } catch(e) {
    BSP.toast('Kamera nicht verfügbar – bitte Galerie nutzen', 'er');
  }
}

function stopCam() {
  if (_camStream) {
    _camStream.getTracks().forEach(t => t.stop());
    _camStream = null;
  }
  const v = document.getElementById('sc-video');
  if (v) { v.style.display = 'none'; v.srcObject = null; }
  const btns = document.getElementById('sc-cam-btns');
  if (btns) btns.style.display = 'none';
  if (!_capB64) {
    const ph = document.getElementById('sc-ph'); 
    if (ph) ph.style.display = 'flex';
  }
}

function capture() {
  const v = document.getElementById('sc-video');
  if (!v) return;
  const c = document.createElement('canvas');
  c.width = v.videoWidth || 800;
  c.height = v.videoHeight || 600;
  c.getContext('2d').drawImage(v, 0, 0);
  const raw = c.toDataURL('image/jpeg', 0.9);
  stopCam();
  
  BSP.toast('Seite ' + (_pages.length + 1) + ' erfasst', 'info');
  
  BSP.compressImage(raw, 1200, 70).then(async compressed => {
    const thumb = await BSP.compressImage(compressed, 400, 60);
    _pages.push({ b64: compressed, thumb: thumb });
    _showMultiPrompt();
  });
}

function finishCapture() {
  const prompt = document.getElementById('sc-multi-prompt');
  if (prompt) prompt.style.display = 'none';
  if (_pages.length > 0) {
    _showPreview(_pages[0].b64);
    _processImage();
  } else {
    close();
  }
}

function _showMultiPrompt() {
  const prompt = document.getElementById('sc-multi-prompt');
  if (prompt) prompt.style.display = 'block';
  const cnt = document.getElementById('sc-page-counter');
  if (cnt) cnt.textContent = 'Seite ' + (_pages.length + 1);
  const v = document.getElementById('sc-video');
  if (v) v.style.display = 'none';
  const camBtns = document.getElementById('sc-cam-btns');
  if (camBtns) camBtns.style.display = 'none';
}

function loadFile(input) {
  const f = input.files[0];
  if (!f) return;
  
  // PDF Support Check
  if (f.type === 'application/pdf') {
    BSP.toast('PDF Import wird für v2.1 vorbereitet...', 'info');
    // Simulierter PDF Text Import für jetzt (echter PDF Parser bräuchte pdf.js)
    return;
  }

  _setLog('🗜️ Bild wird vorbereitet …'); _setP(10);
  const r = new FileReader();
  r.onload = async e => {
    const raw = e.target.result;
    _setLog('🗜️ Iterative Kompression …');
    
    let quality = 0.9;
    let compressed = raw;
    while (compressed.length > 150000 && quality > 0.1) {
      compressed = await BSP.compressImage(raw, 1200, quality * 100);
      quality -= 0.15;
    }
    
    const thumb = await BSP.compressImage(compressed, 400, 70);
    _pages.push({ b64: compressed, thumb: thumb });
    _setP(100);
    _showMultiPrompt();
  };
  r.readAsDataURL(f);
}

function _showPreview(src) {
  const ph = document.getElementById('sc-ph');
  if (ph) ph.style.display = 'none';
  const prev = document.getElementById('sc-preview');
  if (prev) { prev.src = src; prev.style.display = 'block'; }
  const progWrap = document.getElementById('sc-prog-wrap');
  if (progWrap) progWrap.style.display = 'block';
}

// ── KI-Analyse ────────────────────────────────────────────────
async function _processImage() {
  const apiKey = BSP.state.settings?._apiKey || localStorage.getItem('bsp_apikey') || '';

  _setP(15); _setLog('📤 Bilder werden gesendet …');

  if (!apiKey) {
    _setLog('⚠️ Kein API Key – bitte manuell ausfüllen');
    _setP(100);
    setTimeout(() => { _setP(0); const pw = document.getElementById('sc-prog-wrap'); if (pw) pw.style.display = 'none'; }, 1000);
    setType('manual');
    return;
  }

  if (!_pages.length) {
    _setLog('❌ Keine Bilder vorhanden'); return;
  }

  const prompt = `Du bist ein präziser Belegscanner für Deutschland (Freiberufler, volle MwSt-Pflicht).

AUFGABE: Lies alle sichtbaren Daten von diesem Beleg/dieser Rechnung ab.

Das Bild kann sein:
- Papierbeleg / Kassenbon / Quittung
- Gedruckte oder digitale Rechnung
- Monitor-Screenshot (YouTube, Stripe, PayPal, Online-Rechnung)
- Handgeschriebener Beleg

ANTWORTE AUSSCHLIESSLICH mit diesem JSON-Objekt, ohne Erklärung, ohne Markdown:
{
  "shop": "Name des Händlers oder der Plattform",
  "belegNrExtern": "Rechnungsnummer falls sichtbar, sonst null",
  "date": "YYYY-MM-DD",
  "net": 12.34,
  "mwst": 2.34,
  "brutto": 14.68,
  "mwstRate": 19,
  "items": [{"name": "Produktname", "price": 9.99}],
  "category": "Bürobedarf",
  "payment": "Karte",
  "istAbo": false,
  "garantieMonate": null,
  "isReverseCharge": false,
  "isDigitalScreen": false
}

REGELN:
1. Beträge als Dezimalzahl ohne Währungszeichen (14.68 nicht "14,68 €")
2. Datum: YYYY-MM-DD
3. Wenn Netto+Brutto sichtbar: MwSt = Brutto - Netto
4. mwstRate: nur Zahl (19 nicht "19%")
5. category muss einer dieser Werte sein: Bürobedarf, Software, Hardware, Beratung, Marketing, Reisen, Fortbildung, Fahrzeug, Telefon/Internet, Bewirtung, Restaurant, Lebensmittel, Gesundheit, Sonstiges
6. payment: Karte, Bar, Überweisung, Online
7. isReverseCharge=true wenn EU-Reverse Charge erkennbar (ausländischer Anbieter ohne dt. MwSt)
8. garantieMonate=24 für Elektronik/Geräte, 12 für Möbel, sonst null
9. Fehlende Felder: null`;

  try {
    _setLog('🤖 Claude analysiert ' + _pages.length + ' Seite(n) …'); _setP(40);
    
    // Multi-Image Support für den AI-Prozess
    const result = await BSP.AI.process({ 
      prompt, 
      images: _pages.map(p => p.b64), 
      maxTokens: 1024 
    });
    
    const rawText = result.text || result; // Abwärtskompatibilität
    _setP(90);

    // JSON robustissimo parsen
    let parsed = null;
    try { parsed = JSON.parse(rawText.trim()); } catch(_) {}
    if (!parsed) {
      const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenced) try { parsed = JSON.parse(fenced[1].trim()); } catch(_) {}
    }
    if (!parsed) {
      const braces = rawText.match(/\{[\s\S]*\}/);
      if (braces) try { parsed = JSON.parse(braces[0]); } catch(_) {}
    }
    if (!parsed) throw new Error('Konnte JSON nicht lesen: ' + rawText.substring(0, 80));

    // Typen sicherstellen
    ['net','mwst','brutto'].forEach(k => {
      if (typeof parsed[k] === 'string') parsed[k] = parseFloat(parsed[k].replace(',','.')) || null;
    });
    if (typeof parsed.mwstRate === 'string') parsed.mwstRate = parseFloat(parsed.mwstRate) || 19;

    _lastResult = parsed;
    _setP(100); _setLog('✓ Analyse abgeschlossen');
    setTimeout(() => { const pw = document.getElementById('sc-prog-wrap'); if (pw) pw.style.display = 'none'; _setP(0); }, 600);
    _fillForm(parsed);

  } catch(e) {
    _setP(100);
    const msg = e.message || 'Unbekannter Fehler';
    _setLog('❌ ' + msg);
    BSP.toast(msg.substring(0, 80), 'er');
    setTimeout(() => { const pw = document.getElementById('sc-prog-wrap'); if (pw) pw.style.display = 'none'; _setP(0); }, 3000);
  }
}

// ── Formular befüllen ────────────────────────────────────────
function _fillForm(r) {
  const set = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };

  set('sc-shop', r.shop);
  set('sc-date', r.date);
  set('sc-brutto', r.brutto != null ? Number(r.brutto).toFixed(2) : '');
  set('sc-net', r.net != null ? Number(r.net).toFixed(2) : '');
  set('sc-mwst', r.mwst != null ? Number(r.mwst).toFixed(2) : '');
  set('sc-bleg-ext', r.belegNrExtern);

  // MwSt-Satz setzen
  const rateEl = document.getElementById('sc-rate');
  if (rateEl && r.mwstRate != null) {
    const rate = String(Math.round(r.mwstRate));
    if ([...rateEl.options].some(o => o.value === rate)) rateEl.value = rate;
  }

  // Kategorie
  const catEl = document.getElementById('sc-cat');
  if (catEl && r.category) {
    const found = [...catEl.options].find(o => o.text === r.category || o.value === r.category);
    if (found) catEl.value = found.value;
  }

  // Zahlung
  const payEl = document.getElementById('sc-pay');
  if (payEl && r.payment) {
    const found = [...payEl.options].find(o => o.text === r.payment || o.value === r.payment);
    if (found) payEl.value = found.value;
  }

  // Reverse Charge Hinweis
  const rcHint = document.getElementById('sc-rc-hint');
  if (rcHint) rcHint.style.display = r.isReverseCharge ? 'block' : 'none';

  // Positionen
  if (r.items && r.items.length) {
    const sec = document.getElementById('sc-items-sec');
    const body = document.getElementById('sc-items-body');
    if (sec && body) {
      sec.style.display = 'block';
      body.innerHTML = r.items.map(it => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--br);font-size:12px;font-weight:300">
          <span style="color:var(--txt2);flex:1">${BSP.eh(it.name || '—')}</span>
          <span style="color:var(--gold);font-family:'DM Mono',monospace;font-size:11px">${BSP.fm(it.price)} €</span>
        </div>`).join('');
    }
  }

  // Felder anzeigen
  const resBiz = document.getElementById('sc-res-biz');
  if (resBiz) {
    resBiz.style.display = 'block';
    setTimeout(() => resBiz.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }
}

// ── Auto-Calc MwSt ────────────────────────────────────────────
function calcMwst() {
  const brutto = parseFloat(document.getElementById('sc-brutto')?.value?.replace(',', '.') || '0') || 0;
  const rate = parseFloat(document.getElementById('sc-rate')?.value || '19');
  if (brutto <= 0) return;
  if (rate === 0) {
    const n = document.getElementById('sc-net'); if (n) n.value = brutto.toFixed(2);
    const m = document.getElementById('sc-mwst'); if (m) m.value = '0.00';
  } else {
    const netto = brutto / (1 + rate / 100);
    const mwst = brutto - netto;
    const n = document.getElementById('sc-net'); if (n) n.value = netto.toFixed(2);
    const m = document.getElementById('sc-mwst'); if (m) m.value = mwst.toFixed(2);
  }
}

// ── Händler-Autocomplete ──────────────────────────────────────
async function suggestShops(val) {
  if (!val || val.length < 2) return;
  try {
    const all = await BSP.getBelege();
    const shops = [...new Set(all.map(b => b.shop).filter(s => s && s.toLowerCase().includes(val.toLowerCase())))];
    const dl = document.getElementById('sc-shop-list');
    if (dl) dl.innerHTML = shops.slice(0, 6).map(s => `<option value="${BSP.eh(s)}"></option>`).join('');
  } catch(_) {}
}

// ── Speichern ─────────────────────────────────────────────────
async function save() {
  const isPriv = _scanMode === 'priv';
  const get = id => document.getElementById(id)?.value?.trim() || '';

  let item;

  if (isPriv) {
    const shop = get('sc-p-shop') || 'Unbekannt';
    const brutto = parseFloat(get('sc-p-brutto').replace(',', '.')) || 0;
    if (!brutto) { BSP.toast('Bitte Betrag eingeben', 'wr'); return; }
    item = {
      type: 'priv',
      shop,
      date: get('sc-p-date') || new Date().toISOString().split('T')[0],
      brutto,
      cat: get('sc-p-cat'),
      image: _pages[0]?.thumb || _pages[0]?.b64 || null,
      images: _pages.map(p => p.thumb || p.b64), // Alle Seiten speichern
      savedAt: Date.now()
    };
  } else {
    const shop = get('sc-shop');
    const brutto = parseFloat(get('sc-brutto').replace(',', '.')) || 0;
    const date = get('sc-date');

    // Validierung
    let valid = true;
    if (!shop) { _markError('sc-shop'); valid = false; }
    if (!brutto) { _markError('sc-brutto'); valid = false; }
    if (!date) { _markError('sc-date'); valid = false; }
    if (!valid) { BSP.toast('Bitte Pflichtfelder ausfüllen', 'wr'); return; }

    const rate = parseFloat(get('sc-rate')) || 19;
    const netto = parseFloat(get('sc-net').replace(',', '.')) || (brutto / (1 + rate / 100));
    const mwst = parseFloat(get('sc-mwst').replace(',', '.')) || (brutto - netto);
    const isRC = _lastResult?.isReverseCharge || false;

    item = {
      type: _scanMode === 'ar' ? 'ar' : 'er',
      belegNr: BSP.nextNr(_scanMode === 'ar' ? 'ar' : 'er'),
      belegNrExtern: get('sc-bleg-ext') || null,
      shop,
      date,
      brutto, net: netto, mwst, mwstRate: rate,
      cat: get('sc-cat'),
      payment: get('sc-pay'),
      isReverseCharge: isRC,
      istAbo: _lastResult?.istAbo || false,
      garantieMonate: _lastResult?.garantieMonate || null,
      garantieBis: _lastResult?.garantieMonate
        ? new Date(new Date(date).getTime() + _lastResult.garantieMonate * 30 * 864e5).toISOString().split('T')[0]
        : null,
      items: _lastResult?.items || [],
      image: _pages[0]?.thumb || _pages[0]?.b64 || null,
      images: _pages.map(p => p.thumb || p.b64),
      savedAt: Date.now()
    };
  }

  try {
    await BSP.addBeleg(item);
    
    // Beleg-Split: Zweiten Beleg in Privat-DB anlegen
    const splitPct = parseFloat(get('sc-split-pct')) || 0;
    if (splitPct > 0 && splitPct <= 100) {
      const privAmt = item.brutto * (splitPct / 100);
      const privItem = {
        type: 'priv',
        shop: item.shop,
        date: item.date,
        brutto: privAmt,
        cat: 'Eigenanteil',
        parentBizId: item.id,
        image: _pages[0]?.thumb || null,
        images: _pages.map(p => p.thumb || p.b64),
        savedAt: Date.now()
      };
      await BSP.addBeleg(privItem);
      BSP.toast(`Split: ${BSP.fm(privAmt)} € nach Privat übertragen`, 'ok');
    }

    BSP.toast(item.shop + ' gespeichert ✓', 'ok');
    close();
    reset();
  } catch(e) {
    BSP.toast('Fehler: ' + e.message, 'er');
    console.error('Scanner save error:', e);
  }
}

// ── Reset ─────────────────────────────────────────────────────
function reset() {
  _pages = []; _lastResult = null;
  stopCam();
  const prev = document.getElementById('sc-preview');
  if (prev) { prev.src = ''; prev.style.display = 'none'; }
  const ph = document.getElementById('sc-ph');
  if (ph) ph.style.display = 'flex';
  const resBiz = document.getElementById('sc-res-biz');
  if (resBiz) { resBiz.style.display = 'none'; }
  const progWrap = document.getElementById('sc-prog-wrap');
  if (progWrap) { progWrap.style.display = 'none'; _setP(0); }
  ['sc-shop','sc-date','sc-brutto','sc-net','sc-mwst','sc-bleg-ext','sc-p-shop','sc-p-brutto'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const body = document.getElementById('sc-items-body');
  if (body) body.innerHTML = '';
  const sec = document.getElementById('sc-items-sec');
  if (sec) sec.style.display = 'none';
  const rc = document.getElementById('sc-rc-hint');
  if (rc) rc.style.display = 'none';
  // Datei-Input zurücksetzen
  const fi = document.getElementById('sc-file');
  if (fi) fi.value = '';
  // Datum neu setzen
  const today = new Date().toISOString().split('T')[0];
  ['sc-date','sc-p-date'].forEach(id => { const el = document.getElementById(id); if (el) el.value = today; });
}

// ── Hilfsfunktionen ───────────────────────────────────────────
function _setLog(msg) {
  const el = document.getElementById('sc-prog-log');
  if (el) el.textContent = msg;
  const pw = document.getElementById('sc-prog-wrap');
  if (pw) pw.style.display = 'block';
}

function _setP(pct) {
  const el = document.getElementById('sc-prog-fill');
  if (el) el.style.width = pct + '%';
}

function updateSplit() {
  const brutto = parseFloat(document.getElementById('sc-brutto')?.value?.replace(',', '.') || '0') || 0;
  const pct = parseFloat(document.getElementById('sc-split-pct')?.value || '0') || 0;
  const val = document.getElementById('sc-split-val');
  if (val) val.textContent = BSP.fm(brutto * (pct / 100)) + ' € Privat';
}

function _markError(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const parent = el.closest('.field') || el;
  parent.style.borderColor = 'var(--red)';
  parent.style.boxShadow = '0 0 0 2px rgba(192,64,64,.2)';
  setTimeout(() => { parent.style.borderColor = ''; parent.style.boxShadow = ''; }, 3000);
}

// ── Öffentliche API ───────────────────────────────────────────
return {
  init, open, openManuell, close,
  setType, startCam, stopCam, capture, loadFile,
  calcMwst, suggestShops, save, reset, updateSplit
};

})();

// Auto-Init wenn Core bereit ist
BSP.on('core:ready', () => ScannerModule.init());
