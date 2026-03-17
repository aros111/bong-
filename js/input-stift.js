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

        <div class="stitle">Oder Schnell-Erfassung</div>
        <div class="g2" style="margin-bottom:16px">
          <div class="field"><label>Händler</label><input type="text" id="stift-shop" placeholder="z.B. REWE"></div>
          <div class="field"><label>Betrag (€)</label><input type="number" id="stift-amount" placeholder="0,00" step="0.01"></div>
        </div>

        <div class="field" style="margin-bottom:24px">
          <label>Datum</label>
          <input type="date" id="stift-date">
        </div>

        <div style="display:flex; gap:12px">
          <button class="btn btn-g" style="flex:1" onclick="StiftModule.close()">Abbrechen</button>
          <button class="btn btn-gold" style="flex:2; justify-content:center" onclick="StiftModule.save()">
            💾 Speichern & KI-Analyse
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
    const shop = document.getElementById('stift-shop').value.trim();
    const amount = parseFloat(document.getElementById('stift-amount').value);
    const date = document.getElementById('stift-date').value;

    if (!text && !shop) {
      BSP.toast('Bitte Text oder Händler eingeben', 'wr');
      return;
    }

    BSP.toast('Verarbeite Eingabe...', 'info');

    // Wenn nur Text da ist -> KI Analyse
    let analysis = null;
    if (text) {
      analysis = await BSP.AI.process({
        task: 'beleg_analyse',
        text: text,
        context: BSP.getContext()
      });
    }

    const beleg = {
      id: 'B' + Date.now(),
      shop: shop || (analysis ? analysis.shop : 'Unbekannt'),
      amount: amount || (analysis ? analysis.amount : 0),
      date: date || (analysis ? analysis.date : new Date().toISOString().split('T')[0]),
      type: BSP.state.currentPillar === 'business' ? 'er' : 'priv',
      method: 'stift',
      text: text,
      tags: analysis ? analysis.tags : []
    };

    await BSP.saveBeleg(beleg);
    BSP.toast('Beleg gespeichert!', 'ok');
    close();
    BSP.showView('home');
  }

  return { init, open, close, save };

})();
