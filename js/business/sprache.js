// ══════════════════════════════════════════════════════════════
// MODUL: SPRACHE
// Akustischer Beleg-Scanner via Web Speech API
// Manueller Start/Stop, Live-Transkript, KI-Interpretation
// Kommuniziert NUR über BSP.* — niemals direkt mit anderen Modulen
// ══════════════════════════════════════════════════════════════
'use strict';

const SpracheModule = (() => {

let _recognition = null;
let _isRecording = false;
let _transcript = '';
let _lastResult = null;

const OVERLAY_HTML = `
<div id="spr-ovl" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:310;flex-direction:column;overflow-y:auto;padding-top:env(safe-area-inset-top,0px)">
  <div style="background:var(--s1);border-radius:var(--r24) var(--r24) 0 0;margin-top:auto;max-height:92vh;overflow-y:auto;position:relative">
    <div class="sh" style="margin:12px auto 8px"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:0 16px 12px">
      <div style="font-size:14px;font-weight:200;color:var(--txt)">Spracherkennung</div>
      <button onclick="SpracheModule.close()" style="background:var(--s3);border:1px solid var(--br);color:var(--txt2);width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center">×</button>
    </div>

    <!-- Mic + Buttons -->
    <div style="display:flex;flex-direction:column;align-items:center;padding:20px 16px">
      <button id="spr-mic-btn" onclick="SpracheModule.toggle()"
        style="width:72px;height:72px;border-radius:50%;background:rgba(58,175,112,.08);border:1px solid rgba(58,175,112,.2);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;box-shadow:0 0 0 6px var(--s1),0 0 0 7px rgba(58,175,112,.12)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width:28px;height:28px;color:var(--grn);stroke-width:1.3">
          <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
          <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
        </svg>
      </button>
      <div id="spr-status" style="font-size:11px;color:var(--txt3);margin-top:12px;letter-spacing:.4px">Tippe auf das Mikrofon um zu beginnen</div>
    </div>

    <!-- Live-Transkript -->
    <div style="margin:0 16px 16px">
      <div style="font-size:10px;color:var(--txt3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px">Transkript</div>
      <div id="spr-transcript" style="background:var(--s2);border:1px solid var(--br);border-radius:var(--r8);padding:12px;min-height:60px;font-size:13px;font-weight:300;color:var(--txt2);line-height:1.6">
        Noch nichts aufgenommen …
      </div>
    </div>

    <!-- KI-Analyse Button -->
    <div style="padding:0 16px 16px">
      <button id="spr-analyze-btn" class="btn btn-gold" style="width:100%;justify-content:center;display:none" onclick="SpracheModule.analyze()">
        🤖 KI interpretieren
      </button>
    </div>

    <!-- Ergebnis-Felder -->
    <div id="spr-result" style="display:none;padding:0 16px 16px">
      <div class="stitle">KI-Vorschlag</div>
      <div class="g2" style="gap:8px;margin-bottom:8px">
        <div class="field"><label>Händler</label><input class="sett-inp" id="spr-shop" type="text"></div>
        <div class="field"><label>Datum</label><input class="sett-inp" id="spr-date" type="date"></div>
      </div>
      <div class="g2" style="gap:8px;margin-bottom:8px">
        <div class="field"><label>Brutto (€)</label><input class="sett-inp" id="spr-brutto" type="text" inputmode="decimal" oninput="SpracheModule.calcMwst()"></div>
        <div class="field"><label>MwSt-Satz</label>
          <select class="sett-inp" id="spr-rate" onchange="SpracheModule.calcMwst()">
            <option value="19">19%</option>
            <option value="7">7%</option>
            <option value="0">0%</option>
          </select>
        </div>
      </div>
      <div class="g2" style="gap:8px;margin-bottom:8px">
        <div class="field"><label>Netto (€)</label><input class="sett-inp" id="spr-net" type="text" readonly style="opacity:.7"></div>
        <div class="field"><label>MwSt (€)</label><input class="sett-inp" id="spr-mwst" type="text" readonly style="opacity:.7"></div>
      </div>
      <div class="g2" style="gap:8px;margin-bottom:8px">
        <div class="field"><label>Typ</label>
          <select class="sett-inp" id="spr-type">
            <option value="er">Eingangsbeleg (ER)</option>
            <option value="ar">Ausgangsrechnung (AR)</option>
          </select>
        </div>
        <div class="field"><label>Kategorie</label>
          <select class="sett-inp" id="spr-cat">
            <option>Bürobedarf</option><option>Software</option><option>Hardware</option>
            <option>Beratung</option><option>Marketing</option><option>Reisen</option>
            <option>Fortbildung</option><option>Sonstiges</option>
          </select>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-g" style="flex:.5" onclick="SpracheModule.reset()">↺ Neu</button>
        <button class="btn btn-gold" style="flex:1;justify-content:center" onclick="SpracheModule.save()">✓ Speichern</button>
      </div>
    </div>

    <!-- Fallback -->
    <div id="spr-fallback" style="display:none;padding:0 16px 20px;text-align:center">
      <div style="font-size:12px;color:var(--txt3);line-height:1.7">
        Web Speech API ist in diesem Browser nicht verfügbar.<br>
        Bitte Chrome oder Edge auf Android/Desktop verwenden.
      </div>
    </div>
  </div>
</div>
`;

// ── Init ─────────────────────────────────────────────────────
function init() {
  if (!document.getElementById('spr-ovl')) {
    document.body.insertAdjacentHTML('beforeend', OVERLAY_HTML);
  }

  // SpeechRecognition support check
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    const fb = document.getElementById('spr-fallback');
    if (fb) fb.style.display = 'block';
    return;
  }

  _recognition = new SR();
  _recognition.lang = 'de-DE';
  _recognition.continuous = true;
  _recognition.interimResults = true;

  _recognition.onresult = e => {
    let interim = '';
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) final += e.results[i][0].transcript;
      else interim += e.results[i][0].transcript;
    }
    _transcript += final;
    const el = document.getElementById('spr-transcript');
    if (el) el.textContent = (_transcript + interim) || 'Sprich jetzt …';
  };

  _recognition.onerror = e => {
    _setStatus('Fehler: ' + e.error);
    _stopRecording();
  };

  _recognition.onend = () => {
    if (_isRecording) {
      try { _recognition.start(); } catch(_) {}
    }
  };
}

