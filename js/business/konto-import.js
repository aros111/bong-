// ══════════════════════════════════════════════════════════════
// MODUL: KONTO IMPORT
// Scanner/Upload Logik & KI Extraktion für das Konto Modul
// ══════════════════════════════════════════════════════════════
'use strict';

const KontoImport = (() => {

  let _pages = [];
  let _stream = null;
  let _videoEl = null;
  let _canvasEl = null;
  let _currentBankId = null;
  let _pendingImport = null;

  // Event-Listener für Bank-Neuanlage mit Zwischenspeicherung
  BSP.on("bank:created", (data) => {
    if (_pendingImport) {
      _currentBankId = data.id;
      _presentResults(_pendingImport);
      _pendingImport = null;
    }
  });


  const OVERLAY_HTML = `
  <!-- ═══ SCANNER OVERLAY (Multi-Page) ═══ -->
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
        <button class="btn btn-gold btn-sm" onclick="KontoImport.processAllPages()">✨ Fertig & Analyse</button>
      </div>
    </div>

    <!-- Controls -->
    <div id="ko-scan-controls" style="height:140px;background:#000;display:flex;align-items:center;justify-content:center;position:relative;padding:0 30px;z-index:9002">
      <button id="ko-capture-btn" style="width:72px;height:72px;border-radius:50%;background:none;border:4px solid #fff;display:flex;align-items:center;justify-content:center;cursor:pointer" onclick="KontoImport.capturePage()">
        <div style="width:56px;height:56px;background:#fff;border-radius:50%"></div>
      </button>
      <button id="ko-finish-btn" class="btn btn-gold" style="display:none;position:absolute;right:30px" onclick="KontoImport.processAllPages()">Fertig ✓</button>
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
      await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          if (f.type.includes('pdf')) {
            const pdfB64 = e.target.result;
            _pages.push({ isPdf: true, b64: pdfB64, objectUrl: null, thumbUrl: null });
            resolve();
          } else {
            const compB64 = await BSP.compressImage(e.target.result, 1600, 400);
            const mainBlob = BSP.b64toBlob(compB64);
            const objectUrl = URL.createObjectURL(mainBlob);

            const thumbB64 = await BSP.compressImage(compB64, 400, 60);
            const thumbBlob = BSP.b64toBlob(thumbB64);
            const thumbUrl = URL.createObjectURL(thumbBlob);

            _pages.push({ blob: mainBlob, objectUrl, thumbUrl });
            resolve();
          }
        };
        reader.readAsDataURL(f);
      });
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

    // Canvas
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


  function _parseKIResponse(response) {
    const jsonMatch = response.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!jsonMatch) {
      BSP.toast('KI hat kein strukturiertes Ergebnis geliefert', 'wr');
      return null;
    }
    
    let data;
    try {
      data = JSON.parse(jsonMatch[0]);
    } catch(e) {
      BSP.toast('Ergebnis konnte nicht verarbeitet werden', 'wr');
      return null;
    }
    
    const buchungenArray = Array.isArray(data) ? data : (data.buchungen || data.transactions || data.items || data.entries || Object.values(data).find(v => Array.isArray(v)));
    
    if (!buchungenArray || buchungenArray.length === 0) {
      BSP.toast('Keine Buchungen im Dokument erkannt', 'wr');
      return null;
    }
    
    // Normalize fields
    buchungenArray.forEach(b => {
      b.empfaenger = b.empfaenger || b.auftraggeber || '';
      b.betrag = b.betrag || 0;
    });

    return { 
      buchungen: buchungenArray, 
      bankdaten: data.bankdaten || null,
      anfangssaldo: data.anfangssaldo !== undefined ? data.anfangssaldo : (data.saldoAlt !== undefined ? data.saldoAlt : null),
      endsaldo: data.endsaldo !== undefined ? data.endsaldo : (data.saldoNeu !== undefined ? data.saldoNeu : null),
      zeitraum_von: data.zeitraum_von || data.zeitraum || null,
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
          <p class="mod-sub">Die erkannten Daten weichen von der Auswahl ab.</p>
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
          // Update DB
          dbBank.iban = parsedData.bankdaten.iban || dbBank.iban;
          dbBank.name = parsedData.bankdaten.bankname || dbBank.name;
          await BSP.dbPut('konto_banken', dbBank);
          resolve('update');
        };
        document.getElementById('btn-mm-ignore').onclick = () => {
          resolve('ignore');
        };
        document.getElementById('btn-mm-new').onclick = () => {
          resolve('new');
        };
      }, 100);
    });
  }

  function _blobToB64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Blob lesen fehlgeschlagen'));
      reader.readAsDataURL(blob);
    });
  }

  async function processAllPages() {
    if (!_pages.length) return;
    closeScan();

    const prompt = `Analysiere diesen Kontoauszug. Antworte NUR mit einem JSON-Objekt, kein anderer Text:
{
  "bankdaten": {
    "bankname": "Name der Bank",
    "iban": "DE12 3456 7890",
    "kontoinhaber": "Name des Inhabers",
    "zeitraum_von": "2026-03-01",
    "zeitraum_bis": "2026-03-31",
    "anfangssaldo": 1234.56,
    "endsaldo": 987.06
  },
  "buchungen": [
    {
      "datum": "2026-03-01",
      "betrag": -47.50,
      "verwendungszweck": "REWE SAGT DANKE",
      "auftraggeber": "REWE",
      "typ": "lastschrift"
    }
  ]
}
Negative Beträge sind Ausgaben, positive sind Eingänge. Fehlende Felder als null.`;

    let parsedData = null;

    try {
      BSP.showScrim('Analysiere Kontoauszug...');
      const b64Array = await Promise.all(_pages.map(async p => {
        if (p.isPdf) return p.b64;
        return await _blobToB64(p.blob);
      }));
      
      const res = await BSP.callClaude({ prompt, images: b64Array, model: 'claude-sonnet-4-5' });
      console.log('KI Raw Response:', res);
      
      parsedData = _parseKIResponse(res);
      if (!parsedData) return;

    } catch(err) {
      BSP.toast('Fehler bei der Analyse: ' + err.message, 'er');
      return;
    } finally {
      _revokeAllPages();
      BSP.hideScrim();
    }

    // Bank-Check logic
    if (parsedData.bankdaten && _currentBankId) {
       const banken = await BSP.dbGetAll('konto_banken') || [];
       const dbBank = banken.find(b => b.id === _currentBankId);
       
       if (dbBank) {
         let diff = false;
         if (parsedData.bankdaten.iban && dbBank.iban && parsedData.bankdaten.iban.replace(/\s/g,'') !== dbBank.iban.replace(/\s/g,'')) diff = true;
         if (parsedData.bankdaten.bankname && dbBank.name && !dbBank.name.toLowerCase().includes(parsedData.bankdaten.bankname.toLowerCase().substring(0,4))) diff = true;

         if (diff) {
            const action = await _showBankMismatchSheet(parsedData, dbBank);
            if (action === 'new') {
               _pendingImport = parsedData; // store it
               KontoShell.showAddBank(parsedData.bankdaten); 
               return; // halt and wait for bank:created event
            }
         }
       }
    }

    _presentResults(parsedData);
  }

  async function _presentResults(data) {
    let temporaryTxns = JSON.parse(JSON.stringify(data.buchungen || []));
    
    let sumIn = 0; let countIn = 0;
    let sumOut = 0; let countOut = 0;
    
    temporaryTxns.forEach((t) => {
       const b = parseFloat(t.betrag) || 0;
       if (b >= 0) { sumIn += b; countIn++; }
       else { sumOut += Math.abs(b); countOut++; }
    });

    const saldoNeu = data.endsaldo !== null ? `${data.endsaldo.toFixed(2)} €` : '?';
    const saldoAlt = data.anfangssaldo !== null ? `${data.anfangssaldo.toFixed(2)} €` : '?';
    const zVon = data.zeitraum_von || '?';
    const zBis = data.zeitraum_bis || '?';

    let ht = `
      <div class="sh"></div>
      <div class="mod-header" style="margin-bottom:12px;">
        <h2 class="mod-title">Buchungen prüfen</h2>
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

      <div style="max-height:55vh; overflow-y:auto; margin-bottom:16px;">
    `;
    
    temporaryTxns.forEach((t, i) => {
      const isPos = (t.betrag || 0) >= 0;
      const bColor = isPos ? 'var(--grn)' : 'var(--red)';
      ht += `
        <div style="background:var(--s2); padding:10px; border-radius:var(--r8); margin-bottom:8px; border:1px solid var(--br)">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <input id="prev-date-${i}" class="sett-inp" type="date" value="${t.datum || ''}" style="width:130px; font-size:13px; margin:0">
            <div style="display:flex; align-items:center;">
              <input id="prev-amt-${i}" class="sett-inp" type="number" step="0.01" value="${t.betrag || 0}" style="width:90px; text-align:right; font-weight:600; color:${bColor}; margin:0; padding-right:8px;">
              <span style="font-size:13px; color:${bColor}; font-weight:600;">€</span>
            </div>
          </div>
          <input id="prev-empf-${i}" class="sett-inp" type="text" value="${BSP.eh(t.empfaenger || '')}" placeholder="Empfänger/Auftraggeber" style="margin-bottom:6px; font-size:14px; font-weight:500;">
          <input id="prev-zweck-${i}" class="sett-inp" type="text" value="${BSP.eh(t.verwendungszweck || '')}" placeholder="Verwendungszweck" style="font-size:13px; color:var(--txt2);">
        </div>
      `;
    });
    ht += `
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-g" style="flex:1;justify-content:center" onclick="BSP.closeSheet()">Abbrechen</button>
        <button class="btn btn-gold" style="flex:1;justify-content:center" id="ko-preview-save">Alle übernehmen</button>
      </div>
      <div style="height:140px;flex-shrink:0;pointer-events:none"></div>
    `;
    
    BSP.showSheet(ht);
    
    setTimeout(() => {
      const saveBtn = document.getElementById('ko-preview-save');
      if (saveBtn) {
        saveBtn.onclick = async () => {
          temporaryTxns.forEach((t, i) => {
            t.datum = document.getElementById(`prev-date-${i}`)?.value || t.datum;
            t.empfaenger = document.getElementById(`prev-empf-${i}`)?.value || t.empfaenger;
            t.auftraggeber = t.empfaenger;
            t.verwendungszweck = document.getElementById(`prev-zweck-${i}`)?.value || t.verwendungszweck;
            t.betrag = parseFloat(document.getElementById(`prev-amt-${i}`)?.value) || t.betrag;
            t.bankId = _currentBankId;
          });
          BSP.closeSheet();
          BSP.showScrim('Speichere & Abgleich...');
          try {
            await KontoAbgleich.executeAlgorithm(temporaryTxns, _currentBankId);
          } catch(err) {
            BSP.toast('Fehler beim Abgleich: ' + err.message, 'er');
          } finally {
            BSP.hideScrim();
          }
        };
      }
    }, 100);
  }
  return { startScan, handleUpload, closeScan, capturePage, resumeCam, processAllPages };

})();
