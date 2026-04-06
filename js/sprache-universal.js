// ══════════════════════════════════════════════════════════════
// MODUL: SPRACHE UNIVERSAL (v2.0)
// Übergreifende Spracheingabe mit KI-Intent-Detection
// ══════════════════════════════════════════════════════════════
'use strict';

const SpracheUniversal = (() => {

  const VIEW_HTML = `
    <div class="sh"></div>
    <div class="mod-header">
      <h1 class="mod-title">Universal-Sprache</h1>
      <p class="mod-sub">Ich höre dir zu... Erzähl mir alles.</p>
    </div>

    <div style="display:flex; flex-direction:column; align-items:center; gap:32px; padding:40px 20px">
      <!-- Recording Disc -->
      <div id="su-disc" class="rec-disc" onclick="SpracheUniversal.toggle()">
        <div class="rec-icon">🎙️</div>
      </div>
      
      <!-- Live Transcript -->
      <div id="su-transcript" style="font-size:16px; color:var(--txt); text-align:center; min-height:60px; font-weight:200; line-height:1.5">
        Tippe auf das Mikrofon, um zu starten...
      </div>

      <!-- Analysis Status -->
      <div id="su-status" style="display:none; color:var(--gold); font-size:12px; text-transform:uppercase; letter-spacing:1px">
        Künstliche Intelligenz analysiert... 🧠
      </div>
    </div>

    <button class="btn btn-g" style="width:calc(100% - 40px); margin:20px; justify-content:center" onclick="BSP.closeSheet()">Schließen</button>
  `;

  let _recording = false;
  let _recognition = null;
  let _finalText = '';

  function init() {
    // Registrierung am Core
    BSP.registerModule('sprache-universal', { open });
  }

  function open() {
    BSP.showSheet(VIEW_HTML);
    _initRecognition();
  }

  function _initRecognition() {
    if (!('webkitSpeechRecognition' in window)) {
      BSP.toast('Spracherkennung wird nicht unterstützt', 'er');
      return;
    }
    _recognition = new webkitSpeechRecognition();
    _recognition.lang = 'de-DE';
    _recognition.continuous = true;
    _recognition.interimResults = true;

    _recognition.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) _finalText += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      document.getElementById('su-transcript').innerHTML = 
        `<span style="color:var(--txt)">${_finalText}</span> <span style="color:var(--txt3)">${interim}</span>`;
    };

    _recognition.onend = () => {
      if (_recording) _recognition.start();
    };
  }

  function toggle() {
    if (_recording) {
      _stop();
    } else {
      _start();
    }
  }

  function _start() {
    _recording = true;
    _finalText = '';
    document.getElementById('su-disc').classList.add('active');
    document.getElementById('su-transcript').textContent = 'Ich höre...';
    _recognition.start();
  }

  async function _stop() {
    _recording = false;
    document.getElementById('su-disc').classList.remove('active');
    _recognition.stop();
    
    if (!_finalText.trim()) return;

    document.getElementById('su-status').style.display = 'block';
    
    try {
      const context = await BSP.getContext();
      
      const prompt = `Du bist die zentrale Intelligenz von BelegScan Pro v2.0. 
      Analysiere diese Spracheingabe und ordne sie einem der folgenden Ziele zu:
      1. BUSINESS_BELEG (Ausgabe oder Einnahme)
      2. PRIVAT_BELEG (Private Ausgabe)
      3. BUSINESS_KONTEXT (Informationen über den Job, Projekte, Stress)
      4. ARCHIV_NOTIZ (Allgemeine Information zum Merken)

      BENUTZER-KONTEXT:
      ${JSON.stringify(context)}

      EINGABE: "${_finalText}"

      Antworte strikt im JSON-Format: 
      {
        "intent": "...", 
        "data": { ... }, 
        "summary": "kurze Zusammenfassung für Toast"
      }`;

      const response = await BSP.callClaude({ prompt, model: 'claude-sonnet-4-5' });
      const res = JSON.parse(response);

      await _routeToModule(res);
      BSP.toast(res.summary || 'Verarbeitet', 'ok');
      BSP.closeSheet();
    } catch(e) {
      console.error('AI Intent Error', e);
      BSP.toast('Konnte Eingabe nicht verarbeiten', 'er');
    }
  }

  async function _routeToModule(res) {
    if (res.intent === 'BUSINESS_BELEG') {
      await BSP.analysiereEingabeText(_finalText, 'business');
    } else if (res.intent === 'PRIVAT_BELEG') {
      await BSP.analysiereEingabeText(_finalText, 'privat');
    } else if (res.intent === 'BUSINESS_KONTEXT') {
      const entry = { text: _finalText, analysis: res.data, savedAt: Date.now() };
      await BSP.dbAdd('kontext', entry);
      BSP.emit('kontext:updated', entry);
    } else {
      await BSP.dbAdd('archiv_dokumente', { name: 'Sprachnotiz', text: _finalText, ...res.data, savedAt: Date.now() });
    }
  }

  return { init, open, toggle };

})();
SpracheUniversal.init();
