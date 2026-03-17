// ══════════════════════════════════════════════════════════════
// MODUL: PRIVAT SPENDING
// Dashboard für Privatausgaben, Budgets und Lebensstil-Analyse
// ══════════════════════════════════════════════════════════════
'use strict';

const PrivatSpending = (() => {

  const VIEW_HTML = `
    <div class="mod-header">
      <h1 class="mod-title">Life & Spending</h1>
      <p class="mod-sub">Deine private Finanz-Übersicht</p>
    </div>

    <!-- Budget Progress -->
    <div class="card">
      <div class="stitle">Monatsbudget</div>
      <div id="ps-budget-bars"></div>
    </div>

    <!-- Life Analysis Widget -->
    <div class="card" style="background:linear-gradient(135deg, rgba(74,128,192,0.1) 0%, rgba(200,164,90,0.05) 100%)">
      <div class="stitle">Life Analysis</div>
      <div id="ps-analysis-text" style="font-size:14px;line-height:1.6;font-weight:200;color:var(--txt2)">
        Analysiere deine Ausgaben für Erkenntnisse über deinen Lebensstil...
      </div>
      <button class="btn btn-gold btn-sm" style="margin-top:12px;width:100%;justify-content:center" onclick="PrivatSpending.analyze()">
        ✨ Lebensstil-Check (KI)
      </button>
    </div>

    <!-- Kategorien & Trends -->
    <div class="card">
      <div class="stitle">Kategorien (Monat)</div>
      <div id="ps-cat-list" style="display:flex;flex-direction:column;gap:8px"></div>
    </div>
  `;

  function init() {
    BSP.on('pillar:changed', ({ pillar }) => {
      if (pillar === 'privat' && BSP.currentView === 'home') renderDashboard();
    });
    
    // View registrieren
    BSP.on('view:changed', ({ name }) => {
      if (name === 'privat-ausgaben') {
        const v = document.getElementById('v-privat-ausgaben');
        if (v) { v.innerHTML = VIEW_HTML; renderDashboard(); }
      }
    });

    // Styles für Budget Bars
    if (!document.getElementById('ps-css')) {
      const st = document.createElement('style');
      st.id = 'ps-css';
      st.textContent = `
        .pb-row { margin-bottom: 12px; }
        .pb-lab { display:flex; justify-content:space-between; font-size:11px; color:var(--txt2); margin-bottom:4px; }
        .pb-bar-wrap { height:6px; background:var(--s2); border-radius:3px; overflow:hidden; position:relative; }
        .pb-bar-fill { height:100%; border-radius:3px; transition:width .6s cubic-bezier(0.34, 1.5, 0.64, 1); }
      `;
      document.head.appendChild(st);
    }
  }

  async function renderDashboard() {
    const list = await BSP.getBelege();
    const priv = list.filter(b => b.type === 'priv');
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    const monthBelege = priv.filter(b => {
      const d = new Date(b.date + 'T00:00:00');
      return d.getMonth() === month && d.getFullYear() === year;
    });

    const total = monthBelege.reduce((s, b) => s + (b.brutto || 0), 0);
    const budget = BSP.state.settings.monatsbudget || 2000;

    // Budget Bars render
    const barsContainer = document.getElementById('ps-budget-bars');
    if (barsContainer) {
      const pct = Math.min(100, (total / budget) * 100);
      const col = pct > 90 ? 'var(--red)' : pct > 70 ? 'var(--orn)' : 'var(--blu)';
      barsContainer.innerHTML = `
        <div class="pb-row">
          <div class="pb-lab"><span>Gesamtausgaben</span><span>${BSP.fm(total)} € / ${BSP.fm(budget)} €</span></div>
          <div class="pb-bar-wrap"><div class="pb-bar-fill" style="width:${pct}%; background:${col}"></div></div>
        </div>
      `;
    }

    // Kategorien render
    const catList = document.getElementById('ps-cat-list');
    if (catList) {
      const cats = {};
      monthBelege.forEach(b => { const c = b.cat || 'Sonstiges'; cats[c] = (cats[c] || 0) + (b.brutto || 0); });
      const sorted = Object.entries(cats).sort((a,b) => b[1] - a[1]);
      
      catList.innerHTML = sorted.map(([name, val]) => {
        const p = Math.min(100, (val / total) * 100);
        return `
          <div class="pb-row">
            <div class="pb-lab"><span>${name}</span><span>${BSP.fm(val)} €</span></div>
            <div class="pb-bar-wrap"><div class="pb-bar-fill" style="width:${p}%; background:rgba(255,255,255,0.1)"></div></div>
          </div>
        `;
      }).join('');
    }
  }

  async function analyze() {
    const textEl = document.getElementById('ps-analysis-text');
    if (textEl) textEl.textContent = 'KI analysiert Lebensstil... ⏳';

    try {
      const list = await BSP.getBelege();
      const priv = list.filter(b => b.type === 'priv').slice(0, 50);
      const biz = list.filter(b => b.type === 'er' || b.type === 'ar').slice(0, 20);

      const dataStr = JSON.stringify({ priv: priv.map(b => ({ shop:b.shop, cat:b.cat, amt:b.brutto })), biz: biz.map(b => ({ cat:b.cat, amt:b.brutto })) });

      const prompt = `Du bist ein empathischer aber ehrlicher Lebensstil-Berater für einen deutschen Freelancer.
      Hier sind seine letzten Ausgaben (Business & Privat):
      ${dataStr}

      AUFGABE:
      Analysiere das Verhältnis von Arbeit zu Privatleben/Spaß. 
      Finde Muster (z.B. "Zu viel Lieferdienst", "Starker Fokus auf Hardware", "Wenig Freizeitaktivitäten").
      Gib ein kurzes Resümee (max 3 Sätze) und einen Tipp zur Optimierung. 
      Sei locker aber präzise. Keine Einleitung, kein "Hier ist die Analyse".`;

      const result = await BSP.ask({ prompt, model: 'sonnet' });
      if (textEl) textEl.textContent = result;
    } catch(e) {
      if (textEl) textEl.textContent = 'Fehler bei der Analyse.';
    }
  }

  return { init, renderDashboard, analyze };

})();
PrivatSpending.init();
