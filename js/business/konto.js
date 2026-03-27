// ══════════════════════════════════════════════════════════════
// MODUL: KONTO
// Multi-Page Scanner für Kontoauszüge, KI-Extraktion, Saldo-Check,
// algorithmisches Beleg-Matching, Dopplungs-Prüfung & Cash-Tracking
// ══════════════════════════════════════════════════════════════
'use strict';

const KontoModule = (() => {

  let _pages = [];
  let _stream = null;
  let _videoEl = null;
  let _canvasEl = null;

  const VIEW_HTML = `
  <div id="v-konto" class="view">
    <div class="mod-header">
      <div class="mod-title">Bankkonto</div>
      <div class="mod-sub">Kontoauszüge intelligent scannen & abgleichen</div>
    </div>

    <!-- Aktueller Bankstatus / Import Button -->
    <div style="background:var(--s1);border:1px solid var(--br);border-radius:var(--r16);padding:16px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="stitle" style="margin:0">Transaktionen</div>
        <button class="btn btn-gold btn-sm" onclick="KontoModule.startScan()">+ Auszug Scannen</button>
      </div>

      <!-- Live Statistik / Saldo -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
        <div style="background:var(--s2);border:1px solid var(--br);border-radius:var(--r8);padding:10px">
          <div style="font-size:9px;color:var(--txt3);text-transform:uppercase">Offene Posten</div>
          <div id="ko-open-cnt" style="font-size:20px;color:var(--orn);font-weight:200">0</div>
        </div>
        <div style="background:var(--s2);border:1px solid var(--br);border-radius:var(--r8);padding:10px">
          <div style="font-size:9px;color:var(--txt3);text-transform:uppercase">Gematcht</div>
          <div id="ko-match-cnt" style="font-size:20px;color:var(--grn);font-weight:200">0</div>
        </div>
      </div>
    </div>

    <!-- Buchungs-Liste -->
    <div class="stitle">Letzte Buchungen</div>
    <div id="ko-list-container"></div>
  </div>

  <!-- ═══ SCANNER OVERLAY (Multi-Page) ═══ -->
  <div id="ko-scan-overlay" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:#000;z-index:9000;flex-direction:column">
    
    <!-- Top Bar -->
    <div style="position:absolute;top:0;left:0;right:0;padding:20px;display:flex;justify-content:space-between;z-index:9001;background:linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)">
      <button class="btn btn-g" onclick="KontoModule.closeScan()">Abbrechen</button>
      <div id="ko-scan-counter" style="color:#fff;font-weight:600;background:var(--blu);padding:4px 12px;border-radius:20px">Seite 1</div>
    </div>

    <!-- Viewfinder -->
    <div style="flex:1;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden">
      <video id="ko-video" autoplay playsinline style="min-width:100%;min-height:100%;object-fit:cover;transform:scaleX(1)"></video>
      <canvas id="ko-canvas" style="display:none"></canvas>
      <!-- AR Guide -->
      <div style="position:absolute;inset:40px;border:2px solid rgba(255,255,255,0.4);border-radius:8px">
        <div style="position:absolute;top:-2px;left:-2px;width:30px;height:30px;border-top:4px solid var(--gold);border-left:4px solid var(--gold);border-radius:8px 0 0 0"></div>
        <div style="position:absolute;top:-2px;right:-2px;width:30px;height:30px;border-top:4px solid var(--gold);border-right:4px solid var(--gold);border-radius:0 8px 0 0"></div>
        <div style="position:absolute;bottom:-2px;left:-2px;width:30px;height:30px;border-bottom:4px solid var(--gold);border-left:4px solid var(--gold);border-radius:0 0 0 8px"></div>
        <div style="position:absolute;bottom:-2px;right:-2px;width:30px;height:30px;border-bottom:4px solid var(--gold);border-right:4px solid var(--gold);border-radius:0 0 8px 0"></div>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:rgba(255,255,255,0.6);font-size:14px;letter-spacing:1px;font-weight:600;text-align:center">KONTOAUSZUG<br>FOKUSSIEREN</div>
      </div>
    </div>

    <!-- Controls -->
    <div style="height:140px;background:#000;display:flex;align-items:center;justify-content:center;position:relative;padding:0 30px">
      <!-- Auslöser -->
      <button id="ko-capture-btn" style="width:72px;height:72px;border-radius:50%;background:none;border:4px solid #fff;display:flex;align-items:center;justify-content:center;cursor:pointer" onclick="KontoModule.capturePage()">
        <div style="width:56px;height:56px;background:#fff;border-radius:50%"></div>
      </button>

      <!-- Multi-Page Finish -->
      <button id="ko-finish-btn" class="btn btn-gold" style="display:none;position:absolute;right:30px" onclick="KontoModule.processAllPages()">Fertig ✓</button>
    </div>
  </div>
  `;

  function init() {
    const container = document.getElementById('module-views');
    if (container) {
      const tmp = document.createElement('div');
      tmp.innerHTML = VIEW_HTML;
      container.appendChild(tmp.firstElementChild);
    }
    
    _videoEl = document.getElementById('ko-video');
    _canvasEl = document.getElementById('ko-canvas');

    BSP.on('core:ready', () => { renderList(); });
    BSP.on('view:changed', ({ name }) => { if (name === 'konto') renderList(); });
  }

  async function startScan() {
    _pages = [];
    document.getElementById('ko-scan-counter').textContent = 'Seite 1';
    document.getElementById('ko-scan-counter').style.background = 'var(--blu)';
    document.getElementById('ko-finish-btn').style.display = 'none';
    document.getElementById('ko-scan-overlay').style.display = 'flex';
    
    try {
      _stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false });
      _videoEl.srcObject = _stream;
      await _videoEl.play();
    } catch(e) {
      document.getElementById('ko-scan-overlay').style.display = 'none';
      BSP.toast('Kamera-Zugriff verweigert', 'er');
    }
  }

  function closeScan() {
    document.getElementById('ko-scan-overlay').style.display = 'none';
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

    const b64 = _canvasEl.toDataURL('image/jpeg', 0.85);
    const compressed = await BSP.compressImage(b64, 1600, 400); 
    
    _pages.push(compressed);

    document.getElementById('ko-scan-counter').textContent = `Seite ${_pages.length + 1}`;
    document.getElementById('ko-scan-counter').style.background = 'var(--gold)';
    document.getElementById('ko-finish-btn').style.display = 'flex';

    BSP.toast(`Seite ${_pages.length} erfasst`, 'ok');
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
  "saldoNeu": 1234.56,
  "saldoAlt": 1000.00,
  "buchungen": [
    {
      "datum": "YYYY-MM-DD",
      "betrag": -50.20,
      "zweck": "PayPal Europe S.a.r.l.....",
      "empfaenger": "PayPal",
      "typ": "Lastschrift",
      "iban": "DE12...",
      "referenz": "REF1234..."
    }
  ]
}`;

    try {
      const b64Array = _pages.slice();
      const res = await BSP.callClaude({ prompt, images: b64Array, model: 'claude-3-5-sonnet-20241022' });
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
      BSP.hideScrim();
      BSP.toast('Fehler bei der Auswertung: ' + e.message, 'er');
    }
  }

  async function _presentResults(data, missingGapsError) {
    BSP.toast(`Erfolgreich ${data.buchungen?.length || 0} Buchungen extrahiert`, 'ok');
    if (missingGapsError) {
      setTimeout(() => alert('⚠️ SALDO-FEHLER\n\nDie Summe der erfassten Buchungen deckt sich nicht exakt mit der Saldo-Differenz auf dem Kontoauszug.\n\nVermutlich fehlen Seiten oder der Scan war unvollständig. Bitte prüfen!'), 500);
    }
    await _executeAlgorithm(data.buchungen);
  }

  async function _executeAlgorithm(transactions) {
    const alleBelege = await BSP.getBelege();
    let existingKonto = [];
    if (BSP.dbGetAll) existingKonto = await BSP.dbGetAll('konto') || [];

    for (let txn of transactions) {
      txn.tags = { kontoTyp: 'Business', ausgabenTyp: 'Business', mismatch: false };
      txn.status = 'offen';

      const duplicate = existingKonto.find(e => 
        e.datum === txn.datum && 
        Math.abs(e.betrag - txn.betrag) < 0.05 && 
        (e.empfaenger || '').toLowerCase() === (txn.empfaenger || '').toLowerCase()
      );

      if (duplicate) txn.isDuplicateAlert = true;

      const possibleBelege = alleBelege.filter(b => {
        if (!b.date || !b.brutto) return false;
        const daysDiff = Math.abs((new Date(b.date+'T00:00:00') - new Date(txn.datum+'T00:00:00')) / 864e5);
        if (daysDiff > 3) return false;
        const amtDiff = Math.abs(Math.abs(b.brutto) - Math.abs(txn.betrag));
        if (amtDiff > 0.50) return false;
        return true;
      });

      let bestMatch = null;
      let scoreMax = 0;

      for (let m of possibleBelege) {
        let sc = 0;
        const bShop = (m.shop || '').toLowerCase();
        const tShop = (txn.empfaenger || '').toLowerCase();
        
        if (tShop.includes(bShop) || bShop.includes(tShop)) sc += 5;
        if (tShop.includes('amzn') && bShop.includes('amazon')) sc += 5;
        if (tShop.includes('pp.') && bShop.includes('paypal')) sc += 5;
        
        if (m.brutto === Math.abs(txn.betrag)) sc += 2;
        if (m.date === txn.datum) sc += 2;

        if (sc > scoreMax) {
          scoreMax = sc;
          bestMatch = m;
        }
      }

      if (scoreMax >= 5 && bestMatch) {
         txn.status = 'abgeglichen';
         txn.belegId = bestMatch.id;
      }

      if (txn.typ === 'Rücklastschrift') {
         txn.hasAlert = 'Zahlung fehlgeschlagen';
      } else if (txn.typ === 'Geldeingang' && txn.status !== 'abgeglichen') {
         txn.hasAlert = '⚠️ Geldeingang ohne AR-Beleg!';
      } else if (txn.typ === 'Bargeldabhebung') {
         txn.status = 'manuell';
      }

      txn.id = Date.now() + Math.floor(Math.random()*1000);
      txn.savedAt = Date.now();
    }
    
    // An Einstellungen übergeben zwecks Übergangs-Zuweisung
    if (typeof EinstellungenModule !== 'undefined' && EinstellungenModule.startTransitionCheck) {
       EinstellungenModule.startTransitionCheck(transactions, async (finalTxns) => {
          for (let txn of finalTxns) {
             await BSP.dbAdd('konto', txn);
          }
          BSP.toast('Transaktionen gesichert', 'ok');
          BSP.emit('konto:imported');
          renderList();
       });
    } else {
       // Fallback ohne EinstellungenModule (z.B. Offline Debug Mode)
       for (let txn of transactions) {
          await BSP.dbAdd('konto', txn);
       }
       BSP.toast('Transaktionen gesichert', 'ok');
       BSP.emit('konto:imported');
       renderList();
    }
  }

  async function renderList() {
    const list = document.getElementById('ko-list-container');
    if (!list) return;

    let existingKonto = [];
    if (BSP.dbGetAll) existingKonto = await BSP.dbGetAll('konto') || [];
    
    existingKonto.sort((a,b) => (b.datum||'').localeCompare(a.datum||'') || (b.savedAt||0)-(a.savedAt||0));

    if (!existingKonto.length) {
      list.innerHTML = '<div class="empty">Bisher keine Buchungen importiert.</div>';
      return;
    }

    let off = 0;
    let gem = 0;
    existingKonto.forEach(k => {
      if (k.status === 'abgeglichen') gem++;
      else off++;
    });

    const oCnt = document.getElementById('ko-open-cnt');
    const mCnt = document.getElementById('ko-match-cnt');
    if (oCnt) oCnt.textContent = off;
    if (mCnt) mCnt.textContent = gem;

    list.innerHTML = existingKonto.map(k => {
      let badgeHtml = '';
      if (k.isDuplicateAlert) badgeHtml += '<span class="badge" style="background:var(--red);color:#fff;margin-right:6px">⚠️ DOPPLUNG</span>';
      if (k.typ === 'Rücklastschrift') badgeHtml += '<span class="badge" style="background:var(--red);color:#fff;margin-right:6px">RÜCKLASTSCHRIFT</span>';
      if (k.typ === 'Dauerauftrag') badgeHtml += '<span class="badge" style="background:var(--blu);color:#fff;margin-right:6px">ABO</span>';
      if (k.hasAlert) badgeHtml += `<span class="badge" style="background:var(--red);color:#fff;margin-right:6px">${k.hasAlert}</span>`;
      
      let stColor = 'var(--orn)';
      let stTxt = 'OFFEN';
      if (k.status === 'abgeglichen') { stColor = 'var(--grn)'; stTxt = '✓ BELEG'; }
      if (k.status === 'privat') { stColor = 'var(--txt3)'; stTxt = 'PRIVAT'; }
      if (k.status === 'manuell') { stColor = 'var(--ylw)'; stTxt = 'BARGELD'; }
      if (k.status === 'ignoriert') { stColor = 'var(--txt3)'; stTxt = 'IGNORIERT'; }
      
      return `
      <div class="ri" style="flex-direction:column;align-items:stretch;padding:12px;cursor:pointer" onclick="KontoModule.openDetail(${k.id})">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <div style="font-weight:600;color:var(--txt);font-size:14px;max-width:70%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${BSP.eh(k.empfaenger || 'Unbekannt')}</div>
          <div style="font-family:'DM Mono',monospace;font-size:14px;color:${k.betrag > 0 ? 'var(--gold)' : 'var(--txt)'}">${BSP.fm(Math.abs(k.betrag))} €</div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:10px;color:var(--txt3)">
            ${badgeHtml}${BSP.fd(k.datum)} · ${k.typ}
          </div>
          <div style="font-size:9px;font-weight:600;padding:2px 6px;border-radius:4px;color:${stColor};border:1px solid ${stColor}">
            ${stTxt}
          </div>
        </div>
        ${k.tags && k.tags.mismatch ? `<div style="font-size:10px;color:var(--red);margin-top:6px;background:rgba(255,0,0,0.1);padding:4px;border-radius:4px">⚠️ Konto-Mismatch: (${k.tags.ausgabenTyp} auf ${k.tags.kontoTyp}konto)</div>` : ''}
      </div>`
    }).join('');
  }

  async function openDetail(id) {
    const kData = await BSP.dbGetAll('konto');
    const k = kData.find(x => x.id === id);
    if (!k) return;

    let actionHtml = '';
    if (k.status !== 'abgeglichen') {
      actionHtml = `
      <div style="margin-top:20px;display:flex;flex-direction:column;gap:8px">
        <div style="font-size:10px;color:var(--txt3);text-transform:uppercase;margin-bottom:4px">Manuelle Zuweisung</div>
        <button class="btn btn-g" style="justify-content:center" onclick="BSP.toast('Noch offline','wr')">🔗 Vorhandenem Beleg zuordnen</button>
        <button class="btn btn-g" style="justify-content:center" onclick="KontoModule.setAbschluss(${k.id}, 'manuell')">💵 Als Barzahlung / Umbuchung markieren</button>
        <button class="btn btn-g" style="justify-content:center" onclick="KontoModule.setAbschluss(${k.id}, 'privat')">🏠 Als PRIVAT markieren (Keine Betriebsausgabe)</button>
        <button class="btn btn-red" style="justify-content:center" onclick="KontoModule.ignore(${k.id})">❌ Ignorieren (mit Kommentar)</button>
      </div>`;
    } else {
      actionHtml = `
      <div style="margin-top:20px;text-align:center">
        <div style="color:var(--grn);font-size:14px;margin-bottom:8px">✓ Automatisch abgeglichen</div>
        <button class="btn btn-g" style="width:100%;justify-content:center" onclick="BSP.showView('belege');BSP.closeSheet()">📄 Zugehörigen Beleg anzeigen</button>
      </div>`;
    }

    const html = `
      <div class="sh"></div>
      <div class="mod-header" style="text-align:center">
        <div style="font-size:32px;margin-bottom:10px">${k.betrag > 0 ? '🟢' : '🔴'}</div>
        <h2 class="mod-title">${BSP.eh(k.empfaenger || 'Unbekannt')}</h2>
        <p class="mod-sub">${BSP.fd(k.datum)} · ${k.typ}</p>
      </div>
      <div class="card" style="text-align:center">
        <div style="font-size:28px;font-weight:200;color:${k.betrag > 0 ? 'var(--gold)' : 'var(--txt)'}">${BSP.fm(Math.abs(k.betrag))} €</div>
        ${k.zweck ? `<div style="font-size:11px;color:var(--txt3);margin-top:8px;line-height:1.4">${BSP.eh(k.zweck)}</div>` : ''}
      </div>
      ${actionHtml}
      <button class="btn btn-g sett-mt" style="width:100%;justify-content:center" onclick="BSP.closeSheet()">Schließen</button>
    `;
    BSP.showSheet(html);
  }

  async function setAbschluss(id, statusType) {
    const kData = await BSP.dbGetAll('konto');
    const k = kData.find(x => x.id === id);
    if (!k) return;
    
    k.status = statusType;
    if (statusType === 'privat') {
      k.tags.ausgabenTyp = 'Privat';
      if (k.tags.kontoTyp === 'Business') k.tags.mismatch = true;
    }

    await BSP.dbAdd('konto', k); 
    BSP.closeSheet();
    BSP.toast(`Status geändert zu ${statusType}`, 'ok');
    renderList();
  }

  async function ignore(id) {
    const comment = prompt('Warum ignorieren? (Pflichtfeld)');
    if (!comment || !comment.trim()) return;
    
    const kData = await BSP.dbGetAll('konto');
    const k = kData.find(x => x.id === id);
    if (!k) return;
    
    k.status = 'ignoriert';
    k.ignoreComment = comment.trim();
    await BSP.dbAdd('konto', k);
    BSP.closeSheet();
    BSP.toast('Buchung ignoriert', 'ok');
    renderList();
  }

  return { init, startScan, closeScan, capturePage, processAllPages, openDetail, setAbschluss, ignore };

})();
