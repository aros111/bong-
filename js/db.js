// ██ MODUL: DATENBANK (IndexedDB)
// WHY: Alles lokal. Keine Cloud, keine Kosten für den Nutzer.
// ════════════════════════════════════════════════════════
let db;
function initDB(){
  return new Promise((res,rej)=>{
    const r=indexedDB.open('bsp7',3); // Version erhöht für neue Stores
    r.onupgradeneeded=e=>{
      const d=e.target.result;
      if(!d.objectStoreNames.contains('b')){
        const s=d.createObjectStore('b',{keyPath:'id',autoIncrement:true});
        s.createIndex('date','date');s.createIndex('type','type');
        s.createIndex('shop','shop');
      }
      if(!d.objectStoreNames.contains('banks')){
        d.createObjectStore('banks',{keyPath:'id',autoIncrement:true});
      }
      if(!d.objectStoreNames.contains('kontoBuchungen')){
        const s=d.createObjectStore('kontoBuchungen',{keyPath:'id'});
        s.createIndex('bankId','bankId');
        s.createIndex('datum','datum');
      }
    };
    r.onsuccess=e=>{db=e.target.result;res();};r.onerror=()=>rej(r.error);
  });
}
// ── VALIDIERUNG ──
function validateBeleg(it) {
  if (!it || typeof it !== 'object') throw new Error('Ungültiges Beleg-Datenformat');
  if (!['er', 'ar', 'priv'].includes(it.type)) throw new Error('Ungültiger Beleg-Typ');
  
  // Pflichfelder formatieren & prüfen
  it.shop = String(it.shop || 'Unbekannt').trim();
  it.date = String(it.date || new Date().toISOString().split('T')[0]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(it.date)) it.date = new Date().toISOString().split('T')[0];
  
  // Beträge bereinigen
  it.brutto = parseFloat(it.brutto) || 0;
  
  if (it.type === 'priv') {
    it.net = null;
    it.mwst = null;
    it.mwstRate = null;
    it.belegNr = null;
  } else {
    it.net = parseFloat(it.net) || 0;
    it.mwst = parseFloat(it.mwst) || 0;
    it.mwstRate = parseFloat(it.mwstRate) || 0;
    it.belegNr = String(it.belegNr || '').trim();
  }
  
  // Arrays sichern
  it.items = Array.isArray(it.items) ? it.items : [];
  it.savedAt = it.savedAt || Date.now();
  
  return it;
}

const dba=()=>new Promise((res,rej)=>{const r=db.transaction('b','readonly').objectStore('b').getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej();});
const dbadd=it=>new Promise((res,rej)=>{
  try { it = validateBeleg(it); } catch(e) { return rej(e); }
  const r=db.transaction('b','readwrite').objectStore('b').add(it);
  r.onsuccess=()=>res(r.result);r.onerror=()=>rej();
});
const dbput=it=>new Promise((res,rej)=>{
  try { it = validateBeleg(it); } catch(e) { return rej(e); }
  const r=db.transaction('b','readwrite').objectStore('b').put(it);
  r.onsuccess=()=>res(r.result);r.onerror=()=>rej();
});
const dbdel=id=>new Promise((res,rej)=>{const r=db.transaction('b','readwrite').objectStore('b').delete(id);r.onsuccess=()=>res();r.onerror=()=>rej();});

// Bank-Funktionen
const dbBanks=()=>new Promise((res,rej)=>{const r=db.transaction('banks','readonly').objectStore('banks').getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej();});
const dbAddBank=bank=>new Promise((res,rej)=>{const r=db.transaction('banks','readwrite').objectStore('banks').add(bank);r.onsuccess=()=>res(r.result);r.onerror=()=>rej();});
const dbDelBank=id=>new Promise((res,rej)=>{const r=db.transaction('banks','readwrite').objectStore('banks').delete(id);r.onsuccess=()=>res();r.onerror=()=>rej();});

// Kontobuchungen-Funktionen
const dbKontoBuchungen=()=>new Promise((res,rej)=>{const r=db.transaction('kontoBuchungen','readonly').objectStore('kontoBuchungen').getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej();});
const dbAddKontoBuchung=buchung=>new Promise((res,rej)=>{const r=db.transaction('kontoBuchungen','readwrite').objectStore('kontoBuchungen').add(buchung);r.onsuccess=()=>res(r.result);r.onerror=()=>rej();});
const dbDelKontoBuchung=id=>new Promise((res,rej)=>{const r=db.transaction('kontoBuchungen','readwrite').objectStore('kontoBuchungen').delete(id);r.onsuccess=()=>res();r.onerror=()=>rej();});

