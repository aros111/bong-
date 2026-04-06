'use strict';

const ChatInterface = (() => {

  const OVERLAY_HTML = `
  <div id="ci-overlay" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:var(--bg);z-index:10000;flex-direction:column;font-family:system-ui, -apple-system, sans-serif;">
    <div style="height:60px;background:var(--s2);display:flex;align-items:center;justify-content:space-between;padding:0 20px;border-bottom:1px solid var(--br);box-shadow:0 2px 10px rgba(0,0,0,0.3)">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="background:var(--gold);padding:6px;border-radius:50%;display:flex;align-items:center;justify-content:center">
          <svg viewBox="0 0 24 24" fill="none" stroke="#000" style="width:16px;height:16px">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M13 8l-3 4h4l-2 4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div>
          <div style="font-weight:700;font-size:15px;color:var(--text)">BONG Assistant</div>
          <div id="ci-status-text" style="font-size:11px;color:var(--gold)">MwSt Zahl-Last: <span id="ci-tax-badge">...</span> â‚¬</div>
        </div>
      </div>
      <button onclick="ChatInterface.close()" style="background:none;border:none;color:var(--txt2);cursor:pointer;padding:8px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width:24px;height:24px"><path d="M18 6L6 18M6 6l12 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>

    <div id="ci-offline-banner" style="display:none;background:var(--red);color:#fff;font-size:12px;font-weight:600;padding:8px;text-align:center;">
      Offline â€“ KI nicht verfÃ¼gbar. Manuelle Eingaben in Reitern sind weiterhin gesichert.
    </div>

    <!-- Chat History -->
    <div id="ci-history" style="flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:16px;background:var(--bg)"></div>

    <!-- Typing Indicator -->
    <div id="ci-typing" style="display:none;padding:10px 20px;font-size:13px;color:var(--txt2);background:var(--s1);border-top:1px solid var(--br)">
      <span id="ci-typing-msg">KI denkt nach...</span> <span class="ci-dot-anim">...</span>
    </div>

    <!-- Bottom Input -->
    <div style="background:var(--s2);padding:15px 20px;border-top:1px solid var(--br);display:flex;gap:12px;align-items:flex-end">
      <button class="btn btn-g" style="padding:10px;border-radius:12px;height:44px;flex-shrink:0" onclick="ChatInterface.triggerCamera()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width:20px;height:20px"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
      </button>
      <button class="btn btn-g" style="padding:10px;border-radius:12px;height:44px;flex-shrink:0" onclick="document.getElementById('ci-upload').click()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width:20px;height:20px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>

      <textarea id="ci-input" inputmode="text" placeholder="Tippen oder Tastatur-Mikrofon nutzen..." style="flex:1;min-height:44px;max-height:120px;background:var(--s1);border:1px solid var(--br);border-radius:16px;color:var(--text);padding:12px;font-size:15px;resize:none;font-family:inherit;line-height:1.4"></textarea>

      <button class="btn btn-gold" style="padding:10px;border-radius:12px;height:44px;flex-shrink:0" onclick="ChatInterface.sendText()">
        <svg viewBox="0 0 24 24" fill="none" stroke="#000" style="width:20px;height:20px"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </div>
    <input type="file" id="ci-upload" accept="image/*,application/pdf" style="display:none" onchange="ChatInterface.handleFileUpload(event)">
  </div>
  <style>
    @keyframes ci-blink { 0% {opacity: .2;} 20% {opacity: 1;} 100% {opacity: .2;} }
    .ci-dot-anim { animation: ci-blink 1.4s infinite alternate; font-weight: bold; }
    .ci-msg { max-width: 85%; padding: 12px 16px; border-radius: 18px; font-size: 15px; line-height: 1.4; word-wrap: break-word; }
    .ci-msg.user { background: var(--gold); color: #000; align-self: flex-end; border-bottom-right-radius: 4px; }
    .ci-msg.ai { background: var(--s2); color: var(--text); border: 1px solid var(--br); align-self: flex-start; border-bottom-left-radius: 4px; }
    .ci-msg.system { background: var(--s1); color: var(--txt2); font-size: 12px; align-self: center; border-radius: 8px; font-style: italic; text-align:center; }
  </style>
  `;

  let _messages = [];
  let _isOnline = navigator.onLine;

  const TOOLS = [
    { name: "save_beleg", description: "Speichert einen hochgeladenen Business-Eingangsbeleg mit Betrag und Shop", input_schema: { type: "object", properties: { amount: {type:"number"}, shop: {type:"string"} }, required: ["amount","shop"] } },
    { name: "save_privat", description: "Speichert eine rein private Ausgabe (Lebensmittel etc)", input_schema: { type: "object", properties: { amount: {type:"number"}, shop: {type:"string"} }, required: ["amount","shop"] } },
    { name: "archive_document", description: "Speichert ein offizielles Dokument (Post, Finanzamt) im Archiv", input_schema: { type: "object", properties: { sender: {type:"string"}, intent: {type:"string"} }, required: ["sender"] } },
    { name: "query_db", description: "Fragt Finanzdaten aus der IndexedDB ab (MwSt, Ausgaben, Belege)", input_schema: { type: "object", properties: { query_type: {type:"string", enum: ["mwst","ausgaben","belege"]}, month: {type: "string"} }, required: ["query_type"] } },
    { name: "navigate", description: "Wechselt zu einem Modul/Reiter der App auf Wunsch des Nutzers", input_schema: { type: "object", properties: { target: {type:"string", enum: ["privat","business","archiv","konto","steuer","einstellungen"]} }, required: ["target"] } },
    { name: "draft_invoice", description: "Startet eine neue Ausgangsrechnung fÃ¼r einen Kunden", input_schema: { type: "object", properties: { client: {type:"string"}, amount: {type:"number"} }, required: ["client", "amount"] } }
  ];

  function init() {
    if (!document.getElementById('ci-overlay')) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = OVERLAY_HTML;
      document.body.appendChild(wrapper.firstElementChild);
    }
    const inp = document.getElementById('ci-input');
    inp.addEventListener('input', () => {
      inp.style.height = 'auto'; inp.style.height = (inp.scrollHeight) + 'px';
      if(inp.value.trim() === '') inp.style.height = '44px';
    });
    window.addEventListener('online',  () => _setOnlineStatus(true));
    window.addEventListener('offline', () => _setOnlineStatus(false));
    
    // Bind to MwSt Updates
    BSP.on('mwst:updated', (data) => {
      document.getElementById('ci-tax-badge').innerText = data.saldo <= 0 ? '0.00' : data.saldo.toFixed(2);
    });

    _loadHistory();
  }

  function _setOnlineStatus(isOnline) {
    _isOnline = isOnline;
    document.getElementById('ci-offline-banner').style.display = isOnline ? 'none' : 'block';
  }

  async function _loadHistory() {
    try {
      const hist = await BSP.dbGetAll('chat_history') || [];
      hist.sort((a,b) => a.timestamp - b.timestamp);
      _messages = hist.slice(-20);
      _renderHistory();
    } catch(err) {}
  }

  function _renderHistory() {
    const el = document.getElementById('ci-history');
    el.innerHTML = '';
    if (_messages.length === 0) {
       _messages.push({ role: 'ai', text: 'Hallo! Ich bin dein Assistant. Was kann ich heute fÃ¼r dich tun?', timestamp: Date.now() });
    }
    _messages.forEach(m => {
      const div = document.createElement('div');
      div.className = 'ci-msg ' + m.role;
      div.innerText = m.text;
      el.appendChild(div);
    });
    el.scrollTop = el.scrollHeight;
  }

  async function _saveMessage(role, text) {
     const msg = { role, text, timestamp: Date.now() };
     _messages.push(msg);
     if (_messages.length > 20) _messages.shift();
     _renderHistory();
     try { await BSP.dbAdd('chat_history', msg); } catch(e) {}
     return msg;
  }

  function open() {
    init();
    _setOnlineStatus(navigator.onLine);
    document.getElementById('ci-overlay').style.display = 'flex';
    document.getElementById('ci-input').focus();
    // Update badge initially
    if(BSP.state && BSP.state.mwstSaldo) {
       document.getElementById('ci-tax-badge').innerText = BSP.state.mwstSaldo.toFixed(2);
    }
  }

  function close() {
    document.getElementById('ci-overlay').style.display = 'none';
  }

  function setTyping(text) {
    const el = document.getElementById('ci-typing');
    if (text) {
      document.getElementById('ci-typing-msg').innerText = text;
      el.style.display = 'block';
    } else {
      el.style.display = 'none';
    }
    const hist = document.getElementById('ci-history');
    hist.scrollTop = hist.scrollHeight;
  }

  async function sendText() {
    if (!_isOnline) { BSP.toast('Offline', 'wr'); return; }
    const inp = document.getElementById('ci-input');
    const txt = inp.value.trim();
    if (!txt) return;

    inp.value = ''; inp.style.height = '44px';
    await _saveMessage('user', txt);
    _processIntent(txt, null);
  }

  function triggerCamera() {
     const inp = document.getElementById('ci-upload');
     inp.setAttribute('capture', 'environment');
     inp.click();
     inp.removeAttribute('capture');
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!_isOnline) { BSP.toast('Offline', 'er'); return; }

    await _saveMessage('system', `[Dokument geladen: ${file.name}]`);
    setTyping('KI liest Dokument...');

    const reader = new FileReader();
    reader.onload = async () => {
       const b64 = reader.result;
       // Bild wird NICHT im Array langzeitig gespeichert um Tokens zu sparen!
       await _processDocRouter(file.name, b64);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function getSystemContext() {
    return `Du bist der smarte Finanzassistent fÃ¼r Freelancer in der App 'BelegScan Pro'.
SÃ¤ule aktuell: ${BSP.state ? BSP.state.activePillar : 'Unbekannt'}.
Datum: ${new Date().toLocaleDateString()}.
Antworte immer prÃ¤zise und ruf verfÃ¼gbare Tools auf wenn der Nutzer Daten eintragen oder abfragen mÃ¶chte.
Melde Fehler immer nutzerfreundlich auf Deutsch.`;
  }

  // --- Phase 2: Router ---
  async function _processDocRouter(fileName, b64) {
     try {
        const prompt = `Analysiere dieses Dokument kurz. Was ist das? Antworte mit exakt einem der folgenden WÃ¶rter:\nkontoauszug, beleg_eingang, beleg_ausgang, brief_finanzamt, brief_sonstiges, privat_ausgabe, unbekannt.`;
        const resp = await BSP.callClaude({ prompt, imageB64: b64, model: 'claude-haiku-4-5-20251001', maxTokens: 100 });
        const type = (resp && resp.content && resp.content[0].text) ? resp.content[0].text.trim().toLowerCase() : "unbekannt";
        
        if (type.includes("kontoauszug")) {
           setTyping('KI analysiert Kontoauszug... (das kann dauern)');
           await _processKontoauszug(b64);
        } else {
           // Normaler Chat Tool-Call, aber wir pushen das Bild mit fÃ¼r 1 Zyklus
           setTyping('KI wertet Daten aus...');
           await _processIntent(`Hier ist ein Dokument (${type}). Bitte erfasse es entsprechend.`, b64);
        }
     } catch(err) {
        setTyping(null);
        await _saveMessage('ai', 'Der Dokument-Scanner ist fehlgeschlagen: ' + err.message);
     }
  }

  // --- Phase 3: Kontoauszug Batch Extraction ---
  async function _processKontoauszug(b64) {
    try {
      const prompt = `Analysiere diesen Kontoauszug. Lese IBAN und Bankname. Extrahiere JEDE Buchung. 
Antworte NUR mit purem JSON! Kein Markdown! Format:
{
  "bankdaten": { "bankname": "...", "iban": "..." },
  "buchungen": [
    { "datum": "TT.MM.JJJJ", "empfaenger": "...", "verwendungszweck": "...", "betrag": -10.00, "kategorie": "business" | "privat" | "unklar" }
  ]
}`;
      
      const res = await BSP.callClaude({ prompt, imageB64: b64, model: 'claude-sonnet-4-5', maxTokens: 10000 });
      let rawText = res.content[0].text.trim();
      rawText = rawText.replace(/\\`\\`\\`json/gi, '').replace(/\\`\\`\\`/gi, '').trim();
      if (rawText.indexOf('{') !== -1) {
         rawText = rawText.substring(rawText.indexOf('{'), rawText.lastIndexOf('}') + 1);
      }
      const data = JSON.parse(rawText);
      const buchungen = data.buchungen || [];

      // Auto-Bank anlegen
      let finalBankId = null;
      if (data.bankdaten && data.bankdaten.iban) {
         const banken = await BSP.dbGetAll('konto_banken') || [];
         const exist = banken.find(b => b.iban === data.bankdaten.iban);
         if (exist) { finalBankId = exist.id; }
         else {
           finalBankId = 'bnk_' + Date.now();
           await BSP.dbAdd('konto_banken', { id: finalBankId, name: data.bankdaten.bankname, iban: data.bankdaten.iban, typ:'geschaeftskonto' });
           BSP.emit('bank:created', { id: finalBankId });
         }
      } else { finalBankId = 'bnk_default'; }

      // Buchen & Verteilen
      let counter = 0; let priv = 0; let bus = 0;
      for (let t of buchungen) {
         const isNeg = (parseFloat(t.betrag)||0) < 0;
         t.bankId = finalBankId;
         await BSP.dbAdd('konto_buchungen', t);
         counter++;
         if(t.kategorie === 'privat') { 
            priv++; 
            await BSP.dbAdd('privat_belege', { date: t.datum, shop: t.empfaenger, brutto: Math.abs(t.betrag), type: isNeg?'ausgabe':'einnahme' });
         } else { bus++; }
      }
      
      BSP.emit('konto:imported');
      await _saveMessage('ai', `Kontoauszug erfolgreich importiert!\\nBank: ${data.bankdaten?.bankname || 'Unbekannt'}\\n${counter} Buchungen gesichert (${bus} Business, ${priv} Privat). Die neuen Salden sind jetzt in den Widgets aktiv.`);

    } catch(err) {
      await _saveMessage('ai', 'Beim Extrahieren der Buchungen ist ein Fehler aufgetreten: ' + err.message);
    }
    setTyping(null);
  }

  // --- Phase 2: Tooling & Natural Language ---
  async function _processIntent(text, maybeImageB64) {
    setTyping('KI denkt nach...');
    try {
      const payload = { prompt: text, system: getSystemContext(), tools: TOOLS, model: 'claude-haiku-4-5-20251001', maxTokens: 2000 };
      if (maybeImageB64) payload.imageB64 = maybeImageB64;

      const resp = await BSP.callClaude(payload);
      
      // Check Tool Call
      let toolCall = resp.content.find(c => c.type === 'tool_use');
      let aiText = resp.content.find(c => c.type === 'text');
      
      if (toolCall) {
         setTyping('KI wendet Tool an...');
         const resultMsg = await _executeTool(toolCall.name, toolCall.input);
         await _saveMessage('system', `[Tool executed: ${toolCall.name} - ${resultMsg}]`);
         await _saveMessage('ai', "Erledigt. Ich habe die Action entsprechend in der App ausgelÃ¶st!");
      } else if (aiText) {
         await _saveMessage('ai', aiText.text);
      }

    } catch(err) {
      await _saveMessage('ai', 'Ein Kommunikationsfehler ist aufgetreten: ' + err.message);
    }
    setTyping(null);
  }

  async function _executeTool(name, input) {
    switch (name) {
       case 'navigate':
         if (typeof KontoShell !== 'undefined' && input.target === 'konto') KontoShell.open();
         else if (typeof PrivatShell !== 'undefined' && input.target === 'privat') PrivatShell.open();
         else if (typeof ArchivShell !== 'undefined' && input.target === 'archiv') ArchivShell.open();
         else if (typeof SteuerModule !== 'undefined' && input.target === 'steuer') SteuerModule.open();
         close();
         return "Navigiert zu " + input.target;
       
       case 'query_db':
         if (input.query_type === 'mwst') return "Saldo ist " + (BSP.state ? BSP.state.mwstSaldo : 0);
         return "DB Query ausgefÃ¼hrt";
       
       case 'save_beleg':
         await BSP.addBeleg({ type:'er', brutto: parseFloat(input.amount)||0, shop: input.shop });
         return "Eingangsbeleg " + input.shop + " gesichert";

       case 'save_privat':
         await BSP.dbAdd('privat_belege', { date: new Date().toISOString().split('T')[0], shop: input.shop, brutto: parseFloat(input.amount)||0, type: 'ausgabe' });
         return "Privatausgabe " + input.shop + " erfasst";
         
       default:
         return "Unknown Tool";
    }
  }

  return { open, close, sendText, triggerCamera, handleFileUpload };
})();
