const fs = require('fs');
const root = 'c:\\Users\\obuch\\Downloads\\bong-new\\';

// 1. CSS
let css = fs.readFileSync(root + 'style.css', 'utf8');
css += `
details > summary { list-style: none; cursor: pointer; }
details > summary::-webkit-details-marker { display: none; }
details[open] summary ~ * { animation: swp .3s ease-in-out; }
@keyframes swp { 0% {opacity:0;transform:translateY(-5px)} 100% {opacity:1;transform:translateY(0)} }
details[open] { margin-bottom: 20px; }
summary { display: flex; align-items: center; justify-content: space-between; font-weight: 500; font-size: 16px; padding: 12px 0; border-bottom: 1px solid var(--br); }
summary:after { content: '+'; font-size: 20px; font-weight: 300; color: var(--gold); }
details[open] summary:after { content: '\\2212'; } /* Minus character */
`;
fs.writeFileSync(root + 'style.css', css);

// 2. einstellungen.js VIEW_HTML
let js = fs.readFileSync(root + 'js/business/einstellungen.js', 'utf8');

const newHTML = `const VIEW_HTML = \`
<div id="v-einstellungen" class="view">
  <div class="mod-header">
    <div class="mod-title">Einstellungen</div>
    <div class="mod-sub">Deine Daten & App-Konfiguration</div>
  </div>

  <!-- 1. PERSÖNLICHE DATEN -->
  <details class="sett-section" open>
    <summary>👤 Persönliche Daten</summary>
    <div class="sett-grid" style="margin-top:12px">
      <div class="field"><label>Vorname</label><input class="sett-inp" id="s_vorname" type="text" oninput="EinstellungenModule.save()"></div>
      <div class="field"><label>Nachname</label><input class="sett-inp" id="s_nachname" type="text" oninput="EinstellungenModule.save()"></div>
    </div>
    <div class="sett-grid">
      <div class="field"><label>Geburtsdatum</label><input class="sett-inp" id="s_geburtsdatum" type="date" onchange="EinstellungenModule.save()"></div>
      <div class="field"><label>Steuernummer</label><input class="sett-inp" id="s_steuernr" type="text" oninput="EinstellungenModule.save()"></div>
    </div>
    <div class="sett-grid">
      <div class="field"><label>USt-IdNr.</label><input class="sett-inp" id="s_ustidnr" type="text" oninput="EinstellungenModule.save()"></div>
      <div class="field"><label>Familienstand</label>
        <select class="sett-inp" id="s_familienstand" onchange="EinstellungenModule.save()">
          <option value="ledig">Ledig</option>
          <option value="verheiratet">Verheiratet</option>
          <option value="geschieden">Geschieden</option>
          <option value="verwitwet">Verwitwet</option>
        </select>
      </div>
    </div>
    <div class="sett-grid">
      <div class="field"><label>Steuerklasse</label>
        <select class="sett-inp" id="s_stklasse" onchange="EinstellungenModule.save()">
          <option value="1">I</option><option value="2">II</option><option value="3">III</option><option value="4">IV</option><option value="5">V</option><option value="6">VI</option>
        </select>
      </div>
      <div class="field"><label>Kinder (Anzahl)</label><input class="sett-inp" id="s_kinder" type="number" min="0" onchange="EinstellungenModule.save()"></div>
    </div>
    <div class="field sett-mt"><label>Unterhalt / Mon. (€)</label><input class="sett-inp" id="s_unterhalt" type="text" inputmode="decimal" oninput="EinstellungenModule.save()"></div>
  </details>

  <!-- 2. UNTERNEHMEN -->
  <details class="sett-section">
    <summary>🏢 Unternehmen</summary>
    <div class="sett-grid" style="margin-top:12px">
      <div class="field"><label>Firmenname</label><input class="sett-inp" id="s_firmenname" type="text" oninput="EinstellungenModule.save()"></div>
      <div class="field"><label>Berufsbezeichnung</label><input class="sett-inp" id="s_beruf" type="text" oninput="EinstellungenModule.save()"></div>
    </div>
    <div class="field sett-mt"><label>Betriebsstätte / Sitz</label><input class="sett-inp" id="s_adresse" type="text" oninput="EinstellungenModule.save()"></div>
    <div class="field sett-mt"><label>Heimatort (für km-Pauschale)</label><input class="sett-inp" id="s_heimat" type="text" oninput="EinstellungenModule.save()"></div>
    <div class="field sett-mt">
      <label>Unternehmens-Logo</label>
      <div style="display:flex;align-items:center;gap:12px">
        <div id="s_logoPreview" style="width:48px;height:48px;background:var(--br);border-radius:var(--brnd);display:flex;align-items:center;justify-content:center;overflow:hidden"><span style="font-size:10px;color:var(--txt3)">Logo</span></div>
        <button class="btn btn-g" onclick="document.getElementById('s_logoInp').click()">Upload</button>
        <input type="file" id="s_logoInp" hidden accept="image/*" onchange="EinstellungenModule.handleLogo(this)">
      </div>
    </div>
  </details>

  <!-- 3. FINANZIELLES -->
  <details class="sett-section">
    <summary>💰 Finanzielles</summary>
    <div class="sett-grid" style="margin-top:12px">
      <div class="field"><label>Eigener Stundensatz (€/h)</label><input class="sett-inp" id="s_stundensatz" type="text" inputmode="decimal" oninput="EinstellungenModule.save()"></div>
      <div class="field"><label>Steuerberater (€/h)</label><input class="sett-inp" id="s_stbSatz" type="text" inputmode="decimal" oninput="EinstellungenModule.save()"></div>
    </div>
    <div class="field"><label>Gesparte Minuten pro Scan (Ø)</label>
      <div style="display:flex;align-items:center;gap:12px;margin-top:2px">
        <input class="sett-inp" id="s_minProScan" type="range" min="1" max="30" step="1" onchange="EinstellungenModule.save()" oninput="document.getElementById('s_minProScanVal').textContent=this.value" style="flex:1;accent-color:var(--gold)">
        <span id="s_minProScanVal" style="font-size:14px;color:var(--gold);min-width:28px">4</span>
        <span style="font-size:11px;color:var(--txt3)">Min</span>
      </div>
    </div>
  </details>

  <!-- 4. API & SICHERHEIT -->
  <details class="sett-section">
    <summary>🔐 API & Sicherheit</summary>
    <div class="field" style="margin-top:12px"><label>Anthropic API Key</label>
      <div style="position:relative">
        <input class="sett-inp" id="s_apikey" type="password" autocomplete="off" onchange="EinstellungenModule.save()">
        <button onclick="EinstellungenModule.toggleApiKeyVis()" style="position:absolute;right:0;top:0;bottom:0;background:none;border:none;color:var(--txt3);padding:0 10px;cursor:pointer;">👁</button>
      </div>
    </div>
    <div class="field sett-mt"><label>Daten-Verschlüsselung PIN (4-stellig)</label><input class="sett-inp" id="s_pin" type="password" maxlength="4" inputmode="numeric" onchange="EinstellungenModule.save()"></div>
    <div class="field sett-mt"><label>Belegnummer-Format</label>
        <select class="sett-inp" id="s_belegFmt" onchange="EinstellungenModule.save()">
          <option value="A">ER-YYYY-0001</option><option value="B">YYYY-Q1-ER-0001</option><option value="C">YYYY-ER-0001</option>
        </select>
    </div>
  </details>

  <!-- 5. EXPORT -->
  <details class="sett-section">
    <summary>📤 Export</summary>
    <div class="sett-grid" style="margin-top:12px">
      <div class="field"><label>DATEV-Kontonummern</label>
        <select class="sett-inp" id="s_datev" onchange="EinstellungenModule.save()"><option value="0">Aus</option><option value="1">Ein</option></select></div>
      <div class="field"><label>E-Mail Steuerberater</label><input class="sett-inp" id="s_stbEmail" type="email" onchange="EinstellungenModule.save()"></div>
    </div>
  </details>

  <!-- 6. KONTEN -->
  <details class="sett-section" ontoggle="if(this.open) { EinstellungenModule.renderAccounts(); }">
    <summary>💳 Bankkonten</summary>
    <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px" id="s-accounts-list"></div>
    <button class="btn btn-gold" style="width:100%;justify-content:center;margin-top:8px" onclick="if(KontoShell) KontoShell.showAddBank()">+ Bankkonto hinzufügen</button>
  </details>

  <!-- 7. ÜBERGANGS-MODUS -->
  <details class="sett-section">
    <summary style="color:var(--orn)">🔄 Übergangs-Modus</summary>
    <div style="margin-top:12px;font-size:11px;color:var(--txt3);line-height:1.4">
      Aktiviere diesen Modus, wenn Geschäfts- und Privatkonten noch nicht vollständig getrennt sind. Die App fragt bei Buchungen detaillierter nach.
    </div>
    <div class="field sett-mt" style="display:flex;align-items:center;justify-content:space-between">
      <label style="margin:0;color:var(--txt)">Übergangs-Modus aktiv</label><input type="checkbox" id="s_transitionMode" style="width:20px;height:20px;accent-color:var(--orn)" onchange="EinstellungenModule.save()">
    </div>
  </details>

  <!-- 8. BACKUP -->
  <details class="sett-section">
    <summary>💾 Backup</summary>
    <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">
      <button class="btn btn-g" onclick="EinstellungenModule.exportJSON()" style="justify-content:center">⬇️ Lokaler JSON-Export</button>
      <div style="background:var(--s2);border:1px solid var(--br);border-radius:var(--r8);padding:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:12px">☁️ Google Drive</span>
          <span id="s-drive-status-badge" style="font-size:9px;color:var(--orn);border:1px solid var(--orn);padding:2px 4px;border-radius:4px">NICHT VERBUNDEN</span>
        </div>
        <div id="s-drive-last-backup" style="font-size:10px;color:var(--txt3);margin-bottom:8px">Letztes Backup: Noch nie</div>
        <button class="btn btn-g" id="s-drive-connect-btn" onclick="EinstellungenModule.driveConnect()" style="display:none;width:100%;justify-content:center;margin-bottom:6px">🔑 Verbinden</button>
        <button class="btn btn-gold" id="s-drive-backup-btn" onclick="EinstellungenModule.backupDrive()" style="display:none;width:100%;justify-content:center;margin-bottom:6px">☁️ Jetzt sichern</button>
        <button class="btn btn-g" id="s-drive-restore-btn" onclick="EinstellungenModule.restoreFromDrive()" style="display:none;width:100%;justify-content:center;margin-bottom:6px">🔄 Wiederherstellen</button>
        <button class="btn" id="s-drive-disconnect-btn" onclick="EinstellungenModule.driveDisconnect()" style="display:none;width:100%;justify-content:center;color:var(--red)">✕ Trennen</button>
      </div>
    </div>
  </details>

  <!-- 9. APP -->
  <details class="sett-section">
    <summary>⚙️ App & System</summary>
    <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">
      <button class="btn btn-red" onclick="EinstellungenModule.cleanupDatabase()" style="justify-content:center">🗑️ Datenbank bereinigen (Trim)</button>
      <button class="btn btn-red" onclick="EinstellungenModule.resetCounters()" style="justify-content:center">🔄 Zähler zurücksetzen</button>
    </div>
    <div style="margin-top:20px;text-align:center;font-size:10px;color:var(--txt3);line-height:1.6">
      BelegScan Pro v4.4.2<br>Offline-First · DSGVO-konform
    </div>
  </details>
  <div style="height:80px"></div>
</div>
\`;`;

