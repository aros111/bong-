// â–ˆâ–ˆ MODUL: SCANNER & KI-ERKENNUNG
// WHY: Claude Vision ist in 2-3 Sek fertig und erkennt auch
// Monitore, Dashboards und Screens sauber. Der erweiterte Prompt
// extrahiert zusÃ¤tzlich Garantie-relevante und Abo-Signale.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function openScanner(){document.getElementById('scanOvl').classList.add('on');setScanType(appMode==='priv'?'priv':'er');}
function closeScanner(){document.getElementById('scanOvl').classList.remove('on');stopCam();}
function closeScanOuter(e){if(e.target===document.getElementById('scanOvl'))closeScanner();}
function setScanType(t){
  scanType=t;
  // WHY: ER/AR/Manual Buttons toggeln
  ['er','ar','manual'].forEach(x=>{
    const el=document.getElementById('tt'+(x==='manual'?'Manual':x.toUpperCase()));
    if(el) el.className='seg-btn'+(t===x?' on':'');
  });
  const isPriv=t==='priv';
  const isManual=t==='manual';
  // Seg-Buttons und Privat-Hinweis je nach Modus ein/ausblenden
  const seg=document.getElementById('bizSeg');
  if(seg) seg.style.display=isPriv?'none':'grid';
  document.getElementById('bizFields').style.display=(isPriv||isManual)?'none':'grid';
  document.getElementById('privFields').style.display=isPriv?'grid':'none';
  document.getElementById('manualFields').style.display=isManual?'grid':'none';
  document.getElementById('privScanHint').style.display=isPriv?'block':'none';
  document.getElementById('camPH').style.display=(isManual||isPriv)?'none':'block';
  document.getElementById('camArea').style.display=(isManual||isPriv)?'none':'none'; // Versteckt wenn kein Bild
  document.getElementById('resWrap').style.display=isManual?'block':'none';
}

async function startCam(){
  try{
    camStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920}}});
    const v=document.getElementById('camStream');v.srcObject=camStream;v.style.display='block';
    document.getElementById('camArea').style.display='block';
    document.getElementById('camPH').style.display='none';
    document.getElementById('camCtrls').style.display='flex';
    document.getElementById('btnCap').disabled=false;
    document.getElementById('shutI').style.background='var(--txt)';
    document.getElementById('btnStop').style.display='inline-block';
    document.getElementById('vfOvl').style.display='block';
    document.getElementById('capImg').style.display='none';
  }catch(e){toast('Kamera nicht verfÃ¼gbar â€“ bitte Foto aus Galerie wÃ¤hlen','er');}
}
function stopCam(){
  if(camStream){camStream.getTracks().forEach(t=>t.stop());camStream=null;}
  const v=document.getElementById('camStream');v.style.display='none';v.srcObject=null;
  document.getElementById('btnCap').disabled=true;
  document.getElementById('shutI').style.background='var(--s3)';
  document.getElementById('btnStop').style.display='none';
  document.getElementById('camCtrls').style.display='none';
  document.getElementById('vfOvl').style.display='none';
  if(!capB64){
    document.getElementById('camArea').style.display='none';
    document.getElementById('camPH').style.display='block';
  }
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// â–ˆâ–ˆ MODUL: BILD-KOMPRIMIERUNG
// WHY: iPhone-Fotos sind 3â€“8 MB. Die Anthropic API hat ein
// Limit und groÃŸe Bilder sind langsam. Wir skalieren auf
// max. 1024px und komprimieren auf ~200KB JPEG.
// FÃ¼r die gespeicherte Vorschau: nochmal kleiner (400px/30KB).
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function compressImage(b64, maxPx, qualityStart) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'));
    img.onload = () => {
      // SeitenverhÃ¤ltnis behalten, lÃ¤ngste Seite = maxPx
      let w = img.width, h = img.height;
      if (!w || !h) { reject(new Error('Bild hat keine Dimensionen')); return; }
      if (w > maxPx || h > maxPx) {
        if (w > h) { h = Math.round(h * maxPx / w); w = maxPx; }
        else       { w = Math.round(w * maxPx / h); h = maxPx; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      // WeiÃŸen Hintergrund zeichnen (fÃ¼r PNGs mit Transparenz)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      // QualitÃ¤t schrittweise reduzieren bis < 200KB
      let q = qualityStart;
      let result;
      do {
        result = canvas.toDataURL('image/jpeg', q);
        q -= 0.05;
      } while (result.length > 200 * 1024 && q > 0.2);

      // Sicherheitscheck: leeres Canvas abfangen
      if (!result || result === 'data:,' || result.length < 100) {
        reject(new Error('Canvas ist leer â€“ Bild evtl. zu groÃŸ fÃ¼r Speicher'));
        return;
      }
      resolve(result);
    };
    img.src = b64;
  });
}

function captureCam(){
  const v=document.getElementById('camStream');
  const c=document.createElement('canvas');c.width=v.videoWidth||800;c.height=v.videoHeight||600;
  c.getContext('2d').drawImage(v,0,0);
  const raw=c.toDataURL('image/jpeg',.9);
  const im=document.getElementById('capImg');im.src=raw;im.style.display='block';
  v.style.display='none';stopCam();
  // Komprimieren dann verarbeiten
  compressImage(raw, 1024, 0.82).then(compressed => {
    capB64 = compressed;
    im.src = compressed;
    processImg(compressed);
  });
}

