// ══════════════════════════════════════════════════════════════
// MODUL: KONTO IMPORT (All-In-One Import, Matching & Review Logic)
// ══════════════════════════════════════════════════════════════
'use strict';

const KontoImport = (() => {

  let _pages = [];
  let _stream = null;
  let _videoEl = null;
  let _canvasEl = null;
  let _currentBankId = null;
  let _pendingImport = null;

  // Event-Listener für automatisches Resume nach Bank-Neuanlage
  BSP.on("bank:created", (data) => {
    if (_pendingImport) {
      _currentBankId = data.id;
      _performMatching(_pendingImport);
      _pendingImport = null;
    }
  });

  const OVERLAY_HTML = `
  <div id="ko-scan-overlay" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:#000;z-index:9000;flex-direction:column">
    
    <div style="position:absolute;top:0;left:0;right:0;padding:20px;display:flex;justify-content:space-between;z-index:9001;background:linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)">
      <button class="btn btn-g" onclick="KontoImport.closeScan()">Abbrechen</button>
      <div id="ko-scan-counter" style="color:#fff;font-weight:600;background:var(--blu);padding:4px 12px;border-radius:20px">Seite 1</div>
    </div>

    <!-- Viewfinder -->
    <div style="flex:1;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden">
      <video id="ko-video" autoplay playsinline style="min-width:100%;min-height:100%;object-fit:cover;transform:scaleX(1)"></video>
      <canvas id="ko-canvas" style="display:none"></canvas>
      <div style="position:absolute;inset:40px;border:2px solid rgba(255,255,255,0.4);border-radius:8px">
        <div style="position:absolute;top:-2px;left:-2px;width:30px;height:30px;border-top:4px solid var(--gold);border-left:4px solid var(--gold);border-radius:8px 0 0 0"></div>
        <div style="position:absolute;top:-2px;right:-2px;width:30px;height:30px;border-top:4px solid var(--gold);border-right:4px solid var(--gold);border-radius:0 8px 0 0"></div>
        <div style="position:absolute;bottom:-2px;left:-2px;width:30px;height:30px;border-bottom:4px solid var(--gold);border-left:4px solid var(--gold);border-radius:0 0 0 8px"></div>
        <div style="position:absolute;bottom:-2px;right:-2px;width:30px;height:30px;border-bottom:4px solid var(--gold);border-right:4px solid var(--gold);border-radius:0 0 8px 0"></div>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:rgba(255,255,255,0.6);font-size:14px;letter-spacing:1px;font-weight:600;text-align:center">KONTOAUSZUG<br>FOKUSSIEREN</div>
      </div>
    </div>

    <!-- Multi-Page Preview & Management -->
    <div id="ko-pages-preview" style="display:none;padding:12px 16px;background:var(--s2);border-top:1px solid rgba(255,255,255,0.1);display:flex;gap:10px;overflow-x:auto;scrollbar-width:none;z-index:9002"></div>

    <!-- Multi-Page Prompt -->
    <div id="ko-multi-prompt" style="display:none;padding:16px;background:var(--bg3);text-align:center;z-index:9002">
      <div style="font-size:13px;margin-bottom:12px;color:var(--gold)">Seite hinzugefügt! Noch eine Seite scannen/hinzufügen?</div>
      <div style="display:flex;gap:12px;justify-content:center">
        <button class="btn btn-g btn-sm" onclick="document.getElementById('ko-upload-inp').click()">📥 Upload</button>
        <button class="btn btn-g btn-sm" onclick="KontoImport.resumeCam()">📷 Kamera</button>
        <button class="btn btn-gold btn-sm" onclick="KontoImport.processAllPages()">✨ Analysieren</button>
      </div>
    </div>

    <!-- Controls -->
    <div id="ko-scan-controls" style="height:140px;background:#000;display:flex;align-items:center;justify-content:center;position:relative;padding:0 30px;z-index:9002">
      <button id="ko-capture-btn" style="width:72px;height:72px;border-radius:50%;background:none;border:4px solid #fff;display:flex;align-items:center;justify-content:center;cursor:pointer" onclick="KontoImport.capturePage()">
        <div style="width:56px;height:56px;background:#fff;border-radius:50%"></div>
      </button>
      <button id="ko-finish-btn" class="btn btn-gold" style="display:none;position:absolute;right:30px" onclick="KontoImport.processAllPages()">Analysieren</button>
    </div>
  </div>
  `;

  function _injectHTML() {
    if (!document.getElementById('ko-scan-overlay')) {
      const el = document.createElement('div');
      el.innerHTML = OVERLAY_HTML;
      document.body.appendChild(el.firstElementChild);
    }
    _videoEl = document.getElementById('ko-video');
    _canvasEl = document.getElementById('ko-canvas');
  }

  async function startScan(bankId) {
    _injectHTML();
    _currentBankId = bankId;
    _pages = [];
    resumeCam();
  }

  async function resumeCam() {
    document.getElementById('ko-scan-counter').textContent = _pages.length ? `Seite ${_pages.length + 1}` : 'Seite 1';
    document.getElementById('ko-scan-counter').style.background = 'var(--blu)';
    document.getElementById('ko-finish-btn').style.display = _pages.length ? 'flex' : 'none';
    document.getElementById('ko-scan-overlay').style.display = 'flex';
    document.getElementById('ko-scan-controls').style.display = 'flex';
    document.getElementById('ko-multi-prompt').style.display = 'none';
    _updatePreviewList();
    
    if (_stream) _stream.getTracks().forEach(t => t.stop());
    
    try {
      _stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false });
      _videoEl.srcObject = _stream;
      await _videoEl.play();
    } catch(e) {
      BSP.toast('Kamera-Fehler: ' + e.message, 'er');
    }
  }

  function _updatePreviewList() {
    const listInfo = document.getElementById('ko-pages-preview');
    if (!listInfo) return;
    if (_pages.length === 0) { listInfo.style.display = 'none'; return; }
    listInfo.style.display = 'flex';
    listInfo.innerHTML = _pages.map((p, i) => `
      <div style="position:relative;flex-shrink:0;width:60px;height:80px;border-radius:8px;overflow:hidden;border:1px solid #fff">
        ${p.isPdf 
          ? '<div style="width:100%;height:100%;background:#fff;display:flex;align-items:center;justify-content:center;color:red;font-weight:bold;font-size:12px">PDF</div>'
          : `<img src="${p.thumbUrl}" style="width:100%;height:100%;object-fit:cover">`}
        <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.6);color:#fff;font-size:9px;text-align:center;padding:2px">${i+1}</div>
      </div>`).join('');
  }

  async function handleUpload(inp, bankId) {
    if (!inp.files || !inp.files.length) return;
    _currentBankId = bankId;
    _injectHTML();

    BSP.showScrim('Lade Dateien (' + inp.files.length + ')...');
    
    for (let f of inp.files) {
      if (f.type.includes('pdf')) {
        if (typeof pdfjsLib === 'undefined') {
          BSP.toast('PDF Scanner lädt noch, bitte kurz warten...', 'wr');
          continue;
        }
        try {
          const arrayBuffer = await f.arrayBuffer();
          const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          const numPages = pdfDoc.numPages;
          
          // Entnehme maximal 15 Seiten um Speicher zu schonen
          const maxP = Math.min(numPages, 15);
          for (let i = 1; i <= maxP; i++) {
             BSP.showScrim(`Lese PDF... Seite ${i}/${maxP}`);
             const page = await pdfDoc.getPage(i);
             const viewport = page.getViewport({ scale: 1.5 });
             const canvas = document.createElement('canvas');
             const ctx = canvas.getContext('2d');
             canvas.height = viewport.height;
             canvas.width = viewport.width;
             
             await page.render({ canvasContext: ctx, viewport: viewport }).promise;
             
             const rawB64 = canvas.toDataURL('image/jpeg', 0.8);
             const compB64 = await BSP.compressImage(rawB64, 1600, 400); 
             
             const mainBlob = BSP.b64toBlob(compB64);
             const objectUrl = URL.createObjectURL(mainBlob);
             const thumbB64 = await BSP.compressImage(compB64, 400, 60);
             const thumbBlob = BSP.b64toBlob(thumbB64);
             const thumbUrl = URL.createObjectURL(thumbBlob);
             
             _pages.push({ blob: mainBlob, objectUrl, thumbUrl, isPdfPage: true });
          }
        } catch(e) {
          BSP.toast('Fehler beim PDF lesen: ' + e.message, 'er');
          console.error(e);
        }
      } else {
        await new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = async (e) => {
            const compB64 = await BSP.compressImage(e.target.result, 1600, 400);
            const mainBlob = BSP.b64toBlob(compB64);
            const objectUrl = URL.createObjectURL(mainBlob);

            const thumbB64 = await BSP.compressImage(compB64, 400, 60);
            const thumbBlob = BSP.b64toBlob(thumbB64);
            const thumbUrl = URL.createObjectURL(thumbBlob);

            _pages.push({ blob: mainBlob, objectUrl, thumbUrl });
            resolve();
          };
          reader.readAsDataURL(f);
        });
      }
    }
    inp.value = '';
    BSP.hideScrim();
    _showMultiPrompt();
  }

  function _showMultiPrompt() {
    if (_stream) { _stream.getTracks().forEach(t => t.stop()); _stream = null; }
    document.getElementById('ko-scan-overlay').style.display = 'flex';
    document.getElementById('ko-scan-controls').style.display = 'none';
    document.getElementById('ko-multi-prompt').style.display = 'block';
    
    _updatePreviewList();
    document.getElementById('ko-scan-counter').textContent = `${_pages.length} Seite${_pages.length>1?'n':''} in Session`;
    document.getElementById('ko-scan-counter').style.background = 'var(--gold)';
  }

  function closeScan() {
    const el = document.getElementById('ko-scan-overlay');
    if(el) el.style.display = 'none';
    if (_stream) {
      _stream.getTracks().forEach(t => t.stop());
      _stream = null;
    }
  }

  async function capturePage() {
    if (!_stream || !_videoEl) return;
    
    const btnBox = document.getElementById('ko-capture-btn').parentElement;
    const flash = document.createElement('div');
    flash.style = 'position:absolute;inset:0;background:#fff;z-index:99;opacity:0.8';
    btnBox.appendChild(flash);
    setTimeout(() => flash.remove(), 150);

    _canvasEl.width = _videoEl.videoWidth;
    _canvasEl.height = _videoEl.videoHeight;
    const ctx = _canvasEl.getContext('2d');
    ctx.drawImage(_videoEl, 0, 0);

    const mainBlob = await new Promise(res => _canvasEl.toBlob(res, 'image/jpeg', 0.85));
    const tempUrl = URL.createObjectURL(mainBlob);
    const compMainB64 = await BSP.compressImage(tempUrl, 1600, 400);
    URL.revokeObjectURL(tempUrl);

    const compMainBlob = BSP.b64toBlob(compMainB64);
    const objectUrl = URL.createObjectURL(compMainBlob);

    const thumbB64 = await BSP.compressImage(compMainB64, 400, 60);
    const thumbBlob = BSP.b64toBlob(thumbB64);
    const thumbUrl = URL.createObjectURL(thumbBlob);

    _pages.push({ blob: compMainBlob, objectUrl, thumbUrl });
    _showMultiPrompt();
  }

  function _revokeAllPages() {
    _pages.forEach(p => {
      if (p.objectUrl) URL.revokeObjectURL(p.objectUrl);
      if (p.thumbUrl) URL.revokeObjectURL(p.thumbUrl);
    });
    _pages = [];
  }

  function _blobToB64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Blob lesen fehlgeschlagen'));
      reader.readAsDataURL(blob);
    });
  }

  // ════════════════════════════════════════════════════════════
  // 1. KI-ANALYSE
  // ════════════════════════════════════════════════════════════

  const KI_PROMPT = `Analysiere diesen Kontoauszug. Antworte NUR mit reinem JSON, kein anderer Text, kein Markdown, keine Erklärung:
{
  "bankdaten": {
    "bankname": "Name der Bank",
    "iban": "DE12 3456 7890",
    "kontoinhaber": "Name des Inhabers"
  },
  "buchungen": [
    {
      "datum": "2026-03-01",
      "betrag": -47.50,
      "verwendungszweck": "REWE SAGT DANKE",
      "auftraggeber_empfaenger": "REWE",
      "typ": "ausgabe",
      "skr03_vorschlag": "Bürobedarf"
    }
  ],
  "anfangssaldo": 1000.00,
  "endsaldo": 952.50,
  "zeitraum_von": "2026-03-01",
  "zeitraum_bis": "2026-03-31"
}
Negative Beträge sind Ausgaben. Positive Beträge sind Eingänge. Fehlende Felder als null.`;

  async function processAllPages() {
    if (!_pages.length) return;
    closeScan();
    let res = null;

    try {
      BSP.showScrim('Analysiere Kontoauszug...');
      
      let finalB64 = '';
      if (_pages.length === 1) {
        finalB64 = await _blobToB64(_pages[0].blob);
      } else {
        BSP.showScrim('Fasse Dokumente zusammen...');
        const loadedImages = await Promise.all(_pages.map(async p => {
          const b64 = await _blobToB64(p.blob);
          return new Promise(res => {
             const img = new Image();
             img.onload = () => res(img);
             img.src = b64;
          });
        }));
        
        const targetWidth = 1200;
        let totalHeight = 0;
        loadedImages.forEach(img => {
          totalHeight += img.height * (targetWidth / img.width);
        });
        
        const fCanvas = document.createElement('canvas');
        fCanvas.width = targetWidth;
        fCanvas.height = totalHeight;
        const fctx = fCanvas.getContext('2d');
        fctx.fillStyle = 'white';
        fctx.fillRect(0,0,targetWidth,totalHeight);
        
        let cY = 0;
        loadedImages.forEach(img => {
          const h = img.height * (targetWidth / img.width);
          fctx.drawImage(img, 0, cY, targetWidth, h);
          cY += h;
        });
        
        finalB64 = fCanvas.toDataURL('image/jpeg', 0.6);
      }

      BSP.showScrim('Sende an KI, bitte warten...');
      res = await BSP.callClaude({ prompt: KI_PROMPT, images: [finalB64], model: 'claude-sonnet-4-5', maxTokens: 4096 });
    } catch(err) {
      BSP.toast('Fehler bei der Analyse: ' + err.message, 'er');
      _revokeAllPages();
      BSP.hideScrim();
      return;
    } finally {
      BSP.hideScrim(); 
      _revokeAllPages();
    }

    console.log('KI Raw Response:', res);
    
    // JSON Parse in try-catch to not fail silently
    const parsedData = _parseKIResponse(res);
    if (!parsedData) return;

    // Bank-Check logic
    if (parsedData.bankdaten && _currentBankId) {
       const banken = await BSP.dbGetAll('konto_banken') || [];
       const dbBank = banken.find(b => b.id === _currentBankId);
       
       if (dbBank) {
         let diff = false;
         if (parsedData.bankdaten.iban && dbBank.iban && parsedData.bankdaten.iban.replace(/\\s/g,'') !== dbBank.iban.replace(/\\s/g,'')) diff = true;
         if (parsedData.bankdaten.bankname && dbBank.name && !dbBank.name.toLowerCase().includes(parsedData.bankdaten.bankname.toLowerCase().substring(0,4))) diff = true;

         if (diff) {
            const action = await _showBankMismatchSheet(parsedData, dbBank);
            if (action === 'new') {
               _pendingImport = parsedData; // store safely in memory
               KontoShell.showAddBank(parsedData.bankdaten); 
               return; // halt and wait for bank:created event
            }
         }
       }
    }

    await _performMatching(parsedData);
  }

  function _parseKIResponse(response) {
    // Schritt 1: Markdown-Wrapper (```json) entfernen und strikt trimmen
    let cleanRes = response.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    // Alles vor dem ersten { oder [ und nach dem letzten } oder ] abschneiden
    const firstBrace = cleanRes.indexOf('{');
    const firstBracket = cleanRes.indexOf('[');
    const lastBrace = cleanRes.lastIndexOf('}');
    const lastBracket = cleanRes.lastIndexOf(']');
    
    let startIdx = firstBrace !== -1 ? firstBrace : firstBracket;
    if (firstBrace !== -1 && firstBracket !== -1) startIdx = Math.min(firstBrace, firstBracket);

    let endIdx = lastBrace !== -1 ? lastBrace : lastBracket;
    if (lastBrace !== -1 && lastBracket !== -1) endIdx = Math.max(lastBrace, lastBracket);

    if (startIdx === -1 || endIdx === -1) {
      BSP.toast('KI hat kein strukturiertes Ergebnis geliefert. (Siehe Konsole)', 'wr');
      return null;
    }
    
    let jsonStr = cleanRes.substring(startIdx, endIdx + 1);
    
    // Unmaskierte Zeilenumbrüche und Tabs (von der KI oft fälschlich generiert) killen den JSON.parse.
    // Wir ersetzen alle echten Linebreaks und Tabs mit Leerzeichen.
    // (Echte \n Escape-Sequenzen bleiben erhalten, da sie aus backslash und n bestehen)
    jsonStr = jsonStr.replace(/[\n\r\t]+/g, ' ');

    // Schritt 2: Parsen mit Fallback zu RAW anzeige
    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch(e) {
      // Zeige die Rohtexte an, damit der User sieht wo es klemmt
      BSP.showSheet(`<div class="sh"></div><div class="mod-header"><div class="mod-title">KI JSON Parse Fehler</div></div><textarea style="width:100%;height:300px;font-family:monospace;font-size:11px" disabled>${BSP.eh(response)}</textarea><br><button class="btn btn-g" onclick="BSP.closeSheet()">Schließen</button>`);
      BSP.toast('Ergebnis konnte nicht verarbeitet werden.', 'wr');
      return null;
    }
    
    // Schritt 3: Buchungen finden egal wie sie heißen
    const buchungen = data.buchungen || data.transactions || data.items || data.entries || Object.values(data).find(v => Array.isArray(v));
    
    if (!buchungen || buchungen.length === 0) {
      BSP.toast('Keine Buchungen erkannt', 'wr');
      return null;
    }
    
    // Normalisieren
    buchungen.forEach(b => {
      b.empfaenger = b.empfaenger || b.auftraggeber_empfaenger || b.auftraggeber || '';
      b.betrag = parseFloat(b.betrag) || 0;
    });

    return { 
      buchungen, 
      bankdaten: data.bankdaten || null,
      anfangssaldo: data.anfangssaldo,
      endsaldo: data.endsaldo,
      zeitraum_von: data.zeitraum_von || null,
      zeitraum_bis: data.zeitraum_bis || null
    };
  }

  async function _showBankMismatchSheet(parsedData, dbBank) {
    return new Promise((resolve) => {
      const bBank = parsedData.bankdaten.bankname || 'Unbekannt';
      const bIban = parsedData.bankdaten.iban || 'Keine IBAN';
      const bInhaber = parsedData.bankdaten.kontoinhaber || 'Unbekannt';
      
      const dbBankName = dbBank.name || 'Unbekannt';
      const dbIban = dbBank.iban || 'Keine IBAN hinterlegt';

      const html = `
        <div class="sh"></div>
        <div class="mod-header">
          <h2 class="mod-title" style="color:var(--orn)">Bankdaten-Abgleich</h2>
          <p class="mod-sub">Die erkannten Daten im Dokument weichen von der App-Auswahl ab.</p>
        </div>
        <div style="background:var(--s2); border:1px solid var(--br); border-radius:var(--r16); padding:16px; margin-bottom:16px;">
          <div style="font-weight:600; margin-bottom:8px;">Erkannt im Kontoauszug:</div>
          <div style="font-size:14px; color:var(--txt2); margin-bottom:4px;">Bank: <span style="color:var(--txt)">${BSP.eh(bBank)}</span></div>
          <div style="font-size:14px; color:var(--txt2); margin-bottom:4px;">IBAN: <span style="color:var(--txt)">${BSP.eh(bIban)}</span></div>
          <div style="font-size:14px; color:var(--txt2);">Inhaber: <span style="color:var(--txt)">${BSP.eh(bInhaber)}</span></div>
        </div>
        <div style="background:var(--s2); border:1px solid var(--br); border-radius:var(--r16); padding:16px; margin-bottom:20px;">
          <div style="font-weight:600; margin-bottom:8px;">Hinterlegt in App (${BSP.eh(dbBankName)}):</div>
          <div style="font-size:14px; color:var(--txt2); margin-bottom:4px;">Bank: <span style="color:var(--txt)">${BSP.eh(dbBankName)}</span></div>
          <div style="font-size:14px; color:var(--txt2);">IBAN: <span style="color:var(--txt)">${BSP.eh(dbIban)}</span></div>
        </div>
        
        <div style="display:flex; flex-direction:column; gap:8px">
          <button class="btn btn-gold" style="justify-content:center" id="btn-mm-update">Hinterlegte Daten aktualisieren</button>
          <button class="btn btn-g" style="justify-content:center" id="btn-mm-ignore">Ignorieren</button>
          <button class="btn btn-w" style="justify-content:center; color:var(--blu)" id="btn-mm-new">Neue Bank anlegen</button>
        </div>
        <div style="height:140px;flex-shrink:0;pointer-events:none"></div>
      `;
      
      BSP.showSheet(html);

      setTimeout(() => {
        document.getElementById('btn-mm-update').onclick = async () => {
          dbBank.iban = parsedData.bankdaten.iban || dbBank.iban;
          dbBank.name = parsedData.bankdaten.bankname || dbBank.name;
          await BSP.dbPut('konto_banken', dbBank);
          resolve('update');
        };
        document.getElementById('btn-mm-ignore').onclick = () => { resolve('ignore'); };
        document.getElementById('btn-mm-new').onclick = () => { resolve('new'); };
      }, 100);
    });
  }

  // ════════════════════════════════════════════════════════════
  // 2. AUTOMATISCHER ABGLEICH MIT BELEGEN
  // ════════════════════════════════════════════════════════════

  async function _performMatching(parsedData) {
    BSP.showScrim('Gleiche Transaktionen mit Belegen ab...');
    
    let alleBelege = [];
    try { alleBelege = await BSP.dbGetAll('belege') || []; } catch(e){}
    BSP.hideScrim();

    const transactions = parsedData.buchungen;

    for (let txn of transactions) {
      txn.id = 'txn_' + Date.now() + Math.random().toString().slice(2,8);
      txn.bankId = _currentBankId;
      txn.status = 'offen'; // Standard-Status
      txn.buchungstyp = txn.buchungstyp || txn.typ || 'Sonstige';

      const tShop = (txn.empfaenger || '').toLowerCase();
      
      // Eingänge (Rechnungen die wir gestellt haben = ar)
      if (txn.betrag > 0) {
        const arBelege = alleBelege.filter(b => b.type === 'ar');
        const possibleAR = arBelege.filter(b => {
          if (!b.date || !b.brutto) return false;
          const daysDiff = Math.abs((new Date(b.date+'T00:00:00') - new Date(txn.datum+'T00:00:00')) / 864e5);
          const amtDiff = Math.abs(Math.abs(b.brutto) - Math.abs(txn.betrag));
          return daysDiff <= 3 && amtDiff <= 0.50; // +- 3 Tage, +- 50 Cent
        });

        let bestMatch = null; let scoreMax = 0;
        for (let m of possibleAR) {
          let sc = 0;
          const bEmpf = (m.empfaenger || m.shop || '').toLowerCase();
          if (tShop.includes(bEmpf.split(' ')[0]) || bEmpf.includes(tShop.split(' ')[0])) sc += 5;
          const diff = Math.abs(Math.abs(m.brutto) - Math.abs(txn.betrag));
          if (diff === 0) sc += 5; else if (diff <= 0.05) sc += 4; else if (diff <= 0.50) sc += 1;
          if (m.date === txn.datum) sc += 2;
          if (sc > scoreMax) { scoreMax = sc; bestMatch = m; }
        }

        if (scoreMax >= 3 && bestMatch) {
          txn.status = 'abgeglichen';
          txn.belegId = bestMatch.id;
        } else {
          txn.hasAlert = 'Mögliche fehlende Ausgangsrechnung';
        }

      // Ausgaben (Rechnungen die wir bekommen haben = er/bar)
      } else {
        const possibleBelege = alleBelege.filter(b => {
          if (!b.date || !b.brutto) return false;
          const daysDiff = Math.abs((new Date(b.date+'T00:00:00') - new Date(txn.datum+'T00:00:00')) / 864e5);
          const amtDiff = Math.abs(Math.abs(b.brutto) - Math.abs(txn.betrag));
          return daysDiff <= 3 && amtDiff <= 0.50;
        });

        let bestMatch = null; let scoreMax = 0;
        for (let m of possibleBelege) {
          let sc = 0;
          const bShop = (m.shop || '').toLowerCase();
          if (tShop.includes(bShop) || bShop.includes(tShop)) sc += 5;
          const diff = Math.abs(Math.abs(m.brutto) - Math.abs(txn.betrag));
          if (diff === 0) sc += 5; else if (diff <= 0.05) sc += 4; else if (diff <= 0.50) sc += 1;
          if (m.date === txn.datum) sc += 2;
          if (sc > scoreMax) { scoreMax = sc; bestMatch = m; }
        }

        if (scoreMax >= 5 && bestMatch) {
          txn.status = 'abgeglichen';
          txn.belegId = bestMatch.id;
        }
      }
    }
    
    _showReviewDashboard(parsedData, transactions);
  }

  // ════════════════════════════════════════════════════════════
  // 3. ERGEBNIS ANZEIGEN (Dashboard)
  // ════════════════════════════════════════════════════════════

  function _showReviewDashboard(parsedData, transactions) {
    let sumIn = 0; let countIn = 0;
    let sumOut = 0; let countOut = 0;
    
    transactions.forEach(t => {
       const b = t.betrag || 0;
       if (b >= 0) { sumIn += b; countIn++; }
       else { sumOut += Math.abs(b); countOut++; }
    });

    const saldoNeu = parsedData.endsaldo !== null && parsedData.endsaldo !== undefined ? `${parsedData.endsaldo.toFixed(2)} €` : '?';
    const saldoAlt = parsedData.anfangssaldo !== null && parsedData.anfangssaldo !== undefined ? `${parsedData.anfangssaldo.toFixed(2)} €` : '?';
    const zVon = parsedData.zeitraum_von || '?';
    const zBis = parsedData.zeitraum_bis || '?';

    let ht = `
      <div class="sh"></div>
      <div class="mod-header" style="margin-bottom:12px;">
        <h2 class="mod-title">Übersicht Kontoauszug</h2>
        <p class="mod-sub">Zeitraum: ${BSP.eh(zVon)} bis ${BSP.eh(zBis)}</p>
      </div>
      
      <div style="display:flex; justify-content:space-between; background:var(--s1); padding:12px; border-radius:var(--r12); margin-bottom:16px;">
        <div>
           <div style="font-size:12px; color:var(--txt2)">Start</div>
           <div style="font-weight:600">${saldoAlt}</div>
        </div>
        <div style="text-align:right">
           <div style="font-size:12px; color:var(--txt2)">Ende</div>
           <div style="font-weight:600">${saldoNeu}</div>
        </div>
      </div>

      <div style="display:flex; gap:12px; margin-bottom:16px;">
        <div style="flex:1; background:rgba(0,180,100,0.1); border:1px solid rgba(0,180,100,0.2); padding:8px; border-radius:var(--r8); text-align:center;">
           <div style="font-size:12px; color:var(--grn)">${countIn} Eingänge</div>
           <div style="font-weight:600; color:var(--grn)">+${sumIn.toFixed(2)}</div>
        </div>
        <div style="flex:1; background:rgba(255,80,80,0.1); border:1px solid rgba(255,80,80,0.2); padding:8px; border-radius:var(--r8); text-align:center;">
           <div style="font-size:12px; color:var(--red)">${countOut} Ausgänge</div>
           <div style="font-weight:600; color:var(--red)">-${sumOut.toFixed(2)}</div>
        </div>
      </div>

      <div style="max-height:50vh; overflow-y:auto; margin-bottom:16px;">
    `;
    
    transactions.forEach((t) => {
      const isPos = (t.betrag || 0) >= 0;
      const bColor = isPos ? 'var(--grn)' : 'var(--red)';
      
      let badgeHtml = '';
      if (t.status === 'abgeglichen') badgeHtml = `<div class="badge" style="background:var(--grn);color:#fff">✓ Beleg erkannt</div>`;
      else if (t.hasAlert) badgeHtml = `<div class="badge" style="background:var(--red);color:#fff">⚠️ ${BSP.eh(t.hasAlert)}</div>`;
      else badgeHtml = `<div class="badge" style="background:var(--orn);color:#fff">Offen</div>`;

      ht += `
        <div style="background:var(--s2); padding:12px; border-radius:var(--r8); margin-bottom:8px; border:1px solid var(--br)">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
            <div style="font-size:13px; color:var(--txt2);">${t.datum || ''}</div>
            <div style="font-weight:600; color:${bColor};">${t.betrag.toFixed(2)} €</div>
          </div>
          <div style="font-weight:500; font-size:14px; margin-bottom:2px">${BSP.eh(t.empfaenger)}</div>
          <div style="font-size:12px; color:var(--txt3); margin-bottom:8px;">${BSP.eh(t.verwendungszweck)}</div>
          ${badgeHtml}
        </div>
      `;
    });
    
    const unmatchedCount = transactions.filter(t => t.status !== 'abgeglichen').length;
    
    ht += `
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-g" style="flex:1;justify-content:center" onclick="BSP.closeSheet()">Verwerfen</button>
        ${unmatchedCount > 0 
          ? `<button class="btn btn-gold" style="flex:2;justify-content:center" id="ki-review-start">${unmatchedCount} offene Positionen klären</button>` 
          : `<button class="btn btn-gold" style="flex:2;justify-content:center" id="ki-review-save">Alles Speichern</button>` }
      </div>
      <div style="height:140px;flex-shrink:0;pointer-events:none"></div>
    `;
    
    BSP.showSheet(ht);
    
    setTimeout(() => {
      const btnStart = document.getElementById('ki-review-start');
      if (btnStart) btnStart.onclick = () => _startInteractiveReview(transactions);

      const btnSave = document.getElementById('ki-review-save');
      if (btnSave) btnSave.onclick = () => _saveAllTransactions(transactions);
    }, 100);
  }

  // ════════════════════════════════════════════════════════════
  // 4. INTERAKTIVE DURCHARBEITUNG
  // ════════════════════════════════════════════════════════════

  function _getSKR03Liste() {
    return [
      "Bürobedarf", "Reisekosten", "Werbekosten", "Wareneingang", "Fremdleistungen",
      "Lizenzgebühren", "Porto", "Telefon/Internet", "Miete", "Softwareabonnements",
      "Geringwertige Wirtschaftsgüter", "Bewirtungskosten", "Sonstige"
    ];
  }

  async function _startInteractiveReview(transactions) {
    const unmatched = transactions.filter(t => t.status !== 'abgeglichen');
    let currentIndex = 0;

    const transitionActive = true; // Always active default for test phase

    function showNext() {
       if (currentIndex >= unmatched.length) {
         _saveAllTransactions(transactions);
         return;
       }
       const t = unmatched[currentIndex];
       const bColor = t.betrag >= 0 ? 'var(--grn)' : 'var(--red)';

       // Generate SKR03 options
       const skrListe = _getSKR03Liste();
       let skrOptions = ``;
       // fallback matching if the AI suggestion is not exactly in list
       let aiSug = t.skr03_vorschlag || 'Sonstige';
       if (!skrListe.includes(aiSug)) skrListe.unshift(aiSug); // add dynamic if strictly needed
       skrListe.forEach(s => {
         skrOptions += `<option value="${BSP.eh(s)}" ${s === aiSug ? 'selected' : ''}>${BSP.eh(s)}</option>`;
       });

       const privBusHtml = transitionActive ? `
         <div style="font-weight:600;margin-bottom:8px">1. Bereich zuordnen:</div>
         <div style="display:flex;gap:10px;margin-bottom:20px;">
           <button class="btn btn-g" style="flex:1;justify-content:center;background:var(--bg3)" id="btn-bus">🏢 Business</button>
           <button class="btn btn-g" style="flex:1;justify-content:center;background:var(--bg3)" id="btn-priv">🏡 Privat</button>
         </div>
       ` : `<input type="hidden" id="force-business" value="1">`; // Fallback to business

       let ht = `
         <div class="sh"></div>
         <div class="mod-header" style="margin-bottom:12px;">
            <div class="mod-title">Details klären</div>
            <div class="mod-sub">Position ${currentIndex + 1} von ${unmatched.length}</div>
         </div>
         
         <div style="background:var(--s2); padding:16px; border-radius:var(--r12); margin-bottom:20px; text-align:center; border:1px solid var(--br)">
            <div style="font-size:24px; font-weight:700; color:${bColor}; margin-bottom:8px;">${t.betrag.toFixed(2)} €</div>
            <div style="font-weight:500; font-size:15px; margin-bottom:4px;">${BSP.eh(t.empfaenger)}</div>
            <div style="font-size:13px; color:var(--txt3); margin-bottom:12px;">${BSP.eh(t.datum)} • ${BSP.eh(t.verwendungszweck)}</div>
            ${t.hasAlert ? `<div class="badge" style="background:var(--red);color:#fff;margin:auto">⚠️ ${BSP.eh(t.hasAlert)}</div>` : ''}
         </div>

         ${privBusHtml}

         <div id="skr03-box" style="margin-bottom:24px; ${transitionActive ? 'opacity:0.3;pointer-events:none;transition:0.2s' : ''}">
            <div style="font-weight:600;margin-bottom:8px">2. Kategorie (SKR03):</div>
            <select id="skr-select" class="sett-inp">
              ${skrOptions}
            </select>
            <div style="font-size:12px;color:var(--txt3);margin-top:6px;">KI-Kategorie Vorschlag automatisch vorausgewählt.</div>
         </div>

         <div style="display:flex;gap:8px">
           <button class="btn btn-g" style="flex:1;justify-content:center" id="ki-rev-skip">Später klären</button>
           <button class="btn btn-gold" style="flex:1;justify-content:center" id="ki-rev-next">Bestätigen</button>
         </div>
         <div style="height:140px;flex-shrink:0;pointer-events:none"></div>
       `;

       BSP.showSheet(ht);

       setTimeout(() => {
          let chosenArea = transitionActive ? null : 'Business';

          const btnBus = document.getElementById('btn-bus');
          const btnPriv = document.getElementById('btn-priv');
          const skrBox = document.getElementById('skr03-box');

          if (btnBus && btnPriv && skrBox) {
            btnBus.onclick = () => { chosenArea = 'Business'; btnBus.style.background = 'var(--blu)'; btnPriv.style.background = 'var(--bg3)'; skrBox.style.opacity = '1'; skrBox.style.pointerEvents = 'auto'; };
            btnPriv.onclick = () => { chosenArea = 'Privat'; btnPriv.style.background = 'var(--orn)'; btnBus.style.background = 'var(--bg3)'; skrBox.style.opacity = '0.3'; skrBox.style.pointerEvents = 'none'; };
          }

          document.getElementById('ki-rev-next').onclick = () => {
             if (!chosenArea) return BSP.toast('Bitte Bereich wählen (Business/Privat)', 'wr');
             t.bereich = chosenArea;
             if (chosenArea === 'Business') {
                t.skr03 = document.getElementById('skr-select').value;
             }
             t.status = 'geklärt'; // or some valid final state
             currentIndex++;
             showNext();
          };

          document.getElementById('ki-rev-skip').onclick = () => {
             t.status = 'pending_review';
             currentIndex++;
             showNext();
          };
       }, 100);
    }
    
    showNext();
  }

  // ════════════════════════════════════════════════════════════
  // 5. BATCH SPEICHERN
  // ════════════════════════════════════════════════════════════

  async function _saveAllTransactions(transactions) {
     BSP.showScrim('Speichere Buchungen...');
     let gesichert = 0;
     try {
       for (let t of transactions) {
         // Exports logic requirement: "Geldeingänge Geschäftskonto -> immer in Export. Geldeingänge Privatkonto -> nur wenn Business getaggt, mit Hinweis."
         // This export formatting logic relies on tags and bereich
         t.tags = t.tags || {};
         t.tags.kontoTyp = t.bereich || 'Business';
         
         await BSP.dbAdd('konto_buchungen', t);
         gesichert++;
       }
       BSP.emit('konto:imported');
       BSP.closeSheet();
       BSP.toast(`${gesichert} Transaktionen gesichert`, 'ok');
       if (typeof KontoUebersicht !== 'undefined') KontoUebersicht.renderList(_currentBankId);
     } catch(e) {
       BSP.toast('Fehler beim Speichern: ' + e.message, 'er');
     } finally {
       BSP.hideScrim();
     }
  }

  return { startScan, handleUpload, closeScan, capturePage, resumeCam, processAllPages };

})();
