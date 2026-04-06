// ══════════════════════════════════════════════════════════════
// MODUL: DASHBOARD
// Zentrale Übersicht über alle Säulen und Cross-Pillar Stats
// ══════════════════════════════════════════════════════════════
'use strict';

const DashboardModule = (() => {

  async function render() {
    const pillar = _currentPillar;
    const list = await BSP.getBelege();
    const now = new Date();
    const year = now.getFullYear();

    // 1. Filter nach aktuellem Jahr für MWSt-Berechnung (Business)
    const yearBelege = list.filter(b => b.date && new Date(b.date).getFullYear() === year);
    
    // 2. Deadline Ring & Labels aktualisieren
    const { deadline, daysLeft } = BSP.getNextDeadline();
    const daysEl = document.getElementById('deadline-days');
    const ringEl = document.getElementById('deadline-ring');
    const labelEl = document.getElementById('ring-label');
    const ringWrap = document.querySelector('.ring-box'); // Main Dash Ring
    const footLabel = document.getElementById('deadline-label');
    const footRing = document.getElementById('deadline-ring-fill');

    if (ringWrap) ringWrap.style.display = 'block'; // Always show by default now

    if (pillar === 'business') {
      if (daysEl) daysEl.textContent = daysLeft;
      if (labelEl) labelEl.textContent = 'Tage';
      if (footLabel) footLabel.textContent = `Abgabe in ${daysLeft}d`;
      if (ringEl) ringEl.style.strokeDashoffset = 283 - (Math.min(daysLeft, 30) / 30) * 283;
      if (footRing) footRing.style.strokeDashoffset = 276 - (Math.min(daysLeft, 30) / 30) * 276;
    } else if (pillar === 'privat') {
      if (daysEl) daysEl.textContent = '—';
      if (labelEl) labelEl.textContent = 'Warten';
      if (ringEl) ringEl.style.strokeDashoffset = 283;
      if (footLabel) footLabel.textContent = 'Bereit für Scan';
    } else if (pillar === 'archiv') {
      const docs = await BSP.dbGetAll('archiv_dokumente');
      if (daysEl) daysEl.textContent = docs.length;
      if (labelEl) labelEl.textContent = 'Docs';
      if (ringEl) ringEl.style.strokeDashoffset = 0;
      if (footLabel) footLabel.textContent = `${docs.length} Dok. archiviert`;
    }

    // 3. VAT Dashboard aktualisieren (Business Only)
    const vatBox = document.querySelector('.vat-dashboard');
    if (vatBox) vatBox.style.display = (pillar === 'business') ? 'block' : 'none';

    if (pillar === 'business') {
      const er = yearBelege.filter(b => b.type === 'er');
      const ar = yearBelege.filter(b => b.type === 'ar');
      const erMwst = er.reduce((s, b) => s + (b.mwst || 0), 0);
      const arMwst = ar.reduce((s, b) => s + (b.mwst || 0), 0);
      const saldo = arMwst - erMwst;

      const inVal = document.getElementById('qs-einnahmen');
      const outVal = document.getElementById('qs-ausgaben');
      const saldoVal = document.getElementById('vat-saldo-val');
      if (inVal) inVal.textContent = BSP.fm(arMwst) + ' €';
      if (outVal) outVal.textContent = BSP.fm(erMwst) + ' €';
      if (saldoVal) {
        saldoVal.textContent = BSP.fm(Math.abs(saldo)) + ' €';
        saldoVal.style.color = saldo > 0 ? 'var(--red)' : 'var(--grn)';
      }

      // Aufgabe 5: Export Quick-Action – nur wenn Belege vorhanden
      const totalBelege = yearBelege.length;
      let exportBtn = document.getElementById('dash-q1-export-btn');
      if (totalBelege > 0) {
        if (!exportBtn) {
          // Button in vat-summary-line einfügen
          const summaryLine = document.querySelector('.vat-summary-line');
          if (summaryLine) {
            exportBtn = document.createElement('button');
            exportBtn.id = 'dash-q1-export-btn';
            exportBtn.textContent = '📤 Export Q1';
            exportBtn.style.cssText = 'border:none;background:var(--accent);color:#fff;font-size:10px;font-weight:500;padding:5px 10px;border-radius:20px;cursor:pointer;letter-spacing:.3px;flex-shrink:0;margin-left:6px';
            exportBtn.onclick = () => {
              BSP.showView('export');
              if (typeof ExportModule !== 'undefined' && ExportModule.openQ1Dialog) {
                setTimeout(() => ExportModule.openQ1Dialog(), 150);
              }
            };
            summaryLine.appendChild(exportBtn);
          }
        }
      } else if (exportBtn) {
        exportBtn.remove();
      }
    }

    // 4. Letzte Einträge
    const recentList = document.getElementById('recent-list');
    if (recentList) {
      // Filter nach Säule für die Liste
      const pillarFiltered = list.filter(b => {
        if (pillar === 'business') return b.type === 'er' || b.type === 'ar';
        if (pillar === 'privat') return b.type === 'priv';
        return false;
      });

      const top = pillarFiltered.sort((a,b) => (b.savedAt || 0) - (a.savedAt || 0));
      if (!top.length) {
        recentList.innerHTML = '<div class="empty">Noch keine Belege vorhanden.</div>';
      } else {
        recentList.innerHTML = top.map(b => `
          <div class="ri" onclick="BelegeModule.openDetail(${b.id})">
            <div class="ri-bar" style="background:${b.type==='er'?'var(--blu)':b.type==='ar'?'var(--ylw)':'var(--silv)'}"></div>
            <div class="ri-th">${b.image ? `<img src="${b.image}">` : '🧾'}</div>
            <div class="ri-inf">
              <div class="ri-sh">${BSP.eh(b.shop)}</div>
              <div class="ri-me">${(b.cat||'').includes('Bewirtung') ? '<span class="badge" style="background:var(--orn);color:#fff;padding:2px 6px;border-radius:4px;font-size:9px;margin-right:4px">Bewirtung 70/30</span>' : ''}${BSP.fd(b.date)} · ${b.cat || '—'}</div>
            </div>
            <div class="ri-r"><div class="ri-r-amt">${BSP.fm(b.brutto)} €</div></div>
          </div>
        `).join('');
      }
    }

    // 5. Archiv Mini-Widget
    if (pillar === 'archiv' && recentList) {
      const docs = await BSP.dbGetAll('archiv_dokumente');
      const fristen = await BSP.dbGetAll('archiv_fristen');
      recentList.innerHTML = `
        <div class="card" onclick="BSP.showView('archiv-docs')" style="margin-bottom:12px">
          <div style="display:flex; justify-content:space-between"><span>Dokumente</span><span>${docs.length}</span></div>
        </div>
        <div class="card" onclick="BSP.showView('archiv-fristen')">
          <div style="display:flex; justify-content:space-between"><span>Fristen</span><span>${fristen.length}</span></div>
        </div>
      `;
    }
  }

  return { render };

})();
