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
    BSP.showScrim('Analysiere Kontoauszug...');

    const prompt = `Du bist ein KI-Assistent für Buchhaltung. Analysiere den angehängten Kontoauszug (kann mehrere Seiten umfassen).
Lies ALLE Buchungen vollständig und präzise aus dem Datensatz.
Lies zwingend auch den Anfangssaldo (alt) und Endsaldo (neu) des Auszugs aus (falls im Dokument sichtbar).

GIB EXAKT DIESES JSON-FORMAT ZURÜCK:
{
  "zeitraum": "YYYY-MM",
  "kontoId": "DE12... (IBAN falls sichtbar, sonst 'unbekannt')",
  "saldoNeu": 1234.56,
  "saldoAlt": 1000.00,
  "buchungen": [
    {
      "datum": "YYYY-MM-DD",
      "betrag": -50.20,
      "zweck": "PayPal Europe S.a.r.l.....",
      "empfaenger": "PayPal",
      "auftraggeber": "Eigentümer GmbH",
      "typ": "Lastschrift",
      "buchungstyp": "Lastschrift",
      "iban": "DE12...",
      "referenz": "REF1234..."
    }
  ]
}`;

    try {
      const b64Array = await Promise.all(_pages.map(async p => {
        if (p.isPdf) return p.b64;
        return await _blobToB64(p.blob);
      }));
      
      const res = await BSP.callClaude({ prompt, images: b64Array, model: 'claude-sonnet-4-5' });
      _revokeAllPages();

      let data = JSON.parse(res);
      
      let summe = 0;
      data.buchungen.forEach(b => summe += (b.betrag || 0));
      
      const saldoDiff = (data.saldoNeu || 0) - (data.saldoAlt || 0);
      let missingGapsError = false;

      if (data.saldoNeu !== undefined && data.saldoAlt !== undefined) {
        if (Math.abs(saldoDiff - summe) > 0.05) {
          missingGapsError = true;
          console.warn('[BSP] Saldo-Prüfung FEHLGESCHLAGEN', 'Diff:', saldoDiff, 'Summe:', summe);
        }
      }

      BSP.hideScrim();
      await _presentResults(data, missingGapsError);

    } catch(e) {
      _revokeAllPages();
      BSP.hideScrim();
      BSP.toast('Fehler bei der Auswertung: ' + e.message, 'er');
    }
  }

  async function _presentResults(data, missingGapsError) {
    if (missingGapsError) BSP.toast('Achtung: Erfasste Summen weichen vom Saldo ab', 'er');
    
    let temporaryTxns = JSON.parse(JSON.stringify(data.buchungen || []));
    
    let ht = `
      <div class="sh"></div>
      <div class="mod-header"><div class="mod-title">Buchungen prüfen</div>
      <div class="mod-sub">${temporaryTxns.length} erkannte Transaktionen</div></div>
      <div style="max-height:60vh;overflow-y:auto;margin-bottom:16px;">
    `;
    temporaryTxns.forEach((t, i) => {
      ht += `
        <div style="background:var(--s2);padding:10px;border-radius:var(--r8);margin-bottom:8px;border:1px solid var(--br)">
          <input id="prev-date-${i}" class="sett-inp" type="date" value="${t.datum || ''}" style="margin-bottom:6px">
          <input id="prev-empf-${i}" class="sett-inp" type="text" value="${BSP.eh(t.empfaenger || t.auftraggeber || '')}" style="margin-bottom:6px">
          <input id="prev-amt-${i}" class="sett-inp" type="number" step="0.01" value="${t.betrag || 0}">
        </div>
      `;
    });
    ht += `
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-g" style="flex:1;justify-content:center" onclick="BSP.closeSheet()">Abbrechen</button>
        <button class="btn btn-gold" style="flex:1;justify-content:center" id="ko-preview-save">Speichern</button>
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
            t.betrag = parseFloat(document.getElementById(`prev-amt-${i}`)?.value) || t.betrag;
            t.bankId = _currentBankId;
          });
          BSP.closeSheet();
          BSP.showScrim('Speichere & Abgleich...');
          await KontoAbgleich.executeAlgorithm(temporaryTxns, _currentBankId);
          BSP.hideScrim();
        };
      }
    }, 100);
  }

  return { startScan, handleUpload, closeScan, capturePage, resumeCam, processAllPages };

})();
