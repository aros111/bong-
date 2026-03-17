// ══════════════════════════════════════════════════════════════
// MODUL: EXPORT
// Steuerberater-ZIP: CSV, RC-Aufstellung, Kontoabgleich, PDF-Stempel
// Nutzt JSZip (CDN). Kommuniziert NUR über BSP.*
// ══════════════════════════════════════════════════════════════
'use strict';

const ExportModule = (() => {

const JSZIP_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
let _jszipLoaded = false;

const VIEW_HTML = `
<div id="v-export" class="view">
  <div class="mod-header">
    <div class="mod-title">Export</div>
    <div class="mod-sub">Steuerberater-Paket · Kontoabgleich</div>
  </div>

  <!-- Export-Aktionen -->
  <div style="background:var(--s1);border:1px solid var(--br);border-radius:var(--r16);padding:16px;margin-bottom:12px">
    <div class="stitle">Steuerberater-ZIP</div>
    <div style="font-size:12px;font-weight:300;color:var(--txt3);margin-bottom:12px;line-height:1.6">
      Enthält: ER-Liste, AR-Liste, RC-Aufstellung (Z.52/Z.67), Bewirtungsbelege, Km-Liste, Kontoabgleich.<br>
      Alle Belege mit Firmenstempel als gestempelte Bilddateien.
    </div>
    <button class="btn btn-gold" style="width:100%;justify-content:center" id="exp-zip-btn" onclick="ExportModule.exportZIP()">
      📦 Steuerberater-ZIP erstellen
    </button>
    <div id="exp-zip-log" style="font-size:11px;color:var(--txt3);margin-top:8px;text-align:center;display:none"></div>
  </div>

  <!-- Kontoabgleich -->
  <div style="background:var(--s1);border:1px solid var(--br);border-radius:var(--r16);padding:16px;margin-bottom:12px">
    <div class="stitle">Kontoauszug-Abgleich</div>
    <div style="font-size:12px;font-weight:300;color:var(--txt3);margin-bottom:10px;line-height:1.6">
      CSV-Kontoauszug hochladen (z.B. aus Banking-App).<br>
      Nicht gematchte Buchungen (Amazon, Redbubble …) werden markiert.
    </div>

    <!-- CSV Format Hinweis -->
    <div style="font-size:10px;color:var(--txt3);margin-bottom:10px;padding:10px;background:var(--s2);border-radius:var(--r8);line-height:1.7">
      Erwartetes CSV-Format: <code style="color:var(--gold)">Datum;Auftraggeber/Empfänger;Betrag</code><br>
      Datum: DD.MM.YYYY · Betrag: -12,34 oder 56,78 (mit Komma)
    </div>

    <label class="btn btn-g" style="cursor:pointer;width:100%;justify-content:center">
      📄 CSV-Kontoauszug laden
      <input type="file" accept=".csv,.txt" style="display:none" onchange="ExportModule.loadKonto(this)">
    </label>

    <div id="exp-konto-result" style="display:none;margin-top:12px">
      <div style="font-size:10px;color:var(--txt3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px">Abgleich-Ergebnis</div>
      <div id="exp-konto-stats" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px"></div>
      <div id="exp-konto-offene" style="display:flex;flex-direction:column;gap:4px"></div>
      <button class="btn btn-gold" style="width:100%;justify-content:center;margin-top:10px" onclick="ExportModule.exportKontoCSV()">
        ⬇️ Abgleich-CSV exportieren
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

let _kontoData = []; // Parsed Konto-Einträge
let _matchResult = []; // Abgleich-Ergebnis

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
    const fahrten = await BSP.dbGetAll('fahrten');
    const verpfl = await BSP.dbGetAll('verpflegung');
    const year = new Date().getFullYear();
    const yb = belege.filter(b => b.date && new Date(b.date + 'T00:00:00').getFullYear() === year);
    const yf = fahrten.filter(f => f.date && new Date(f.date + 'T00:00:00').getFullYear() === year);
    const yv = verpfl.filter(v => v.date && new Date(v.date + 'T00:00:00').getFullYear() === year);
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--br)"><span style="font-size:12px;color:var(--txt2)">Eingangsbelege (ER)</span><span style="font-size:12px;color:var(--blu)">${yb.filter(b=>b.type==='er').length}</span></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--br)"><span style="font-size:12px;color:var(--txt2)">Ausgangsrechnungen (AR)</span><span style="font-size:12px;color:var(--ylw)">${yb.filter(b=>b.type==='ar').length}</span></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--br)"><span style="font-size:12px;color:var(--txt2)">Reverse Charge</span><span style="font-size:12px;color:var(--orn)">${yb.filter(b=>b.isReverseCharge).length}</span></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--br)"><span style="font-size:12px;color:var(--txt2)">Kilometer-Fahrten</span><span style="font-size:12px;color:var(--silv)">${yf.length}</span></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0"><span style="font-size:12px;color:var(--txt2)">Verpflegungstage</span><span style="font-size:12px;color:var(--silv)">${yv.length}</span></div>`;
  } catch(e) { el.textContent = 'Fehler beim Laden'; }
}

