// ══════════════════════════════════════════════════════════════
// MODUL: PRIVAT-SCANNER
// Foto-Scan für private Belege – Mehrseiten-Funktion & PDF-Import
// Keine Stempelung – Speichert in privat_belege
// ══════════════════════════════════════════════════════════════
'use strict';

const PrivatScanModule = (() => {

let _camStream = null;
let _pages = []; // {b64, thumb}
let _lastResult = null;

const OVERLAY_HTML = `
<div style="min-height:100dvh; display:flex; flex-direction:column; background:var(--bg); max-width:600px; margin:0 auto; width:100%; position:relative;">
  <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 16px 12px; border-bottom:1px solid var(--br); background:var(--bg2); position:sticky; top:0; z-index:10;">
    <div style="font-size:16px;font-weight:600;color:var(--gold)">Privat-Scan</div>
    <button onclick="PrivatScanModule.close()" style="background:var(--s3);border:1px solid var(--br);color:var(--txt2);width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center">×</button>
  </div>

  <div id="ps-cam-wrap" style="flex:1; position:relative;background:var(--bg2);overflow:hidden;border-bottom:1px solid var(--br); display:flex; flex-direction:column; justify-content:center; min-height: 60vh;">
    <video id="ps-video" autoplay playsinline muted style="width:100%; height:100%; display:none; object-fit:cover; position:absolute; inset:0;"></video>
    <img id="ps-preview" style="width:100%; height:100%; display:none; object-fit:contain; background:var(--bg3); position:absolute; inset:0;">
    
    <div id="ps-ph" style="display:flex;flex-direction:column;align-items:center;justify-content:center; flex:1; color:var(--txt2); gap:10px; z-index:2;">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="opacity:.6">
        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
        <circle cx="12" cy="13" r="4"/>
      </svg>
      <div style="font-size:12px">Privaten Beleg erfassen</div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn btn-gold btn-sm" onclick="PrivatScanModule.startCam()">📷 Kamera</button>
        <label class="btn btn-g btn-sm" style="cursor:pointer">
          🖼️ Galerie <input id="ps-file" type="file" accept="image/*" style="display:none" onchange="PrivatScanModule.loadFile(this)">
        </label>
      </div>
    </div>

    <div id="ps-cam-btns" style="display:none;position:absolute;bottom:20px;left:50%;transform:translateX(-50%);gap:12px;align-items:center; z-index:5;">
      <button class="btn btn-g btn-sm" style="background:rgba(0,0,0,0.6); color:#fff; border:none;" onclick="PrivatScanModule.stopCam()">⏹ Stopp</button>
      <button onclick="PrivatScanModule.capture()" style="width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,0.2);border:3px solid #fff;cursor:pointer; display:flex; justify-content:center; align-items:center;">
        <div style="width:50px;height:50px;border-radius:50%;background:#fff;"></div>
      </button>
    </div>
  </div>

  <div id="ps-pages-preview" style="display:none;padding:12px 16px;background:var(--s2); border-bottom:1px solid var(--br); display:flex;gap:10px;overflow-x:auto"></div>

  <div id="ps-multi-prompt" style="display:none;padding:16px;background:var(--bg3);border-bottom:1px solid var(--br);text-align:center">
    <div style="font-size:13px;margin-bottom:12px;color:var(--gold)">Seite hinzugefügt! Noch eine Seite?</div>
    <div style="display:flex;gap:12px;justify-content:center">
      <button class="btn btn-g btn-sm" onclick="PrivatScanModule.startCam()">➕ Ja</button>
      <button class="btn btn-gold btn-sm" onclick="PrivatScanModule.finishCapture()">✨ Auswerten</button>
    </div>
  </div>

  <div id="ps-prog-wrap" style="display:none;padding:16px">
    <div style="background:var(--s3);height:4px;border-radius:2px;overflow:hidden;margin-bottom:8px"><div id="ps-prog-fill" style="height:100%;background:var(--gold);width:0%;transition:width 0.3s"></div></div>
    <div id="ps-prog-log" style="font-size:12px;color:var(--txt3);text-align:center">Bereit</div>
  </div>

  <div id="ps-res" style="display:none;padding:16px; flex:1;">
    <div class="g2 sett-mt">
      <div class="field"><label>Händler</label><input id="ps-shop" class="sett-inp"></div>
      <div class="field"><label>Datum</label><input id="ps-date" class="sett-inp" type="date"></div>
    </div>
    <div class="g2 sett-mt">
      <div class="field"><label>Brutto (€)</label><input id="ps-brutto" class="sett-inp" type="text" inputmode="decimal"></div>
      <div class="field"><label>Kategorie</label>
        <select id="ps-cat" class="sett-inp">
          <option>Lebensmittel</option><option>Restaurant</option><option>Elektronik</option>
          <option>Kleidung</option><option>Tanken</option><option>Haushalt</option>
          <option>Gesundheit</option><option>Freizeit</option><option>Reise</option><option>Sonstiges</option>
        </select>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:24px; padding-bottom: 24px;">
      <button class="btn btn-g" style="flex:.5" onclick="PrivatScanModule.reset()">↺ Neu</button>
      <button class="btn btn-gold" style="flex:1;justify-content:center" onclick="PrivatScanModule.save()">✓ Speichern</button>
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
    const v = document.getElementById('ps-video');
    if (v) { 
      v.srcObject = _camStream; 
      v.style.display = 'block'; 
      await v.play();
    }
    document.getElementById('ps-ph').style.display = 'none';
    document.getElementById('ps-cam-btns').style.display = 'flex';
    document.getElementById('ps-preview').style.display = 'none';
    document.getElementById('ps-multi-prompt').style.display = 'none';
  } catch(e) { 
    console.error(e);
    const msg = e.message === "HTTPS_REQUIRED" ? "Kamera blockiert (HTTPS nötig). Nutze Galerie!" : "Kamera-Zugriff verweigert.";
    BSP.toast(msg, 'er');
    document.getElementById('ps-ph').style.display = 'flex'; 
  }
}

function stopCam() {
  if (_camStream) _camStream.getTracks().forEach(t => t.stop());
  _camStream = null;
  const v = document.getElementById('ps-video');
  if (v) v.style.display = 'none';
  const btns = document.getElementById('ps-cam-btns');
  if (btns) btns.style.display = 'none';
}

async function capture() {
  const v = document.getElementById('ps-video');
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
    document.getElementById('ps-multi-prompt').style.display = 'block';
  } catch(e) { BSP.toast(e.message, 'er'); }
}

function _updateUI() {
  const container = document.getElementById('ps-pages-preview');
  container.style.display = _pages.length ? 'flex' : 'none';
  container.innerHTML = _pages.map((p, i) => `
    <div style="position:relative;width:60px;height:80px;flex-shrink:0;border:1px solid var(--br);overflow:hidden;border-radius:4px">
      <img src="${p.thumb}" style="width:100%;height:100%;object-fit:cover">
      <div onclick="PrivatScanModule.removePage(${i})" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.6);color:#fff;width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;cursor:pointer">×</div>
    </div>`).join('');
}

function removePage(i) {
  if (_pages[i] && _pages[i].url) URL.revokeObjectURL(_pages[i].url);
  _pages.splice(i, 1);
  _updateUI();
  if (!_pages.length) reset();
}

function finishCapture() {
  document.getElementById('ps-multi-prompt').style.display = 'none';
  _analyze();
}

async function _analyze() {
  if (!_pages.length) return;
  document.getElementById('ps-prog-wrap').style.display = 'block';
  _setLog('KI analysiert private Ausgaben...');
  _setP(40);

  const prompt = `DU bist ein privater Beleg-Assistent. Analysiere diese ${_pages.length} Seite(n).
  Extrahiere: shop, date (YYYY-MM-DD), brutto, category (Lebensmittel, Restaurant, Elektronik, Kleidung, Tanken, Haushalt, Gesundheit, Freizeit, Reise, Sonstiges).
  Antworte NUR mit JSON: {"shop": "...", "date": "...", "brutto": 12.34, "category": "..."}`;

  try {
    const res = await BSP.callClaude({ prompt, images: _pages.map(p => p.b64) });
    const json = JSON.parse(res.match(/\{[\s\S]*\}/)[0]);
    _lastResult = json;
    
    document.getElementById('ps-shop').value = json.shop;
    document.getElementById('ps-date').value = json.date;
    document.getElementById('ps-brutto').value = json.brutto;
    document.getElementById('ps-cat').value = json.category;
    
    document.getElementById('ps-res').style.display = 'block';
    _setP(100);
    setTimeout(() => document.getElementById('ps-prog-wrap').style.display = 'none', 600);
  } catch(e) { 
    BSP.toast('Analyse fehlgeschlagen', 'er');
    document.getElementById('ps-res').style.display = 'block';
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
      document.getElementById('ps-multi-prompt').style.display = 'block';
      document.getElementById('ps-ph').style.display = 'none';
    } catch(err) { BSP.toast(err.message, 'er'); }
  };
  reader.readAsDataURL(f);
}

async function save() {
  const shop = document.getElementById('ps-shop').value;
  const brutto = parseFloat(document.getElementById('ps-brutto').value.replace(',','.'));
  if (!shop || !brutto) return BSP.toast('Daten unvollständig', 'wr');

  const item = {
    type: 'priv',
    shop,
    date: document.getElementById('ps-date').value,
    brutto,
    cat: document.getElementById('ps-cat').value,
    images: _pages.map(p => p.b64),
    image: _pages[0].b64,
    savedAt: Date.now()
  };

  try {
    await BSP.dbAdd('privat_belege', item);
    BSP.emit('privat:saved', item);
    BSP.toast('Privater Beleg gespeichert✓', 'ok');
    close();
  } catch (err) {
    BSP.toast('Fehler beim Speichern: ' + err.message, 'er');
  }
}

function reset() {
  if (_pages) _pages.forEach(p => { if (p.url) URL.revokeObjectURL(p.url); });
  _pages = []; _lastResult = null;
  document.getElementById('ps-res').style.display = 'none';
  document.getElementById('ps-ph').style.display = 'flex';
  document.getElementById('ps-preview').style.display = 'none';
  document.getElementById('ps-pages-preview').style.display = 'none';
  document.getElementById('ps-multi-prompt').style.display = 'none';
  _setP(0);
}

function _setLog(m) { document.getElementById('ps-prog-log').textContent = m; }
function _setP(p) { document.getElementById('ps-prog-fill').style.width = p + '%'; }

// ── Vorbefüllung von KI ───────────────────────────────────────
function prefillFromAI(parsed) {
  open(); // Öffnet Privat Scanner Overlay
  stopCam(); // Kamera stoppen
  document.getElementById('ps-res').style.display = 'block'; // Formular anzeigen
  document.getElementById('ps-cam-btns').style.display = 'none';
  document.getElementById('ps-ph').style.display = 'none';
  
  const setF = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (val) {
      el.value = val;
      el.style.backgroundColor = '';
    } else {
      el.value = '';
      el.style.backgroundColor = 'rgba(255, 200, 0, 0.2)'; // gelb markiert falls leer
    }
  };
  
  setF('ps-shop', parsed.shop);
  setF('ps-date', parsed.date);
  setF('ps-brutto', parsed.brutto);
  
  if(parsed.category) {
     const catEl = document.getElementById('ps-cat');
     if(catEl) {
        const found = [...catEl.options].find(o => o.text.includes(parsed.category) || parsed.category.includes(o.text));
        if (found) { catEl.value = found.value; catEl.style.backgroundColor = ''; }
        else catEl.style.backgroundColor = 'rgba(255, 200, 0, 0.2)';
     }
  }
}

return { init, open, close, startCam, stopCam, capture, loadFile, removePage, finishCapture, save, reset, prefillFromAI };

})();

BSP.on('core:ready', () => PrivatScanModule.init());
