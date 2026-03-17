// ══════════════════════════════════════════════════════════════
// MODUL: ARCHIV DOCUMENTS
// Verwaltung von Dokumenten, OCR und KI-Kategorisierung
// ══════════════════════════════════════════════════════════════
'use strict';

const ArchivDocs = (() => {

  const VIEW_HTML = `
    <div class="mod-header">
      <h1 class="mod-title">Dokumenten-Archiv</h1>
      <p class="mod-sub">Verträge, Briefe und Dokumente sicher verwahrt</p>
    </div>

    <!-- Upload/Scan Field -->
    <div class="card" style="border: 2px dashed var(--br); background:transparent; display:flex; flex-direction:column; align-items:center; padding:24px; gap:12px">
      <div style="font-size:32px">📂</div>
      <div style="font-size:14px; color:var(--txt2); text-align:center">Dokument hochladen oder scannen</div>
      <div style="display:flex; gap:8px">
        <button class="btn btn-gold btn-sm" onclick="ScannerModule.open()">📷 Scannen</button>
        <label class="btn btn-g btn-sm" style="cursor:pointer">
          📄 Datei <input type="file" accept="image/*,application/pdf" style="display:none" onchange="ArchivDocs.uploadFile(this)">
        </label>
      </div>
    </div>

    <!-- Kategorien -->
    <div style="display:flex; gap:8px; margin:16px 0; overflow-x:auto; padding-bottom:8px" id="arc-cat-tabs">
      <button class="btn btn-gold btn-sm" onclick="ArchivDocs.setCat('Alle')">Alle</button>
      <button class="btn btn-g btn-sm" onclick="ArchivDocs.setCat('Brief')">Briefe</button>
      <button class="btn btn-g btn-sm" onclick="ArchivDocs.setCat('Vertrag')">Verträge</button>
      <button class="btn btn-g btn-sm" onclick="ArchivDocs.setCat('Versicherung')">Versicherung</button>
      <button class="btn btn-g btn-sm" onclick="ArchivDocs.setCat('Amt')">Behörden</button>
    </div>

    <div id="archiv-list-container"></div>
  `;

  let _currentCat = 'Alle';

  function init() {
    BSP.on('view:changed', ({ name }) => {
      if (name === 'archiv-docs') {
        const v = document.getElementById('v-archiv-docs');
        if (v) { v.innerHTML = VIEW_HTML; renderList(); }
      }
    });
    
    // Bridge from Belege (Business/Privat)
    BSP.on('beleg:deleted', () => { if (BSP.currentView === 'archiv-docs') renderList(); });
  }

  function setCat(cat) {
    _currentCat = cat;
    renderList();
    // UI Update Tabs
    document.querySelectorAll('#arc-cat-tabs .btn').forEach(b => {
      b.classList.toggle('btn-gold', b.textContent === cat || (cat === 'Alle' && b.textContent === 'Alle'));
      b.classList.toggle('btn-g', b.textContent !== cat && !(cat === 'Alle' && b.textContent === 'Alle'));
    });
  }

  async function uploadFile(input) {
    const f = input.files[0];
    if (!f) return;
    
    BSP.toast('Analysiere Dokument... ⏳', 'ok');
    
    // In echten Szenarien würden wir hier OCR/Claude nutzen
    // Hier simulieren wir den Prozess
    const reader = new FileReader();
    reader.onload = async (e) => {
      const b64 = e.target.result;
      
      const doc = {
        name: f.name,
        date: new Date().toISOString().split('T')[0],
        type: 'archiv',
        category: 'Brief',
        image: b64,
        savedAt: Date.now()
      };
      
      await BSP.dbAdd('archiv_dokumente', doc);
      renderList();
      BSP.toast('Dokument archiviert ✓', 'ok');
    };
    reader.readAsDataURL(f);
  }

  async function renderList() {
    const container = document.getElementById('archiv-list-container');
    if (!container) return;

    const all = await BSP.dbGetAll('archiv_dokumente');
    const filtered = _currentCat === 'Alle' ? all : all.filter(d => d.category === _currentCat);

    if (!filtered.length) {
      container.innerHTML = '<div class="empty">Keine Dokumente im Archiv.</div>';
      return;
    }

    container.innerHTML = filtered.sort((a,b) => b.savedAt - a.savedAt).map(d => `
      <div class="ri" onclick="ArchivDocs.openDetail(${d.id})">
        <div class="ri-bar" style="background:var(--orn)"></div>
        <div class="ri-th">${d.image ? `<img src="${d.image}">` : '📄'}</div>
        <div class="ri-inf">
          <div class="ri-sh">${BSP.eh(d.name || 'Dokument')}</div>
          <div class="ri-me"><span>${BSP.fd(d.date)}</span> · <span>${d.category}</span></div>
        </div>
      </div>
    `).join('');
  }

  async function openDetail(id) {
    const d = await BSP.dbGet('archiv_dokumente', id);
    if (!d) return;

    const html = `
      <div class="sh"></div>
      <h2 class="mod-title" style="text-align:center">${BSP.eh(d.name)}</h2>
      <p class="mod-sub" style="text-align:center; margin-bottom:16px">${d.category} · Erfasst am ${BSP.fd(new Date(d.savedAt).toISOString().split('T')[0])}</p>
      
      <div class="card" style="padding:4px">
        <img src="${d.image}" style="width:100%; border-radius:var(--r12)">
      </div>

      <div class="g2 sett-mt">
        <button class="btn btn-red" style="justify-content:center" onclick="ArchivDocs.deleteDoc(${d.id})">Löschen</button>
        <button class="btn btn-gold" style="justify-content:center" onclick="ArchivDocs.generateAnswer(${d.id})">✍️ Antwort entwerfen</button>
      </div>

      <button class="btn btn-g" style="width:100%; margin-top:10px; justify-content:center" onclick="BSP.closeSheet()">Schließen</button>
    `;
    BSP.showSheet(html);
  }

  async function deleteDoc(id) {
    if (!confirm('Dokument wirklich löschen?')) return;
    await BSP.dbDel('archiv_dokumente', id);
    BSP.closeSheet();
    renderList();
    BSP.toast('Gelöscht', 'ok');
  }

  function generateAnswer(id) {
    BSP.closeSheet();
    BSP.showView('archiv-antwort', { docId: id });
  }

  return { init, setCat, uploadFile, renderList, openDetail, deleteDoc, generateAnswer };

})();
ArchivDocs.init();
