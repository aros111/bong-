// ══════════════════════════════════════════════════════════════
// MODUL: EXPORT (DATEV SKR03 Q1 EDITION)
// Aufgaben 3 + 6: Monatsfilter + Vollständigkeits-Ampel + Q1-ZIP
// ══════════════════════════════════════════════════════════════
'use strict';

const ExportModule = (() => {

const JSZIP_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';

// Aktiver Zeitraum-Filter
let _filter = 'q1'; // 'jan'|'feb'|'mär'|'q1'|'year'
let _kontoData = [];
let _matchResult = [];
let _validationBlocker = false;

const VIEW_HTML = `
<div id="v-export" class="view">
  <div class="mod-header">
    <div class="mod-title">Export</div>
    <div class="mod-sub">DATEV ZIP · Q1 Steuererklärung · Checkliste</div>
  </div>

  <!-- Zeitraum-Filter (Aufgabe 3) -->
  <div style="background:var(--bg2);border:1px solid var(--br);border-radius:var(--r12);padding:12px;margin-bottom:12px">
    <div style="font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">Zeitraum wählen</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap" id="exp-period-btns">
      <button class="btn btn-gold btn-sm" id="exp-p-jan" onclick="ExportModule.setPeriod('jan')">Januar</button>
      <button class="btn btn-g btn-sm" id="exp-p-feb" onclick="ExportModule.setPeriod('feb')">Februar</button>
      <button class="btn btn-g btn-sm" id="exp-p-mar" onclick="ExportModule.setPeriod('mar')">März</button>
      <button class="btn btn-g btn-sm" id="exp-p-q1" onclick="ExportModule.setPeriod('q1')" style="border-color:var(--accent)">Q1 gesamt ✓</button>
    </div>
  </div>

  <!-- Vollständigkeits-Ampel (Aufgabe 3) -->
  <div id="exp-ampel" style="background:var(--bg2);border:1px solid var(--br);border-radius:var(--r12);padding:16px;margin-bottom:12px">
    <div style="font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px">Vollständigkeits-Prüfung</div>
    <div id="exp-ampel-body"><div style="color:var(--txt3);font-size:12px">Wird geladen …</div></div>
  </div>

  <!-- Export-Aktionen -->
  <div style="background:var(--bg2);border:1px solid var(--br);border-radius:var(--r16);padding:16px;margin-bottom:12px">
    <div style="font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px">DATEV Steuerberater-ZIP</div>
    <div style="font-size:12px;font-weight:300;color:var(--txt3);margin-bottom:12px;line-height:1.6">
      Enthält: ustva_q1.csv, buchungen.csv (SKR03), kontoauszuege.csv, belege/, zuordnung.xml, README.txt
    </div>
    <button class="btn btn-gold" style="width:100%;justify-content:center" id="exp-zip-btn" onclick="ExportModule.validateAndExport()">
      📦 Prüfung starten &amp; ZIP erstellen
    </button>
    <div id="exp-zip-log" style="font-size:11px;color:var(--txt3);margin-top:8px;text-align:center;display:none"></div>
  </div>

  <!-- Vollständigkeitsprüfung (erweitert) -->
  <div id="exp-validation" style="display:none;background:var(--bg2);border:1px solid var(--br);border-radius:var(--r16);padding:16px;margin-bottom:12px">
    <div style="font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px">Vollständigkeits-Check</div>
    <div id="exp-val-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px"></div>
    <button class="btn btn-gold" style="width:100%;justify-content:center" id="exp-continue-btn" onclick="ExportModule._runZIP()">
      🚀 Export fortsetzen
    </button>
  </div>

  <!-- Statistik -->
  <div style="background:var(--bg2);border:1px solid var(--br);border-radius:var(--r16);padding:16px;margin-bottom:12px" id="exp-stats">
    <div style="font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">Datenbestand</div>
    <div id="exp-stats-body"></div>
  </div>
</div>
`;

// ── Init ─────────────────────────────────────────────────────
function init() {
  const container = document.getElementById('module-views');
  if (container) {
    const tmp = document.createElement('div');
    tmp.innerHTML = VIEW_HTML;
    container.appendChild(tmp.firstElementChild);
  }

  BSP.on('core:ready', async () => { await _renderStats(); await _renderAmpel(); });
  BSP.on('view:changed', ({ name }) => { if (name === 'export') { _renderStats(); _renderAmpel(); _highlightPeriodBtn(); } });
  BSP.on('beleg:saved', () => { _renderStats(); _renderAmpel(); });
  BSP.on('konto:imported', () => { _renderAmpel(); });
}

// ── Zeitraum ─────────────────────────────────────────────────
function setPeriod(p) {
  _filter = p;
  _highlightPeriodBtn();
  _renderAmpel();
  _renderStats();
}

// Öffentlich aufgerufen von MwSt-Sheet-Button und Dashboard
function openQ1Dialog() {
  _filter = 'q1';
  _highlightPeriodBtn();
  _renderAmpel();
  document.getElementById('exp-zip-btn')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function _highlightPeriodBtn() {
  ['jan','feb','mar','q1'].forEach(p => {
    const b = document.getElementById('exp-p-' + p);
    if (!b) return;
    if (p === _filter) {
      b.className = 'btn btn-gold btn-sm';
    } else {
      b.className = 'btn btn-g btn-sm';
    }
  });
}

function _getPeriodRange() {
  const year = new Date().getFullYear();
  // Immer 2026 für Q1
  const y = 2026;
  if (_filter === 'jan') return { start: `${y}-01-01`, end: `${y}-01-31` };
  if (_filter === 'feb') return { start: `${y}-02-01`, end: `${y}-02-28` };
  if (_filter === 'mar') return { start: `${y}-03-01`, end: `${y}-03-31` };
  if (_filter === 'q1')  return { start: `${y}-01-01`, end: `${y}-03-31` };
  return { start: `${y}-01-01`, end: `${year}-12-31` }; // 'year'
}

function _filterBelege(belege) {
  const { start, end } = _getPeriodRange();
  return belege.filter(b => {
    if (!b.date) return false;
    return b.date >= start && b.date <= end;
  });
}

// ── Vollständigkeits-Ampel (Aufgabe 3) ────────────────────────
async function _renderAmpel() {
  const el = document.getElementById('exp-ampel-body');
  if (!el) return;

  const allBelege = await BSP.getBelege();
  const allKonto = (await BSP.dbGetAll('konto')) || [];

  const months = [
    { name: 'Januar', start: '2026-01-01', end: '2026-01-31', m: 0 },
    { name: 'Februar', start: '2026-02-01', end: '2026-02-28', m: 1 },
    { name: 'März', start: '2026-03-01', end: '2026-03-31', m: 2 },
  ];

  let globalStatus = 'grn'; // grn | orn | red
  let html = '';

  for (const mo of months) {
    const mb = allBelege.filter(b => b.date >= mo.start && b.date <= mo.end);
    const mk = allKonto.filter(k => k.datum >= mo.start && k.datum <= mo.end);
    const geldeingaenge = mk.filter(k => k.betrag > 0);
    const offeneGE = geldeingaenge.filter(k => k.status !== 'abgeglichen');
    const hasKonto = mk.length > 0;
    const hasBelege = mb.length > 0;

    let icon, color, status;
    if (!hasBelege) {
      icon = '❌'; color = 'var(--red)'; status = 'red';
      if (globalStatus !== 'red') globalStatus = 'red';
    } else if (!hasKonto || offeneGE.length > 0) {
      icon = '⚠️'; color = 'var(--orn)'; status = 'orn';
      if (globalStatus === 'grn') globalStatus = 'orn';
    } else {
      icon = '✓'; color = 'var(--grn)'; status = 'grn';
    }

    const details = [];
    details.push(`${mb.length} Beleg${mb.length !== 1 ? 'e' : ''}`);
    details.push(hasKonto ? `${mk.length} Kontobuchung${mk.length !== 1 ? 'en' : ''} ✓` : 'kein Kontoauszug ⚠️');
    if (offeneGE.length > 0) details.push(`${offeneGE.length} offene Geldeingänge`);

    html += `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--br)">
        <div style="font-size:16px;width:24px;text-align:center">${icon}</div>
        <div style="flex:1">
          <div style="font-size:13px;color:${color};font-weight:500">${mo.name}</div>
          <div style="font-size:11px;color:var(--txt3)">${details.join(' · ')}</div>
        </div>
      </div>`;
  }

  // Gesamtstatus-Box
  const statusMap = {
    grn: { bg: 'rgba(58,175,112,.08)', border: 'rgba(58,175,112,.3)', color: 'var(--grn)', text: 'Q1 vollständig – Export bereit', icon: '✓' },
    orn: { bg: 'rgba(192,112,48,.07)', border: 'rgba(192,112,48,.3)', color: 'var(--orn)', text: 'Lücken vorhanden – Export mit Hinweis möglich', icon: '⚠️' },
    red: { bg: 'rgba(192,64,64,.07)',  border: 'rgba(192,64,64,.3)',  color: 'var(--red)', text: 'Kritisch: Fehlende Daten – Export nur nach Bestätigung', icon: '❌' },
  };
  const st = statusMap[globalStatus];
  const sumHtml = `<div style="background:${st.bg};border:1px solid ${st.border};border-radius:var(--r8);padding:12px;margin-top:4px;display:flex;align-items:center;gap:10px">
    <div style="font-size:20px">${st.icon}</div>
    <div style="font-size:12px;color:${st.color};font-weight:500">${st.text}</div>
  </div>`;

  el.innerHTML = html + sumHtml;
}

async function _renderStats() {
  const el = document.getElementById('exp-stats-body');
  if (!el) return;
  try {
    const belege = await BSP.getBelege();
    const fb = _filterBelege(belege);
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--br)"><span style="font-size:12px;color:var(--txt2)">Eingangsbelege (ER)</span><span style="font-size:12px;color:var(--blu)">${fb.filter(b=>b.type==='er').length}</span></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--br)"><span style="font-size:12px;color:var(--txt2)">Ausgangsrechnungen (AR)</span><span style="font-size:12px;color:var(--ylw)">${fb.filter(b=>b.type==='ar').length}</span></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0"><span style="font-size:12px;color:var(--txt2)">Reverse Charge</span><span style="font-size:12px;color:var(--orn)">${fb.filter(b=>b.isReverseCharge).length}</span></div>`;
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
  return s.includes(';') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s;
}
function _headerRow(...cols) { return cols.map(_esc).join(';'); }

// ── DATEV CSV Mapper ──────────────────────────────────────────
function _datevRow(b, skr03, is70 = false, is30 = false) {
  let netto = Number(b.net || 0);
  let brutto = Number(b.brutto || 0);
  let mwst = Number(b.mwst || 0);
  let text = b.type === 'ar'
    ? (b.empfaenger || b.shop || 'Unbekannt') + ' (AR)'
    : (b.shop || 'Unbekannt');
  if (is70) { netto*=0.7; brutto*=0.7; mwst*=0.7; text = '70% absetzbar | ' + text; }
  if (is30) { netto*=0.3; brutto*=0.3; mwst*=0.3; text = '30% privat | ' + text; }

  let kInfo = skr03[b.cat] || { konto: '' };
  if (b.type === 'ar') kInfo = { konto: 8400 };
  
  if (is70) kInfo = skr03['Bewirtung 70% absetzbar'] || { konto: 4650 };
  if (is30) kInfo = skr03['Bewirtung 30% nicht absetzbar'] || { konto: 4654 };

  let sw = '';
  if (!kInfo.automatik) {
    if (kInfo.steuerSchluessel) sw = kInfo.steuerSchluessel;
    else if (b.isReverseCharge) sw = 94;
    else if (b.mwstRate === 19) sw = 9;
    else if (b.mwstRate === 7) sw = 8;
  }

  return [
    b.belegNr || '',
    b.date ? b.date.split('-').reverse().join('') : '',
    text,
    netto.toFixed(2).replace('.',','),
    b.mwstRate || '',
    mwst.toFixed(2).replace('.',','),
    brutto.toFixed(2).replace('.',','),
    kInfo.konto || '',
    sw,
    b.cat || '',
    b.belegNrExtern || '',
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

    const belege = await BSP.getBelege();
    const fb = _filterBelege(belege);
    const allKonto = (await BSP.dbGetAll('konto')) || [];
    const { start, end } = _getPeriodRange();
    const fk = allKonto.filter(k => k.datum >= start && k.datum <= end);

    // Aufgabe 6: pending_review prüfen
    const pendingAll = await BSP.prGetAll();
    const pendingOpen = pendingAll.filter(p => p.status === 'offen' || p.status === 'später_klären');
    const pendingStale = pendingOpen.filter(p => p.ts && p.ts < Date.now() - 14 * 864e5);
    const pendingCount = pendingOpen.length;

    let missingSKR03 = 0, missingRC = 0;
    fb.forEach(b => {
      if (b.type === 'ar') return;
      const isBewirtung = (b.cat || '').includes('Bewirtung');
      if (!isBewirtung && (!b.cat || !BSP.DATEV?.SKR03[b.cat])) missingSKR03++;
      if (b.isReverseCharge && !b.cat?.includes('Reverse')) missingRC++;
    });

    const offeneGE = fk.filter(k => k.betrag > 0 && k.status !== 'abgeglichen').length;
    const hasKonto = fk.length > 0;
    const missingAR = fb.filter(b => b.type === 'ar' && !b.empfaenger).length;

    let html = '';
    _validationBlocker = false;
    let _validationOrange = false;

    const addLi = (status, text, sub) => {
      const c = status === 'ok' ? 'var(--grn)' : status === 'warn' ? 'var(--orn)' : 'var(--red)';
      const i = status === 'ok' ? '✓' : status === 'warn' ? '⚠️' : '❌';
      html += `<div style="background:var(--bg3);border:1px solid ${c}40;border-left:3px solid ${c};padding:10px;border-radius:var(--r8)">
          <div style="font-size:13px;color:var(--txt)">${i} ${text}</div>
          <div style="font-size:11px;color:var(--txt3);margin-top:2px">${sub}</div>
        </div>`;
    };

    addLi(missingSKR03 === 0 ? 'ok' : 'err', 'SKR03 Kategorien',
      missingSKR03 === 0 ? 'Alle Belege sind zugewiesen' : `${missingSKR03} Belege ohne passendes Gegenkonto!`);
    if (missingSKR03 > 0) _validationBlocker = true;

    addLi(missingRC === 0 ? 'ok' : 'warn', 'Reverse-Charge',
      missingRC === 0 ? 'Keine RC-Logikbrüche' : `${missingRC} RC-Belege mit fragwürdigen Kategorien.`);

    addLi(!hasKonto ? 'warn' : offeneGE === 0 ? 'ok' : 'warn',
      'Kontoauszüge & Geldeingänge',
      !hasKonto ? 'Kein Kontoauszug importiert – AR-Abgleich nicht möglich ⚠️'
        : offeneGE === 0 ? 'Alle Geldeingänge abgeglichen ✓'
        : `${offeneGE} Geldeingang${offeneGE!==1?'e':''} ohne passende AR-Rechnung ⚠️`);

    addLi(missingAR === 0 ? 'ok' : 'err', 'AR-Pflichtfelder',
      missingAR === 0 ? 'Alle AR-Belege haben Rechnungsempfänger'
        : `${missingAR} AR-Beleg${missingAR!==1?'e':''} ohne Rechnungsempfänger!`);
    if (missingAR > 0) _validationBlocker = true;

    // pending_review Check (Aufgabe 6)
    if (pendingCount === 0) {
      addLi('ok', 'Ungeklärte Buchungen', 'Alle Buchungen sind geklärt ✓');
    } else {
      const staleHint = pendingStale.length > 0 ? ` (${pendingStale.length} älter als 14 Tage!)` : '';
      addLi('warn', `Ungeklärte Buchungen: ${pendingCount}${staleHint}`,
        'Werden am Ende der CSV für die Steuerberaterin markiert. Bestätigung erforderlich.');
      _validationOrange = true;
    }

    valList.innerHTML = html;

    // Bestätigungs-Checkbox wenn pending vorhanden
    if (_validationOrange && !_validationBlocker) {
      const confirmRow = document.createElement('div');
      confirmRow.style.cssText = 'background:rgba(192,112,48,.06);border:1px solid rgba(192,112,48,.3);border-radius:var(--r8);padding:12px;margin-top:8px;display:flex;align-items:flex-start;gap:10px';
      confirmRow.innerHTML = `
        <input type="checkbox" id="pending-confirm-cb" style="width:18px;height:18px;accent-color:var(--orn);flex-shrink:0;margin-top:2px">
        <label for="pending-confirm-cb" style="font-size:12px;color:var(--txt);line-height:1.5;cursor:pointer">
          Ich bestätige, dass <strong>${pendingCount} Buchung${pendingCount!==1?'en':''}</strong> noch ungeklärt sind und trotzdem exportiert werden sollen. Die Steuerberaterin wird informiert.
        </label>`;
      valList.appendChild(confirmRow);
    }

    if (_validationBlocker) {
      contBtn.style.cssText = 'width:100%;padding:14px;border:none;border-radius:var(--r12);background:var(--red);color:#fff;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center';
      contBtn.textContent = '💀 Fehlerhaft Exportieren (Nicht Empfohlen)';
      contBtn.onclick = () => _runZIP();
    } else if (_validationOrange) {
      contBtn.style.cssText = 'width:100%;padding:14px;border:none;border-radius:var(--r12);background:var(--orn);color:#fff;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center';
      contBtn.textContent = '⚠️ Export mit offenen Buchungen';
      contBtn.onclick = () => {
        const cb = document.getElementById('pending-confirm-cb');
        if (cb && !cb.checked) { BSP.toast('Bitte erst bestätigen', 'wr'); cb.style.outline = '2px solid var(--orn)'; return; }
        _runZIP();
      };
    } else {
      contBtn.style.cssText = 'width:100%;padding:14px;border:none;border-radius:var(--r12);background:var(--grn);color:#fff;font-size:14px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center';
      contBtn.textContent = '📤 DATEV Q1-Export Starten';
      contBtn.onclick = () => _runZIP();
    }

  } catch(e) {
    BSP.toast('Fehler in Validierung: ' + e.message, 'er');
  } finally {
    if (btn) btn.disabled = false;
  }
}


// ── Export Runner – Q1 ZIP (Aufgabe 6) ─────────────────────────
async function _runZIP() {
  const contBtn = document.getElementById('exp-continue-btn');
  if (contBtn) contBtn.disabled = true;

  try {
    _log('📦 JSZip wird gestartet …');
    await _loadJSZip();
    const zip = new JSZip();
    const SKR03 = BSP.DATEV?.SKR03 || {};
    const s = BSP.state.settings || {};
    const { start, end } = _getPeriodRange();
    const periodLabel = _filter === 'q1' ? 'Q1' : _filter === 'jan' ? 'Jan' : _filter === 'feb' ? 'Feb' : 'Mar';
    const year = 2026;

    const allBelege = await BSP.getBelege();
    const fb = _filterBelege(allBelege);
    const allKonto = (await BSP.dbGetAll('konto')) || [];
    const fk = allKonto.filter(k => k.datum >= start && k.datum <= end);

    // ── 1. UStVA-Zusammenfassung (ustva_q1_2026.csv) ─────────
    _log('📊 ustva_q1_2026.csv wird generiert …');
    const erBelege = fb.filter(b => b.type === 'er' && !b.isReverseCharge);
    const arBelege = fb.filter(b => b.type === 'ar' && !b.isReverseCharge);
    const rcBelege = fb.filter(b => b.isReverseCharge);

    const arNetto  = arBelege.reduce((s,b) => s+(b.net||0), 0);
    const arMwst   = arBelege.reduce((s,b) => s+(b.mwst||0), 0);
    const erNetto  = erBelege.reduce((s,b) => s+(b.net||0), 0);
    const erMwst   = erBelege.reduce((s,b) => s+(b.mwst||0), 0);
    const rcNetto  = rcBelege.reduce((s,b) => s+(b.net||0), 0);
    const rcMwst   = rcBelege.reduce((s,b) => s+(b.mwst||0), 0);
    const zahllast = arMwst - erMwst;

    const ustva = [
      _headerRow('Position', 'Betrag (€)', 'Hinweis'),
      [_esc('Gesamteinnahmen Netto (AR)'), _esc(arNetto.toFixed(2).replace('.',',')), ''].join(';'),
      [_esc('AR-MwSt eingenommen'), _esc(arMwst.toFixed(2).replace('.',',')), 'UStVA Kennzahl 181 / Zeile 26'].join(';'),
      [_esc('Gesamtausgaben Netto (ER)'), _esc(erNetto.toFixed(2).replace('.',',')), ''].join(';'),
      [_esc('ER-Vorsteuer abziehbar'), _esc(erMwst.toFixed(2).replace('.',',')), 'UStVA Kennzahl 66 / Zeile 67'].join(';'),
      [_esc('Reverse-Charge-Netto'), _esc(rcNetto.toFixed(2).replace('.',',')), 'UStVA Zeile 52 – separat eintragen!'].join(';'),
      [_esc('Reverse-Charge-Steuer (selbst)'), _esc(rcMwst.toFixed(2).replace('.',',')), 'UStVA Zeile 67 mit SK 94 oder 19'].join(';'),
      [_esc(zahllast >= 0 ? 'ZAHLLAST' : 'ERSTATTUNG'), _esc(Math.abs(zahllast).toFixed(2).replace('.',',')), zahllast >= 0 ? 'An Finanzamt zu zahlen' : 'Vom Finanzamt erstatten lassen'].join(';'),
    ].join('\r\n');
    zip.file(`ustva_${periodLabel.toLowerCase()}_${year}.csv`, '\uFEFF' + ustva);

    // ── 2. Buchungen DATEV (buchungen_q1_2026.csv) ───────────
    _log('📊 buchungen_q1_2026.csv wird generiert …');
    const csvHeader = _headerRow('Belegnummer','Datum','Buchungstext','Umsatz (Netto)','MwSt-Satz','MwSt','Brutto','SKR03-Konto','BU-Schlüssel','Kategorie','Externe Belegnr.','Währung Orig','Betrag Orig','Wechselkurs (EZB)');
    const csvRows = [];
    fb.forEach(b => {
      if ((b.cat||'').includes('Bewirtung')) {
        csvRows.push(_datevRow(b, SKR03, true, false));
        csvRows.push(_datevRow(b, SKR03, false, true));
      } else {
        csvRows.push(_datevRow(b, SKR03));
      }
    });

    // Aufgabe 6: pending_review am Ende der CSV einfügen
    const pendingAll2 = await BSP.prGetAll();
    const pendingOpen2 = pendingAll2.filter(p => p.status === 'offen' || p.status === 'später_klären');
    if (pendingOpen2.length > 0) {
      csvRows.push('');
      csvRows.push(_esc('=== MANUELL ZU PRÜFEN: ' + pendingOpen2.length + ' ungeklärte Buchungen ==='));
      csvRows.push(_headerRow('Buchungsreferenz','Datum','Auftraggeber/Empfänger','Betrag','Status','Hinweis'));
      pendingOpen2.forEach(p => {
        csvRows.push([
          p.buchungsId || '',
          p.datum || '',
          p.auftraggeber || '',
          Number(p.betrag || 0).toFixed(2).replace('.',','),
          p.status || '',
          'MANUELL ZU PRÜFEN – vom Steuerberater klären'
        ].map(_esc).join(';'));
      });
    }

    zip.file(`buchungen_${periodLabel.toLowerCase()}_${year}.csv`, '\uFEFF' + [csvHeader, ...csvRows].join('\r\n'));

    // ── 3. Kontoauszüge (kontoauszuege_q1_2026.csv) ─────────
    _log('📊 kontoauszuege_q1_2026.csv wird generiert …');
    if (fk.length > 0) {
      const kHeader = _headerRow('Datum','Auftraggeber/Empfänger','Betrag (€)','Buchungstyp','Verwendungszweck','Konto-ID','Status','Abgeglichen mit Beleg','Hinweis');
      const kRows = fk.map(k => {
        let hinweis = '';
        if (k.betrag > 0 && k.status !== 'abgeglichen') hinweis = '⚠️ Mögliche fehlende Ausgangsrechnung';
        if (k.isDuplicateAlert) hinweis = '⚠️ Mögliche Dopplung';
        return [
          k.datum||'',
          k.auftraggeber||k.empfaenger||'',
          Number(k.betrag||0).toFixed(2).replace('.',','),
          k.buchungstyp||k.typ||'',
          k.zweck||'',
          k.kontoId||k.iban||'',
          k.status||'offen',
          k.belegNr||'',
          hinweis
        ].map(_esc).join(';');
      });
      zip.file(`kontoauszuege_${periodLabel.toLowerCase()}_${year}.csv`, '\uFEFF' + [kHeader, ...kRows].join('\r\n'));
    }

    // ── 4. Belege-Ordner + zuordnung.xml ─────────────────────
    _log('🖼️ Belege werden bestempelt …');
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<Belege>\n';
    const stempelPromises = [];
    const belegFolder = zip.folder('belege');

    for (const b of fb) {
      if (!b.belegNr) continue;
      const allImages = (b.images && b.images.length > 0) ? b.images : (b.image ? [b.image] : []);
      if (!allImages.length) continue;

      const sanitizedNr = b.belegNr.replace(/[/\\:*?"<>|]/g, '_');
      let xmlBeleg = `  <Beleg>\n    <Belegnummer>${b.belegNr}</Belegnummer>\n`;
      allImages.forEach((_, idx) => {
        const suffix = allImages.length > 1 ? '_S' + (idx + 1) : '';
        xmlBeleg += `    <Dateiname>${sanitizedNr}${suffix}.jpg</Dateiname>\n`;
      });
      xmlBeleg += '  </Beleg>\n';
      xml += xmlBeleg;

      allImages.forEach((imgSrc, idx) => {
        const suffix = allImages.length > 1 ? '_S' + (idx + 1) : '';
        const fileName = sanitizedNr + suffix + '.jpg';
        const p = _stampImage(imgSrc, b).then(stamped => {
          const data = stamped.replace(/^data:[^;]+;base64,/, '');
          belegFolder.file(fileName, data, { base64: true });
        }).catch(() => {});
        stempelPromises.push(p);
      });
    }
    xml += '</Belege>';
    zip.file('zuordnung.xml', xml);

    await Promise.all(stempelPromises);

    // ── 5. README.txt ─────────────────────────────────────────
    const name = [s.vorname, s.nachname].filter(Boolean).join(' ') || 'Mandant';
    const firmName = s.firmenname || name;
    const readme = `DATEV EXPORTPAKET – BELEGSCAN PRO
Mandant: ${firmName}
Zeitraum: ${periodLabel} ${year}
Erstellt: ${new Date().toLocaleDateString('de-DE')}

═══════════════════════════════════════════════
INHALT
═══════════════════════════════════════════════

ustva_${periodLabel.toLowerCase()}_${year}.csv
  Umsatzsteuer-Voranmeldungs-Zusammenfassung.
  Enthält: Gesamteinnahmen, AR-MwSt, Gesamtausgaben, ER-Vorsteuer,
  Zahllast/Erstattung, Reverse-Charge-Beträge.

buchungen_${periodLabel.toLowerCase()}_${year}.csv
  Alle Buchungen im DATEV-Format mit SKR03-Kontonummern.
  ER und AR in einer Datei. Bewirtungsbelege wurden 70/30 gesplittet.
  Automatik-Konten (3010, 3030) enthalten planmäßig keinen BU-Schlüssel.
  Fremdwährungen via EZB-API in Euro umgerechnet (Buchungsdatum).

kontoauszuege_${periodLabel.toLowerCase()}_${year}.csv
  Alle importierten Kontobuchungen. Offene Geldeingänge ohne
  passende Ausgangsrechnung sind mit Hinweis ⚠️ markiert.

belege/
  Gestempelte Foto-Scans. Dateiname = Belegnummer (DATEV-Pflicht).
  Max 100KB pro Bild.

zuordnung.xml
  Verknüpft jede Datei in belege/ mit der Buchungsnummer.

═══════════════════════════════════════════════
HINWEISE FÜR DIE STEUERBERATERIN
═══════════════════════════════════════════════

Automatik-Konten:
• Kto 3010 = Erlöse 19% MwSt
• Kto 3030 = Erlöse 7% MwSt
Diese Konten erhalten keinen BU-Schlüssel – das ist korrekt.

Reverse Charge (§13b UStG):
• Steuerschlüssel 94 = § 13b innergemeinschaftliche Leistungen
• Steuerschlüssel 19 = sonstige § 13b Fälle
Reverse-Charge-Beträge separat in UStVA Zeile 52 und 67 eintragen.

Bei Fragen: Die originalen Scan-Bilder liegen in belege/.
`;
    zip.file('README.txt', readme);

    // ── ZIP packen & herunterladen ─────────────────────────────
    _log('📦 ZIP wird gepackt …');
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DATEV-Export-${periodLabel}-${year}-${new Date().toISOString().split('T')[0]}.zip`;
    a.click();
    URL.revokeObjectURL(url);

    _log(`✓ ZIP erstellt – ${fb.length} Belege, ${fk.length} Kontobuchungen`);
    BSP.toast('Export komplett ✓', 'ok');
    document.getElementById('exp-validation').style.display = 'none';

  } catch(e) {
    _log('❌ ' + e.message);
    BSP.toast('ZIP Fehler: ' + e.message, 'er');
  } finally {
    if (contBtn) contBtn.disabled = false;
  }
}

// ── Firmenstempel Canvas ──────────────────────────────────────
async function _stampImage(b64, beleg) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const s = BSP.state.settings || {};
      const fsize = Math.max(12, Math.min(20, c.width / 40));
      const pad = 10;

      const lines = [
        'GEPRÜFT UND GEBUCHT',
        `Nr: ${beleg.belegNr || '—'}`,
        `${beleg.type?.toUpperCase()||''} · Kto: ${(BSP.DATEV?.SKR03[beleg.cat]||{}).konto||'?'}`,
        `Datum: ${new Date().toLocaleDateString('de-DE')}`
      ];
      ctx.font = `300 ${fsize}px Inter, sans-serif`;
      const lineH = fsize * 1.4;
      const boxH = lines.length * lineH + pad * 2;
      const boxW = lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0) + pad * 2.5;
      const x = c.width - boxW - 8;
      const y = c.height - boxH - 8;

      ctx.fillStyle = 'rgba(0,40,15,.75)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, boxW, boxH, 6);
      else ctx.rect(x, y, boxW, boxH);
      ctx.fill();
      ctx.strokeStyle = '#44cc66';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#44cc66';
      lines.forEach((line, i) => {
        ctx.font = i === 0 ? `600 ${fsize}px Inter, sans-serif` : `300 ${fsize*0.9}px Inter, sans-serif`;
        ctx.fillText(line, x + pad, y + pad + fsize + i * lineH);
      });

      // Bild komprimieren auf max ~100KB
      let quality = 0.82;
      let result = c.toDataURL('image/jpeg', quality);
      while (result.length > 140000 && quality > 0.3) { quality -= 0.1; result = c.toDataURL('image/jpeg', quality); }
      resolve(result);
    };
    img.onerror = () => resolve(b64);
    img.src = b64;
  });
}

return { init, setPeriod, openQ1Dialog, validateAndExport, _runZIP };

})();
