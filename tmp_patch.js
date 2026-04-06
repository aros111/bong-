const fs = require('fs');
let code = fs.readFileSync('js/business/konto-import.js', 'utf8');

// 1. Inject Button
const targetBtn = `<button class="btn btn-g btn-sm" onclick="KontoImport.resumeCam()">📷 Kamera</button>`;
const newBtnHtml = targetBtn + `\n        <button class="btn btn-g btn-sm" onclick="KontoImport.showTextPrompt()">📝 Text einfügen</button>`;
code = code.replace(targetBtn, newBtnHtml);

// 2. Inject Text Prompt Overlay
const closingDivs = `<!-- Controls -->`;
const textOverlayHtml = `
    <!-- Text Prompt Overlay -->
    <div id="ko-text-prompt" style="display:none;position:absolute;inset:0;background:var(--bg);z-index:9005;flex-direction:column;padding:20px;">
        <h3 style="margin-bottom:10px;color:var(--gold)">Text einfügen</h3>
        <textarea id="ko-text-inp" style="flex:1;width:100%;background:var(--s1);color:var(--text);border:1px solid var(--br);border-radius:var(--r8);padding:10px;font-family:monospace;font-size:13px;" placeholder="Kopierte Umsätze hier einfügen..."></textarea>
        <div style="display:flex;gap:10px;margin-top:15px">
           <button class="btn btn-g" style="flex:1;justify-content:center" onclick="document.getElementById('ko-text-prompt').style.display='none'">Abbrechen</button>
           <button class="btn btn-gold" style="flex:1;justify-content:center" onclick="KontoImport.submitText()">Übernehmen</button>
        </div>
    </div>\n
    <!-- Controls -->`;
code = code.replace(closingDivs, textOverlayHtml);

// 3. Add JS functions
const processAllPagesStart = `  async function processAllPages() {`;
const textFuncs = `
  function showTextPrompt() {
    document.getElementById('ko-text-inp').value = '';
    document.getElementById('ko-text-prompt').style.display = 'flex';
  }

  function submitText() {
    const txt = document.getElementById('ko-text-inp').value.trim();
    if (!txt) {
       BSP.toast('Bitte Text eingeben', 'wr');
       return;
    }
    _pages.push({ isText: true, text: txt });
    document.getElementById('ko-text-prompt').style.display = 'none';
    _showMultiPrompt();
  }

  async function processAllPages() {`;
code = code.replace(processAllPagesStart, textFuncs);

// 4. Expose functions
const exportsLine = `return { startScan, handleUpload, closeScan, capturePage, resumeCam, processAllPages };`;
const newExports = `return { startScan, handleUpload, closeScan, capturePage, resumeCam, showTextPrompt, submitText, processAllPages };`;
code = code.replace(exportsLine, newExports);

// 5. Array modification
const arrayLoopOld = `         if (p.blob) contents.push(await _blobToB64(p.blob));
         else if (p.b64) contents.push(p.b64);`;
const arrayLoopNew = `         if (p.isText) contents.push({ type: 'text', text: p.text });
         else if (p.blob) contents.push(await _blobToB64(p.blob));
         else if (p.b64) contents.push(p.b64);`;
code = code.replace(arrayLoopOld, arrayLoopNew);

fs.writeFileSync('js/business/konto-import.js', code, 'utf8');
console.log('PATCHED');
