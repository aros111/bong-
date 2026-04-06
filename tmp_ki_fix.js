const fs = require('fs');
const path = 'js/business/konto-import.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Add _pendingImport at the top
content = content.replace('  let _currentBankId = null;', 
  '  let _currentBankId = null;\n  let _pendingImport = null;\n\n  // Event-Listener für Bank-Neuanlage mit Zwischenspeicherung\n  BSP.on("bank:created", (data) => {\n    if (_pendingImport) {\n      _currentBankId = data.id;\n      _presentResults(_pendingImport);\n      _pendingImport = null;\n    }\n  });\n');

// 2. Add _parseKIResponse
const parseLogic = `
  function _parseKIResponse(response) {
    const jsonMatch = response.match(/\\{[\\s\\S]*\\}|\\[[\\s\\S]*\\]/);
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

      const html = \`
        <div class="sh"></div>
        <div class="mod-header">
          <h2 class="mod-title" style="color:var(--orn)">Bankdaten-Abgleich</h2>
          <p class="mod-sub">Die erkannten Daten weichen von der Auswahl ab.</p>
        </div>
        <div style="background:var(--s2); border:1px solid var(--br); border-radius:var(--r16); padding:16px; margin-bottom:16px;">
          <div style="font-weight:600; margin-bottom:8px;">Erkannt im Kontoauszug:</div>
          <div style="font-size:14px; color:var(--txt2); margin-bottom:4px;">Bank: <span style="color:var(--txt)">\${BSP.eh(bBank)}</span></div>
          <div style="font-size:14px; color:var(--txt2); margin-bottom:4px;">IBAN: <span style="color:var(--txt)">\${BSP.eh(bIban)}</span></div>
          <div style="font-size:14px; color:var(--txt2);">Inhaber: <span style="color:var(--txt)">\${BSP.eh(bInhaber)}</span></div>
        </div>
        <div style="background:var(--s2); border:1px solid var(--br); border-radius:var(--r16); padding:16px; margin-bottom:20px;">
          <div style="font-weight:600; margin-bottom:8px;">Hinterlegt in App (\${BSP.eh(dbBankName)}):</div>
          <div style="font-size:14px; color:var(--txt2); margin-bottom:4px;">Bank: <span style="color:var(--txt)">\${BSP.eh(dbBankName)}</span></div>
          <div style="font-size:14px; color:var(--txt2);">IBAN: <span style="color:var(--txt)">\${BSP.eh(dbIban)}</span></div>
        </div>
        
        <div style="display:flex; flex-direction:column; gap:8px">
          <button class="btn btn-gold" style="justify-content:center" id="btn-mm-update">Hinterlegte Daten aktualisieren</button>
          <button class="btn btn-g" style="justify-content:center" id="btn-mm-ignore">Ignorieren</button>
          <button class="btn btn-w" style="justify-content:center; color:var(--blu)" id="btn-mm-new">Neue Bank anlegen</button>
        </div>
        <div style="height:140px;flex-shrink:0;pointer-events:none"></div>
      \`;
      
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
`;

content = content.replace('  function _blobToB64(blob)', parseLogic + '\n  function _blobToB64(blob)');