function open() {
  const ovl = document.getElementById('spr-ovl');
  if (ovl) ovl.style.display = 'flex';
  reset();
}

function close() {
  stopRecording();
  const ovl = document.getElementById('spr-ovl');
  if (ovl) ovl.style.display = 'none';
}

function toggle() {
  if (_isRecording) stopRecording();
  else startRecording();
}

function startRecording() {
  if (!_recognition) return;
  _isRecording = true;
  _transcript = '';
  try { _recognition.start(); } catch(_) {}

  const btn = document.getElementById('spr-mic-btn');
  if (btn) {
    btn.style.background = 'rgba(192,64,64,.12)';
    btn.style.borderColor = 'rgba(192,64,64,.3)';
    btn.style.boxShadow = '0 0 0 6px var(--s1), 0 0 0 7px rgba(192,64,64,.2)';
    btn.style.animation = 'pulse .9s ease infinite';
  }
  // Mic SVG color
  const svg = btn?.querySelector('svg');
  if (svg) svg.style.color = 'var(--red)';

  _setStatus('🔴 Aufnahme läuft … Spreche jetzt');
  const transcEl = document.getElementById('spr-transcript');
  if (transcEl) transcEl.textContent = 'Sprich jetzt …';
}

function stopRecording() {
  _stopRecording();
  if (_transcript.trim().length > 5) {
    const analyzeBtn = document.getElementById('spr-analyze-btn');
    if (analyzeBtn) analyzeBtn.style.display = 'block';
    _setStatus('Aufnahme gestoppt. Tippe auf "KI interpretieren".');
  } else {
    _setStatus('Zu kurz – bitte erneut aufnehmen.');
  }
}

function _stopRecording() {
  _isRecording = false;
  try { _recognition?.stop(); } catch(_) {}

  const btn = document.getElementById('spr-mic-btn');
  if (btn) {
    btn.style.background = 'rgba(58,175,112,.08)';
    btn.style.borderColor = 'rgba(58,175,112,.2)';
    btn.style.boxShadow = '0 0 0 6px var(--s1), 0 0 0 7px rgba(58,175,112,.12)';
    btn.style.animation = '';
  }
  const svg = btn?.querySelector('svg');
  if (svg) svg.style.color = 'var(--grn)';
}

function _setStatus(msg) {
  const el = document.getElementById('spr-status');
  if (el) el.textContent = msg;
}