// ── JSZip laden ───────────────────────────────────────────────
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

// ── CSV-Hilfe ─────────────────────────────────────────────────
function _esc(v) {
  const s = String(v == null ? '' : v);
  return s.includes(';') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function _headerRow(...cols) { return cols.map(_esc).join(';'); }

function _belegeToCSV(belege, withDatev) {
  const datevCol = withDatev ? ';DATEV-Konto' : '';
  const datevFn = (b) => withDatev ? `;${b.type === 'er' ? '4000' : '8000'}` : '';

  const header = _headerRow('BelegNr','Datum','Händler','Brutto','Netto','MwSt','MwStSatz%','Kategorie','Zahlung','Extern-Nr','RC','Abo') + datevCol;
  const rows = belege.map(b => [
    b.belegNr || '', b.date || '', b.shop || '',
    Number(b.brutto||0).toFixed(2).replace('.',','),
    Number(b.net||0).toFixed(2).replace('.',','),
    Number(b.mwst||0).toFixed(2).replace('.',','),
    (b.mwstRate||19),
    b.cat||'', b.payment||'',
    b.belegNrExtern||'',
    b.isReverseCharge ? 'Ja' : '',
    b.istAbo ? 'Ja' : ''
  ].map(_esc).join(';') + datevFn(b));

  return [header, ...rows].join('\r\n');
}

function _fahrtenToCSV(fahrten) {
  const header = _headerRow('Datum','Ziel','Zweck','Art','km','Pauschale€');
  const rows = fahrten.map(f => [f.date||'', f.ziel||'', f.zweck||'', f.art||'', Math.round(f.km||0), Number(f.pauschale||0).toFixed(2).replace('.',',')].map(_esc).join(';'));
  return [header, ...rows].join('\r\n');
}

function _rcToCSV(belege) {
  const header = _headerRow('BelegNr','Datum','Händler','NettoZ52','MwStZ67');
  const rows = belege.filter(b=>b.isReverseCharge).map(b => [b.belegNr||'', b.date||'', b.shop||'', Number(b.net||0).toFixed(2).replace('.',','), Number(b.mwst||0).toFixed(2).replace('.',',')].map(_esc).join(';'));
  return [header, ...rows].join('\r\n');
}

function _vatSummaryToCSV(belege) {
  const header = _headerRow('Satz','Netto','MwSt','Brutto');
  const rates = [19, 7, 0];
  const rows = rates.map(r => {
    const list = belege.filter(b => Math.round(b.mwstRate) === r && !b.isReverseCharge);
    const n = list.reduce((s, b) => s + (b.net || 0), 0);
    const m = list.reduce((s, b) => s + (b.mwst || 0), 0);
    const br = list.reduce((s, b) => s + (b.brutto || 0), 0);
    return [r + '%', n.toFixed(2).replace('.',','), m.toFixed(2).replace('.',','), br.toFixed(2).replace('.',',')].map(_esc).join(';');
  });
  return [header, ...rows].join('\r\n');
}

// ── Firmenstempel auf Canvas ──────────────────────────────────
async function _stampImage(b64, beleg) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const s = BSP.state.settings || {};
      const col = s.stempelColor || '#c8a45a';
      const name = s.stempelName || (s.vorname ? [s.vorname, s.nachname].filter(Boolean).join(' ') : 'BelegScan Pro');
      const fsize = Math.max(12, Math.min(18, c.width / 40));
      const pad = 12;

      // Stempel-Box rechts unten
      ctx.font = `300 ${fsize}px Inter, sans-serif`;
      const lines = [
        name,
        `Belegnr: ${beleg.belegNr || '—'}`,
        `${beleg.date || ''}`,
        `Netto: ${Number(beleg.net||0).toFixed(2).replace('.',',')} €  MwSt: ${Number(beleg.mwst||0).toFixed(2).replace('.',',')} €`,
        `Brutto: ${Number(beleg.brutto||0).toFixed(2).replace('.',',')} €`
      ];
      const lineH = fsize * 1.4;
      const boxH = lines.length * lineH + pad * 2;
      const boxW = lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0) + pad * 2.5;
      const x = c.width - boxW - 8;
      const y = c.height - boxH - 8;

      // Hintergrund
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.beginPath();
      ctx.roundRect(x, y, boxW, boxH, 6);
      ctx.fill();

      // Text
      ctx.fillStyle = col;
      lines.forEach((line, i) => {
        ctx.font = i === 0 ? `400 ${fsize}px Inter, sans-serif` : `300 ${fsize*0.85}px Inter, sans-serif`;
        ctx.fillText(line, x + pad, y + pad + fsize + i * lineH);
      });

      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(b64); // Fallback: original
    img.src = b64;
  });
}