// 3. Replace processAllPages
const processRegex = /async function processAllPages\(\) \{[\s\S]*?(?=async function _presentResults)/;
const newProcessLines = `async function processAllPages() {
    if (!_pages.length) return;
    closeScan();

    const prompt = \`Analysiere diesen Kontoauszug. Antworte NUR mit einem JSON-Objekt, kein anderer Text:
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
Negative Beträge sind Ausgaben, positive sind Eingänge. Fehlende Felder als null.\`;

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
         if (parsedData.bankdaten.iban && dbBank.iban && parsedData.bankdaten.iban.replace(/\\s/g,'') !== dbBank.iban.replace(/\\s/g,'')) diff = true;
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

  `;

content = content.replace(processRegex, newProcessLines);

// 4. Replace _presentResults
const presentRegex = /async function _presentResults\([\s\S]*?(?=\n  return \{)/;
const newPresentLines = `async function _presentResults(data) {
    let temporaryTxns = JSON.parse(JSON.stringify(data.buchungen || []));
    
    let sumIn = 0; let countIn = 0;
    let sumOut = 0; let countOut = 0;
    
    temporaryTxns.forEach((t) => {
       const b = parseFloat(t.betrag) || 0;
       if (b >= 0) { sumIn += b; countIn++; }
       else { sumOut += Math.abs(b); countOut++; }
    });

    const saldoNeu = data.endsaldo !== null ? \`\${data.endsaldo.toFixed(2)} €\` : '?';
    const saldoAlt = data.anfangssaldo !== null ? \`\${data.anfangssaldo.toFixed(2)} €\` : '?';
    const zVon = data.zeitraum_von || '?';
    const zBis = data.zeitraum_bis || '?';

    let ht = \`
      <div class="sh"></div>
      <div class="mod-header" style="margin-bottom:12px;">
        <h2 class="mod-title">Buchungen prüfen</h2>
        <p class="mod-sub">Zeitraum: \${BSP.eh(zVon)} bis \${BSP.eh(zBis)}</p>
      </div>
      
      <div style="display:flex; justify-content:space-between; background:var(--s1); padding:12px; border-radius:var(--r12); margin-bottom:16px;">
        <div>
           <div style="font-size:12px; color:var(--txt2)">Start</div>
           <div style="font-weight:600">\${saldoAlt}</div>
        </div>
        <div style="text-align:right">
           <div style="font-size:12px; color:var(--txt2)">Ende</div>
           <div style="font-weight:600">\${saldoNeu}</div>
        </div>
      </div>

      <div style="display:flex; gap:12px; margin-bottom:16px;">
        <div style="flex:1; background:rgba(0,180,100,0.1); border:1px solid rgba(0,180,100,0.2); padding:8px; border-radius:var(--r8); text-align:center;">
           <div style="font-size:12px; color:var(--grn)">\${countIn} Eingänge</div>
           <div style="font-weight:600; color:var(--grn)">+\${sumIn.toFixed(2)}</div>
        </div>
        <div style="flex:1; background:rgba(255,80,80,0.1); border:1px solid rgba(255,80,80,0.2); padding:8px; border-radius:var(--r8); text-align:center;">
           <div style="font-size:12px; color:var(--red)">\${countOut} Ausgänge</div>
           <div style="font-weight:600; color:var(--red)">-\${sumOut.toFixed(2)}</div>
        </div>
      </div>

      <div style="max-height:55vh; overflow-y:auto; margin-bottom:16px;">
    \`;
    
    temporaryTxns.forEach((t, i) => {
      const isPos = (t.betrag || 0) >= 0;
      const bColor = isPos ? 'var(--grn)' : 'var(--red)';
      ht += \`
        <div style="background:var(--s2); padding:10px; border-radius:var(--r8); margin-bottom:8px; border:1px solid var(--br)">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <input id="prev-date-\${i}" class="sett-inp" type="date" value="\${t.datum || ''}" style="width:130px; font-size:13px; margin:0">
            <div style="display:flex; align-items:center;">
              <input id="prev-amt-\${i}" class="sett-inp" type="number" step="0.01" value="\${t.betrag || 0}" style="width:90px; text-align:right; font-weight:600; color:\${bColor}; margin:0; padding-right:8px;">
              <span style="font-size:13px; color:\${bColor}; font-weight:600;">€</span>
            </div>
          </div>
          <input id="prev-empf-\${i}" class="sett-inp" type="text" value="\${BSP.eh(t.empfaenger || '')}" placeholder="Empfänger/Auftraggeber" style="margin-bottom:6px; font-size:14px; font-weight:500;">
          <input id="prev-zweck-\${i}" class="sett-inp" type="text" value="\${BSP.eh(t.verwendungszweck || '')}" placeholder="Verwendungszweck" style="font-size:13px; color:var(--txt2);">
        </div>
      \`;
    });
    ht += \`
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-g" style="flex:1;justify-content:center" onclick="BSP.closeSheet()">Abbrechen</button>
        <button class="btn btn-gold" style="flex:1;justify-content:center" id="ko-preview-save">Alle übernehmen</button>
      </div>
      <div style="height:140px;flex-shrink:0;pointer-events:none"></div>
    \`;
    
    BSP.showSheet(ht);
    
    setTimeout(() => {
      const saveBtn = document.getElementById('ko-preview-save');
      if (saveBtn) {
        saveBtn.onclick = async () => {
          temporaryTxns.forEach((t, i) => {
            t.datum = document.getElementById(\`prev-date-\${i}\`)?.value || t.datum;
            t.empfaenger = document.getElementById(\`prev-empf-\${i}\`)?.value || t.empfaenger;
            t.auftraggeber = t.empfaenger;
            t.verwendungszweck = document.getElementById(\`prev-zweck-\${i}\`)?.value || t.verwendungszweck;
            t.betrag = parseFloat(document.getElementById(\`prev-amt-\${i}\`)?.value) || t.betrag;
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
  }`;

content = content.replace(presentRegex, newPresentLines);

fs.writeFileSync(path, content, 'utf8');
console.log('Update finished completely.');
