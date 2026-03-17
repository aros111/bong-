// ══════════════════════════════════════════════════════════════
// MODUL: ARCHIV KONTEXT
// Verwaltung des KI-Gedächtnisses (Business & Life)
// ══════════════════════════════════════════════════════════════
'use strict';

const ArchivKontext = (() => {

  const VIEW_HTML = `
    <div class="mod-header">
      <h1 class="mod-title">KI-Gedächtnis</h1>
      <p class="mod-sub">Fakten und Zusammenhänge über dein Leben</p>
    </div>

    <div class="card" style="border-left:4px solid var(--gold)">
      <div style="font-size:12px; color:var(--txt3); text-transform:uppercase; margin-bottom:8px">Was die KI über dich weiß</div>
      <div id="kontext-dynamic-content" style="font-size:14px; line-height:1.6; color:var(--txt2); white-space:pre-wrap">
        Erzähle mir etwas über dein Business oder deinen Alltag, damit ich dich besser unterstützen kann.
      </div>
    </div>

    <!-- Historie -->
    <div class="stitle" style="margin-top:24px">Letzte Erkenntnisse</div>
    <div id="kontext-history-list"></div>

    <button class="btn btn-gold" style="width:100%; margin-top:24px; justify-content:center" onclick="SpracheUniversal.open()">🎙️ Neues hinzufügen</button>
  `;

  function init() {
    BSP.on('view:changed', ({ name }) => {
      if (name === 'archiv-kontext') {
        const v = document.getElementById('v-archiv-kontext');
        if (v) { v.innerHTML = VIEW_HTML; render(); }
      }
    });

    BSP.on('kontext:updated', () => {
      if (BSP.currentView === 'archiv-kontext') render();
    });
  }

  async function render() {
    const list = await BSP.dbGetAll('kontext');
    const historyEl = document.getElementById('kontext-history-list');
    const contentEl = document.getElementById('kontext-dynamic-content');
    
    if (!historyEl || !contentEl) return;

    if (!list.length) {
      historyEl.innerHTML = '<div class="empty">Noch keine Einträge.</div>';
      return;
    }

    const sorted = list.sort((a,b) => b.savedAt - a.savedAt);
    
    // Aktueller "Focus" (Zusammenfassung der letzten 5)
    contentEl.innerHTML = sorted.slice(0, 3).map(e => `• ${eh(e.text)}`).join('\n');

    historyEl.innerHTML = sorted.map(e => `
      <div class="ri" style="padding:12px">
        <div style="font-size:10px; color:var(--txt3); margin-bottom:4px">${BSP.fd(new Date(e.savedAt).toISOString().split('T')[0])}</div>
        <div style="font-size:13px; color:var(--txt2)">${eh(e.text)}</div>
      </div>
    `).join('');
  }

  return { init, render };

})();
ArchivKontext.init();