function loadFile(inp){
  const f=inp.files[0];if(!f)return;
  setLog('ðŸ—œï¸ Bild wird komprimiert â€¦');
  document.getElementById('progWrap').style.display='block';
  setP(10);
  const r=new FileReader();
  r.onload=async e=>{
    const raw = e.target.result;
    // Vorschau sofort anzeigen (unkomprimiert)
    const im=document.getElementById('capImg');
    im.src=raw; im.style.display='block';
    document.getElementById('camArea').style.display='block';
    document.getElementById('camPH').style.display='none';
    document.getElementById('camCtrls').style.display='none';
    stopCam();
    setP(25); setLog('ðŸ—œï¸ Komprimiere â€¦');
    // FÃ¼r API: auf 1024px / max ~200KB komprimieren
    const compressed = await compressImage(raw, 1024, 0.82);
    // FÃ¼r Speicherung: 800px Vorschau â€“ lesbar fÃ¼r Menschen, trotzdem klein
    const thumb = await compressImage(raw, 800, 0.82);
    capB64 = compressed;
    capThumb = thumb; // wird beim Speichern als image verwendet
    setP(40);
    const kb = Math.round(compressed.length * 3/4 / 1024);
    setLog(`âœ“ ${kb} KB â€“ wird analysiert â€¦`);
    processImg(compressed);
  };
  r.readAsDataURL(f);
}
function resetScan(){
  capB64=null;capThumb=null;curRes=null;
  document.getElementById('capImg').style.display='none';
  document.getElementById('camArea').style.display='none';
  document.getElementById('camPH').style.display='block';
  document.getElementById('camCtrls').style.display='none';
  document.getElementById('resWrap').classList.remove('on');
  document.getElementById('progWrap').style.display='none';
  document.getElementById('btnStop').style.display='none';
  // WHY: Items-Tabelle immer leeren â€“ sonst bleibt vorheriger Scan stehen
  const bd=document.getElementById('itemsB');if(bd)bd.innerHTML='';
  const sec=document.getElementById('itemsSec');if(sec)sec.style.display='none';
  // Privat-Felder auch leeren
  try{document.getElementById('pShop').value='';document.getElementById('pBrutto').value='';}catch(e){}
  // File-Inputs zurÃ¼cksetzen damit dasselbe Foto nochmal wÃ¤hlbar ist
  try{document.getElementById('fi').value='';document.getElementById('fiGal').value='';}catch(e){}
}
function setLog(m){document.getElementById('progLog').textContent=m;}
function setP(p){document.getElementById('progFill').style.width=p+'%';}

async function processImg(b64){
  // WHY: Key immer frisch lesen â€“ er kÃ¶nnte nach dem Seitenload gespeichert worden sein
  apiKey = localStorage.getItem('cak') || apiKey || '';

  // Nur anzeigen wenn noch nicht sichtbar (loadFile hat es evtl. schon gezeigt)
  document.getElementById('progWrap').style.display='block';
  document.getElementById('resWrap').classList.remove('on');

  // Sicherheitscheck: Base64 muss valide sein
  if(!b64 || b64 === 'data:,' || b64.length < 200){
    setLog('âŒ Bild ist leer oder beschÃ¤digt â€“ bitte nochmal aufnehmen.');
    setTimeout(()=>{document.getElementById('progWrap').style.display='none';},3000);
    return;
  }

  if(!apiKey){
    setLog('âš ï¸ Kein API Key â€“ Daten manuell eingeben oder Key in Settings hinterlegen.');
    setP(100);
    setTimeout(()=>{document.getElementById('progWrap').style.display='none';setP(0);},800);
    showManualForm();
    return;
  }

  try{
    setLog('ðŸ“¤ Bild wird gesendet â€¦'); setP(15);
    const res = await askClaude(b64);
    trackApiCost('scan', b64.length);
    setP(95); setLog('âœ“ Analyse abgeschlossen.');
    incrKiScans();
    curRes = res;
    showRes(res);
    setP(100);
    setTimeout(()=>{document.getElementById('progWrap').style.display='none';setP(0);}, 600);
  } catch(e) {
    setP(100);
    setLog('âŒ ' + (e.message || 'Unbekannter Fehler'));
    console.error('BelegScan KI-Fehler:', e);
    setTimeout(()=>{
      document.getElementById('progWrap').style.display='none';
      setP(0);
    }, 5000);
    showManualForm();
    toast(e.message || 'KI-Fehler â€“ Felder manuell ausfÃ¼llen', 'er');
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• 
// â–ˆâ–ˆ OFFLINE SYNC
// â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• 
window.addEventListener('online', async () => {
  try {
    const offlineScans = await dbOfflineScans();
    if (offlineScans.length > 0) {
      toast(offlineScans.length + ' Offline-Scans werden analysiert...', 'wr');
      for (const scan of offlineScans) {
        await processImg(scan.image, true);
        await dbDelOfflineScan(scan.id);
      }
      toast('Offline-Sync abgeschlossen.', 'ok');
    }
  } catch (e) {
    console.error('Offline Sync Error:', e);
  }
});
