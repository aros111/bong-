// ══════════════════════════════════════════════════════════════
// MODUL: KONTO SHELL (Bank-Verwaltung)
// Einstieg in das Konto-Modul. Zeigt Liste der Banken.
// ══════════════════════════════════════════════════════════════
'use strict';

const KontoShell = (() => {

  const VIEW_HTML = `
  <div id="v-konto" class="view">
    <div class="mod-header" style="display:flex; justify-content:space-between; align-items:center">
      <div>
        <div class="mod-title">Bankkonten</div>
        <div class="mod-sub">Wähle eine Bank für Import & Abgleich</div>
      </div>
      <button class="btn btn-gold btn-sm" onclick="KontoShell.showAddBank()">+ Bank</button>
    </div>

    <!-- Liste der Banken -->
    <div id="ko-bank-list" style="margin-top:20px; display:flex; flex-direction:column; gap:12px;"></div>
  </div>
  `;

  let _activeBankId = null;

  function init() {
    const container = document.getElementById('module-views');
    if (container && !document.getElementById('v-konto')) {
      const tmp = document.createElement('div');
      tmp.innerHTML = VIEW_HTML;
      container.appendChild(tmp.firstElementChild);
    }

    BSP.on('view:changed', ({ name }) => { 
      if (name === 'konto') {
        _activeBankId = null; // Zurück in die Übersicht
        const vKonto = document.getElementById('v-konto');
        if (vKonto && !vKonto.querySelector('.mod-title')?.textContent.includes('Bankkonten')) {
           const tmp = document.createElement('div');
           tmp.innerHTML = VIEW_HTML;
           vKonto.innerHTML = tmp.firstElementChild.innerHTML;
        }
        renderBankList(); 
      }
    });

    // Event hooks für Zurück Navigieren aus der Konto-Detailseite
    BSP.on('konto:back', () => {
      _activeBankId = null;
      const vKonto = document.getElementById('v-konto');
      if (vKonto) {
         const tmp = document.createElement('div');
         tmp.innerHTML = VIEW_HTML;
         vKonto.innerHTML = tmp.firstElementChild.innerHTML;
      }
      renderBankList();
    });
  }

  async function renderBankList() {
    const listEl = document.getElementById('ko-bank-list');
    if (!listEl) return;

    let banken = [];
    if (BSP.dbGetAll) banken = await BSP.dbGetAll('konto_banken') || [];

    if (banken.length === 0) {
      listEl.innerHTML = `
        <div class="empty" style="padding: 40px 20px; text-align:center;">
          <div style="font-size:32px; margin-bottom:12px">🏦</div>
          <div style="font-size:16px; font-weight:500; margin-bottom:8px">Noch keine Bank hinterlegt</div>
          <div style="font-size:13px; color:var(--txt3); margin-bottom:24px">Füge zuerst eine Bank hinzu, bevor du Kontoauszüge hochlädst.</div>
          <button class="btn btn-gold" style="justify-content:center; width:100%" onclick="KontoShell.showAddBank()">Prüfung... Erste Bank hinzufügen</button>
        </div>
      `;
      return;
    }

    const uploadBtnHtml = `
      <div style="background:var(--s1);border:1px solid var(--br);border-radius:var(--r16);padding:16px;margin-bottom:20px;text-align:center">
        <div style="font-weight:500;margin-bottom:12px">Einen neuen Kontoauszug importieren?</div>
        <button class="btn btn-gold" style="justify-content:center;width:100%" onclick="KontoShell.showGlobalUpload()">📥 Dokument hochladen / scannen</button>
      </div>
    `;

    listEl.innerHTML = uploadBtnHtml + banken.map(b => `
      <div class="card" style="padding:16px; cursor:pointer;" onclick="KontoShell.openBank('${b.id}')">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px">
          <div>
            <div style="font-weight:600; font-size:15px; color:var(--txt); margin-bottom:2px">${BSP.eh(b.name)}</div>
            <div style="font-size:13px; color:var(--txt3)">${BSP.eh(b.bezeichnung)}</div>
          </div>
          <div class="badge" style="background:${b.typ === 'geschaeft' ? 'var(--blu)' : 'var(--orn)'}; color:#fff;">
            ${b.typ === 'geschaeft' ? 'Geschäftskonto' : 'Privatkonto'}
          </div>
        </div>
        <div style="font-family:'DM Mono', monospace; font-size:12px; color:var(--txt2); letter-spacing:1px">${b.iban ? BSP.eh(b.iban) : 'Keine IBAN hinterlegt'}</div>
      </div>
    `).join('') + '<div style="height:140px;flex-shrink:0;pointer-events:none"></div>';
  }

  function showAddBank() {
    const html = `
      <div class="sh"></div>
      <div class="mod-header">
        <h2 class="mod-title">Bank hinzufügen</h2>
        <p class="mod-sub">Neue Bankverbindung für Import anlegen</p>
      </div>
      <div class="field sett-mt">
        <label>Bankname (z.B. N26, Sparkasse)</label>
        <input type="text" id="add-bank-name" class="sett-inp">
      </div>
      <div class="field sett-mt">
        <label>Kontobezeichnung (z.B. Hauptkonto, Kreditkarte)</label>
        <input type="text" id="add-bank-bez" class="sett-inp">
      </div>
      <div class="field sett-mt">
        <label>IBAN (Optional, für Export wichtig)</label>
        <input type="text" id="add-bank-iban" class="sett-inp" placeholder="DE12 3456...">
      </div>
      <div class="field sett-mt" style="margin-bottom:20px">
        <label>Typ</label>
        <select id="add-bank-typ" class="sett-inp">
          <option value="geschaeft">Geschäftskonto</option>
          <option value="privat">Privatkonto</option>
        </select>
      </div>
      <div style="display:flex; gap:8px">
        <button class="btn btn-g" style="flex:1; justify-content:center" onclick="BSP.closeSheet()">Abbrechen</button>
        <button class="btn btn-gold" style="flex:1; justify-content:center" onclick="KontoShell.saveBank()">Speichern</button>
      </div>
    `;
    BSP.showSheet(html);
  }

  async function saveBank() {
    const name = document.getElementById('add-bank-name').value.trim();
    const bez = document.getElementById('add-bank-bez').value.trim();
    const iban = document.getElementById('add-bank-iban').value.trim();
    const typ = document.getElementById('add-bank-typ').value;

    if (!name || !bez) {
      BSP.toast('Bitte Bankname und Bezeichnung ausfüllen', 'wr');
      return;
    }

    const id = 'bank_' + Date.now();
    await BSP.dbAdd('konto_banken', { id, name, bezeichnung: bez, iban, typ, createdAt: Date.now() });
    
    BSP.closeSheet();
    BSP.toast('Bank hinzugefügt', 'ok');
    renderBankList();
  }

  function openBank(bankId) {
    _activeBankId = bankId;
    if (typeof KontoUebersicht !== 'undefined') {
      // Löse View Render für spezifische Bank aus
      KontoUebersicht.renderForBank(bankId);
    }
  }

  function getActiveBankId() {
    return _activeBankId;
  }

  async function showGlobalUpload() {
    const banken = await BSP.dbGetAll('konto_banken') || [];
    const html = `
      <div class="sh"></div>
      <div class="mod-header">
        <h2 class="mod-title">Kontoauszug hochladen</h2>
        <p class="mod-sub">Für welche Bank möchtest du Dokumente importieren?</p>
      </div>
      <div class="field sett-mt" style="margin-bottom:20px">
        <label>Bank auswählen</label>
        <select id="ko-global-bank-select" class="sett-inp">
          ${banken.map(b => `<option value="${b.id}">${BSP.eh(b.name)} (${BSP.eh(b.bezeichnung)})</option>`).join('')}
        </select>
      </div>
      <input type="file" multiple accept="image/*,application/pdf,.pdf" id="ko-global-upload-inp" hidden>
      <div style="display:flex; gap:8px">
        <button class="btn btn-g" style="flex:1; justify-content:center" onclick="BSP.closeSheet()">Abbrechen</button>
        <button class="btn btn-gold" style="flex:2; justify-content:center" onclick="KontoShell.triggerGlobalUpload()">Dateien auswählen</button>
      </div>
    `;
    BSP.showSheet(html);
  }

  function triggerGlobalUpload() {
    const sel = document.getElementById('ko-global-bank-select');
    if(!sel) return;
    const bankId = sel.value;
    const inp = document.getElementById('ko-global-upload-inp');
    inp.onchange = () => {
      BSP.closeSheet();
      KontoImport.handleUpload(inp, bankId);
    };
    inp.click();
  }

  return { init, showAddBank, saveBank, openBank, getActiveBankId, showGlobalUpload, triggerGlobalUpload };

})();
