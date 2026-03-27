// ══════════════════════════════════════════════════════════════
// MODUL: EXPORT (DATEV SKR03 EDITION)
// Steuerberater-ZIP: buchungen.csv, zuordnung.xml, Belege, Checklist
// ══════════════════════════════════════════════════════════════
'use strict';

const ExportModule = (() => {

const JSZIP_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
let _jszipLoaded = false;

const VIEW_HTML = `
<div id="v-export" class="view">
  <div class="mod-header">
    <div class="mod-title">Export</div>
    <div class="mod-sub">DATEV ZIP · Konten-Abgleich · Checkliste</div>
  </div>

  <!-- Export-Aktionen -->
  <div style="background:var(--s1);border:1px solid var(--br);border-radius:var(--r16);padding:16px;margin-bottom:12px">
    <div class="stitle">DATEV Steuerberater-ZIP</div>
    <div style="font-size:12px;font-weight:300;color:var(--txt3);margin-bottom:12px;line-height:1.6">
      Enthält: buchungen.csv (SKR03 gemappt, Bewirtung 70/30 gesplittet), zuordnung.xml, Gestempelte Belegbilder.
    </div>
    <button class="btn btn-gold" style="width:100%;justify-content:center" id="exp-zip-btn" onclick="ExportModule.validateAndExport()">
      📦 Prüfung starten & ZIP erstellen
    </button>
    <div id="exp-zip-log" style="font-size:11px;color:var(--txt3);margin-top:8px;text-align:center;display:none"></div>
  </div>

  <!-- Vollständigkeitsprüfung UI -->
  <div id="exp-validation" style="display:none;background:var(--s1);border:1px solid var(--br);border-radius:var(--r16);padding:16px;margin-bottom:12px">
    <div class="stitle">Vollständigkeits-Check</div>
    <div id="exp-val-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px"></div>
    <button class="btn btn-gold" style="width:100%;justify-content:center" id="exp-continue-btn" onclick="ExportModule._runZIP()">
      🚀 Export fortsetzen
    </button>
  </div>

  <!-- Kontoabgleich -->
  <div style="background:var(--s1);border:1px solid var(--br);border-radius:var(--r16);padding:16px;margin-bottom:12px">
    <div class="stitle">Kontoauszug-Abgleich (Vor Export)</div>
    <div style="font-size:12px;font-weight:300;color:var(--txt3);margin-bottom:10px;line-height:1.6">
      Bank-CSV laden um offene Posten (AR/ER) zu matchen. Wichtig für Vollständigkeit!
    </div>
    <label class="btn btn-g" style="cursor:pointer;width:100%;justify-content:center">
      📄 Bank-CSV laden
      <input type="file" accept=".csv,.txt" style="display:none" onchange="ExportModule.loadKonto(this)">
    </label>

    <div id="exp-konto-result" style="display:none;margin-top:12px">
      <div id="exp-konto-stats" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px"></div>
      <div id="exp-konto-offene" style="display:flex;flex-direction:column;gap:4px"></div>
      <button class="btn btn-gold" style="width:100%;justify-content:center;margin-top:10px" onclick="ExportModule.exportKontoCSV()">
        ⬇️ Abgelehnte Buchungen laden
      </button>
    </div>
  </div>

  <!-- Statistik -->
  <div style="background:var(--s1);border:1px solid var(--br);border-radius:var(--r16);padding:16px;margin-bottom:12px" id="exp-stats">
    <div class="stitle">Datenbestand</div>
    <div id="exp-stats-body"></div>
  </div>
</div>
`;

let _kontoData = [];
let _matchResult = [];
let _validationBlocker = false;

// ── Init ─────────────────────────────────────────────────────
function init() {
  const container = document.getElementById('module-views');
  if (container) {
    const tmp = document.createElement('div');
    tmp.innerHTML = VIEW_HTML;
    container.appendChild(tmp.firstElementChild);
  }

  BSP.on('core:ready', async () => { await _renderStats(); });
  BSP.on('view:changed', ({ name }) => { if (name === 'export') _renderStats(); });
  BSP.on('beleg:saved', () => { _renderStats(); });
}

async function _renderStats() {
  const el = document.getElementById('exp-stats-body');
  if (!el) return;
  try {
    const belege = await BSP.getBelege();
    const year = new Date().getFullYear();
    const yb = belege.filter(b => b.date && new Date(b.date + 'T00:00:00').getFullYear() === year);
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--br)"><span style="font-size:12px;color:var(--txt2)">Eingangsbelege (ER)</span><span style="font-size:12px;color:var(--blu)">${yb.filter(b=>b.type==='er').length}</span></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--br)"><span style="font-size:12px;color:var(--txt2)">Ausgangsrechnungen (AR)</span><span style="font-size:12px;color:var(--ylw)">${yb.filter(b=>b.type==='ar').length}</span></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0"><span style="font-size:12px;color:var(--txt2)">Reverse Charge</span><span style="font-size:12px;color:var(--orn)">${yb.filter(b=>b.isReverseCharge).length}</span></div>`;
  } catch(e) { el.textContent = 'Fehler beim Laden'; }
}

async function _loadJSZip() {
  if (typeof JSZip !== 'undefined') return;
  return new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = JSZIP_CDN;
    sc.onload = res;
    sc.onerror = () => rej(new Error('JSZip konnte nicht geladen werden'));
    document.head.appendChild(sc);
  });
}

