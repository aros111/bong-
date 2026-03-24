// ══════════════════════════════════════════════════════════════
// MODUL: ARCHIV-SCANNER
// Dokumentenerkennung (Brief, Rechnung, Vertrag, etc.)
// KI-Zusammenfassung & Handlungsbedarf
// ══════════════════════════════════════════════════════════════
'use strict';

const ArchivScanModule = (() => {

let _camStream = null;
let _pages = [];

const OVERLAY_HTML = `
<div style="min-height:100dvh; display:flex; flex-direction:column; background:var(--bg); max-width:600px; margin:0 auto; width:100%; position:relative;">
  <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 16px 12px; border-bottom:1px solid var(--br); background:var(--bg2); position:sticky; top:0; z-index:10;">
    <div style="font-size:16px;font-weight:600;color:var(--gold)">Archiv-Scan</div>
    <button onclick="ArchivScanModule.close()" style="background:var(--s3);border:1px solid var(--br);color:var(--txt2);width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center">×</button>
  </div>

  <div id="as-cam-wrap" style="flex:1; position:relative;background:var(--bg2);overflow:hidden;border-bottom:1px solid var(--br); display:flex; flex-direction:column; justify-content:center; min-height: 60vh;">
    <video id="as-video" autoplay playsinline muted style="width:100%; height:100%; display:none; object-fit:cover; position:absolute; inset:0;"></video>
    
    <div id="as-ph" style="display:flex;flex-direction:column;align-items:center;justify-content:center; flex:1; color:var(--txt2); gap:10px; z-index:2;">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="opacity:.6">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
      </svg>
      <div style="font-size:12px">Dokument für das Archiv scannen</div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn btn-gold btn-sm" onclick="ArchivScanModule.startCam()">📷 Kamera</button>
        <label class="btn btn-g btn-sm" style="cursor:pointer">
          🖼️ Galerie <input id="as-file" type="file" accept="image/*" style="display:none" onchange="ArchivScanModule.loadFile(this)">
        </label>
      </div>
    </div>
    
    <div id="as-cam-btns" style="display:none;position:absolute;bottom:20px;left:50%;transform:translateX(-50%);gap:12px;align-items:center; z-index:5;">
      <button class="btn btn-g btn-sm" style="background:rgba(0,0,0,0.6); color:#fff; border:none;" onclick="ArchivScanModule.stopCam()">⏹ Stopp</button>
      <button onclick="ArchivScanModule.capture()" style="width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,0.2);border:3px solid #fff;cursor:pointer; display:flex; justify-content:center; align-items:center;">
        <div style="width:50px;height:50px;border-radius:50%;background:#fff;"></div>
      </button>
    </div>
  </div>

  <div id="as-pages-preview" style="display:none;padding:12px 16px;background:var(--s2); border-bottom:1px solid var(--br); display:flex;gap:10px;overflow-x:auto"></div>

  <div id="as-multi-prompt" style="display:none;padding:16px;background:var(--bg3);border-bottom:1px solid var(--br);text-align:center">
    <div style="font-size:13px;margin-bottom:12px;color:var(--gold)">Seite hinzugefügt! Noch eine Seite?</div>
    <div style="display:flex;gap:12px;justify-content:center">
      <button class="btn btn-g btn-sm" onclick="ArchivScanModule.startCam()">➕ Mehr</button>
      <button class="btn btn-gold btn-sm" onclick="ArchivScanModule.finishCapture()">✨ Archivieren</button>
    </div>
  </div>

  <div id="as-prog-wrap" style="display:none;padding:16px">
    <div style="background:var(--s3);height:4px;border-radius:2px;overflow:hidden;margin-bottom:8px"><div id="as-prog-fill" style="height:100%;background:var(--gold);width:0%;transition:width 0.3s"></div></div>
    <div id="as-prog-log" style="font-size:12px;color:var(--txt3);text-align:center">Analysiere Dokument...</div>
  </div>

  <div id="as-res" style="display:none;padding:16px; flex:1;">
    <div class="field sett-mt"><label>Absender</label><input id="as-sender" class="sett-inp"></div>
    <div class="g2 sett-mt">
      <div class="field"><label>Datum</label><input id="as-date" class="sett-inp" type="date"></div>
      <div class="field"><label>Dokumenten-Typ</label>
        <select id="as-type" class="sett-inp">
          <option>Brief</option><option>Rechnung</option><option>Vertrag</option>
          <option>Behörde</option><option>Versicherung</option><option>Bank</option><option>Sonstiges</option>
        </select>
      </div>
    </div>
    <div class="field sett-mt"><label>KI-Zusammenfassung</label><textarea id="as-summary" class="sett-inp" rows="2" style="font-size:12px;resize:none"></textarea></div>
    <div class="field sett-mt" style="display:flex;align-items:center;gap:10px">
      <label style="margin:0">Handlungsbedarf?</label>
      <input type="checkbox" id="as-todo" style="width:20px;height:20px;accent-color:var(--gold)">
    </div>
    <div style="display:flex;gap:8px;margin-top:24px; padding-bottom: 24px;">
      <button class="btn btn-g" style="flex:.5" onclick="ArchivScanModule.reset()">↺ Neu</button>
      <button class="btn btn-gold" style="flex:1;justify-content:center" onclick="ArchivScanModule.save()">✓ Archivieren</button>
    </div>
  </div>
</div>
`;

function init() {
  const ovl = document.getElementById('scanner-overlay');
  if (ovl) {
    ovl.addEventListener('click', e => { if (e.target === ovl) close(); });
  }
}

function open() { 
  const ovl = document.getElementById('scanner-overlay');
  if (!ovl) return;
  ovl.innerHTML = OVERLAY_HTML;
  ovl.style.display = 'flex';
  reset(); 
  setTimeout(() => startCam(), 300);
}

function close() { 
  stopCam(); 
  const ovl = document.getElementById('scanner-overlay'); 
  if (ovl) { ovl.style.display = 'none'; ovl.innerHTML = ''; } 
}

async function startCam() {
  stopCam();
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("HTTPS_REQUIRED");
    }
    _camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const v = document.getElementById('as-video');
    if (v) { 
      v.srcObject = _camStream; 
      v.style.display = 'block'; 
      await v.play();
    }
    document.getElementById('as-ph').style.display = 'none';
    document.getElementById('as-cam-btns').style.display = 'flex';
    document.getElementById('as-multi-prompt').style.display = 'none';
  } catch(e) { 
    console.error(e);
    const msg = e.message === "HTTPS_REQUIRED" ? "Kamera blockiert (HTTPS nötig). Nutze Galerie!" : "Kamera-Zugriff verweigert.";
    BSP.toast(msg, 'er');
    document.getElementById('as-ph').style.display = 'flex';
  }
}