// ── ZIP-Export ────────────────────────────────────────────────
async function exportZIP() {
  const btn = document.getElementById('exp-zip-btn');
  if (btn) btn.disabled = true;

  try {
    _log('📦 JSZip wird geladen …');
    await _loadJSZip();

    const zip = new JSZip();
    const year = new Date().getFullYear();
    const s = BSP.state.settings || {};
    const withDatev = s.datev === '1';

    _log('📄 Belege werden geladen …');
    const allBelege = await BSP.getBelege();
    const yb = allBelege.filter(b => b.date && new Date(b.date + 'T00:00:00').getFullYear() === year);
    const er = yb.filter(b => b.type === 'er' && !b.isReverseCharge);
    const ar = yb.filter(b => b.type === 'ar' && !b.isReverseCharge);
    const rc = yb.filter(b => b.isReverseCharge);
    const bew = er.filter(b => b.cat === 'Bewirtung' || b.cat === 'Restaurant');

    const fahrten = (await BSP.dbGetAll('fahrten')).filter(f => f.date && new Date(f.date + 'T00:00:00').getFullYear() === year);
    const verpfl = (await BSP.dbGetAll('verpflegung')).filter(v => v.date && new Date(v.date + 'T00:00:00').getFullYear() === year);

    // ── zusammenfassung.csv ─────────────────────────────────
    _log('📊 CSVs werden erstellt …');
    let zusammen = `EINGANGSBELEGE (ER) - ${year}\r\n${_belegeToCSV(er, withDatev)}\r\n\r\n`;
    zusammen += `AUSGANGSRECHNUNGEN (AR) - ${year}\r\n${_belegeToCSV(ar, withDatev)}\r\n\r\n`;
    if (bew.length) {
      zusammen += `BEWIRTUNGSBELEGE (70% absetzbar)\r\n${_belegeToCSV(bew, false)}\r\n\r\n`;
    }
    if (fahrten.length) {
      zusammen += `KILOMETERPAUSCHALE - ${year}\r\n${_fahrtenToCSV(fahrten)}\r\n\r\n`;
    }
    if (verpfl.length) {
      const vHeader = _headerRow('Datum','Ziel','Dauer','Pauschale€');
      const vRows = verpfl.map(v => [v.date||'',v.ziel||'',v.dauer||'',Number(v.pauschale||0).toFixed(2).replace('.',',')].map(_esc).join(';'));
      zusammen += `VERPFLEGUNGSPAUSCHALEN - ${year}\r\n${[vHeader,...vRows].join('\r\n')}\r\n`;
    }
    zip.file('zusammenfassung.csv', '\uFEFF' + zusammen); // BOM für Excel

    // ── rc_reverse_charge.csv ───────────────────────────────
    if (rc.length) {
      zip.file('rc_reverse_charge.csv', '\uFEFF' + _rcToCSV(yb));
    }

    // ── ust_zusammenfassung.csv ─────────────────────────────
    zip.file('ust_zusammenfassung.csv', '\uFEFF' + _vatSummaryToCSV(yb));

    // ── Kontoabgleich.csv (wenn Konto geladen) ──────────────
    if (_matchResult.length) {
      zip.file('kontoabgleich.csv', '\uFEFF' + _matchResultToCSV());
    }

    // ── README.txt ──────────────────────────────────────────
    const name = [s.vorname, s.nachname].filter(Boolean).join(' ') || 'Freiberufler';
    const readme = `BELEGSCAN PRO – STEUERBERATER-PAKET
Mandant: ${name}
Steuernummer: ${s.steuernr || '—'}
USt-IdNr: ${s.ustidnr || '—'}
Erstellt am: ${new Date().toLocaleDateString('de-DE')}
Zeitraum: ${year}

INHALT:
• zusammenfassung.csv – ER, AR, Bewirtung, Km-Pauschale, Verpflegung
• ust_zusammenfassung.csv – MwSt nach Sätzen (19/7/0)
• rc_reverse_charge.csv – Reverse Charge (UStVA Z.52/Z.67)${_matchResult.length ? '\n• kontoabgleich.csv – Nicht gematchte Buchungen' : ''}
• belege/ – Alle Belegfotos mit Firmenstempel

HINWEIS:
Bewirtungsbelege sind auf 70% nach §4 Abs.5 EStG begrenzt.
Reverse-Charge-Belege separat in UStVA Zeile 52 und 67 eintragen.
${_matchResult.filter(r=>r.status==='unmatched').length ? `ACHTUNG: ${_matchResult.filter(r=>r.status==='unmatched').length} nicht gematchte Buchungen – bitte auf Kleinstbeträge prüfen!` : ''}`;
    zip.file('README.txt', readme);

    // ── Beleg-Fotos mit Stempel ─────────────────────────────
    _log('🖼️ Belege werden gestempelt …');
    const belegFolder = zip.folder('belege');
    let count = 0;
    for (const b of yb) {
      if (b.image) {
        try {
          const stamped = await _stampImage(b.image, b);
          const ext = stamped.startsWith('data:image/png') ? 'png' : 'jpg';
          const fname = (b.belegNr || 'beleg-' + b.id).replace(/[/\\:*?"<>|]/g, '_') + '.' + ext;
          const data = stamped.replace(/^data:[^;]+;base64,/, '');
          belegFolder.file(fname, data, { base64: true });
          count++;
        } catch(_) {}
      }
    }

    _log(`📦 ZIP wird komprimiert … (${count} Fotos)`);
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `belegscan-steuerberater-${year}-${new Date().toISOString().split('T')[0]}.zip`;
    a.click();
    URL.revokeObjectURL(url);

    _log(`✓ ZIP erstellt (${yb.length} Belege, ${fahrten.length} Fahrten)`);
    BSP.toast('ZIP erstellt ✓', 'ok');

  } catch(e) {
    _log('❌ ' + e.message);
    BSP.toast('Export Fehler: ' + e.message, 'er');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ── Kontoauszug laden ─────────────────────────────────────────
async function loadKonto(input) {
  const f = input.files[0];
  if (!f) return;

  const text = await f.text();
  _kontoData = _parseKontoCSV(text);

  if (!_kontoData.length) {
    BSP.toast('Keine Einträge gefunden – bitte Format prüfen', 'wr');
    return;
  }

  await _abgleichen();
}

function _parseKontoCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const entries = [];

  for (const line of lines) {
    // Flexibel: Trennzeichen Semikolon oder Komma
    const sep = line.includes(';') ? ';' : ',';
    const parts = line.split(sep).map(p => p.replace(/^"|"$/g, '').trim());
    if (parts.length < 3) continue;

    // Datum erkennen (DD.MM.YYYY oder YYYY-MM-DD)
    let dateStr = parts[0];
    let isoDate = null;
    if (/\d{2}\.\d{2}\.\d{4}/.test(dateStr)) {
      const [d, m, y] = dateStr.split('.');
      isoDate = `${y}-${m}-${d}`;
    } else if (/\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      isoDate = dateStr;
    }
    if (!isoDate) continue;

    // Betrag (letztes Zahlen-Feld)
    let betrag = null;
    for (let i = parts.length - 1; i >= 1; i--) {
      const raw = parts[i].replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, '');
      const n = parseFloat(raw);
      if (!isNaN(n)) { betrag = n; break; }
    }
    if (betrag === null) continue;

    const empf = parts[1] || parts[2] || '';
    entries.push({ date: isoDate, empfaenger: empf, betrag, rawLine: line });
  }

  return entries;
}

async function _abgleichen() {
  const belege = await BSP.getBelege();
  _matchResult = [];

  for (const konto of _kontoData) {
    // Match: selbes Datum ±1 Tag UND Brutto-Betrag stimmt (±0.05)
    const match = belege.find(b => {
      if (!b.date || !b.brutto) return false;
      const bDate = new Date(b.date + 'T00:00:00');
      const kDate = new Date(konto.date + 'T00:00:00');
      const daysDiff = Math.abs((bDate - kDate) / 864e5);
      const amtMatch = Math.abs(Math.abs(konto.betrag) - Math.abs(b.brutto)) < 0.05;
      return daysDiff <= 1 && amtMatch;
    });

    _matchResult.push({
      ...konto,
      status: match ? 'matched' : 'unmatched',
      belegNr: match?.belegNr || null,
      shop: match?.shop || null
    });
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
    const sc = (lbl, val, col) => `<div style="background:var(--s2);border:1px solid var(--br);border-radius:var(--r8);padding:10px;text-align:center">
      <div style="font-size:9px;color:var(--txt3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">${lbl}</div>
      <div style="font-size:18px;font-weight:200;color:${col}">${val}</div>
    </div>`;
    stats.innerHTML = sc('Gesamt', _matchResult.length, 'var(--txt)') + sc('Gematcht', matched, 'var(--grn)') + sc('Offen', unmatched, 'var(--red)');
  }

  const offene = document.getElementById('exp-konto-offene');
  if (offene) {
    const unmatchedItems = _matchResult.filter(r => r.status === 'unmatched');
    if (!unmatchedItems.length) {
      offene.innerHTML = '<div style="font-size:12px;color:var(--grn);text-align:center;padding:10px">✓ Alle Buchungen gematcht</div>';
    } else {
      offene.innerHTML = `<div style="font-size:10px;color:var(--txt3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px">⚠️ Nicht gematchte Buchungen</div>` +
        unmatchedItems.map(r => `
          <div style="background:rgba(192,64,64,.06);border:1px solid rgba(192,64,64,.2);border-radius:var(--r8);padding:10px 12px;font-size:12px">
            <div style="display:flex;justify-content:space-between">
              <span style="color:var(--txt2);max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${BSP.eh(r.empfaenger)}</span>
              <span style="color:var(--red);font-family:'DM Mono',monospace">${BSP.fm(Math.abs(r.betrag))} €</span>
            </div>
            <div style="font-size:10px;color:var(--txt3);margin-top:2px">${BSP.fd(r.date)}</div>
          </div>`).join('');
    }
  }

  BSP.toast(`Abgleich: ${matched} gematcht, ${unmatched} offen`, unmatched > 0 ? 'wr' : 'ok');
}

function _matchResultToCSV() {
  const header = _headerRow('Datum','Empfänger/Auftraggeber','Betrag€','Status','BelegNr','Shop');
  const rows = _matchResult.map(r => [
    r.date, r.empfaenger, Number(r.betrag).toFixed(2).replace('.', ','),
    r.status === 'matched' ? 'Gematcht' : 'NICHT GEFUNDEN',
    r.belegNr || '', r.shop || ''
  ].map(_esc).join(';'));
  return [header, ...rows].join('\r\n');
}

function exportKontoCSV() {
  if (!_matchResult.length) { BSP.toast('Kein Abgleich vorhanden', 'wr'); return; }
  const csv = '\uFEFF' + _matchResultToCSV();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kontoabgleich-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  BSP.toast('CSV exportiert ✓', 'ok');
}

return { init, exportZIP, loadKonto, exportKontoCSV };

})();
