// ══════════════════════════════════════════════════════════════
// MODUL: KONTO ÜBERSICHT
// Zeigt die importierten Buchungen einer spezifischen Bank.
// Ersetzt das alte Listen-Rendering aus dem Monolithen.
// ══════════════════════════════════════════════════════════════
'use strict';

const KontoUebersicht = (() => {

  const VIEW_HTML = (bank) => `
    <div class="mod-header" style="display:flex; align-items:center; gap:12px">
      <button class="btn btn-g" style="padding:8px 12px" onclick="BSP.emit('konto:back')">←</button>
      <div>
        <div class="mod-title">${BSP.eh(bank.name)}</div>
        <div class="mod-sub">${BSP.eh(bank.bezeichnung)} ${bank.iban ? `· ${BSP.eh(bank.iban)}` : ''}</div>
      </div>
    </div>

    <!-- Aktueller Bankstatus / Import Button -->
    <div style="background:var(--s1);border:1px solid var(--br);border-radius:var(--r16);padding:16px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="stitle" style="margin:0">Transaktionen</div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-gold btn-sm" onclick="document.getElementById('ko-upload-inp').click()">📥 Upload</button>
          <button class="btn btn-g btn-sm" onclick="KontoImport.startScan('${bank.id}')">📷 Scan</button>
        </div>
      </div>
      <input type="file" multiple accept="image/*,application/pdf,.pdf" id="ko-upload-inp" hidden onchange="KontoImport.handleUpload(this, '${bank.id}')">

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
  `;

  async function renderForBank(bankId) {
    const banken = await BSP.dbGetAll('konto_banken') || [];
    const bank = banken.find(b => b.id === bankId);
    if (!bank) return;

    const vKonto = document.getElementById('v-konto');
    if (vKonto) vKonto.innerHTML = VIEW_HTML(bank);

    await renderList(bankId);
  }

  async function renderList(bankId) {
    const list = document.getElementById('ko-list-container');
    if (!list) return;

    let existingKonto = [];
    if (BSP.dbGetAll) existingKonto = await BSP.dbGetAll('konto_buchungen') || [];
    
    // Nach Bank filtern (Fall-Back für alte Buchungen: 'unbekannt')
    let bankBuchungen = existingKonto.filter(k => (k.bankId === bankId) || (!k.bankId && bankId === 'bank_legacy'));
    
    // Legacy support: Wenn es Buchungen ohne Bank-ID gibt und die erste Bank angeklickt wird, verknüpfe sie.
    if (!bankId && existingKonto.length) bankBuchungen = existingKonto; // fallback

    bankBuchungen.sort((a,b) => (b.datum||'').localeCompare(a.datum||'') || (b.savedAt||0)-(a.savedAt||0));

    if (!bankBuchungen.length) {
      list.innerHTML = '<div class="empty">Bisher keine Buchungen für dieses Konto importiert.</div><div style="height:140px;flex-shrink:0;pointer-events:none"></div>';
      
      const oCnt = document.getElementById('ko-open-cnt');
      const mCnt = document.getElementById('ko-match-cnt');
      if (oCnt) oCnt.textContent = 0;
      if (mCnt) mCnt.textContent = 0;
      return;
    }

    let off = 0;
    let gem = 0;
    bankBuchungen.forEach(k => {
      if (k.status === 'abgeglichen') gem++;
      else off++;
    });

    const oCnt = document.getElementById('ko-open-cnt');
    const mCnt = document.getElementById('ko-match-cnt');
    if (oCnt) oCnt.textContent = off;
    if (mCnt) mCnt.textContent = gem;

    list.innerHTML = bankBuchungen.map(k => {
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
      <div class="ri" style="flex-direction:column;align-items:stretch;padding:12px;cursor:pointer" onclick="KontoUebersicht.openDetail(${k.id})">
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
    }).join('') + '<div style="height:140px;flex-shrink:0;pointer-events:none"></div>';
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
        <button class="btn btn-g" style="justify-content:center" onclick="KontoUebersicht.setAbschluss(${k.id}, 'manuell')">💵 Als Barzahlung / Umbuchung markieren</button>
        <button class="btn btn-g" style="justify-content:center" onclick="KontoUebersicht.setAbschluss(${k.id}, 'privat')">🏠 Als PRIVAT markieren (Keine Betriebsausgabe)</button>
        <button class="btn btn-red" style="justify-content:center" onclick="KontoUebersicht.ignore(${k.id})">❌ Ignorieren (mit Kommentar)</button>
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

    await BSP.dbPut('konto', k);
    BSP.closeSheet();
    BSP.toast(`Status geändert zu ${statusType}`, 'ok');
    
    const activeBank = KontoShell.getActiveBankId();
    if(activeBank) renderList(activeBank);
  }

  async function ignore(id) {
    const comment = prompt('Warum ignorieren? (Pflichtfeld)');
    if (!comment || !comment.trim()) return;
    
    const kData = await BSP.dbGetAll('konto');
    const k = kData.find(x => x.id === id);
    if (!k) return;
    
    k.status = 'ignoriert';
    k.ignoreComment = comment.trim();
    await BSP.dbPut('konto', k);
    BSP.closeSheet();
    BSP.toast('Buchung ignoriert', 'ok');
    
    const activeBank = KontoShell.getActiveBankId();
    if(activeBank) renderList(activeBank);
  }

  return { renderForBank, renderList, openDetail, setAbschluss, ignore };

})();