function stopCam() {
  if (_camStream) _camStream.getTracks().forEach(t => t.stop());
  _camStream = null;
  const v = document.getElementById('as-video'); if (v) v.style.display = 'none';
  const btns = document.getElementById('as-cam-btns');
  if (btns) btns.style.display = 'none';
}

async function capture() {
  const v = document.getElementById('as-video');
  const c = document.createElement('canvas');
  c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext('2d').drawImage(v, 0, 0);
  const raw = c.toDataURL('image/jpeg', 0.82);
  stopCam();
  try {
    const compressed = await BSP.compressImage(raw, 600, 100);
    const thumbStr = await BSP.compressImage(compressed, 300, 40);
    const blob = BSP.b64toBlob(thumbStr);
    const url = URL.createObjectURL(blob);
    _pages.push({ b64: compressed, thumb: url, url: url });
    _updateUI();
    document.getElementById('as-multi-prompt').style.display = 'block';
  } catch(e) { BSP.toast(e.message, 'er'); }
}

function _updateUI() {
  const container = document.getElementById('as-pages-preview');
  container.style.display = _pages.length ? 'flex' : 'none';
  container.innerHTML = _pages.map((p, i) => `<div style="position:relative;width:60px;height:80px;flex-shrink:0;border:1px solid var(--br);border-radius:4px;overflow:hidden"><img src="${p.thumb}" style="width:100%;height:100%;object-fit:cover"><div onclick="ArchivScanModule.removePage(${i})" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.6);color:#fff;width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;cursor:pointer">×</div></div>`).join('');
}