// ════════════════════════════════════════════════════════
// ██ MODUL: BELEG SPEICHERN
// ════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════
// ██ MODUL: DUPLIKATSPRÜFUNG & UNGEREIMTHEITEN
// ════════════════════════════════════════════════════════
async function checkForDuplicates() {
  const all = await dba();
  const duplicates = [];
  
  if (scanType === 'priv') {
    const shop = document.getElementById('pShop').value || '';
    const brutto = parseFloat(document.getElementById('pBrutto').value) || 0;
    const date = document.getElementById('pDate').value || '';
    
    // Prüfe auf ähnliche Belege
    all.filter(b => b.type === 'priv').forEach(b => {
      let score = 0;
      if (b.shop && shop && b.shop.toLowerCase().includes(shop.toLowerCase().substring(0, 3))) score += 1;
      if (Math.abs((b.brutto || 0) - brutto) <= 1) score += 1;
      if (b.date === date) score += 1;
      if (score >= 2) duplicates.push(b);
    });
  } else {
    const shop = document.getElementById('rShop').value || '';
    const brutto = parseFloat(document.getElementById('rBrutto').value) || 0;
    const belegNr = curRes?.belegNr || '';
    
    // Prüfe auf Duplikate basierend auf Rechnungsnummer, Preis, Anbieter
    all.filter(b => b.type !== 'priv').forEach(b => {
      let score = 0;
      if (b.belegNr && belegNr && b.belegNr === belegNr) score += 2;
      if (b.shop && shop && b.shop.toLowerCase().includes(shop.toLowerCase().substring(0, 3))) score += 1;
      if (Math.abs((b.brutto || 0) - brutto) <= 1) score += 1;
      if (score >= 2) duplicates.push(b);
    });
  }
  
  return duplicates;
}

async function askUserAboutDuplicates(duplicates) {
  return new Promise(resolve => {
    const msg = `Mögliche Duplikate gefunden:\n${duplicates.map(d => `- ${d.shop} (${fm(d.brutto || 0)} €, ${fd(d.date)}, ${d.belegNr || 'Keine Nr.'})`).join('\n')}\n\nWie möchtest du den Beleg ablegen?`;
    const choice = prompt(msg + '\n\n1: Als neuen Beleg speichern\n2: Abbrechen und bearbeiten\n\nGib 1 oder 2 ein:');
    if (choice === '1') {
      resolve(true); // Speichern
    } else {
      resolve(false); // Abbrechen
    }
  });
}

// Liste von Institutionen/Keywords, die typischerweise keine MwSt berechnen
const MWST_FREE_KEYWORDS = [
  'finanzamt', 'finanzbehörde', 'bundesamt', 'landesamt', 'stadt', 'gemeinde', 'behörde',
  'arzt', 'zahnarzt', 'klinik', 'krankenhaus', 'apotheke', 'therapeut', 'psychologe',
  'schule', 'universität', 'bildungseinrichtung', 'kindergarten',
  'kirche', 'stiftung', 'verein', 'verband',
  'versicherung', 'bank', 'sparkasse', 'post', 'telekom'
];

function isMwstFreeInstitution(shop) {
  if (!shop) return false;
  const lowerShop = shop.toLowerCase();
  return MWST_FREE_KEYWORDS.some(keyword => lowerShop.includes(keyword));
}

function checkForIssues() {
  const issues = [];
  
  if (scanType !== 'priv') {
    const shop = document.getElementById('rShop').value || '';
    const brutto = parseFloat(document.getElementById('rBrutto').value) || 0;
    const mwst = parseFloat(document.getElementById('rMwst').value) || 0;
    const net = parseFloat(document.getElementById('rNet').value) || 0;
    const rate = parseFloat(document.getElementById('rRate').value) || cfg().mwstH;
    
    // Prüfe auf MwSt-freie Institutionen
    if (isMwstFreeInstitution(shop) && mwst > 0) {
      issues.push('Institution berechnet typischerweise keine MwSt – bitte prüfen');
    }
    
    // Prüfe MwSt-Berechnung
    const expectedNet = brutto / (1 + rate / 100);
    const expectedMwst = brutto - expectedNet;
    if (Math.abs(net - expectedNet) > 0.1) issues.push('Nettobetrag passt nicht zur MwSt-Berechnung');
    if (Math.abs(mwst - expectedMwst) > 0.1) issues.push('MwSt-Betrag passt nicht zur Berechnung');
    
    // Prüfe auf ungewöhnliche Werte
    if (brutto > 10000) issues.push('Sehr hoher Betrag – bitte prüfen');
    if (rate !== cfg().mwstH && rate !== cfg().mwstL && !isMwstFreeInstitution(shop)) issues.push('Ungewöhnlicher MwSt-Satz');
  } else {
    const brutto = parseFloat(document.getElementById('pBrutto').value) || 0;
    if (brutto > 5000) issues.push('Sehr hoher privater Betrag – bitte prüfen');
  }
  
  return issues;
}

