// ══════════════════════════════════════════════════════════════
// MODUL: STEUER
// EÜR + vereinfachte Einkommensteuer-Schätzung
// Kommuniziert NUR über BSP.* — niemals direkt mit anderen Modulen
// ══════════════════════════════════════════════════════════════
'use strict';

const SteuerModule = (() => {

const VIEW_HTML = `
<div id="v-steuer" class="view">
  <div class="mod-header">
    <div class="mod-title">Steuer</div>
    <div class="mod-sub">EÜR + Einkommensteuer-Schätzung</div>
  </div>

  <!-- EÜR Übersicht -->
  <div style="background:var(--s1);border:1px solid var(--br);border-radius:var(--r16);padding:16px;margin-bottom:12px">
    <div class="stitle">Einnahmen-Überschuss-Rechnung (EÜR)</div>
    <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--br)">
      <span style="font-size:12px;font-weight:300;color:var(--txt2)">Betriebseinnahmen (AR-Netto)</span>
      <span id="st-ar-netto" style="font-size:14px;font-weight:200;color:var(--ylw)">0,00 €</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--br)">
      <span style="font-size:12px;font-weight:300;color:var(--txt2)">Betriebsausgaben (ER-Netto)</span>
      <span id="st-er-netto" style="font-size:14px;font-weight:200;color:var(--blu)">0,00 €</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--br)">
      <span style="font-size:12px;font-weight:300;color:var(--txt2)">Km-Pauschale</span>
      <span id="st-km" style="font-size:14px;font-weight:200;color:var(--silv)">0,00 €</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--br)">
      <span style="font-size:12px;font-weight:300;color:var(--txt2)">Verpflegungspauschalen</span>
      <span id="st-verp" style="font-size:14px;font-weight:200;color:var(--silv)">0,00 €</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:12px 0 0">
      <span style="font-size:13px;font-weight:300;color:var(--txt)">Gewinn / Verlust</span>
      <span id="st-gewinn" style="font-size:18px;font-weight:200;color:var(--grn)">0,00 €</span>
    </div>
  </div>

  <!-- ESt-Schätzung -->
  <div style="background:var(--s1);border:1px solid var(--br);border-radius:var(--r16);padding:16px;margin-bottom:12px">
    <div class="stitle">Einkommensteuer-Schätzung</div>
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--br)">
      <span style="font-size:12px;color:var(--txt2)">Zu versteuerndes Einkommen (zvE)</span>
      <span id="st-zve" style="font-size:13px;font-weight:200;color:var(--txt)">0,00 €</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--br)">
      <span style="font-size:12px;color:var(--txt2)">Grundfreibetrag (2025)</span>
      <span style="font-size:13px;font-weight:200;color:var(--grn)">11.784 €</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--br)">
      <span style="font-size:12px;color:var(--txt2)">Vorsorgeaufwandspauschale (est.)</span>
      <span style="font-size:13px;font-weight:200;color:var(--silv)">— €</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:10px 0 0">
      <span style="font-size:13px;font-weight:300;color:var(--txt)">Geschätzte ESt</span>
      <span id="st-est" style="font-size:18px;font-weight:200;color:var(--red)">0,00 €</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:6px 0 0;border-top:1px solid var(--br);margin-top:6px">
      <span style="font-size:12px;color:var(--txt3)">+ Soli (bei Bedarf)</span>
      <span id="st-soli" style="font-size:12px;color:var(--txt3)">0,00 €</span>
    </div>
  </div>

  <!-- Ausgaben nach Kategorie -->
  <div class="stitle">Ausgaben nach Kategorie</div>
  <div id="st-cats" style="display:flex;flex-direction:column;gap:4px;margin-bottom:12px"></div>

  <!-- Disclaimer -->
  <div style="padding:14px;background:rgba(192,112,48,.06);border:1px solid rgba(192,112,48,.2);border-radius:var(--r12);font-size:11px;color:var(--txt3);line-height:1.7">
    ⚠️ <strong style="color:var(--orn)">Nur zur Orientierung.</strong> Diese Schätzung ersetzt keine professionelle Steuerberatung.
    Keine Haftung für Vollständigkeit oder Richtigkeit. Für die offizielle EÜR den Steuerberater
    oder ELSTER nutzen.
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

  BSP.on('core:ready', async () => { await render(); });
  BSP.on('beleg:saved', async () => { await render(); });
  BSP.on('view:changed', ({ name }) => { if (name === 'steuer') render(); });
}

// ── Einkommensteuer-Formel (vereinfacht §32a EStG 2025) ──────
function _calcESt(zve) {
  if (zve <= 0) return { est: 0, soli: 0 };
  const x = zve;
  const gf = 11784; // Grundfreibetrag 2025
  if (x <= gf) return { est: 0, soli: 0 };

  let est = 0;
  // Zone 2: 11.785 – 17.005 (14% bis 24%)
  // Zone 3: 17.006 – 66.760 (24% bis 42%)
  // Zone 4: 66.761 – 277.825 (42%)
  // Zone 5: > 277.825 (45%)
  if (x <= 17005) {
    const y = (x - 11784) / 10000;
    est = (912.17 * y + 1400) * y;
  } else if (x <= 66760) {
    const y = (x - 17005) / 10000;
    est = (181.19 * y + 2397) * y + 1007;
  } else if (x <= 277825) {
    est = 0.42 * x - 10908;
  } else {
    est = 0.45 * x - 19256;
  }
  est = Math.max(0, Math.round(est));

  // Soli: 5,5% der ESt wenn ESt > 18.130 € (vereinfacht ab 2024)
  const soli = est > 18130 ? Math.round(est * 0.055) : 0;
  return { est, soli };
}

// ── Render ───────────────────────────────────────────────────
async function render() {
  try {
    const s = BSP.state.settings || {};
    const year = new Date().getFullYear();
    const all = await BSP.getBelege();
    const yearBelege = all.filter(b => b.date && new Date(b.date + 'T00:00:00').getFullYear() === year);

    const arNetto = yearBelege.filter(b => b.type === 'ar').reduce((s, b) => s + (b.net || b.brutto || 0), 0);
    const erNetto = yearBelege.filter(b => b.type === 'er').reduce((s, b) => s + (b.net || b.brutto || 0), 0);

    const fahrten = await BSP.dbGetAll('fahrten');
    const kmPauschale = fahrten
      .filter(f => f.date && new Date(f.date + 'T00:00:00').getFullYear() === year)
      .reduce((s, f) => s + (f.pauschale || 0), 0);

    const verpfl = await BSP.dbGetAll('verpflegung');
    const verpfPauschale = verpfl
      .filter(v => v.date && new Date(v.date + 'T00:00:00').getFullYear() === year)
      .reduce((s, v) => s + (v.pauschale || 0), 0);

    const gesamtAusgaben = erNetto + kmPauschale + verpfPauschale;
    const gewinn = arNetto - gesamtAusgaben;

    // ESt-Schätzung (vereinfacht: Gewinn = zvE, kein Vorsorgeabzug)
    const zve = Math.max(0, gewinn);
    const { est, soli } = _calcESt(zve);

    // DOM aktualisieren
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('st-ar-netto', BSP.fm(arNetto) + ' €');
    set('st-er-netto', BSP.fm(erNetto) + ' €');
    set('st-km', BSP.fm(kmPauschale) + ' €');
    set('st-verp', BSP.fm(verpfPauschale) + ' €');

    const gewinnEl = document.getElementById('st-gewinn');
    if (gewinnEl) {
      gewinnEl.textContent = BSP.fm(gewinn) + ' €';
      gewinnEl.style.color = gewinn >= 0 ? 'var(--grn)' : 'var(--red)';
    }

    set('st-zve', BSP.fm(zve) + ' €');
    const estEl = document.getElementById('st-est');
    if (estEl) estEl.textContent = BSP.fm(est) + ' €';
    set('st-soli', BSP.fm(soli) + ' €');

    // Kategorie-Aufschlüsselung
    _renderCats(yearBelege.filter(b => b.type === 'er'));

  } catch(e) {
    console.warn('Steuer render error:', e);
  }
}

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
    return `<div style="background:var(--s1);border:1px solid var(--br);border-radius:var(--r8);padding:10px 12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:5px">
        <span style="font-size:12px;font-weight:300;color:var(--txt2)">${BSP.eh(cat)}</span>
        <span style="font-size:12px;font-weight:200;color:var(--blu)">${BSP.fm(val)} €</span>
      </div>
      <div style="background:var(--s3);border-radius:2px;height:2px;overflow:hidden">
        <div style="height:100%;background:var(--blu);width:${pct}%;transition:width .5s"></div>
      </div>
    </div>`;
  }).join('');
}

return { init, render };

})();