function removePage(i) {
  if (_pages[i] && _pages[i].url) URL.revokeObjectURL(_pages[i].url);
  _pages.splice(i, 1);
  _updateUI();
  if (!_pages.length) reset();
}

function finishCapture() { document.getElementById('as-multi-prompt').style.display = 'none'; _analyze(); }

async function _analyze() {
  document.getElementById('as-prog-wrap').style.display = 'block';
  _setP(40);
  const prompt = `Analysiere dieses Dokument (${_pages.length} Seiten).
  Extrahiere: sender, date (YYYY-MM-DD), type (Brief, Rechnung, Vertrag, Behörde, Versicherung, Bank, Sonstiges), summary (ein prägnanter Satz), todo (boolean - gibt es eine Frist oder Handlungsbedarf?).
  Antworte NUR mit JSON: {"sender": "...", "date": "...", "type": "...", "summary": "...", "todo": true/false}`;

  try {
    const res = await BSP.callClaude({ prompt, images: _pages.map(p => p.b64) });
    const json = JSON.parse(res.match(/\{[\s\S]*\}/)[0]);
    document.getElementById('as-sender').value = json.sender;
    document.getElementById('as-date').value = json.date;
    document.getElementById('as-type').value = json.type;
    document.getElementById('as-summary').value = json.summary;
    document.getElementById('as-todo').checked = json.todo;
    document.getElementById('as-res').style.display = 'block';
    _setP(100);
    setTimeout(() => document.getElementById('as-prog-wrap').style.display = 'none', 600);
  } catch(e) { 
    BSP.toast('Fehler bei Analyse', 'er');
    document.getElementById('as-res').style.display = 'block';
  }
}

async function loadFile(inp) {
  const f = inp.files[0]; if (!f) return;
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const compressed = await BSP.compressImage(e.target.result, 600, 100);
      const thumbStr = await BSP.compressImage(compressed, 300, 40);
      const blob = BSP.b64toBlob(thumbStr);
      const url = URL.createObjectURL(blob);
      _pages.push({ b64: compressed, thumb: url, url: url });
      _updateUI();
      document.getElementById('as-multi-prompt').style.display = 'block';
      document.getElementById('as-ph').style.display = 'none';
    } catch(err) { BSP.toast(err.message, 'er'); }
  };
  reader.readAsDataURL(f);
}

async function save() {
  const item = {
    sender: document.getElementById('as-sender').value,
    date: document.getElementById('as-date').value,
    type: document.getElementById('as-type').value,
    summary: document.getElementById('as-summary').value,
    todo: document.getElementById('as-todo').checked,
    images: _pages.map(p => p.b64),
    savedAt: Date.now()
  };
  try {
    await BSP.dbAdd('archiv_dokumente', item);
    BSP.emit('archiv:saved', item);
    BSP.toast('Dokument archiviert✓', 'ok');
    close();
  } catch (err) {
    BSP.toast('Fehler beim Speichern: ' + err.message, 'er');
  }
}

function reset() {
  if (_pages) _pages.forEach(p => { if (p.url) URL.revokeObjectURL(p.url); });
  _pages = [];
  document.getElementById('as-res').style.display = 'none';
  document.getElementById('as-ph').style.display = 'flex';
  document.getElementById('as-pages-preview').style.display = 'none';
  document.getElementById('as-multi-prompt').style.display = 'none';
  _setP(0);
}

function _setP(p) { document.getElementById('as-prog-fill').style.width = p + '%'; }

return { init, open, close, startCam, stopCam, capture, loadFile, removePage, finishCapture, save, reset };

})();

BSP.on('core:ready', () => ArchivScanModule.init());