async function askUserAboutIssues(issues) {
  return new Promise(resolve => {
    const msg = `Ungereimtheiten gefunden:\n${issues.map(i => `- ${i}`).join('\n')}\n\nTrotzdem buchen?`;
    const choice = confirm(msg + '\n\nOK: Ja, trotzdem speichern\nAbbrechen: Bearbeiten');
    resolve(choice);
  });
}

async function saveBeleg(){
  // ── DUPLIKATSPRÜFUNG ──
  const duplicates = await checkForDuplicates();
  if (duplicates.length > 0) {
    const confirmed = await askUserAboutDuplicates(duplicates);
    if (!confirmed) return; // Abbruch, wenn Nutzer nicht bestätigt
  }

  // ── UNGEREIMTHEITEN PRÜFEN ──
  const issues = checkForIssues();
  if (issues.length > 0) {
    const confirmed = await askUserAboutIssues(issues);
    if (!confirmed) return; // Abbruch bei Ungereimtheiten
  }

  // ── BESTIMME ZIEL-TYP UND QUELLE ──
  let targetType = scanType;
  let sShop, sDate, sBrutto, sNet, sMwst, sRate, sCat, sPay;

  if (scanType === 'manual') {
    // Wenn 'manual' gewählt (oder nach KI-Scan in Manual gewechselt)
    // Ziel: abhängig davon ob Nutzer gerade im Privat- oder Business-Modus ist
    targetType = appMode === 'priv' ? 'priv' : 'er'; 
    sShop = document.getElementById('mShop').value || 'Unbekannt';
    sDate = document.getElementById('mDate').value || new Date().toISOString().split('T')[0];
    sBrutto = parseFloat(document.getElementById('mBrutto').value) || 0;
    sNet = parseFloat(document.getElementById('mNet').value) || 0;
    sMwst = parseFloat(document.getElementById('mMwst').value) || 0;
    sRate = parseFloat(document.getElementById('mRate').value) || cfg().mwstH;
    sCat = document.getElementById('mCat').value;
    sPay = document.getElementById('mPay').value;
  } else if (scanType === 'priv') {
    targetType = 'priv';
    sShop = document.getElementById('pShop').value || 'Unbekannt';
    sDate = document.getElementById('pDate').value || new Date().toISOString().split('T')[0];
    sBrutto = parseFloat(document.getElementById('pBrutto').value) || 0;
    sNet = null; sMwst = null; sRate = null;
    sCat = document.getElementById('pCat').value;
    sPay = document.getElementById('pPay').value;
  } else {
    // Business (er / ar) via Standard-Felder (falls die direkt genutzt würden)
    targetType = scanType;
    sShop = document.getElementById('rShop').value || 'Unbekannt';
    sDate = document.getElementById('rDate').value || new Date().toISOString().split('T')[0];
    sBrutto = parseFloat(document.getElementById('rBrutto').value) || 0;
    sNet = parseFloat(document.getElementById('rNet').value) || 0;
    sMwst = parseFloat(document.getElementById('rMwst').value) || 0;
    sRate = parseFloat(document.getElementById('rRate').value) || cfg().mwstH;
    sCat = document.getElementById('rCat').value;
    sPay = document.getElementById('rPay').value;
  }

  // ── PRIVAT-BELEG: Logik ──
  if (targetType === 'priv') {
    const item = {
      type: 'priv',
      belegNr: null,  // Privat-Belege bekommen KEINE Nummer
      shop: sShop,
      date: sDate,
      brutto: sBrutto,
      net: null, mwst: null, mwstRate: null,
      cat: sCat,
      payment: sPay,
      items: curRes?.items || [],
      image: capThumb || capB64,
      savedAt: Date.now(),
      istAbo: curRes?.istAbo || false,
      garantieBis: null,
      isDigitalScreen: curRes?.isDigitalScreen || false,
      screenType: curRes?.screenType || null
    };
    try {
      await dbadd(item);
      toast('Privat-Beleg gespeichert ✓', 'ok');
      closeScanner(); resetScan(); renderHome();
    } catch (e) { toast('Fehler: ' + e.message, 'er'); }
    return;
  }

  // ── BUSINESS-BELEG (er/ar): bisherige Logik ──
  const brutto = sBrutto;
  let mwst = sMwst;
  let net = sNet;
  let mwstRate = sRate;

  // ── REVERSE CHARGE BEHANDLUNG ──
  const shop = sShop;
  const isRC = targetType === 'er' && isReverseCharge({shop});
  if (isRC) {
    // Bei Reverse Charge: MwSt selbst berechnen (19% auf Brutto), unabhängig von ausgewiesener MwSt
    mwst = Math.round(brutto * 0.19 * 100) / 100;
    net = brutto - mwst;
    mwstRate = 19;
    // UI aktualisieren
    document.getElementById('rNet').value = net.toFixed(2);
    document.getElementById('rMwst').value = mwst.toFixed(2);
    document.getElementById('rRate').value = '19';
    toast('Reverse Charge erkannt – MwSt selbst berechnet (19%)', 'wr');
  } else if (targetType === 'er' && mwst === 0) {
    // MwSt nicht ausgewiesen - normale Berechnung
    if (net > 0 && brutto > 0) {
      // Netto und Brutto gegeben - MwSt = Brutto - Netto
      mwst = brutto - net;
    } else if (brutto > 0) {
      // Nur Brutto gegeben - MwSt berechnen aus Rate
      mwst = Math.round(brutto / (1 + mwstRate / 100) * (mwstRate / 100) * 100) / 100;
      net = brutto - mwst;
      // UI aktualisieren
      document.getElementById('rNet').value = net.toFixed(2);
      document.getElementById('rMwst').value = mwst.toFixed(2);
    }
    toast('MwSt nicht ausgewiesen – automatisch berechnet', 'wr');
  }

  let nr;
  if (targetType === 'ar' && curRes?.belegNrExtern) {
    nr = curRes.belegNrExtern; arC++; localStorage.setItem('arc', arC);
  } else { nr = nextNr(targetType); }

  let garantieBis=null;
  if(curRes?.garantieMonate&&sDate){
    const kauf=new Date(sDate+'T00:00:00');
    kauf.setMonth(kauf.getMonth()+curRes.garantieMonate);
    garantieBis=kauf.toISOString().split('T')[0];
  }

  const item={type:targetType,belegNr:nr,
    shop:sShop,
    date:sDate,
    net,mwst,brutto,
    mwstRate,
    cat:sCat,payment:sPay,
    items:curRes?.items||[],image:capThumb||capB64,savedAt:Date.now(),
    istAbo:curRes?.istAbo||false,
    garantieBis,
    isDigitalScreen:curRes?.isDigitalScreen||false,
    screenType:curRes?.screenType||null
  };
  try{
    await dbadd(item);
    toast(nr+' gespeichert ✓','ok');
    closeScanner();resetScan();updCounters();renderHome();
    // WHY: MwSt-Tab sofort aktuell halten – egal ob gerade geöffnet oder nicht
    if(appMode==='biz') renderMwst();
    if(kiScanCount===10) triggerBong('10 KI-Scans geschafft – du hast bereits ~19 Minuten Lebenszeit gespart.','milestone');
    if(brutto>=500&&targetType==='er'){const vstRueck=(item.mwst||0);if(vstRueck>=50)triggerBong(`${fm(vstRueck)} € Vorsteuer aus diesem Beleg zurückholen – fällig in der nächsten Voranmeldung.`,'vorsteuer');}
    // WHY: Wenn der Scan aus dem Konto-Tab kam (fehlende Beleg), den neuen Beleg direkt zuordnen
    if(_aktiverKontoBuchungId){
      try{
        const alle = await dbKontoBuchungen();
        const buchung = alle.find(x => String(x.id) === String(_aktiverKontoBuchungId));
        if(buchung){
          await dbAddKontoBuchung({...buchung,
            belegStatus: 'bestaetigt',
            vorschlagBelegNr: nr,
            vorschlagBelegShop: item.shop
          });
          await dbDelKontoBuchung(buchung.id);
          toast('Beleg automatisch zugeordnet ✓', 'ok');
        }
      }catch(_){}
      _aktiverKontoBuchungId = null;
    }
  }catch(e){toast('Fehler: '+e.message,'er');}
}

// ════════════════════════════════════════════════════════

// Offline Scans
const dbOfflineScans=()=>new Promise((res,rej)=>{const r=db.transaction('offlineScans','readonly').objectStore('offlineScans').getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej();});
const dbAddOfflineScan=scan=>new Promise((res,rej)=>{const r=db.transaction('offlineScans','readwrite').objectStore('offlineScans').add(scan);r.onsuccess=()=>res(r.result);r.onerror=()=>rej();});
const dbDelOfflineScan=id=>new Promise((res,rej)=>{const r=db.transaction('offlineScans','readwrite').objectStore('offlineScans').delete(id);r.onsuccess=()=>res();r.onerror=()=>rej();});
