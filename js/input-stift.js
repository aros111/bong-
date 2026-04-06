// ══════════════════════════════════════════════════════════════
// MODUL: STIFT (v2.1)
// Manuelle Eingabe, Copy-Paste & Text-Import
// ══════════════════════════════════════════════════════════════
'use strict';

const StiftModule = (() => {

  const VIEW_HTML = `
    <div class="ovl" id="stift-ovl">
      <div class="sheet">
        <div class="sh"></div>
        <div class="mod-header">
          <h1 class="mod-title">Manuelle Eingabe</h1>
          <p class="mod-sub">Text einfügen oder Beleg manuell erfassen</p>
        </div>

        <div class="field" style="margin-bottom:16px">
          <label>Belegtext / Notiz</label>
          <textarea id="stift-text" placeholder="Inhalt hier einfügen oder tippen..." style="height:150px; font-family:'DM Mono',monospace; font-size:13px"></textarea>
        </div>

        <div style="display:flex; gap:12px">
          <button class="btn btn-g" style="flex:1" onclick="StiftModule.close()">Abbrechen</button>
          <button class="btn btn-gold" style="flex:2; justify-content:center" onclick="StiftModule.save()">
            🕵️ KI-Analyse
          </button>
        </div>
      </div>
    </div>
  `;

  function init() {
    if (!document.getElementById('v-stift')) {
      const div = document.createElement('div');
      div.id = 'v-stift';
      div.innerHTML = VIEW_HTML;
      document.body.appendChild(div);
    }
    // Setze heute als Standarddatum
    const d = document.getElementById('stift-date');
    if (d) d.value = new Date().toISOString().split('T')[0];
  }

  function open() {
    document.getElementById('stift-ovl').classList.add('on');
    document.getElementById('stift-text').focus();
  }

  function close() {
    document.getElementById('stift-ovl').classList.remove('on');
    // Felder leeren
    ['stift-text', 'stift-shop', 'stift-amount'].forEach(id => {
      document.getElementById(id).value = '';
    });
  }

  async function save() {
    const text = document.getElementById('stift-text').value.trim();
    if (!text) {
      BSP.toast('Bitte Text eingeben', 'wr');
      return;
    }

    BSP.toast('Verarbeite Eingabe...', 'info');
    close();

    const modus = BSP.state.currentPillar === 'privat' ? 'privat' : 'business';
    await BSP.analysiereEingabeText(text, modus);
  }

  return { init, open, close, save };

})();