// ── KI-Analyse ────────────────────────────────────────────────
async function analyze() {
  if (!_transcript.trim()) return;

  _setStatus('🤖 KI analysiert …');
  const analyzeBtn = document.getElementById('spr-analyze-btn');
  if (analyzeBtn) analyzeBtn.disabled = true;

  const prompt = `Du bist ein Buchhalter-Assistent für deutsche Freiberufler. Der Nutzer hat folgenden Text gesprochen:

"${_transcript}"

Interpretiere diesen Text als Beleg-Eintrag. Antworte AUSSCHLIESSLICH mit diesem JSON:
{
  "shop": "Händler oder Beschreibung",
  "date": "YYYY-MM-DD oder null",
  "brutto": 0.00,
  "mwstRate": 19,
  "category": "Bürobedarf",
  "type": "er"
}
type: "er" für Ausgaben/Eingangsbelege, "ar" für Einnahmen/Ausgangsrechnungen.
Datum: Heute ist ${new Date().toISOString().split('T')[0]}.
Wenn ein Betrag genannt: Brutto. mwstRate: 19 oder 7 je nach Kontext.`;

  try {
    const raw = await BSP.ask({ prompt, maxTokens: 256 });
    let parsed = null;
    try { parsed = JSON.parse(raw.trim()); } catch(_) {}
    if (!parsed) {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) try { parsed = JSON.parse(m[0]); } catch(_) {}
    }
    if (!parsed) throw new Error('KI-Antwort nicht lesbar');

    _lastResult = parsed;
    _fillSpracheForm(parsed);
    document.getElementById('spr-result').style.display = 'block';
    _setStatus('✓ Felder befüllt – bitte prüfen und speichern');
  } catch(e) {
    _setStatus('❌ ' + (e.message || 'Fehler'));
    BSP.toast(e.message, 'er');
  } finally {
    if (analyzeBtn) analyzeBtn.disabled = false;
  }
}

function _fillSpracheForm(r) {
  const set = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
  set('spr-shop', r.shop);
  set('spr-date', r.date || new Date().toISOString().split('T')[0]);
  set('spr-brutto', r.brutto != null ? Number(r.brutto).toFixed(2) : '');
  set('spr-type', r.type || 'er');
  // Kategorie
  const catEl = document.getElementById('spr-cat');
  if (catEl && r.category) {
    const found = [...catEl.options].find(o => o.text === r.category);
    if (found) catEl.value = found.value;
  }
  // Rate
  const rateEl = document.getElementById('spr-rate');
  if (rateEl && r.mwstRate != null) rateEl.value = String(Math.round(r.mwstRate));
  calcMwst();
}

function calcMwst() {
  const brutto = parseFloat(document.getElementById('spr-brutto')?.value?.replace(',', '.') || '0') || 0;
  const rate = parseFloat(document.getElementById('spr-rate')?.value || '19');
  if (brutto <= 0) return;
  const netto = rate === 0 ? brutto : brutto / (1 + rate / 100);
  const mwst = brutto - netto;
  const n = document.getElementById('spr-net'); if (n) n.value = netto.toFixed(2);
  const m = document.getElementById('spr-mwst'); if (m) m.value = mwst.toFixed(2);
}

// ── Speichern ─────────────────────────────────────────────────
async function save() {
  const get = id => document.getElementById(id)?.value?.trim() || '';
  const shop = get('spr-shop') || 'Unbekannt';
  const brutto = parseFloat(get('spr-brutto').replace(',', '.')) || 0;
  if (!brutto) { BSP.toast('Bitte Betrag eingeben', 'wr'); return; }

  const type = get('spr-type') || 'er';
  const rate = parseFloat(get('spr-rate') || '19');
  const netto = parseFloat(get('spr-net').replace(',', '.')) || (brutto / (1 + rate / 100));
  const mwst = brutto - netto;

  const item = {
    type,
    belegNr: BSP.nextNr(type),
    shop,
    date: get('spr-date') || new Date().toISOString().split('T')[0],
    brutto, net: netto, mwst, mwstRate: rate,
    cat: get('spr-cat'),
    isReverseCharge: false,
    items: [],
    savedAt: Date.now()
  };

  try {
    await BSP.addBeleg(item);
    BSP.toast(shop + ' gespeichert ✓', 'ok');
    close();
  } catch(e) {
    BSP.toast('Fehler: ' + e.message, 'er');
  }
}

function reset() {
  _transcript = '';
  _lastResult = null;
  _isRecording = false;
  _setStatus('Tippe auf das Mikrofon um zu beginnen');
  const el = document.getElementById('spr-transcript');
  if (el) el.textContent = 'Noch nichts aufgenommen …';
  const analyzeBtn = document.getElementById('spr-analyze-btn');
  if (analyzeBtn) analyzeBtn.style.display = 'none';
  const result = document.getElementById('spr-result');
  if (result) result.style.display = 'none';
}

return { init, open, close, toggle, startRecording, stopRecording, analyze, calcMwst, save, reset };

})();
