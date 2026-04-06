// ══════════════════════════════════════════════════════════════
// MODUL: ARCHIV ANTWORT
// KI-Unterstützung für das Beantworten von Dokumenten
// ══════════════════════════════════════════════════════════════
'use strict';

const ArchivAntwort = (() => {

  const VIEW_HTML = `
    <div class="mod-header">
      <h1 class="mod-title">KI-Schreibassistent</h1>
      <p class="mod-sub">Formale Antworten basierend auf Dokumenten</p>
    </div>

    <div class="card" id="aa-context-info" style="display:none; border-left:4px solid var(--gold)">
      <div style="font-size:11px; color:var(--txt3); text-transform:uppercase">Bezug auf Dokument</div>
      <div id="aa-doc-name" style="font-size:14px; color:var(--txt2); margin-top:4px">...</div>
    </div>

    <!-- AI Prompt -->
    <div class="card">
      <div class="stitle">Was möchtest du antworten?</div>
      <textarea id="aa-input" class="sett-inp" style="height:120px; resize:none" placeholder="z.B. Ich möchte den Vertrag zum nächstmöglichen Termin kündigen und um eine Bestätigung bitten."></textarea>
      
      <div class="field sett-mt"><label>Tonfall</label>
        <select id="aa-tone" class="sett-inp">
          <option value="formal">Höflich & Formal</option>
          <option value="direkt">Direkt & Bestimmt</option>
          <option value="anfrage">Unverbindliche Anfrage</option>
        </select>
      </div>

      <button class="btn btn-gold" style="width:100%; margin-top:16px; justify-content:center" onclick="ArchivAntwort.generate()">
        ✨ Entwurf generieren
      </button>
    </div>

    <!-- Ergebnis -->
    <div id="aa-result-wrap" style="display:none">
      <div class="card">
        <div class="stitle">Entwurf</div>
        <div id="aa-result" style="font-size:14px; line-height:1.6; white-space:pre-wrap; font-weight:200; color:var(--txt2)"></div>
      </div>
      <div class="g2" style="padding:0 16px 16px">
        <button class="btn btn-g" style="justify-content:center" onclick="ArchivAntwort.copy()">📋 Kopieren</button>
        <button class="btn btn-gold" style="justify-content:center" onclick="ArchivAntwort.share()">📤 Teilen</button>
      </div>
    </div>
  `;

  let _activeDocId = null;

  function init() {
    BSP.on('view:changed', ({ name, params }) => {
      if (name === 'archiv-antwort') {
        const v = document.getElementById('v-archiv-antwort');
        if (v) { 
          v.innerHTML = VIEW_HTML; 
          _activeDocId = params?.docId || null;
          loadDocState();
        }
      }
    });
  }

  async function loadDocState() {
    if (!_activeDocId) return;
    const doc = await BSP.dbGet('archiv_dokumente', _activeDocId);
    if (!doc) return;
    
    document.getElementById('aa-context-info').style.display = 'block';
    document.getElementById('aa-doc-name').textContent = doc.name;
  }

  async function generate() {
    const userInput = document.getElementById('aa-input').value.trim();
    const tone = document.getElementById('aa-tone').value;
    
    if (!userInput) return BSP.toast('Bitte gib an, was du schreiben möchtest.', 'wr');

    BSP.toast('KI schreibt... ✍️', 'ok');
    const resultWrap = document.getElementById('aa-result-wrap');
    const resultEl = document.getElementById('aa-result');
    
    try {
      let context = "";
      if (_activeDocId) {
        const doc = await BSP.dbGet('archiv_dokumente', _activeDocId);
        context = `BEZUGSDOKUMENT: ${doc.name}\n`;
      }

      const prompt = `Du bist ein professioneller Schreibassistent für einen deutschen Freelancer. 
      Erstelle einen formalen Antwort-Entwurf (E-Mail oder Brief) basierend auf diesen Angaben:
      ${context}
      INHALT: ${userInput}
      TONFALL: ${tone}

      REGELN:
      1. Verwende Platzhalter wie [Name], [Datum] falls nötig.
      2. Sei präzise und professionell.
      3. Gib NUR den fertigen Text zurück, ohne Kommentare oder Einleitungen.`;

      const draft = await BSP.ask({ prompt, model: 'claude-sonnet-4-5' });
      
      resultEl.textContent = draft;
      resultWrap.style.display = 'block';
      resultWrap.scrollIntoView({ behavior: 'smooth' });
    } catch(e) {
      BSP.toast('Fehler beim Generieren.', 'er');
    }
  }

  function copy() {
    const text = document.getElementById('aa-result').innerText;
    navigator.clipboard.writeText(text);
    BSP.toast('Kopiert ✓', 'ok');
  }

  function share() {
    const text = document.getElementById('aa-result').innerText;
    if (navigator.share) {
      navigator.share({ title: 'Antwort-Entwurf', text });
    } else {
      copy();
    }
  }

  return { init, generate, copy, share };

})();
ArchivAntwort.init();