function _log(msg) {
  const el = document.getElementById('exp-zip-log');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function _esc(v) {
  const s = String(v == null ? '' : v);
  return s.includes(';') || s.includes('"') || s.includes('\\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}
function _headerRow(...cols) { return cols.map(_esc).join(';'); }

// ── DATEV CSV Mapper ──────────────────────────────────────────
function _datevRow(b, skr03, is70 = false, is30 = false) {
  let netto = Number(b.net || 0);
  let brutto = Number(b.brutto || 0);
  let mwst = Number(b.mwst || 0);
  let text = b.shop || 'Unbekannt';
  let kInfo = skr03[b.cat] || { konto: '' };

  if (is70) {
    netto*=0.7; brutto*=0.7; mwst*=0.7;
    text = '70% absetzbar | ' + text;
    kInfo = skr03['Bewirtung 70% absetzbar'] || { konto: 4650 };
  } else if (is30) {
    netto*=0.3; brutto*=0.3; mwst*=0.3;
    text = '30% privat | ' + text;
    kInfo = skr03['Bewirtung 30% nicht absetzbar'] || { konto: 4654 };
  }

  let sw = '';
  if (!kInfo.automatik) {
    if (kInfo.steuerSchluessel) sw = kInfo.steuerSchluessel;
    else if (b.isReverseCharge) sw = 94;
    else if (b.mwstRate === 19) sw = 9;
    else if (b.mwstRate === 7) sw = 8;
  }

  return [
    b.belegNr || '',
    b.date ? b.date.split('-').reverse().join('') : '', // DDMMYYYY für DATEV
    text,
    netto.toFixed(2).replace('.',','),
    b.mwstRate || '',
    mwst.toFixed(2).replace('.',','),
    brutto.toFixed(2).replace('.',','),
    kInfo.konto || '',
    sw,
    b.cat || '',
    b.klartext || '',
    b.originalWaehrung || '',
    b.originalBrutto ? Number(b.originalBrutto).toFixed(2).replace('.',',') : '',
    b.wechselkurs ? Number(b.wechselkurs).toFixed(4).replace('.',',') : ''
  ].map(_esc).join(';');
}

// ── Vollständigkeitsprüfung ──────────────────────────────────
async function validateAndExport() {
  const btn = document.getElementById('exp-zip-btn');
  if (btn) btn.disabled = true;

  try {
    const valView = document.getElementById('exp-validation');
    const valList = document.getElementById('exp-val-list');
    const contBtn = document.getElementById('exp-continue-btn');
    valView.style.display = 'block';
    valList.innerHTML = '<div style="color:var(--txt3)">Prüfe Daten...</div>';
    
    // Check elements
    const year = new Date().getFullYear();
    const belege = await BSP.getBelege();
    const yb = belege.filter(b => b.date && new Date(b.date + 'T00:00:00').getFullYear() === year);
    
    let missingSKR03 = 0;
    let missingRC = 0;
    
    yb.forEach(b => {
      const isBewirtung = (b.cat || '').includes('Bewirtung');
      if (!isBewirtung && (!b.cat || !BSP.DATEV?.SKR03[b.cat])) missingSKR03++;
      if (b.isReverseCharge && !b.cat?.includes('Reverse')) missingRC++;
    });

    const hasBank = _kontoData.length > 0;
    const unmatchedAR = _matchResult.filter(r => r.betrag > 0 && r.status === 'unmatched').length;

    let html = '';
    _validationBlocker = false;

    const addLi = (passed, text, sub) => {
      const c = passed ? 'var(--grn)' : 'var(--orn)';
      const i = passed ? '✓' : '⚠️';
      html += `<div style="background:var(--s2);border:1px solid ${c}40;border-left:3px solid ${c};padding:10px;border-radius:var(--r8)">
          <div style="font-size:13px;color:var(--txt)">${i} ${text}</div>
          <div style="font-size:11px;color:var(--txt3);margin-top:2px">${sub}</div>
        </div>`;
    };

    addLi(missingSKR03 === 0, 'SKR03 Kategorien', missingSKR03 === 0 ? 'Alle Belege sind zugewiesen' : `${missingSKR03} Belege ohne passendes Gegenkonto!`);
    if(missingSKR03 > 0) _validationBlocker = true;

    addLi(missingRC === 0, 'Reverse-Charge', missingRC === 0 ? 'Keine RC-Logikbrüche' : `${missingRC} RC-Belege haben fragwürdige Kategorien.`);
    
    if (!hasBank) {
      addLi(false, 'Kontoauszug fehlt', 'Es wurde kein CSV-Kontoauszug geladen. AR-Geldeingänge nicht abgleichbar.');
    } else {
      addLi(unmatchedAR === 0, 'Geldeingänge (AR)', unmatchedAR === 0 ? 'Alle Zahlungen gematcht' : `${unmatchedAR} ungeklärte Geldeingänge im Kontoauszug!`);
    }

    valList.innerHTML = html;

    if (_validationBlocker) {
      contBtn.className = 'btn btn-red';
      contBtn.textContent = '💀 Fehlerhaft Exportieren (Nicht Empfohlen)';
    } else {
      contBtn.className = 'btn btn-grn';
      contBtn.textContent = '🚀 DATEV-Export Starten';
    }

  } catch(e) {
    BSP.toast('Fehler in Validierung: ' + e.message, 'er');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ── Export Runner (CSV + XML + ZIP + Stempel) ─────────────────
async function _runZIP() {
  const contBtn = document.getElementById('exp-continue-btn');
  if (contBtn) contBtn.disabled = true;

  try {
    _log('📦 JSZip und DATEV-Mapper werden gestartet …');
    await _loadJSZip();
    const zip = new JSZip();
    const year = new Date().getFullYear();
    const s = BSP.state.settings || {};
    const SKR03 = BSP.DATEV?.SKR03 || {};

    const allBelege = await BSP.getBelege();
    const yb = allBelege.filter(b => b.date && new Date(b.date + 'T00:00:00').getFullYear() === year);

    _log('📊 DATEV buchungen.csv wird generiert …');
    const csvHeader = _headerRow('Belegnummer','Datum','Buchungstext','Umsatz (ohne Soll/Haben-Kz)','MwSt-Satz','MwSt','Brutto','Konto','BU-Schlüssel','Kategorie','Klartext (KI)','Währung Orig','Betrag Orig','Wechselkurs (EZB)');
    
    const csvRows = [];
    yb.forEach(b => {
      if ((b.cat||'').includes('Bewirtung')) {
        csvRows.push(_datevRow(b, SKR03, true, false));
        csvRows.push(_datevRow(b, SKR03, false, true));
      } else {
        csvRows.push(_datevRow(b, SKR03));
      }
    });

    const csvOutput = '\uFEFF' + [csvHeader, ...csvRows].join('\r\n');
    zip.file('buchungen.csv', csvOutput);

    // ── KONTO DATEN LADEN ──
    const allKonto = (await BSP.dbGetAll('konto')) || [];
    
    // 1. Konto-Buchungen (Alle Geschäftskonten)
    const bizKonto = allKonto.filter(k => k.tags && k.tags.kontoTyp === 'Business');
    if (bizKonto.length > 0) {
       _log('📊 konto-buchungen.csv wird generiert …');
       const kHeader = _headerRow('Datum', 'Empfänger/Auftraggeber', 'Betrag', 'Typ', 'Zweck', 'Status');
       const kRows = bizKonto.map(k => {
          return [BSP.fd(k.datum), k.empfaenger||'', BSP.fm(k.betrag), k.typ||'', k.zweck||'', k.status||''].map(_esc).join(';');
       });
       zip.file('konto-buchungen.csv', '\uFEFF' + [kHeader, ...kRows].join('\r\n'));
    }

    // 2. Geldeingänge (Eigene Tabelle)
    const geldeingaenge = allKonto.filter(k => k.betrag > 0 && 
       // Entweder auf Geschäftskonto ODER auf Privatkonto als Business getaggt
       (k.tags?.kontoTyp === 'Business' || (k.tags?.kontoTyp === 'Privat' && k.tags?.ausgabenTyp === 'Business'))
    );
    if (geldeingaenge.length > 0) {
       _log('📊 geldeingaenge.csv wird generiert …');
       const gHeader = _headerRow('Datum', 'Auftraggeber', 'Betrag', 'Zweck', 'Konto-Typ', 'Verknüpfter Beleg', 'Korrektur-Hinweis');
       const gRows = geldeingaenge.map(k => {
          let warn = '';
          if (k.tags?.kontoTyp === 'Privat' && k.tags?.ausgabenTyp === 'Business') warn = 'Geschäftseinnahme auf Privatkonto – Korrekturbuchung erforderlich';
          return [BSP.fd(k.datum), k.empfaenger||'', BSP.fm(k.betrag), k.zweck||'', k.tags?.kontoTyp||'', k.status==='abgeglichen'?'Ja':'Nein', warn].map(_esc).join(';');
       });
       zip.file('geldeingaenge.csv', '\uFEFF' + [gHeader, ...gRows].join('\r\n'));
    }

    // 3. Konto-Korrekturen (Mismatch)
    const mismatches = allKonto.filter(k => k.tags && k.tags.mismatch);
    if (mismatches.length > 0) {
       _log('📊 konto-korrekturen.csv wird generiert …');
       const mHeader = _headerRow('Datum', 'Empfänger', 'Betrag', 'Zweck', 'Gezahlt von Konto', 'Tatsächliche Ausgabe', 'Hinweis an Steuerberater');
       const mRows = mismatches.map(k => {
          let hint = 'Privat auf Business-Konto gezahlt (Sollte gegen Privatentnahme gebucht werden)';
          if (k.tags.kontoTyp === 'Privat') hint = 'Business auf Privat-Konto gezahlt (Sollte als Privateinlage gebucht werden)';
          return [BSP.fd(k.datum), k.empfaenger||'', BSP.fm(k.betrag), k.zweck||'', k.tags.kontoTyp, k.tags.ausgabenTyp, hint].map(_esc).join(';');
       });
       zip.file('konto-korrekturen.csv', '\uFEFF' + [mHeader, ...mRows].join('\r\n'));
    }


    _log('🔗 zuordnung.xml wird strukturiert …');
    // DATEV XML Wrapper
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Belege>\n`;
    const stempelPromises = [];
    const belegFolder = zip.folder('belege');
    
    let count = 0;
    for (const b of yb) {
      if (!b.image || !b.belegNr) continue;
      
      const fileName = `${b.belegNr}_S1.jpg`.replace(/[/\\:*?"<>|]/g, '_');
      xml += `  <Beleg>\n    <Belegnummer>${b.belegNr}</Belegnummer>\n    <Dateiname>${fileName}</Dateiname>\n  </Beleg>\n`;
      
      // Bildkompression / Stempel asynchron sammeln
      const p = _stampImage(b.image, b).then(stamped => {
        const data = stamped.replace(/^data:[^;]+;base64,/, '');
        belegFolder.file(fileName, data, { base64: true });
        count++;
      }).catch(()=>{});
      stempelPromises.push(p);
    }
    xml += `</Belege>`;
    zip.file('zuordnung.xml', xml);

    _log('🖼️ Belege werden bestempelt (' + stempelPromises.length + ' Docs) …');
    await Promise.all(stempelPromises);

    // README
    const name = [s.vorname, s.nachname].filter(Boolean).join(' ') || 'Mandant';
    const readme = `DATEV EXPORTPAKET - BELEGSCAN PRO
Mandant: ${name}
Zeitraum: ${year}

INHALT:
• buchungen.csv: DATEV-konforme Importdatei mit automatischem Konto-Mapping (SKR03). Bewirtungsbelege wurden mathematisch 70/30 gesplittet (selbe Belegnummer). Automatik-Konten (3010, 3030) enthalten planmäßig keinen BU-Schlüssel. Fremdwährungen wurden via EZB-API in Euro umgerechnet (Kurswert aus Buchungsdatum).
• zuordnung.xml: Verknüpft die Rechnungen in 'buchungen.csv' mit den Dateien im Ordner.
• belege/: Gestempelte Foto-Scans der Belege.`;
    zip.file('README.txt', readme);

    _log(`📦 ZIP wird gepackt ...` );
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DATEV-Export-${year}-${new Date().toISOString().split('T')[0]}.zip`;
    a.click();
    URL.revokeObjectURL(url);

    _log(`✓ DATEV-ZIP erstellt (${yb.length} Belege)`);
    BSP.toast('Export komplett ✓', 'ok');

    // UI Reset
    document.getElementById('exp-validation').style.display = 'none';

  } catch(e) {
    _log('❌ ' + e.message);
    BSP.toast('ZIP Fehler: ' + e.message, 'er');
  } finally {
    if (contBtn) contBtn.disabled = false;
  }
}

// ── Firmenstempel Canvas (nur Business ER) ────────────────────
async function _stampImage(b64, beleg) {
  if (beleg.type !== 'er') return b64; // Stempel nur für Eingangsrechnungen
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const s = BSP.state.settings || {};
      const fsize = Math.max(14, Math.min(24, c.width / 35));
      const pad = 12;

      ctx.font = `300 ${fsize}px Inter, sans-serif`;
      const lines = [
        "GEPRÜFT UND GEBUCHT",
        `Konto: ${(BSP.DATEV?.SKR03[beleg.cat] || {}).konto || 'Unbekannt'}`,
        `Belegnr: ${beleg.belegNr || '—'}`,
        `Datum: ${new Date().toLocaleDateString('de-DE')}`
      ];
      const lineH = fsize * 1.4;
      const boxH = lines.length * lineH + pad * 2;
      const boxW = lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0) + pad * 2.5;
      const x = c.width - boxW - 8;
      const y = c.height - boxH - 8;

      // Kasten
      ctx.fillStyle = 'rgba(0,40,15,.75)';
      ctx.beginPath();
      ctx.roundRect(x, y, boxW, boxH, 6);
      ctx.fill();
      ctx.strokeStyle = '#44cc66';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Text
      ctx.fillStyle = '#44cc66';
      lines.forEach((line, i) => {
        ctx.font = i === 0 ? `500 ${fsize}px Inter, sans-serif` : `300 ${fsize*0.9}px Inter, sans-serif`;
        ctx.fillText(line, x + pad, y + pad + fsize + i * lineH);
      });

      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(b64);
    img.src = b64;
  });
}

// ── Kontoabgleich Legacy ───────────────────────────────────────
async function loadKonto(input) {
  const f = input.files[0];
  if (!f) return;
  const text = await f.text();
  _kontoData = _parseKontoCSV(text);
  if (!_kontoData.length) { BSP.toast('Keine Einträge gefunden – bitte Format prüfen', 'wr'); return; }
  await _abgleichen();
}

function _parseKontoCSV(text) {
  const lines = text.split(/\\r?\\n/).filter(l => l.trim());
  const entries = [];
  for (const line of lines) {
    const sep = line.includes(';') ? ';' : ',';
    const parts = line.split(sep).map(p => p.replace(/^"|"$/g, '').trim());
    if (parts.length < 3) continue;
    let dateStr = parts[0];
    let isoDate = null;
    if (/\\d{2}\\.\\d{2}\\.\\d{4}/.test(dateStr)) {
      const [d, m, y] = dateStr.split('.');
      isoDate = `${y}-${m}-${d}`;
    } else if (/\\d{4}-\\d{2}-\\d{2}/.test(dateStr)) {
      isoDate = dateStr;
    }
    if (!isoDate) continue;
    let betrag = null;
    for (let i = parts.length - 1; i >= 1; i--) {
      const raw = parts[i].replace(/\\./g, '').replace(',', '.').replace(/[^\\d.\\-]/g, '');
      const n = parseFloat(raw);
      if (!isNaN(n)) { betrag = n; break; }
    }
    if (betrag === null) continue;
    entries.push({ date: isoDate, empfaenger: parts[1] || parts[2] || '', betrag, rawLine: line });
  }
  return entries;
}

async function _abgleichen() {
  const belege = await BSP.getBelege();
  _matchResult = [];
  for (const konto of _kontoData) {
    const match = belege.find(b => {
      if (!b.date || !b.brutto) return false;
      const daysDiff = Math.abs((new Date(b.date+'T00:00:00') - new Date(konto.date+'T00:00:00')) / 864e5);
      return daysDiff <= 1 && Math.abs(Math.abs(konto.betrag) - Math.abs(b.brutto)) < 0.05;
    });
    _matchResult.push({ ...konto, status: match ? 'matched' : 'unmatched', belegNr: match?.belegNr, shop: match?.shop });
  }
  _renderAbgleich();
}

function _renderAbgleich() {
  const container = document.getElementById('exp-konto-result');
  if (container) container.style.display = 'block';
  const matched = _matchResult.filter(r => r.status === 'matched').length;
  const unmatched = _matchResult.filter(r => r.status === 'unmatched').length;
  const stats = document.getElementById('exp-konto-stats');
  if (stats) {
    const sc = (lbl, val, col) => `<div style="background:var(--s2);border:1px solid var(--br);border-radius:var(--r8);padding:10px;text-align:center"><div style="font-size:9px;color:var(--txt3);text-transform:uppercase;margin-bottom:4px">${lbl}</div><div style="font-size:18px;color:${col}">${val}</div></div>`;
    stats.innerHTML = sc('Gesamt', _matchResult.length, 'var(--txt)') + sc('Gematcht', matched, 'var(--grn)') + sc('Offen', unmatched, 'var(--red)');
  }
  const offene = document.getElementById('exp-konto-offene');
  if (offene) {
    const umItems = _matchResult.filter(r => r.status === 'unmatched');
    if (!umItems.length) offene.innerHTML = '<div style="color:var(--grn);text-align:center">✓ Alle gematcht</div>';
    else offene.innerHTML = umItems.map(r => `<div style="background:rgba(192,64,64,.06);padding:10px;font-size:12px;border-radius:8px"><div style="display:flex;justify-content:space-between"><span style="color:var(--txt2)">${BSP.eh(r.empfaenger)}</span><span style="color:var(--red)">${BSP.fm(Math.abs(r.betrag))} €</span></div><div style="font-size:10px;color:var(--txt3)">${r.date}</div></div>`).join('');
  }
}

function exportKontoCSV() {
  if (!_matchResult.length) return;
  const csv = '\\uFEFF' + _headerRow('Datum','Empfaenger','Betrag','Status','BelegNr') + '\\r\\n' + _matchResult.map(r => [r.date, r.empfaenger, String(r.betrag).replace('.',','), r.status, r.belegNr||''].map(_esc).join(';')).join('\\r\\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `kontoabgleich-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

return { init, validateAndExport, _runZIP, loadKonto, exportKontoCSV };

})();