js = js.replace(/const VIEW_HTML = `[\s\S]*?`;/, newHTML);

// Add scrollIntoView on toggle to details hook
const saveHook = `
    // Auto Scroll Accordions
    const wrapper = document.getElementById('v-einstellungen');
    if (wrapper && !wrapper.dataset.hooked) {
      wrapper.dataset.hooked = '1';
      wrapper.addEventListener('toggle', (e) => {
        if (e.target.tagName === 'DETAILS' && e.target.open) {
          setTimeout(() => {
             e.target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 30);
        }
      }, true);
    }
`;

js = js.replace(/(function load\(\) \{[\s\S]*?\}).*?(function loadSettingsToUI\(\) \{)/, `$1\n${saveHook}\n$2`);


const accountsHelper = `
  async function renderAccounts() {
    const list = document.getElementById('s-accounts-list');
    if (!list) return;
    let banken = [];
    if (BSP.dbGetAll) banken = await BSP.dbGetAll('konto_banken') || [];
    if (!banken.length) {
      list.innerHTML = '<div class="empty" style="padding:10px">Keine Konten hinterlegt.</div>';
      return;
    }
    list.innerHTML = banken.map(b => \`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:var(--s2);border:1px solid var(--br);border-radius:var(--r8)">
        <div>
          <div style="font-weight:500;font-size:14px">\${BSP.eh(b.name)}</div>
          <div style="font-size:11px;color:var(--txt3)">\${b.iban ? b.iban.substring(0,8)+'...' : 'Keine IBAN'}</div>
        </div>
        <div style="font-size:10px;padding:2px 6px;border-radius:4px;background:\${b.typ==='geschaeftlich'?'rgba(200,164,90,0.1)':'rgba(74,158,255,0.1)'};color:\${b.typ==='geschaeftlich'?'var(--gold)':'var(--blu)'}">\${b.typ==='geschaeftlich'?'GL':'PR'}</div>
      </div>
    \`).join('');
  }
`;

js = js.replace(/return \{ init,/, `${accountsHelper}\n  return { init, renderAccounts,`);

fs.writeFileSync(root + 'js/business/einstellungen.js', js, 'utf8');
console.log("Success");
