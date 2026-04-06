// ══════════════════════════════════════════════════════════════
// MODUL: MWST
// MwSt-Voranmeldung, Saldo, RC-Ausweis, Countdown
// Kommuniziert NUR über BSP.* — niemals direkt mit anderen Modulen
// ══════════════════════════════════════════════════════════════
'use strict';

const MwStModule = (() => {

const VIEW_HTML = `
<div id="v-mwst" class="view">
  <div class="mod-header">
    <div class="mod-title">MwSt-Voranmeldung</div>
    <div class="mod-sub" id="mwst-rhythmus-lbl">Wird geladen …</div>
  </div>

  <!-- Saldo-Card – antippbar für Detail-Ansicht -->
  <div class="mwst-saldo-card mwst-zahllast" id="mwst-saldo-card" onclick="MwStModule.openZahllastSheet()" style="cursor:pointer;position:relative">
    <div style="position:absolute;top:14px;right:14px;font-size:10px;color:var(--txt3);letter-spacing:.4px">DETAILS ›</div>
    <div class="mwst-saldo-lbl" id="mwst-saldo-lbl">ZAHLLAST</div>
    <div class="mwst-saldo-val" id="mwst-saldo-val">0,00 €</div>
    <div style="font-size:11px;font-weight:300;color:var(--txt3);margin-top:8px" id="mwst-saldo-sub">AR-MwSt minus ER-Vorsteuer</div>
  </div>

  <!-- Deadline-Box -->
  <div style="background:var(--s1);border:1px solid var(--br);border-radius:var(--r12);padding:14px 16px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between">
    <div>
      <div style="font-size:10px;color:var(--txt3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:4px">Nächste Abgabe</div>
      <div style="font-size:15px;font-weight:200;color:var(--txt)" id="mwst-deadline-date">—</div>
    </div>
    <div style="text-align:right">
      <div id="mwst-deadline-days" style="font-size:22px;font-weight:200;letter-spacing:-1px">–</div>
      <div style="font-size:10px;color:var(--txt3)">Tage</div>
    </div>
  </div>

  <!-- AR / ER Breakdown -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
    <div style="background:var(--s1);border:1px solid var(--br);border-radius:var(--r12);padding:14px">
      <div style="font-size:9px;color:var(--txt3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px">AR-MwSt (Einnahmen)</div>
      <div id="mwst-ar" style="font-size:18px;font-weight:200;color:var(--ylw)">0,00 €</div>
      <div id="mwst-ar-cnt" style="font-size:10px;color:var(--txt3);margin-top:2px">0 Belege</div>
    </div>
    <div style="background:var(--s1);border:1px solid var(--br);border-radius:var(--r12);padding:14px">
      <div style="font-size:9px;color:var(--txt3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px">ER-Vorsteuer (Ausgaben)</div>
      <div id="mwst-er" style="font-size:18px;font-weight:200;color:var(--blu)">0,00 €</div>
      <div id="mwst-er-cnt" style="font-size:10px;color:var(--txt3);margin-top:2px">0 Belege</div>
    </div>
  </div>

  <!-- Reverse Charge -->
  <div id="mwst-rc-box" style="display:none;background:rgba(192,112,48,.07);border:1px solid rgba(192,112,48,.25);border-radius:var(--r12);padding:14px;margin-bottom:10px">
    <div style="font-size:10px;color:var(--orn);letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px">⚠️ Reverse Charge (§13b UStG)</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div>
        <div style="font-size:9px;color:var(--txt3);margin-bottom:3px">UStVA Zeile 52 (Netto)</div>
        <div id="mwst-rc52" style="font-size:16px;font-weight:200;color:var(--orn)">0,00 €</div>
      </div>
      <div>
        <div style="font-size:9px;color:var(--txt3);margin-bottom:3px">UStVA Zeile 67 (Steuer)</div>
        <div id="mwst-rc67" style="font-size:16px;font-weight:200;color:var(--orn)">0,00 €</div>
      </div>
    </div>
    <div style="font-size:10px;color:var(--txt3);margin-top:10px;line-height:1.6">
      Diese Beträge fließen nicht in die normale Zahllast ein. Separat in der UStVA eintragen.
    </div>
  </div>

  <!-- Monatsaufschlüsselung -->
  <div class="stitle" style="margin-top:16px">Monatsübersicht (aktuelles Jahr)</div>
  <div id="mwst-months" style="display:flex;flex-direction:column;gap:4px"></div>

  <!-- Hinweis -->
  <div style="margin-top:16px;padding:14px;background:var(--s1);border:1px solid var(--br);border-radius:var(--r12);font-size:11px;color:var(--txt3);line-height:1.7">
    <strong style="color:var(--txt2)">Hinweis:</strong> Zahllast = AR-MwSt aus Ausgangsrechnungen minus ER-Vorsteuer aus Eingangsbelegen.
    Reverse-Charge-Beträge sind separat ausgewiesen. Alle Angaben ohne Gewähr – nur zur Orientierung.
  </div>
</div>
`;

// ── Modul Init ───────────────────────────────────────────────
function init() {
  const container = document.getElementById('module-views');
  if (container) {
    const tmp = document.createElement('div');
    tmp.innerHTML = VIEW_HTML;
    container.appendChild(tmp.firstElementChild);
  }

  BSP.on('core:ready', async () => {
    await render();
  });

  BSP.on('mwst:updated', async () => {
    await render();
  });

  BSP.on('settings:saved', async () => {
    await render();
  });
}

// ── Render ───────────────────────────────────────────────────
async function render() {
  const all = await BSP.getBelege();
  const now = new Date();
  const year = now.getFullYear();
  const yearBelege = all.filter(b => b.date && new Date(b.date + 'T00:00:00').getFullYear() === year);

  let arMwst = 0, erMwst = 0, rcZ52 = 0, rcZ67 = 0;
  let arCnt = 0, erCnt = 0;

  yearBelege.forEach(b => {
    if (b.isReverseCharge) {
      rcZ52 += (b.net || 0);
      rcZ67 += (b.mwst || 0);
    } else if (b.type === 'ar') {
      arMwst += (b.mwst || 0);
      arCnt++;
    } else if (b.type === 'er') {
      erMwst += (b.mwst || 0);
      erCnt++;
    }
  });

  const saldo = arMwst - erMwst;
  const isZahllast = saldo >= 0;

  // Saldo-Card
  const card = document.getElementById('mwst-saldo-card');
  const lbl = document.getElementById('mwst-saldo-lbl');
  const val = document.getElementById('mwst-saldo-val');
  const sub = document.getElementById('mwst-saldo-sub');

  if (card) {
    card.className = 'mwst-saldo-card ' + (isZahllast ? 'mwst-zahllast' : 'mwst-erstattung');
  }
  if (lbl) lbl.textContent = isZahllast ? 'ZAHLLAST' : 'ERSTATTUNG';
  if (val) val.textContent = BSP.fm(Math.abs(saldo)) + ' €';
  if (sub) sub.textContent = `AR ${BSP.fm(arMwst)} € – ER ${BSP.fm(erMwst)} €`;

  // AR / ER
  const arEl = document.getElementById('mwst-ar');
  const erEl = document.getElementById('mwst-er');
  const arCntEl = document.getElementById('mwst-ar-cnt');
  const erCntEl = document.getElementById('mwst-er-cnt');
  if (arEl) arEl.textContent = BSP.fm(arMwst) + ' €';
  if (erEl) erEl.textContent = BSP.fm(erMwst) + ' €';
  if (arCntEl) arCntEl.textContent = arCnt + ' Beleg' + (arCnt !== 1 ? 'e' : '');
  if (erCntEl) erCntEl.textContent = erCnt + ' Beleg' + (erCnt !== 1 ? 'e' : '');

  // RC-Box
  const rcBox = document.getElementById('mwst-rc-box');
  if (rcBox) {
    rcBox.style.display = (rcZ52 > 0 || rcZ67 > 0) ? 'block' : 'none';
    const r52 = document.getElementById('mwst-rc52');
    const r67 = document.getElementById('mwst-rc67');
    if (r52) r52.textContent = BSP.fm(rcZ52) + ' €';
    if (r67) r67.textContent = BSP.fm(rcZ67) + ' €';
  }

  // Deadline
  const dl = BSP.getNextDeadline();
  const rhythmusLabels = {
    monatlich: 'Monatliche Voranmeldung',
    quartal: 'Quartalsweise Voranmeldung',
    halbjahr: 'Halbjährliche Voranmeldung',
    jaehrlich: 'Jährliche Abgabe'
  };
  const rhythmusEl = document.getElementById('mwst-rhythmus-lbl');
  if (rhythmusEl) rhythmusEl.textContent = rhythmusLabels[dl.rhythmus] || 'Voranmeldung';

  const dlDate = document.getElementById('mwst-deadline-date');
  const dlDays = document.getElementById('mwst-deadline-days');
  if (dlDate) dlDate.textContent = dl.deadline.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  if (dlDays) {
    dlDays.textContent = dl.daysLeft;
    dlDays.style.color = dl.daysLeft <= 3 ? 'var(--red)' : dl.daysLeft <= 7 ? 'var(--orn)' : 'var(--grn)';
  }

  // Monatsübersicht
  _renderMonths(yearBelege);
}

// ── Monats-Aufschlüsselung ───────────────────────────────────
function _renderMonths(belege) {
  const container = document.getElementById('mwst-months');
  if (!container) return;

  const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const now = new Date();
  const rows = [];

  for (let m = 0; m <= now.getMonth(); m++) {
    const mb = belege.filter(b => {
      const bd = new Date(b.date + 'T00:00:00');
      return bd.getMonth() === m;
    });
    const ar = mb.filter(b => b.type === 'ar' && !b.isReverseCharge).reduce((s, b) => s + (b.mwst || 0), 0);
    const er = mb.filter(b => b.type === 'er' && !b.isReverseCharge).reduce((s, b) => s + (b.mwst || 0), 0);
    const saldo = ar - er;
    if (ar === 0 && er === 0) continue;
    rows.push({ m, ar, er, saldo });
  }

  if (!rows.length) {
    container.innerHTML = '<div class="empty" style="padding:20px 0">Noch keine Belege in diesem Jahr.</div>';
    return;
  }

  container.innerHTML = rows.map(({ m, ar, er, saldo }) => {
    const col = saldo >= 0 ? 'var(--red)' : 'var(--grn)';
    return `<div style="display:flex;align-items:center;padding:10px 12px;background:var(--s1);border:1px solid var(--br);border-radius:var(--r8);gap:10px">
      <div style="font-size:11px;font-weight:300;color:var(--txt3);width:28px">${monthNames[m]}</div>
      <div style="flex:1;display:flex;gap:8px">
        <span style="font-size:11px;color:var(--ylw)">AR ${BSP.fm(ar)} €</span>
        <span style="font-size:11px;color:var(--txt3)">·</span>
        <span style="font-size:11px;color:var(--blu)">ER ${BSP.fm(er)} €</span>
      </div>
      <div style="font-size:13px;font-weight:200;color:${col}">${saldo >= 0 ? '+' : ''}${BSP.fm(saldo)} €</div>
    </div>`;
  }).join('');
}

// ── Zahllast-Detail-Sheet ────────────────────────────────────
async function openZahllastSheet() {
  const all = await BSP.getBelege();
  const now = new Date();
  const year = now.getFullYear();
  const yb = all.filter(b => b.date && new Date(b.date + 'T00:00:00').getFullYear() === year);

  const erBelege = yb.filter(b => b.type === 'er' && !b.isReverseCharge);
  const arBelege = yb.filter(b => b.type === 'ar' && !b.isReverseCharge);
  const rcBelege = yb.filter(b => b.isReverseCharge);

  const arMwst  = arBelege.reduce((s, b) => s + (b.mwst || 0), 0);
  const erMwst  = erBelege.reduce((s, b) => s + (b.mwst || 0), 0);
  const arNetto = arBelege.reduce((s, b) => s + (b.net  || 0), 0);
  const erNetto = erBelege.reduce((s, b) => s + (b.net  || 0), 0);
  const rcNetto = rcBelege.reduce((s, b) => s + (b.net  || 0), 0);
  const saldo   = arMwst - erMwst;
  const isZahllast = saldo >= 0;

  // Aufgabe 7: pending_review Anzahl
  const pendingCount = await BSP.prCountOpen();

  const SKR03 = BSP.DATEV?.SKR03 || {};

  const erRows = erBelege.map(b => `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--br)">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${BSP.eh(b.shop||'Unbekannt')}</div>
        <div style="font-size:10px;color:var(--txt3)">${b.belegNr||'—'} · ${BSP.fd(b.date)} · Kto ${(SKR03[b.cat]||{}).konto||'?'}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;margin-left:8px">
        <div style="font-size:12px;color:var(--blu);font-family:'DM Mono',monospace">${BSP.fm(b.mwst)} €</div>
        <div style="font-size:9px;color:var(--txt3)">${b.mwstRate||19}% · Netto ${BSP.fm(b.net)} €</div>
      </div>
    </div>`).join('');

  const arRows = arBelege.map(b => `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--br)">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${BSP.eh(b.empfaenger||b.shop||'Unbekannt')}</div>
        <div style="font-size:10px;color:var(--txt3)">${b.belegNr||'—'} · ${BSP.fd(b.date)}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;margin-left:8px">
        <div style="font-size:12px;color:var(--ylw);font-family:'DM Mono',monospace">${BSP.fm(b.mwst)} €</div>
        <div style="font-size:9px;color:var(--txt3)">${b.mwstRate||19}% · Netto ${BSP.fm(b.net)} €</div>
      </div>
    </div>`).join('');

  const rcRows = rcBelege.length ? rcBelege.map(b => `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--br)">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${BSP.eh(b.shop||'Unbekannt')}</div>
        <div style="font-size:10px;color:var(--orn)">${b.belegNr||'—'} · ${BSP.fd(b.date)} · SK ${b.mwstRate===19?'94':'19'}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;margin-left:8px">
        <div style="font-size:12px;color:var(--orn);font-family:'DM Mono',monospace">${BSP.fm(b.net)} € Netto</div>
        <div style="font-size:9px;color:var(--txt3)">MwSt (selbst): ${BSP.fm(b.net * (b.mwstRate||19) / 100)} €</div>
      </div>
    </div>`).join('') : '<div style="font-size:12px;color:var(--txt3);padding:8px 0">Keine RC-Buchungen</div>';

  const html = `
    <div class="sh"></div>
    <div style="font-size:18px;font-weight:200;letter-spacing:-.5px;color:var(--txt);margin-bottom:4px">MwSt-Detailansicht</div>
    <div style="font-size:11px;color:var(--txt3);margin-bottom:20px">Jahr ${year} · Alle Belege</div>

    <!-- ① ER -->
    <div style="margin-bottom:20px">
      <div style="font-size:10px;font-weight:600;color:var(--txt3);letter-spacing:.8px;text-transform:uppercase;margin-bottom:10px;display:flex;justify-content:space-between">
        <span>① Eingangsrechnungen (ER)</span>
        <span style="color:var(--blu);font-family:'DM Mono',monospace">${BSP.fm(erMwst)} €</span>
      </div>
      ${erRows || '<div style="font-size:12px;color:var(--txt3)">Keine ER-Belege</div>'}
    </div>

    <!-- ② AR -->
    <div style="margin-bottom:20px">
      <div style="font-size:10px;font-weight:600;color:var(--txt3);letter-spacing:.8px;text-transform:uppercase;margin-bottom:10px;display:flex;justify-content:space-between">
        <span>② Ausgangsrechnungen (AR)</span>
        <span style="color:var(--ylw);font-family:'DM Mono',monospace">${BSP.fm(arMwst)} €</span>
      </div>
      ${arRows || '<div style="font-size:12px;color:var(--txt3)">Keine AR-Belege</div>'}
    </div>

    <!-- ③ Reverse Charge -->
    <div style="margin-bottom:20px">
      <div style="font-size:10px;font-weight:600;color:var(--txt3);letter-spacing:.8px;text-transform:uppercase;margin-bottom:10px;display:flex;justify-content:space-between">
        <span>③ Reverse Charge (§13b UStG)</span>
        <span style="color:var(--orn);font-family:'DM Mono',monospace">${BSP.fm(rcNetto)} € Netto</span>
      </div>
      ${rcRows}
    </div>

    <!-- ④ Zusammenfassung -->
    <div style="background:var(--bg2);border:1px solid var(--br);border-radius:var(--r12);padding:16px;margin-bottom:20px">
      <div style="font-size:10px;font-weight:600;color:var(--txt3);letter-spacing:.8px;text-transform:uppercase;margin-bottom:12px">④ Zusammenfassung</div>
      <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0"><span style="color:var(--txt2)">Gesamteinnahmen (Netto)</span><span style="color:var(--ylw);font-family:'DM Mono',monospace">${BSP.fm(arNetto)} €</span></div>
      <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0"><span style="color:var(--txt2)">Gesamtausgaben (Netto)</span><span style="color:var(--blu);font-family:'DM Mono',monospace">${BSP.fm(erNetto)} €</span></div>
      <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0"><span style="color:var(--txt2)">Eingenommene MwSt (AR)</span><span style="color:var(--ylw);font-family:'DM Mono',monospace">${BSP.fm(arMwst)} €</span></div>
      <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0"><span style="color:var(--txt2)">Abziehbare Vorsteuer (ER)</span><span style="color:var(--blu);font-family:'DM Mono',monospace">${BSP.fm(erMwst)} €</span></div>
      ${rcNetto > 0 ? `<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0"><span style="color:var(--txt2)">Reverse-Charge-Netto</span><span style="color:var(--orn);font-family:'DM Mono',monospace">${BSP.fm(rcNetto)} €</span></div>` : ''}
      <div style="border-top:1px solid var(--br);margin-top:10px;padding-top:10px;display:flex;justify-content:space-between;align-items:baseline">
        <div style="font-size:12px;color:var(--txt2);font-weight:500">${isZahllast ? 'ZAHLLAST' : 'ERSTATTUNG'}</div>
        <div style="font-size:28px;font-weight:200;letter-spacing:-1px;color:${isZahllast ? 'var(--red)' : 'var(--grn)'}">${BSP.fm(Math.abs(saldo))} €</div>
      </div>
    </div>

    <!-- ⑤ Pending Review -->
    <div style="background:${pendingCount===0?'rgba(58,175,112,.06)':'rgba(192,112,48,.06)'};border:1px solid ${pendingCount===0?'rgba(58,175,112,.2)':'rgba(192,112,48,.2)'};border-radius:var(--r12);padding:14px;margin-bottom:20px">
      <div style="font-size:10px;font-weight:600;color:var(--txt3);letter-spacing:.8px;text-transform:uppercase;margin-bottom:8px">⑤ Ungeklärte Buchungen</div>
      ${pendingCount === 0
        ? '<div style="font-size:13px;color:var(--grn)">✓ Alle Buchungen geklärt</div>'
        : `<div style="font-size:13px;color:var(--orn);margin-bottom:10px">⚠️ ${pendingCount} Buchung${pendingCount!==1?'en':''} noch ungeklärt</div>
           <button style="padding:8px 16px;border:1px solid var(--orn);border-radius:100px;background:transparent;color:var(--orn);font-size:11px;cursor:pointer"
             onclick="BSP.closeSheet();setTimeout(()=>typeof ReviewWorkflowModule!=='undefined'&&ReviewWorkflowModule.startFromPending(),250)">
             → Jetzt klären
           </button>`
      }
    </div>

    <!-- Export-Button -->
    <button style="width:100%;padding:18px;border:none;border-radius:var(--r16);background:var(--accent);color:#fff;font-size:15px;font-weight:500;letter-spacing:.2px;cursor:pointer;margin-bottom:8px;display:flex;align-items:center;justify-content:center;gap:8px"
      onclick="BSP.closeSheet();setTimeout(()=>{BSP.showView('export');if(typeof ExportModule!=='undefined'&&ExportModule.openQ1Dialog)ExportModule.openQ1Dialog();},250)">
      📤 Jetzt ans Steuerbüro senden
    </button>
    <button class="btn btn-g" style="width:100%;justify-content:center" onclick="BSP.closeSheet()">Schließen</button>
    <div class="scroll-spacer"></div>
  `;
  BSP.showSheet(html);
}

return { init, render, openZahllastSheet, openDetailSheet: openZahllastSheet };

})();

// Alias für SteuerModule.openMwstSheet()
const MwstModule = MwStModule;
