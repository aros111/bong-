// ══════════════════════════════════════════════════════════════
// MODUL: STEUER (Aufgabe 2 – Vollständiger Ausbau)
// Block 1: EÜR mit Zeitraum-Filter
// Block 2: MwSt-Zahllast antippbar + Countdown
// Block 3: ESt-Gauge (Halbkreis) + Progressions-Warnung
// Block 4: Quartals-Übersicht (gestapelte Balken)
// Block 5: Export-Button mit Vollständigkeits-Status
//
// ESt-Stufen 2026 (§32a EStG):
// Grundfreibetrag 11.784€
// Zone 2: 11.785–17.005 (14%–24% progressiv)
// Zone 3: 17.006–66.760 (24%–42% progressiv)
// Zone 4: 66.761–277.825 (42%)
// Zone 5: >277.825 (45%)
// TODO: Steuerberater-Werte wie Vorauszahlungen und andere
//       Einkünfte – später als eigenes Modul ausbauen.
//
// Kommuniziert NUR über BSP.* — niemals direkt mit Modulen
// ══════════════════════════════════════════════════════════════
'use strict';

const SteuerModule = (() => {

let _filter = 'jahr'; // 'q1'|'q2'|'q3'|'q4'|'jahr'

const VIEW_HTML = `
<div id="v-steuer" class="view">
  <div class="mod-header" style="display:flex;justify-content:space-between;align-items:flex-end">
    <div>
      <div class="mod-title">Steuer</div>
      <div class="mod-sub">EÜR · MwSt · ESt-Schätzung</div>
    </div>
    <select id="st-filter" onchange="SteuerModule.setFilter(this.value)"
      style="background:var(--bg3);border:1px solid var(--br);border-radius:var(--r8);color:var(--txt);font-size:11px;padding:5px 8px;outline:none">
      <option value="q1">Q1 (Jan–Mär)</option>
      <option value="q2">Q2 (Apr–Jun)</option>
      <option value="q3">Q3 (Jul–Sep)</option>
      <option value="q4">Q4 (Okt–Dez)</option>
      <option value="jahr" selected>Ganzes Jahr</option>
    </select>
  </div>

  <!-- BLOCK 1: EÜR-Übersicht -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">
    <div style="background:rgba(58,175,112,.06);border:1px solid rgba(58,175,112,.2);border-radius:var(--r12);padding:14px;text-align:center">
      <div style="font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Einnahmen</div>
      <div id="st-ar-netto" style="font-size:22px;font-weight:200;color:var(--grn);letter-spacing:-1px">0 €</div>
    </div>
    <div style="background:rgba(192,64,64,.06);border:1px solid rgba(192,64,64,.2);border-radius:var(--r12);padding:14px;text-align:center">
      <div style="font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Ausgaben</div>
      <div id="st-er-netto" style="font-size:22px;font-weight:200;color:var(--red);letter-spacing:-1px">0 €</div>
    </div>
    <div style="background:rgba(200,164,90,.06);border:1px solid rgba(200,164,90,.2);border-radius:var(--r12);padding:14px;text-align:center">
      <div style="font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Gewinn</div>
      <div id="st-gewinn" style="font-size:22px;font-weight:200;color:var(--gold);letter-spacing:-1px">0 €</div>
    </div>
  </div>

  <!-- Zusatz EÜR: Km + Verpfl -->
  <div id="st-eur-details" style="background:var(--bg3);border:1px solid var(--br);border-radius:var(--r12);padding:12px;margin-bottom:12px"></div>

  <!-- Belege prüfen -->
  <div style="display:flex;gap:8px;margin-bottom:16px">
    <button class="btn btn-g" style="flex:1;justify-content:center;color:var(--grn);border:1px solid rgba(58,175,112,.3)" onclick="SteuerModule.showBelegeSheet('ar')">📄 Einnahmen prüfen</button>
    <button class="btn btn-g" style="flex:1;justify-content:center;color:var(--red);border:1px solid rgba(192,64,64,.3)" onclick="SteuerModule.showBelegeSheet('er')">💼 Ausgaben prüfen</button>
  </div>

  <!-- BLOCK 2: MwSt-Zahllast (antippbar) -->
  <div id="st-mwst-card" onclick="SteuerModule.openMwstSheet()"
    style="cursor:pointer;border-radius:var(--r16);padding:18px;margin-bottom:16px;border:1px solid var(--br);transition:transform .2s,opacity .2s;active:transform scale(.98)">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">MwSt-Zahllast</div>
        <div id="st-mwst-val" style="font-size:32px;font-weight:200;letter-spacing:-1.5px">0,00 €</div>
        <div id="st-mwst-sub" style="font-size:11px;color:var(--txt3);margin-top:4px"></div>
      </div>
      <div style="text-align:right">
        <div id="st-countdown-badge" style="font-size:11px;font-weight:500;padding:4px 10px;border-radius:100px;display:inline-block"></div>
        <div style="font-size:10px;color:var(--txt3);margin-top:4px">Nächste Voranmeldung</div>
        <div style="font-size:10px;color:var(--txt3);margin-top:8px">→ Details ansehen</div>
      </div>
    </div>
  </div>

  <!-- BLOCK 3: ESt-Schätzung mit Gauge -->
  <div style="background:var(--bg3);border:1px solid var(--br);border-radius:var(--r16);padding:18px;margin-bottom:16px">
    <div class="stitle">Einkommensteuer-Schätzung 2026 ⓘ</div>

    <!-- Halbkreis-Gauge -->
    <div style="display:flex;justify-content:center;margin-bottom:12px;position:relative">
      <svg id="st-gauge-svg" width="200" height="110" viewBox="0 0 200 110">
        <!-- Hintergrund-Bogen -->
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="var(--br)" stroke-width="14" stroke-linecap="round"/>
        <!-- Füll-Bogen (animiert) -->
        <path id="st-gauge-fill" d="M 20 100 A 80 80 0 0 1 180 100" fill="none"
          stroke="var(--gold)" stroke-width="14" stroke-linecap="round"
          stroke-dasharray="251" stroke-dashoffset="251"
          style="transition:stroke-dashoffset 1s ease,stroke .4s ease"/>
        <!-- Zentrum-Text -->
        <text x="100" y="90" text-anchor="middle" fill="var(--txt)" font-size="14" font-weight="300" font-family="Inter,sans-serif" id="st-gauge-pct">0%</text>
        <text x="100" y="108" text-anchor="middle" fill="var(--txt3)" font-size="9" font-family="Inter,sans-serif">Steuerlast</text>
      </svg>
    </div>

    <div style="display:flex;justify-content:space-between;margin-bottom:6px">
      <span style="font-size:12px;color:var(--txt3)">Grundfreibetrag 2026</span>
      <span style="font-size:12px;color:var(--grn);font-weight:300">11.784 €</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:6px">
      <span style="font-size:12px;color:var(--txt3)">zvE (geschätzt)</span>
      <span id="st-zve" style="font-size:12px;color:var(--txt)">0,00 €</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid var(--br);margin-bottom:4px">
      <span style="font-size:13px;color:var(--txt)">Geschätzte ESt</span>
      <span id="st-est" style="font-size:18px;font-weight:200;color:var(--red)">0,00 €</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:8px">
      <span style="font-size:11px;color:var(--txt3)">+ Solidaritätszuschlag</span>
      <span id="st-soli" style="font-size:11px;color:var(--txt3)">0,00 €</span>
    </div>

    <!-- Progressions-Warnung -->
    <div id="st-progress-warn" style="display:none;background:rgba(192,112,48,.06);border:1px solid rgba(192,112,48,.2);border-radius:var(--r8);padding:10px;font-size:11px;color:var(--orn);line-height:1.6"></div>

    <div style="font-size:10px;color:var(--txt3);margin-top:8px;line-height:1.5;border-top:1px solid var(--br);padding-top:8px">
      ⚠️ Nur zur Orientierung. Keine Haftung. Kein Vorsorgeabzug,
      keine weiteren Einkünfte berücksichtigt.<br>
      <!-- TODO: Steuerberater-Werte (Vorauszahlungen, andere Einkünfte) – später als eigenes Modul -->
    </div>
  </div>

  <!-- BLOCK 4: Quartals-Übersicht -->
  <div style="background:var(--bg3);border:1px solid var(--br);border-radius:var(--r16);padding:18px;margin-bottom:16px">
    <div class="stitle">Quartals-Übersicht</div>
    <div id="st-quarters" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;align-items:flex-end;height:120px"></div>
    <div id="st-quarters-labels" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:6px;text-align:center"></div>
  </div>

  <!-- BLOCK 5: Export-Button -->
  <div id="st-export-btn-wrap" style="margin-bottom:16px">
    <button onclick="BSP.showView('export')" id="st-export-btn"
      style="width:100%;padding:18px;border:none;border-radius:var(--r16);font-size:15px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:transform .2s">
    </button>
  </div>

  <!-- Ausgaben nach Kategorie -->
  <div class="stitle">Ausgaben nach Kategorie</div>
  <div id="st-cats" style="display:flex;flex-direction:column;gap:4px;margin-bottom:12px"></div>

  <div style="height:140px;flex-shrink:0;pointer-events:none"></div>
</div>
`;

// ── Init ──────────────────────────────────────────────────────
function init() {
  const container = document.getElementById('module-views');
  if (container) {
    const tmp = document.createElement('div');
    tmp.innerHTML = VIEW_HTML;
    container.appendChild(tmp.firstElementChild);
  }
  BSP.on('core:ready', async () => { await render(); });
  BSP.on('beleg:saved', async () => { await render(); });
  BSP.on('view:changed', ({ name }) => { if (name === 'steuer') render(); });
}

function setFilter(val) {
  _filter = val;
  render();
}

// ── Zeitraum aus Filter ───────────────────────────────────────
function _getRange() {
  const y = new Date().getFullYear();
  const ranges = {
    q1:   [`${y}-01-01`, `${y}-03-31`],
    q2:   [`${y}-04-01`, `${y}-06-30`],
    q3:   [`${y}-07-01`, `${y}-09-30`],
    q4:   [`${y}-10-01`, `${y}-12-31`],
    jahr: [`${y}-01-01`, `${y}-12-31`],
  };
  return ranges[_filter] || ranges.jahr;
}

// ── ESt-Formel 2026 (§32a EStG) ──────────────────────────────
function _calcESt(zve) {
  // TODO: Steuerberater-Werte (Vorauszahlungen, andere Einkünfte) – später als eigenes Modul
  if (zve <= 0) return { est: 0, soli: 0, rate: 0 };
  const gf = 11784; // Grundfreibetrag 2026
  if (zve <= gf) return { est: 0, soli: 0, rate: 0 };

  let est = 0;
  if (zve <= 17005) {
    const y = (zve - 11784) / 10000;
    est = (912.17 * y + 1400) * y;
  } else if (zve <= 66760) {
    const y = (zve - 17005) / 10000;
    est = (181.19 * y + 2397) * y + 1007;
  } else if (zve <= 277825) {
    est = 0.42 * zve - 10908;
  } else {
    est = 0.45 * zve - 19256;
  }
  est = Math.max(0, Math.round(est));
  const soli = est > 18130 ? Math.round(est * 0.055) : 0;
  const rate = zve > 0 ? Math.round((est / zve) * 100) : 0;
  return { est, soli, rate };
}

// ── Render ────────────────────────────────────────────────────
async function render() {
  try {
    const [start, end] = _getRange();
    const all = await BSP.getBelege();
    const fb = all.filter(b => b.date && b.date >= start && b.date <= end);

    const arBelege = fb.filter(b => b.type === 'ar');
    const erBelege = fb.filter(b => b.type === 'er');

    const arNetto = arBelege.reduce((s, b) => s + (b.net || b.brutto || 0), 0);
    const erNetto = erBelege.reduce((s, b) => s + (b.net || b.brutto || 0), 0);

    const fahrten = await BSP.dbGetAll('fahrten');
    const year = new Date().getFullYear();
    const kmPauschale = fahrten
      .filter(f => f.date && f.date >= start && f.date <= end)
      .reduce((s, f) => s + (f.pauschale || 0), 0);

    const verpfl = await BSP.dbGetAll('verpflegung');
    const verpfPauschale = verpfl
      .filter(v => v.date && v.date >= start && v.date <= end)
      .reduce((s, v) => s + (v.pauschale || 0), 0);

    const gesamtAusgaben = erNetto + kmPauschale + verpfPauschale;
    const gewinn = arNetto - gesamtAusgaben;
    const zve = Math.max(0, gewinn);
    const { est, soli, rate } = _calcESt(zve);

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    // Block 1: EÜR
    const fmt = (v) => BSP.fm(v) + ' €';
    set('st-ar-netto', fmt(arNetto));
    set('st-er-netto', fmt(erNetto));
    const gewinnEl = document.getElementById('st-gewinn');
    if (gewinnEl) {
      gewinnEl.textContent = fmt(gewinn);
      gewinnEl.style.color = gewinn >= 0 ? 'var(--gold)' : 'var(--red)';
    }

    // Details EÜR
    const detEl = document.getElementById('st-eur-details');
    if (detEl) {
      detEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--br)">
          <span style="font-size:11px;color:var(--txt3)">+ Km-Pauschale</span>
          <span style="font-size:11px;color:var(--silv)">${fmt(kmPauschale)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:5px 0">
          <span style="font-size:11px;color:var(--txt3)">+ Verpflegungspauschalen</span>
          <span style="font-size:11px;color:var(--silv)">${fmt(verpfPauschale)}</span>
        </div>`;
    }

    // Block 2: MwSt
    const mwstSaldo = BSP.state.mwstSaldo || 0;
    const mwstCard = document.getElementById('st-mwst-card');
    if (mwstCard) {
      mwstCard.style.background = mwstSaldo >= 0 ? 'rgba(192,64,64,.06)' : 'rgba(58,175,112,.06)';
      mwstCard.style.borderColor = mwstSaldo >= 0 ? 'rgba(192,64,64,.2)' : 'rgba(58,175,112,.2)';
    }
    const mwstValEl = document.getElementById('st-mwst-val');
    if (mwstValEl) {
      mwstValEl.textContent = BSP.fm(Math.abs(mwstSaldo)) + ' €';
      mwstValEl.style.color = mwstSaldo >= 0 ? 'var(--red)' : 'var(--grn)';
    }
    set('st-mwst-sub', mwstSaldo >= 0 ? '→ Zu zahlen ans Finanzamt' : '→ Erstattung vom Finanzamt');

    // Countdown
    const dl = BSP.getNextDeadline();
    const badge = document.getElementById('st-countdown-badge');
    if (badge && dl) {
      badge.textContent = `${dl.daysLeft} Tage`;
      badge.style.background = dl.daysLeft > 14 ? 'rgba(58,175,112,.15)' : dl.daysLeft > 7 ? 'rgba(192,112,48,.15)' : 'rgba(192,64,64,.15)';
      badge.style.color = dl.daysLeft > 14 ? 'var(--grn)' : dl.daysLeft > 7 ? 'var(--orn)' : 'var(--red)';
    }

    // Block 3: Gauge
    set('st-zve', fmt(zve));
    set('st-est', fmt(est));
    set('st-soli', fmt(soli));

    const gauge = document.getElementById('st-gauge-fill');
    if (gauge) {
      const maxRate = 45;
      const fillPct = Math.min(rate / maxRate, 1);
      const arcLen = 251;
      gauge.style.strokeDashoffset = String(arcLen - fillPct * arcLen);
      gauge.style.stroke = rate < 20 ? 'var(--grn)' : rate < 35 ? 'var(--orn)' : 'var(--red)';
    }
    set('st-gauge-pct', rate + '%');

    // Progressions-Warnung
    const warnEl = document.getElementById('st-progress-warn');
    if (warnEl) {
      const STUFEN = [
        { limit: 17005,  next: 17005,  label: '24%-Stufe',  savings: 17005 - zve },
        { limit: 66760,  next: 66760,  label: '42%-Stufe',  savings: 66760 - zve },
        { limit: 277825, next: 277825, label: '45%-Stufe',  savings: 277825 - zve },
      ];
      const nahe = STUFEN.find(s => s.savings > 0 && s.savings < 5000);
      if (nahe) {
        warnEl.style.display = 'block';
        warnEl.textContent = `⚠️ Nur noch ${BSP.fm(nahe.savings)} € bis zur nächsten Steuerstufe (${nahe.label}). Jetzt sinnvolle Betriebsausgaben prüfen!`;
      } else {
        warnEl.style.display = 'none';
      }
    }

    // Block 4: Quartals-Balken
    await _renderQuarters(all);

    // Block 5: Export-Button
    await _renderExportBtn();

    // Kategorie-Aufschlüsselung
    _renderCats(erBelege);

  } catch(e) {
    console.warn('Steuer render error:', e);
  }
}

// ── Quartals-Balken ───────────────────────────────────────────
async function _renderQuarters(allBelege) {
  const qEl = document.getElementById('st-quarters');
  const qlEl = document.getElementById('st-quarters-labels');
  if (!qEl || !qlEl) return;

  const y = new Date().getFullYear();
  const currentQ = Math.ceil((new Date().getMonth() + 1) / 3);

  const quarts = [
    { label: 'Q1', start: `${y}-01-01`, end: `${y}-03-31` },
    { label: 'Q2', start: `${y}-04-01`, end: `${y}-06-30` },
    { label: 'Q3', start: `${y}-07-01`, end: `${y}-09-30` },
    { label: 'Q4', start: `${y}-10-01`, end: `${y}-12-31` },
  ];

  const data = quarts.map((q, i) => {
    const qb = allBelege.filter(b => b.date >= q.start && b.date <= q.end);
    const ein = qb.filter(b => b.type === 'ar').reduce((s, b) => s + (b.net || b.brutto || 0), 0);
    const aus = qb.filter(b => b.type === 'er').reduce((s, b) => s + (b.net || b.brutto || 0), 0);
    return { label: q.label, ein, aus, isCurrent: (i + 1) === currentQ, isFuture: (i + 1) > currentQ };
  });

  const maxVal = Math.max(...data.map(d => Math.max(d.ein, d.aus)), 1);
  const H = 90; // max Balkenhöhe px

  qEl.innerHTML = data.map(d => {
    const hEin = Math.round((d.ein / maxVal) * H);
    const hAus = Math.round((d.aus / maxVal) * H);
    const opacity = d.isFuture ? '0.3' : '1';
    const outline = d.isCurrent ? `box-shadow:0 0 0 2px var(--gold)` : '';
    return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;height:${H}px">
      <div style="width:18px;height:${hEin}px;background:var(--grn);border-radius:3px 3px 0 0;opacity:${opacity};transition:height .6s ease"></div>
      <div style="width:18px;height:${hAus}px;background:var(--red);border-radius:3px 3px 0 0;opacity:${opacity};transition:height .6s ease"></div>
    </div>`;
  }).join('');

  qlEl.innerHTML = data.map((d, i) => {
    const bold = d.isCurrent ? 'font-weight:600;color:var(--gold)' : 'color:var(--txt3)';
    return `<div style="font-size:10px;${bold};text-align:center">${d.label}</div>`;
  }).join('');
}

// ── Export-Button ─────────────────────────────────────────────
async function _renderExportBtn() {
  const btn = document.getElementById('st-export-btn');
  if (!btn) return;

  const pendingCount = await BSP.prCountOpen();
  const q = Math.ceil((new Date().getMonth() + 1) / 3);

  if (pendingCount === 0) {
    btn.style.cssText = 'width:100%;padding:18px;border:none;border-radius:var(--r16);font-size:15px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;background:var(--grn);color:#fff;transition:transform .2s';
    btn.innerHTML = `<span>✓</span> Q${q} ans Steuerbüro senden`;
  } else {
    btn.style.cssText = 'width:100%;padding:18px;border:none;border-radius:var(--r16);font-size:15px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;background:var(--orn);color:#fff;transition:transform .2s';
    btn.innerHTML = `<span>⚠️</span> Q${q} exportieren (${pendingCount} offen)`;
  }
}

// ── MwSt-Sheet öffnen ─────────────────────────────────────────
function openMwstSheet() {
  if (typeof MwstModule !== 'undefined' && MwstModule.openDetailSheet) {
    MwstModule.openDetailSheet();
  } else {
    BSP.showView('mwst');
  }
}

// ── Kategorie-Aufschlüsselung ─────────────────────────────────
function _renderCats(erBelege) {
  const container = document.getElementById('st-cats');
  if (!container) return;
  const catMap = {};
  erBelege.forEach(b => {
    const cat = b.cat || 'Sonstiges';
    catMap[cat] = (catMap[cat] || 0) + (b.net || b.brutto || 0);
  });
  const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const max = sorted[0]?.[1] || 1;
  if (!sorted.length) {
    container.innerHTML = '<div class="empty" style="padding:16px 0">Noch keine Ausgaben.</div>';
    return;
  }
  container.innerHTML = sorted.map(([cat, val]) => {
    const pct = Math.round((val / max) * 100);
    return `<div style="background:var(--bg3);border:1px solid var(--br);border-radius:var(--r8);padding:10px 12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:5px">
        <span style="font-size:12px;font-weight:300;color:var(--txt2)">${BSP.eh(cat)}</span>
        <span style="font-size:12px;font-weight:200;color:var(--blu)">${BSP.fm(val)} €</span>
      </div>
      <div style="background:var(--bg);border-radius:2px;height:2px;overflow:hidden">
        <div style="height:100%;background:var(--blu);width:${pct}%;transition:width .5s"></div>
      </div>
    </div>`;
  }).join('');
}

// ── Belege Sheet ──────────────────────────────────────────────
async function showBelegeSheet(type) {
  const allBelege = await BSP.getBelege();
  let belege = allBelege.filter(b => b.type === type);
  
  if (_filter !== 'jahr') {
    const qMatch = { 'q1': 1, 'q2': 2, 'q3': 3, 'q4': 4 };
    belege = belege.filter(b => {
      const db = new Date(b.date);
      if (isNaN(db.getTime())) return false;
      const q = Math.floor(db.getMonth() / 3) + 1;
      return q === qMatch[_filter];
    });
  }

  belege.sort((a,b) => (b.date || '').localeCompare(a.date || '') || (b.savedAt || 0) - (a.savedAt || 0));

  let listHtml = '<div class="empty" style="padding:16px 0">Keine Belege für diesen Zeitraum gefunden.</div>';
  
  if (belege.length > 0) {
    listHtml = belege.map(b => `
      <div class="ri" onclick="BelegeModule.openDetail(${b.id})">
        <div class="ri-bar" style="background:${b.type==='er'?'var(--blu)':b.type==='ar'?'var(--ylw)':'var(--silv)'}"></div>
        <div class="ri-th">${b.image ? `<img src="${b.image}">` : '🧾'}</div>
        <div class="ri-inf">
          <div class="ri-sh">${BSP.eh(b.shop)}</div>
          <div class="ri-me">${BSP.fd(b.date)} ${b.belegNr ? '· ' + b.belegNr : ''}</div>
        </div>
        <div class="ri-r"><div class="ri-r-amt">${BSP.fm(b.brutto)} €</div></div>
      </div>
    `).join('');
  }

  const title = type === 'ar' ? 'Einnahmen Belege' : 'Ausgaben Belege';
  const html = `
    <div class="sh"></div>
    <div class="mod-header">
      <h2 class="mod-title">${title}</h2>
      <p class="mod-sub">${belege.length} Belege in diesem Zeitraum</p>
    </div>
    <div style="margin-top:16px;max-height:60vh;overflow-y:auto;padding-bottom:20px;margin: 16px -16px 0;padding: 0 16px;">
      ${listHtml}
    </div>
    <div style="margin-top:12px">
      <button class="btn btn-g" style="width:100%;justify-content:center" onclick="BSP.closeSheet()">Schließen</button>
    </div>
  `;
  BSP.showSheet(html);
}

return { init, render, setFilter, openMwstSheet, showBelegeSheet };

})();
