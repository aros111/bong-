// ██ MODUL: POTENTIAL-RING
// WHY: Das visuelle Zentrum der App. Je nach Modus und Nutzertyp
// zeigt er die relevanteste Zahl – kein verschwendeter Platz.
// Business+MwSt-Pflicht → Tage bis Voranmeldung
// Business+KU → Umsatz-% bis zur Grenze
// Privat → Optimierbares Geld in Prozent genutzt
// ════════════════════════════════════════════════════════
async function updateRing(){
  const circ=358.14;
  const rf=document.getElementById('ringF');

  if(appMode==='priv'){
    // PRIVAT-MODUS: Ring zeigt Abo-Last vs. erkanntes Sparpotential
    // WHY: Statt Steuerfrist sieht der Nutzer wieviel "totes Geld" er ausgibt
    const all=await dba();
    const abos=detectAbos(all);
    const totalAbo=abos.reduce((s,a)=>s+a.monatlich,0);
    // Sparpotential: Abos mit nur 1 Vorkommen im letzten Jahr (vergessene Abos)
    const potential=abos.filter(a=>a.count<=2).reduce((s,a)=>s+a.monatlich,0);
    const pct=totalAbo>0?Math.min(1,potential/totalAbo):0;
    const col=pct>.5?'var(--red)':pct>.2?'var(--orn)':'var(--silv)';
    rf.style.stroke=col;
    rf.style.strokeDashoffset=circ*(1-pct);
    document.getElementById('ringBig').textContent=fm(Math.round(potential));
    document.getElementById('ringBig').style.color=col;
    document.getElementById('ringTag').textContent='€/Mon sparen';
    document.getElementById('ringSub').textContent=abos.length+' Abos erkannt · '+abos.filter(a=>a.count<=2).length+' selten genutzt';
    document.getElementById('ringDate').textContent='Abo-Gesamtlast: '+fm(totalAbo)+' €/Mon';
    // Privat-Hero updaten
    document.getElementById('heroPrivVal').textContent=fm(potential*12)+' '+cfg().currency;
    document.getElementById('heroPrivSub').textContent=`${abos.filter(a=>a.count<=2).length} Abos selten genutzt – mögliche Jahrersparnis`;
    document.getElementById('heroPriv').className='hero priv';
    // Insight-Banner wenn Sparpotential > 0
    renderInsightBanner(abos,potential);
    return;
  }

  // BUSINESS-MODUS
  rf.style.stroke='var(--gold)';
  if(profile.typ==='ku'){
    // KU-Umsatzwächter
    const all=await dba(),now=new Date();
    const yr=all.filter(b=>b.type==='ar'&&b.date&&new Date(b.date+'T00:00:00').getFullYear()===now.getFullYear());
    const umsatz=yr.reduce((s,b)=>s+(b.brutto||0),0);
    const limit=cfg().kuLimit;
    const pct=Math.min(1,umsatz/limit);
    let col;if(pct>=.9)col='var(--red)';else if(pct>=.75)col='var(--orn)';else col='var(--grn)';
    rf.style.stroke=col;rf.style.strokeDashoffset=circ*(1-pct);
    document.getElementById('ringBig').textContent=Math.round(pct*100)+'%';
    document.getElementById('ringBig').style.color=col;
    document.getElementById('ringTag').textContent='Umsatz';
    const rest=Math.max(0,limit-umsatz);
    document.getElementById('ringSub').textContent='Noch '+fmK(rest)+' '+cfg().currency+' bis MwSt-Pflicht';
    document.getElementById('ringDate').textContent=`Grenze: ${fmK(limit)} ${cfg().currency}`;
    document.getElementById('kuBarWrap').style.display='block';
    document.getElementById('kuBarFill').style.width=Math.round(pct*100)+'%';
    document.getElementById('kuBarFill').style.background=col;
    document.getElementById('kuBarLeft').textContent='Umsatz '+fmK(umsatz)+' '+cfg().currency;
    document.getElementById('kuBarRight').textContent='Grenze '+fmK(limit);
    if(pct>=.9){document.getElementById('kuBarHint').textContent='⚠️ MwSt-Pflichtgrenze fast erreicht! Steuerberater kontaktieren.';document.getElementById('kuBarHint').style.color='var(--red)';}
    else if(pct>=.75){document.getElementById('kuBarHint').textContent='Noch '+fmK(rest)+' '+cfg().currency+' Puffer – plane voraus.';document.getElementById('kuBarHint').style.color='var(--orn)';}
    else{document.getElementById('kuBarHint').textContent='Noch '+fmK(rest)+' '+cfg().currency+' Puffer.';document.getElementById('kuBarHint').style.color='var(--txt3)';}
    document.getElementById('heroLbl').textContent='Einnahmen dieses Jahr';
    document.getElementById('heroCols').style.display='none';
    document.getElementById('heroVal').textContent=fmK(umsatz)+' '+cfg().currency;
    document.getElementById('heroVal').style.color='var(--ylw)';
    document.getElementById('heroCard').className='hero ku';
  } else {
    // MwSt-Voranmeldungs-Frist
    document.getElementById('kuBarWrap').style.display='none';
    document.getElementById('heroCols').style.display='flex';
    const now=new Date(),y=now.getFullYear(),m=now.getMonth();
    const deadline=new Date(y,m+1,10);
    const dLeft=Math.max(0,Math.ceil((deadline-now)/(864e5)));
    const dPer=new Date(y,m+1,0).getDate()+10;
    const pct=Math.max(0,Math.min(1,(dPer-dLeft)/dPer));
    let col;if(dLeft<=3)col='var(--red)';else if(dLeft<=7)col='var(--orn)';else col='var(--grn)';
    rf.style.stroke=col;rf.style.strokeDashoffset=circ*(1-pct);
    document.getElementById('ringBig').textContent=dLeft;
    document.getElementById('ringBig').style.color=col;
    document.getElementById('ringTag').textContent='Tage';
    document.getElementById('ringSub').textContent=cfg().steuerLabel+'-Voranmeldung bis';
    document.getElementById('ringDate').textContent=deadline.toLocaleDateString('de-DE',{day:'2-digit',month:'long',year:'numeric'});
  }
}

// ════════════════════════════════════════════════════════
// ██ MODUL: EFFIZIENZ-TACHO
// WHY: Macht den ROI der KI-Nutzung transparent.
// Formel aus der Spezifikation:
//   Zeit_manuell (120s) - Zeit_KI (5s) = 115s pro Scan gespart
//   Steuerberater: ~150€/h = 0,0417€/s → gespart: 115s × 0,0417€ = ~4,80€ pro Scan
// Der Tacho zählt alle KI-Scans und rechnet hoch.
// ════════════════════════════════════════════════════════

// Konstanten für die Berechnung (aus Master-Spezifikation)
const SECS_MANUELL  = 120;  // Sekunden für manuelle Eingabe
const SECS_KI       = 5;    // Sekunden für KI-Scan
const SECS_GESPART  = SECS_MANUELL - SECS_KI; // = 115s pro Scan
const STBR_PRO_STD  = 150;  // Steuerberater-Stundenhonorar (DACH-Durchschnitt)
const STBR_PRO_SEK  = STBR_PRO_STD / 3600;    // = ~0,0417€ pro Sekunde

// KI-Scan-Zähler aus localStorage (wird bei jedem erfolgreichen Scan erhöht)
let kiScanCount = parseInt(localStorage.getItem('kiScans') || '0');

function incrKiScans() {
  // WHY: Nur zählen wenn wirklich die KI gearbeitet hat (nicht manuell)
  kiScanCount++;
  localStorage.setItem('kiScans', kiScanCount);
}

function renderTacho() {
  // Gesparte Zeit: Anzahl KI-Scans × 115 Sekunden
  const sekundenGespart = kiScanCount * SECS_GESPART;
  const minutenGespart  = Math.round(sekundenGespart / 60);

  // Gesparte Kosten vs. Steuerberater
  const euroGespart = kiScanCount * SECS_GESPART * STBR_PRO_SEK;

  // Darstellung: unter 60min = "X Min", darüber = "X Std"
  const zeitText = minutenGespart < 60
    ? minutenGespart + ' Min'
    : (minutenGespart / 60).toFixed(1) + ' Std';

  document.getElementById('tachoScans').textContent = kiScanCount;
  document.getElementById('tachoZeit').textContent  = zeitText;
  document.getElementById('tachoGeld').textContent  = fmK(Math.round(euroGespart)) + ' €';

  // Tacho nur anzeigen wenn mindestens 1 Scan gemacht wurde
  // WHY: Leere Nullen wären kein motivierendes Bild
  document.getElementById('tachoCard').style.display = kiScanCount > 0 ? 'block' : 'none';
}

// ════════════════════════════════════════════════════════
// ██ MODUL: PROGRESSIONS-SCHUTZ
// WHY: Warnt proaktiv bevor der Nutzer in die nächste
// Steuerprogression rutscht. Gibt konkreten Investitions-Tipp
// damit er jetzt noch handeln kann.
// Steuerstufen DE nach §32a EStG (zu versteuerndes Einkommen):
//   0-11.604€ = 0%, 11.605-17.005€ = 14-24%, 17.006-66.760€ = 24-42%
//   66.761-277.825€ = 42%, >277.825€ = 45%
// ════════════════════════════════════════════════════════
async function renderProgressionsSchutz() {
  const banner = document.getElementById('progSchutzBanner');

  // Berechne aktuellen Jahresgewinn (Einnahmen minus Ausgaben)
  const all  = await dba();
  const now  = new Date();
  const ar   = all.filter(b => b.type === 'ar' && b.date && new Date(b.date + 'T00:00:00').getFullYear() === now.getFullYear());
  const er   = all.filter(b => b.type === 'er' && b.date && new Date(b.date + 'T00:00:00').getFullYear() === now.getFullYear());
  const ein  = ar.reduce((s, b) => s + (b.net || 0), 0);
  const ausg = er.reduce((s, b) => s + (b.net || 0), 0);
  const gewinn = Math.max(0, ein - ausg);

  // Grundfreibetrag abziehen → zu versteuerndes Einkommen
  const grundFB = 11604;
  const zvE = Math.max(0, gewinn - grundFB);

  // Stufengrenzen (zvE-Werte) und Warnschwellen
  // WHY: Wir warnen wenn man innerhalb 5.000€ einer Stufengrenze ist
  const stufen = [
    { grenze: 17005,   rate: 24, naechste: 42, label: '24–42 %' },
    { grenze: 66760,   rate: 42, naechste: 45, label: '42 %'    },
    { grenze: 277825,  rate: 45, naechste: 45, label: '45 %'    },
  ];
  const WARN_ABSTAND = 5000; // Warnen wenn noch <5.000€ bis zur nächsten Stufe

  let gefunden = null;
  for (const s of stufen) {
    const abstand = s.grenze - zvE;
    if (abstand > 0 && abstand < WARN_ABSTAND) {
      gefunden = { ...s, abstand: Math.round(abstand), zvE: Math.round(zvE) };
      break;
    }
  }

  if (!gefunden) { banner.style.display = 'none'; return; }

  // Investitions-Tipp: Steuer-optimale Ausgaben die jetzt noch Sinn ergeben
  // WHY: Konkreter Tipp > abstrakte Warnung. Nutzer weiß was er tun soll.
  const tipps = [
    'Laptop oder externes Display kaufen',
    'Software-Lizenzen für das nächste Jahr voraus bezahlen',
    'Fachliteratur und Weiterbildung buchen',
    'Büromöbel oder Ergonomie-Ausstattung anschaffen',
    'Reparaturen und Wartung jetzt durchführen lassen',
  ];
  const tipp = tipps[Math.floor(zvE / 1000) % tipps.length];

  banner.style.display = 'block';
  banner.innerHTML = `<div class="prog-schutz">
    <div class="head">⚠️ Progressions-Warnung: Noch ${fmK(gefunden.abstand)} € Puffer</div>
    <div class="body">
      Du nähert dich dem ${gefunden.label}-Steuersatz. Jeder weitere Euro Gewinn
      kostet dich dann bis zu <strong style="color:var(--orn)">${gefunden.naechste} Cent Steuern</strong>.
      <br><br>
      Aktuelles zvE: <span class="mono" style="color:var(--txt)">${fmK(gefunden.zvE)} €</span> ·
      Stufengrenze: <span class="mono" style="color:var(--orn)">${fmK(gefunden.grenze)} €</span>
    </div>
    <div class="tipp">
      💡 <strong style="font-weight:300">Investitions-Tipp:</strong> ${tipp} –
      das senkt deinen Gewinn und hält dich in der günstigeren Steuerzone.
      Als Betriebsausgabe 100% absetzbar.
    </div>
  </div>`;

  // WHY: Progressions-Warnung = echter Aha-Moment = Bong-Trigger
  triggerBong(
    `Du nähert dich dem ${gefunden.label}-Steuersatz. Noch ${fmK(gefunden.abstand)} € Puffer.`,
    'progression'
  );
}

// ════════════════════════════════════════════════════════
// ██ MODUL: BONG-BUTTON
// WHY: Erscheint NICHT ständig. Nur nach echten "Aha-Momenten":
// - Großer Steuerspar-Tipp wurde angezeigt
// - KU-Grenze sicher unterschritten (Nutzer ist safe)
// - Meilenstein erreicht (z.B. 10. Scan)
// Der Nutzer sieht die Live-Kalkulation: Trinkgeld ist fast gratis
// weil 100% absetzbar + MwSt-Rückerstattung.
// ════════════════════════════════════════════════════════

// Verhindert Spam: Bong nur 1x alle 24h zeigen
function canShowBong() {
  const last = parseInt(localStorage.getItem('bongLast') || '0');
  return Date.now() - last > 24 * 60 * 60 * 1000; // 24 Stunden
}

function triggerBong(kontext, trigger) {
  // WHY: Nur zeigen wenn es sich wirklich lohnt und kein Spam
  if (!canShowBong()) return;
  if (!kontext) return;

  localStorage.setItem('bongLast', Date.now());
  localStorage.setItem('bongKontext', kontext);

  const wrap = document.getElementById('bongWrap');
  const sub  = document.getElementById('bongSubText');
  sub.textContent = kontext;
  wrap.style.display = 'block';

  // Auto-hide nach 8 Sekunden wenn nicht angeklickt
  setTimeout(() => {
    if (wrap.style.display !== 'none') wrap.style.display = 'none';
  }, 8000);
}

function closeBong(e) {
  e.stopPropagation();
  document.getElementById('bongWrap').style.display = 'none';
}

function openBongSheet() {
  document.getElementById('bongWrap').style.display = 'none';
  const ctx = localStorage.getItem('bongKontext') || '';
  document.getElementById('bongSheetCtx').textContent = ctx;
  document.getElementById('bongAmount').value = '';
  document.getElementById('bongCalc').textContent = 'Betrag eingeben um Effektivkosten zu sehen.';
  document.getElementById('bongOvl').classList.add('on');
}
function closeBongSheet() { document.getElementById('bongOvl').classList.remove('on'); }
function closeBongOuter(e) { if (e.target === document.getElementById('bongOvl')) closeBongSheet(); }

function calcBongLive() {
  // WHY: Live-Kalkulation zeigt dem Nutzer die tatsächlichen Netto-Kosten
  // nach Steuerersparnis. Das Finanzamt "zahlt" einen Teil mit.
  const betrag = parseFloat(document.getElementById('bongAmount').value) || 0;
  if (betrag <= 0) {
    document.getElementById('bongCalc').textContent = 'Betrag eingeben um Effektivkosten zu sehen.';
    return;
  }

  const mwstSatz  = cfg().mwstH / 100;                      // z.B. 0.19
  const netto     = betrag / (1 + mwstSatz);                 // Netto-Betrag
  const mwstBet   = betrag - netto;                          // MwSt-Anteil
  const steuersatz = 0.35;                                   // Annahme: ~35% ESt+Soli
  const ersparnis = netto * steuersatz;                      // Steuerersparnis durch Abzug
  const vstRueck  = profile.typ !== 'ku' ? mwstBet : 0;     // Vorsteuer nur wenn MwSt-pflichtig
  const effektiv  = betrag - ersparnis - vstRueck;           // Echte Kosten nach allem

  const c = document.getElementById('bongCalc');
  c.innerHTML = `
    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
      <span style="color:var(--txt3)">Brutto-Betrag</span>
      <span class="mono">${fm(betrag)} €</span>
    </div>
    ${profile.typ !== 'ku' ? `<div style="display:flex;justify-content:space-between;margin-bottom:4px">
      <span style="color:var(--txt3)">− Vorsteuer (${cfg().mwstH}%)</span>
      <span class="mono" style="color:var(--grn)">−${fm(vstRueck)} €</span>
    </div>` : ''}
    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
      <span style="color:var(--txt3)">− ESt-Ersparnis (~35%)</span>
      <span class="mono" style="color:var(--grn)">−${fm(ersparnis)} €</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid var(--br);margin-top:4px">
      <span style="color:var(--txt)">Effektivkosten für dich</span>
      <span class="mono" style="color:var(--gold);font-size:16px">${fm(Math.max(0, effektiv))} €</span>
    </div>
    <div style="font-size:10px;color:var(--txt3);margin-top:6px;line-height:1.5">
      Das Finanzamt trägt ${fm(ersparnis + vstRueck)} € (${Math.round((ersparnis + vstRueck) / betrag * 100)}%) mit.
    </div>`;

  // Update Zahlungslink mit Betrag
  document.getElementById('bongPayLink').textContent = `→ ${fm(betrag)} € senden`;
}


// ════════════════════════════════════════════════════════
// ██ MODUL: HOME RENDER
// ════════════════════════════════════════════════════════
async function renderHome(){
  renderTacho(); // WHY: Synchron – sofort sichtbar, kein DB-Wait nötig
  // WHY: try/catch damit ein Fehler hier nicht die ganze Home-View blockiert
  try { await renderProgressionsSchutz(); } catch(e) { console.warn('ProgSchutz:', e); }

  await updateRing();
  const all=await dba(),now=new Date();
  const yr=all.filter(b=>b.date&&new Date(b.date+'T00:00:00').getFullYear()===now.getFullYear());
  const ar=yr.filter(b=>b.type==='ar'),er=yr.filter(b=>b.type==='er');
  const arM=ar.reduce((s,b)=>s+(b.mwst||0),0),erM=er.reduce((s,b)=>s+(b.mwst||0),0),saldo=arM-erM;
  const umsatz=ar.reduce((s,b)=>s+(b.brutto||0),0),ausg=er.reduce((s,b)=>s+(b.brutto||0),0);
  if(profile.typ!=='ku'&&appMode==='biz'){
    const hc=document.getElementById('heroCard'),hv=document.getElementById('heroVal');
    document.getElementById('heroLbl').textContent='Aktueller '+cfg().steuerLabel+'-Stand';
    if(saldo>=0){hc.className='hero zl';document.getElementById('saldoLbl').textContent='Zahllast';document.getElementById('hSaldo').style.color='var(--red)';}
    else{hc.className='hero ex';document.getElementById('saldoLbl').textContent='Erstattung';document.getElementById('hSaldo').style.color='var(--grn)';}
    hv.textContent=fm(Math.abs(saldo))+' '+cfg().currency;hv.style.color='';
    document.getElementById('hAR').textContent=fm(arM)+' '+cfg().currency;
    document.getElementById('hER').textContent=fm(erM)+' '+cfg().currency;
    document.getElementById('hSaldo').textContent=fm(Math.abs(saldo))+' '+cfg().currency;
    const tot=arM+erM;
    document.getElementById('hbA').style.width=(tot>0?Math.round(arM/tot*100):50)+'%';
    document.getElementById('hbE').style.width=(tot>0?Math.round(erM/tot*100):50)+'%';
  }
  document.getElementById('qsU').textContent=fmK(umsatz)+' '+cfg().currency;document.getElementById('qsUc').textContent=ar.length+' Rechnungen';
  document.getElementById('qsA').textContent=fmK(ausg)+' '+cfg().currency;document.getElementById('qsAc').textContent=er.length+' Belege';

  // Intelligenz-Layer rendern
  await renderGarantieWaechter(all);
  await renderAboDetektiv(all);

  // Recent list – WHY: Je nach Modus nur passende Belege zeigen
  const sortedAll=[...all].sort((a,b)=>(b.savedAt||0)-(a.savedAt||0));
  const sorted=appMode==='priv'
    ? sortedAll.filter(b=>b.type==='priv').slice(0,6)
    : sortedAll.filter(b=>b.type!=='priv').slice(0,6);

  // WHY: Im Privat-Modus Gesamtübersicht auf Home
  {
    let phEl=document.getElementById('privHomeTotal');
    if(appMode==='priv'){
      const privAll=all.filter(b=>b.type==='priv');
      const privTotal=privAll.reduce((s,b)=>s+(b.brutto||0),0);
      const mo=String(new Date().getMonth()+1).padStart(2,'0');
      const thisMonth=privAll.filter(b=>(b.date||'').substring(5,7)===mo);
      const monthTotal=thisMonth.reduce((s,b)=>s+(b.brutto||0),0);
      const rlp2=document.getElementById('recentList');
      if(!phEl&&rlp2){phEl=document.createElement('div');phEl.id='privHomeTotal';phEl.style.cssText='background:rgba(136,153,170,.06);border:1px solid rgba(136,153,170,.18);border-radius:var(--r12);padding:14px 16px;margin-bottom:14px';rlp2.parentNode.insertBefore(phEl,rlp2);}
      if(phEl){phEl.style.display='block';phEl.innerHTML='<div style="display:flex;justify-content:space-between;align-items:flex-end"><div><div style="font-size:10px;font-weight:300;color:var(--txt3);letter-spacing:.4px;text-transform:uppercase;margin-bottom:4px">Gesamt Privatausgaben</div><div style="font-size:28px;font-weight:200;color:var(--silv)">'+fm(privTotal)+' €</div><div style="font-size:11px;font-weight:300;color:var(--txt3);margin-top:2px">'+privAll.length+' Belege</div></div><div style="text-align:right"><div style="font-size:10px;font-weight:300;color:var(--txt3);margin-bottom:4px">Dieser Monat</div><div style="font-size:18px;font-weight:200;color:var(--silv)">'+fm(monthTotal)+' €</div><div style="font-size:11px;font-weight:300;color:var(--txt3);margin-top:2px">'+thisMonth.length+' Belege</div></div></div>';}
    } else if(phEl){phEl.style.display='none';}
  }

  const rl=document.getElementById('recentList');
  if(!sorted.length){rl.innerHTML='<div class="empty"><p>Noch keine Belege.<br>Tippe auf den Scanner-Button.</p></div>';return;}
  rl.innerHTML=sorted.map(b=>{
    const isPriv=b.type==='priv';
    const barCol=isPriv?'var(--silv)':b.type==='er'?'var(--blu)':'var(--ylw)';
    const amCol=isPriv?'var(--silv)':b.type==='er'?'var(--blu)':'var(--ylw)';
    const badge=isPriv?'<span class="badge" style="background:rgba(136,153,170,.15);color:var(--silv)">🏠</span>'
      :`<span class="badge ${b.type==='er'?'b-er':'b-ar'}">${b.type.toUpperCase()}</span>`;
    const nrSpan=isPriv?'':`<span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--txt3)">${eh(b.belegNr||'')}</span>`;
    return `<div class="ri" onclick="showDetail(${b.id})">
    <div class="ri-bar" style="background:${barCol}"></div>
    <div class="ri-th">${b.image?`<img src="${b.image}" alt="">`:'🧾'}</div>
    <div class="ri-inf">
      <div class="ri-sh">${eh(b.shop||'Unbekannt')}</div>
      <div class="ri-me">${badge}${nrSpan}${b.garantieBis?`<span style="font-size:10px;color:${new Date(b.garantieBis)<new Date()?'var(--red)':'var(--grn)'}">🛡️ ${fd(b.garantieBis)}</span>`:''}${b.istAbo?'<span class="badge b-priv">Abo</span>':''}</div>
    </div>
    <div class="ri-r">
      <div class="ri-am" style="color:${amCol}">${b.brutto!=null?fm(b.brutto)+' '+cfg().currency:'–'}</div>
      <div class="ri-dt">${fd(b.date)}</div>
    </div></div>`;}).join('');
}

// ════════════════════════════════════════════════════════
// ██ INTELLIGENZ-MODUL 1: GARANTIE-WÄCHTER
// WHY: Elektrogeräte haben 24 Monate gesetzliche Gewährleistung.
// Die App weiß wann gekauft wurde – also kann sie warnen.
// Kein neues Datenfeld nötig: kaufdatum + kategorie = garantieBis
// Elektronik-Keywords aus den bereits vorhandenen items/shop Feldern.
// ════════════════════════════════════════════════════════
const ELEKTRONIK_KEYWORDS=/samsung|apple|iphone|ipad|macbook|sony|lg|philips|bosch|miele|siemens|electrolux|dyson|dell|hp |lenovo|asus|acer|bose|jbl|garmin|fitbit|tv |fernseh|laptop|computer|tablet|drucker|kaffeemasch|waschmasch|spülmasch|kühlschrank|gefrier|mixer|toaster|mikrowelle|staubsaug|monitor|bildschirm|lautsprecher|headphone|kopfhörer|kamera|elektronik/i;
const MOEBEL_KEYWORDS=/ikea|möbel|sofa|schrank|bett|tisch|stuhl|regal|kommode|matratze|mömax|poco möbel|home24/i;

async function renderGarantieWaechter(all){
  const now=new Date();
  // Filtere alle ER die als Elektronik/Möbel erkannt wurden UND ein Kaufdatum haben
  const mit=all.filter(b=>{
    if(b.type!=='er'||!b.date)return false;
    const shopText=(b.shop||'')+(b.items||[]).map(i=>i.name||'').join(' ');
    return ELEKTRONIK_KEYWORDS.test(shopText)||MOEBEL_KEYWORDS.test(shopText)||b.garantieBis;
  });
  // Garantiebis berechnen falls noch nicht vorhanden: Kaufdatum + 24 Monate
  const items=mit.map(b=>{
    const bis=b.garantieBis?new Date(b.garantieBis):new Date(new Date(b.date+'T00:00:00').setMonth(new Date(b.date+'T00:00:00').getMonth()+24));
    const daysLeft=Math.ceil((bis-now)/(864e5));
    return{...b,_bis:bis,_days:daysLeft};
  }).sort((a,b)=>a._days-b._days);
  const card=document.getElementById('gwCard');
  if(!items.length){card.style.display='none';return;}
  card.style.display='block';
  document.getElementById('gwList').innerHTML=items.slice(0,5).map(b=>{
    const st=b._days<0?'urgent':b._days<60?'warn':'ok';
    const lbl=b._days<0?`Abgelaufen vor ${Math.abs(b._days)} Tagen`:b._days===0?'Heute letzter Tag':`Noch ${b._days} Tage`;
    return`<div class="gw-item ${st}">
      <div class="gw-ico">${MOEBEL_KEYWORDS.test(b.shop||'')?'🛋️':'📱'}</div>
      <div class="gw-inf">
        <div class="gw-name">${eh(b.shop||'Gerät')}</div>
        <div class="gw-date">Gekauft ${fd(b.date)} · ${fm(b.brutto||0)} ${cfg().currency}</div>
      </div>
      <span class="gw-badge ${st}">${lbl}</span>
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════════════════
// ██ INTELLIGENZ-MODUL 2: ABO-DETEKTIV
// WHY: Abonnements sind das "stille Geld-Leck". Die App erkennt
// wiederkehrende Zahlungen an denselben Händlern automatisch
// aus den bereits vorhandenen shop/brutto/date Feldern –
// ohne dass der Nutzer etwas markieren muss.
// ════════════════════════════════════════════════════════
const ABO_KEYWORDS = new RegExp(localStorage.getItem('aboKeywords') || 'netflix|spotify|amazon prime|prime video|disney|dazn|youtube premium|apple music|apple one|icloud|dropbox|adobe|microsoft 365|office 365|google one|notion|slack|zoom|github|aws|heroku|openai|anthropic|claude|chatgpt|xing|linkedin|audible|kindle unlimited|software|subscription|abo|monats|jahres', 'i');

// Reverse Charge Anbieter (nicht-EU, keine ausgewiesene MwSt)
const RC_PROVIDERS = ['anthropic', 'openai', 'claude', 'chatgpt', 'github', 'adobe', 'aws', 'heroku', 'google', 'microsoft', 'apple', 'dropbox', 'notion', 'slack', 'zoom', 'xing', 'linkedin'];

function isReverseCharge(beleg) {
  const shop = (beleg.shop || '').toLowerCase();
  const hasMwst = beleg.mwst && beleg.mwst > 0;
  // Reverse Charge gilt für RC-Anbieter, unabhängig von ausgewiesener MwSt
  return RC_PROVIDERS.some(provider => shop.includes(provider));
}

function detectAbos(all){
  // WHY: Gleicher Händler, ähnlicher Betrag, mindestens 2x – das ist ein Abo
  const byShop={};
  all.filter(b=>b.date&&b.brutto).forEach(b=>{
    const key=(b.shop||'unbekannt').toLowerCase().trim().substring(0,30);
    if(!byShop[key])byShop[key]={shop:b.shop,belege:[],brutto:[]};
    byShop[key].belege.push(b);
    byShop[key].brutto.push(b.brutto);
  });
  const abos=[];
  Object.values(byShop).forEach(g=>{
    if(g.belege.length<2)return;
    const looksLikeAbo=ABO_KEYWORDS.test(g.shop||'')||g.belege.some(b=>b.istAbo);
    // Auch ohne Keyword: wenn Beträge sehr ähnlich ( ±5%) und mind. 2x = wahrscheinliches Abo
    const avg=g.brutto.reduce((s,v)=>s+v,0)/g.brutto.length;
    const consistent=g.brutto.every(v=>Math.abs(v-avg)/avg<0.05);
    if(looksLikeAbo||consistent){
      // Monatliche Kosten schätzen: Anzahl Buchungen / Monate Laufzeit
      const dates=g.belege.map(b=>new Date(b.date+'T00:00:00')).sort((a,b)=>a-b);
      const monate=Math.max(1,(dates[dates.length-1]-dates[0])/(864e5*30));
      const monatlich=avg*(g.belege.length/Math.max(monate,1));
      abos.push({shop:g.shop,count:g.belege.length,avg,monatlich:Math.min(monatlich,avg),belege:g.belege});
    }
  });
  return abos.sort((a,b)=>b.monatlich-a.monatlich);
}

async function renderAboDetektiv(all){
  const abos=detectAbos(all);
  const card=document.getElementById('aboCard');
  if(!abos.length){card.style.display='none';return;}
  card.style.display='block';
  document.getElementById('aboList').innerHTML=abos.slice(0,5).map(a=>`<div class="abo-item">
    <div class="abo-ico">${ABO_KEYWORDS.test(a.shop||'')?'📺':'🔄'}</div>
    <div class="abo-inf">
      <div class="abo-name">${eh(a.shop)}</div>
      <div class="abo-detail">${a.count}× erfasst · ∅ ${fm(a.avg)} ${cfg().currency}</div>
    </div>
    <div class="abo-amt">~${fm(a.monatlich)}/Mon</div>
  </div>`).join('');
}

// ════════════════════════════════════════════════════════
// ██ INTELLIGENZ-MODUL 3: VITAL-CHECK
// WHY: Positive Verstärkung für Lebensmittel-Einkäufe.
// "Mehr Frisches gekauft" motiviert – ohne zu moralisieren.
// Nutzt Items aus OCR-Daten wenn vorhanden, sonst Kategorie-Proxy.
// ════════════════════════════════════════════════════════
const FRISCH_KEYWORDS=/obst|gemüse|salat|tomate|apfel|banane|karotte|spinat|gurke|paprika|brokkoli|blaubeere|beere|mango|avocado|frisch|bio |organic/i;
const VERARBEITET_KEYWORDS=/chips|cola|fanta|sprite|süßigkeit|schokolade|gummibär|convenience|fertigg|tiefkühl|instant/i;

async function renderVitalCheck(){
  const all=await dba();
  const lebens=all.filter(b=>b.cat==='Lebensmittel'&&b.items?.length);
  if(lebens.length<3){document.getElementById('vitalCard').style.display='none';return;}
  let frischCount=0,verarbCount=0;
  lebens.forEach(b=>(b.items||[]).forEach(it=>{
    const n=it.name||'';
    if(FRISCH_KEYWORDS.test(n))frischCount++;
    if(VERARBEITET_KEYWORDS.test(n))verarbCount++;
  }));
  const total=Math.max(1,frischCount+verarbCount);
  const frischPct=Math.round(frischCount/total*100);
  const msg=frischPct>=60?'Großartig! Überwiegend frische Produkte 🌿':frischPct>=40?'Gute Mischung – mehr Frisches wäre ideal':'Mehr frische Produkte würden sich lohnen';
  document.getElementById('vitalCard').style.display='block';
  document.getElementById('vitalContent').innerHTML=`
    <div class="vital-row"><span>Frische Produkte</span><span>${frischPct}%</span></div>
    <div class="vital-bar"><div class="vital-fill" style="width:${frischPct}%;background:${frischPct>=60?'var(--grn)':frischPct>=40?'var(--ylw)':'var(--orn)'}"></div></div>
    <p style="font-size:11px;font-weight:300;color:var(--txt2);line-height:1.55">${msg}</p>
    <p style="font-size:10px;font-weight:300;color:var(--txt3);margin-top:5px">${lebens.length} Lebensmittel-Belege · ${frischCount+verarbCount} erkannte Artikel</p>`;
}

// ════════════════════════════════════════════════════════
// ██ INTELLIGENZ-MODUL 4: INFLATIONS-TRACKER
// WHY: Gleiches Produkt, gleicher Händler – aber der Preis steigt.
// Das spürt man, aber selten sieht man es schwarz auf weiß.
// Nutzt items-Array aus OCR-Daten. Kein extra Datenfeld.
// ════════════════════════════════════════════════════════
async function renderInflationsTracker(){
  const all=await dba();
  // Sammle alle Artikel mit Preis und Datum aus OCR-Items
  const byItem={};
  all.forEach(b=>{
    if(!b.date||!b.items?.length)return;
    b.items.forEach(it=>{
      if(!it.name||!it.price||it.price<0.5)return;
      const key=it.name.toLowerCase().trim().substring(0,30);
      if(!byItem[key])byItem[key]={name:it.name,preise:[]};
      byItem[key].preise.push({datum:b.date,preis:it.price});
    });
  });
  // Nur Artikel mit mind. 2 verschiedenen Käufen
  const vergleiche=Object.values(byItem).filter(g=>g.preise.length>=2).map(g=>{
    const sorted=g.preise.sort((a,b)=>a.datum.localeCompare(b.datum));
    const alt=sorted[0].preis,neu=sorted[sorted.length-1].preis;
    const delta=Math.round((neu-alt)/alt*100);
    return{name:g.name,alt,neu,delta};
  }).filter(g=>Math.abs(g.delta)>=5).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)).slice(0,6);
  const cc=document.getElementById('inflCC');
  if(!vergleiche.length){cc.style.display='none';return;}
  cc.style.display='block';
  document.getElementById('inflList').innerHTML=vergleiche.map(v=>`<div class="inf-item">
    <div class="inf-name">${eh(v.name)}</div>
    <div style="font-size:10px;font-weight:300;color:var(--txt3);margin-right:8px">${fm(v.alt)} → ${fm(v.neu)} ${cfg().currency}</div>
    <div class="inf-delta ${v.delta>0?'up':'dn'}">${v.delta>0?'+':''}${v.delta}%</div>
  </div>`).join('');
}

// ════════════════════════════════════════════════════════
// ██ INTELLIGENZ-MODUL 5: INSIGHT-BANNER (Privat-Modus)
// WHY: Kontextbezogene "Aha-Momente" – nur wenn echtes Sparpotential
// erkannt wurde. Kein Spam, kein Dauern-anzeigen.
// ════════════════════════════════════════════════════════
function renderInsightBanner(abos,potential){
  const b=document.getElementById('insightBanner');
  if(potential<5){b.style.display='none';return;}
  // Finde den größten "vergessenen" Abo-Kandidaten
  const top=abos.filter(a=>a.count<=2).sort((a,b)=>b.monatlich-a.monatlich)[0];
  if(!top){b.style.display='none';return;}
  b.style.display='block';
  b.innerHTML=`<div class="insight">
    <div class="ico">💡</div>
    <div class="body">
      <div class="head">${eh(top.shop)} – noch aktiv?</div>
      <div class="desc">Nur ${top.count}× genutzt in deinen Belegen. Wenn du das Abo nicht aktiv nutzt, könntest du es kündigen.</div>
      <div class="amt">Mögliche Ersparnis: ${fm(top.monatlich)} ${cfg().currency}/Mon · ${fm(top.monatlich*12)} ${cfg().currency}/Jahr</div>
    </div>
  </div>`;
}

// ════════════════════════════════════════════════════════
// ██ MODUL: BELEGE LIST
// ════════════════════════════════════════════════════════
// WHY: Artikel-Zeile für Belege-Listen – kompakt, max 3 Items
function renderItemsLine(items){
  if(!items||!items.length) return '';
  const names=items.slice(0,3).map(i=>eh(i.name||'–')).join(' · ');
  const mehr=items.length>3?` +${items.length-3}`:'';
  return `<div style="font-size:10px;font-weight:300;color:var(--txt3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${names}${mehr}</div>`;
}
async function renderBelege(){
  const all=await dba();
  const q=(document.getElementById('srch').value||'').toLowerCase();
  const tf=document.getElementById('ftT').value,cf=document.getElementById('ftC').value;
  // WHY: Privat-Belege (type='priv') gehören NICHT in die Business-Liste
  let it=all.filter(b=>b.type!=='priv'&&(!q||b.shop.toLowerCase().includes(q)||(b.belegNr||'').toLowerCase().includes(q))&&(!tf||b.type===tf)&&(!cf||b.cat===cf));
  it.sort((a,b)=>(b.date||'')>(a.date||'')?1:-1);
  const l=document.getElementById('bList');
  if(!it.length){l.innerHTML='<div class="empty"><div class="ico">🧾</div><p>Keine Belege gefunden.</p></div>';return;}
  renderPrivatChart(it);
  l.innerHTML=it.map(b=>`<div class="bc" onclick="showDetail(${b.id})">
    <div class="bc-bar" style="background:${b.type==='er'?'var(--blu)':'var(--ylw)'}"></div>
    <div class="bc-th">${b.image?`<img src="${b.image}" alt="">`:'🧾'}</div>
    <div class="bc-inf">
      <div class="bc-sh">${eh(b.shop||'Unbekannt')}</div>
      <div class="bc-me"><span class="badge ${b.type==='er'?'b-er':'b-ar'}">${b.type==='er'?'Eingang':'Ausgang'}</span>${eh(b.cat||'')}${b.istAbo?'<span class="badge b-priv">Abo</span>':''}${b.garantieBis?'<span style="font-size:9px;color:var(--grn)">🛡️</span>':''}${b.isDigitalScreen?'<span style="font-size:9px;color:var(--silv)">🖥️</span>':''}</div>
      <div class="bc-nr">${eh(b.belegNr||'')}</div>
      ${renderItemsLine(b.items)}
    </div>
    <div class="bc-r">
      <div class="bc-am ${b.type}">${b.brutto!=null?fm(b.brutto)+' '+cfg().currency:'–'}</div>
      <div class="bc-dt">${fd(b.date)}</div>
    </div></div>`).join('');
}

// ════════════════════════════════════════════════════════
// ██ MODUL: PRIVAT-BELEGE LIST + KI-ANALYSE
// WHY: Komplett getrennt von Business. Nur Gesamtbetrag,
// keine Belegnummer, keine MwSt. KI-Analyse optional auf Knopfdruck.
// ════════════════════════════════════════════════════════
async function renderPrivatBelege(){
  const all=await dba();
  // WHY: Nur Privat-Belege (type='priv')
  const cf=document.getElementById('pftC')?.value||'';
  const mf=document.getElementById('pftM')?.value||'';
  let it=all.filter(b=>b.type==='priv');
  if(cf) it=it.filter(b=>b.cat===cf);
  if(mf) it=it.filter(b=>(b.date||'').substring(5,7)===mf);
  it.sort((a,b)=>(b.date||'')>(a.date||'')?1:-1);

  // Summe + Zähler
  const total=it.reduce((s,b)=>s+(b.brutto||0),0);
  const td=document.getElementById('privTotalDisp'),cd=document.getElementById('privCountDisp');
  if(td)td.textContent=fm(total)+' '+cfg().currency;
  if(cd)cd.textContent=it.length+' Beleg'+(it.length!==1?'e':'');

  const l=document.getElementById('pList');
  if(!it.length){
    l.innerHTML='<div class="empty"><div class="ico">🏠</div><p>Noch keine privaten Belege.<br>Im Privat-Modus scannen oder Schnelleingabe nutzen.</p></div>';
    renderPrivatChart([]);
    return;
  }
  l.innerHTML=it.map(b=>`<div class="bc" onclick="showDetail(${b.id})">
    <div class="bc-bar" style="background:var(--silv)"></div>
    <div class="bc-th">${b.image?`<img src="${b.image}" alt="">`:'🧾'}</div>
    <div class="bc-inf">
      <div class="bc-sh">${eh(b.shop||'Unbekannt')}</div>
      <div class="bc-me"><span class="badge" style="background:rgba(136,153,170,.12);color:var(--silv)">🏠 Privat</span> ${eh(b.cat||'')}${b.istAbo?'<span class="badge b-priv">Abo</span>':''}</div>
      ${renderItemsLine(b.items)}
    </div>
    <div class="bc-r">
      <div class="bc-am" style="color:var(--silv)">${fm(b.brutto||0)} ${cfg().currency}</div>
      <div class="bc-dt">${fd(b.date)}</div>
    </div></div>`).join('');
}

// WHY: Auf Knopfdruck – analysiert IMMER den aktuellen Monat.
// Der Nutzer bekommt eine klare Monatsübersicht ohne manuellen Filter.
async function analysePrivatMonat(){
  apiKey=localStorage.getItem('cak')||apiKey||'';
  if(!apiKey){toast('Bitte erst API Key in Settings hinterlegen','er');openApiSheet();return;}

  // WHY: Sofort visuelles Feedback – Button deaktivieren + Spinner
  const btn=document.querySelector('[onclick="analysePrivatMonat()"]');
  if(btn){btn.disabled=true;btn.style.opacity='0.5';btn.innerHTML=btn.innerHTML.replace('KI-Analyse','⏳ Lädt …');}

  const now=new Date();
  const monat=String(now.getMonth()+1).padStart(2,'0');
  const jahr=now.getFullYear();
  const monatName=now.toLocaleDateString('de-DE',{month:'long',year:'numeric'});

  const all=await dba();
  const it=all.filter(b=>b.type==='priv'&&(b.date||'').startsWith(`${jahr}-${monat}`));

  if(!it.length){
    if(btn){btn.disabled=false;btn.style.opacity='';btn.innerHTML=btn.innerHTML.replace('⏳ Lädt …','KI-Analyse');}
    toast(`Keine privaten Belege für ${monatName}`,'wr');
    return;
  }

  const card=document.getElementById('privAnalyseCard');
  card.style.display='block';
  card.innerHTML=`<div style="display:flex;align-items:center;gap:10px;color:var(--txt3)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity=".2"/><path d="M12 3a9 9 0 019 9"/></svg><span>Analysiere ${it.length} Belege aus ${monatName} …</span></div>`;

  const summary=it.map(b=>`- ${fd(b.date)}: ${b.shop||'?'} | ${b.cat||'?'} | ${fm(b.brutto||0)} € | Artikel: ${(b.items||[]).map(i=>i.name).join(', ')||'–'}`).join('\n');
  const total=it.reduce((s,b)=>s+(b.brutto||0),0);
  const byCat={};it.forEach(b=>{byCat[b.cat||'?']=(byCat[b.cat||'?']||0)+(b.brutto||0);});
  const catSummary=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([c,v])=>`${c}: ${fm(v)} €`).join(', ');

  const prompt=`Du bist ein persönlicher Finanzassistent für Privatausgaben im deutschsprachigen Raum.\n\nAnalysiere meine privaten Ausgaben für ${monatName} und gib konkrete Tipps auf Deutsch:\n\nMONAT: ${monatName}\nGESAMTAUSGABEN: ${fm(total)} €\nNACH KATEGORIE: ${catSummary}\n\nBELEGE DIESES MONATS:\n${summary}\n\nDEINE ANALYSE:\n1. 🏷️ TOP-AUSGABEN: Was kostet am meisten – ist das angemessen?\n2. 💡 SPARPOTENTIAL: Wo könnte ich konkret sparen? Keine allgemeinen Tipps.\n3. 🥗 LEBENSMITTEL & GESUNDHEIT (falls Belege vorhanden): Sind die Produkte ausgewogen? Was fehlt oder ist zu viel?\n4. 🔄 MUSTER: Wiederkehrende Ausgaben oder mögliche Abos die ich kündigen könnte?\n5. ⭐ MEIN TIPP FÜR NÄCHSTEN MONAT: Die eine konkrete Maßnahme mit dem größten Effekt.\n\nAntworte direkt und praktisch auf Deutsch. Maximal 250 Wörter.`;

  try{
    const resp=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:'claude-sonnet-4-5',max_tokens:700,messages:[{role:'user',content:prompt}]})
    });
    const respText=await resp.text().catch(()=>'');
    trackApiCost('analyse');
    if(!resp.ok){card.textContent='❌ API Fehler '+resp.status;return;}
    let data;try{data=JSON.parse(respText);}catch(e){card.textContent='❌ Netzwerkfehler – nochmal versuchen';return;}
    const text=data.content?.filter(c=>c.type==='text').map(c=>c.text).join('')||'Keine Antwort';
    card.innerHTML=`<div style="font-size:10px;font-weight:300;color:var(--txt3);margin-bottom:8px;letter-spacing:.5px;text-transform:uppercase">${monatName} · ${fm(total)} € · ${it.length} Belege</div><div style="white-space:pre-wrap">${eh(text)}</div>`;
  }catch(e){
    card.textContent='❌ '+e.message;
  }finally{
    if(btn){btn.disabled=false;btn.style.opacity='';btn.innerHTML=btn.innerHTML.replace('⏳ Lädt …','KI-Analyse');}
  }
}

// ════════════════════════════════════════════════════════
// ██ MODUL: DETAIL SHEET
// ════════════════════════════════════════════════════════
async function showDetail(id){
  const all=await dba();const b=all.find(x=>x.id===id);if(!b)return;
  curDet=b;
  const isPriv=b.type==='priv';
  const isER=b.type==='er';

  let html='';
  if(b.image) html+=`<img src="${b.image}" alt="" class="det-img">`;
  html+=`<div class="det-title">${eh(b.shop||'Unbekannt')}</div>`;

  if(isPriv){
    // WHY: Privat-Detail – keine Belegnummer, keine MwSt, kein Stempel
    html+=`<div class="det-sub"><span class="badge" style="background:rgba(136,153,170,.12);color:var(--silv)">🏠 Privat-Ausgabe</span></div>`;
    html+=`<div class="drow"><span class="dk">Datum</span><span class="dv">${fd(b.date)}</span></div>`;
    html+=`<div class="drow"><span class="dk">Betrag</span><span class="dv" style="color:var(--silv)">${b.brutto!=null?fm(b.brutto)+' '+cfg().currency:'–'}</span></div>`;
    html+=`<div class="drow"><span class="dk">Kategorie</span><span class="dv">${eh(b.cat||'–')}</span></div>`;
    html+=`<div class="drow"><span class="dk">Zahlung</span><span class="dv">${eh(b.payment||'–')}</span></div>`;
    if(b.istAbo) html+=`<div class="drow"><span class="dk">Status</span><span class="dv"><span class="badge b-priv">Abo / wiederkehrend</span></span></div>`;
    if(b.items&&b.items.length) html+=`<div style="margin-top:10px"><table class="itbl"><thead><tr><th>Artikel</th><th style="text-align:right">Preis</th></tr></thead><tbody>${b.items.map(it=>`<tr><td>${eh(it.name||'–')}</td><td style="text-align:right" class="mono">${(parseFloat(it.price)||0).toFixed(2)} ${cfg().currency}</td></tr>`).join('')}</tbody></table></div>`;
    html+=`<div class="drow"><span class="dk">Erfasst</span><span class="dv">${new Date(b.savedAt||0).toLocaleString('de-DE')}</span></div>`;
    html+=`<div style="margin-top:15px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-red btn-sm" onclick="delBeleg(${b.id})">Löschen</button></div>`;
  } else {
    // Business-Detail (er/ar)
    const garantieInfo=b.garantieBis?`<div class="drow"><span class="dk">🛡️ Garantie bis</span><span class="dv" style="color:${new Date(b.garantieBis)<new Date()?'var(--red)':'var(--grn)'}">${fd(b.garantieBis)}</span></div>`:'';
    const aboInfo=b.istAbo?`<div class="drow"><span class="dk">Status</span><span class="dv"><span class="badge b-priv">Abo / wiederkehrend</span></span></div>`:'';
    const screenInfo=b.isDigitalScreen?`<div class="drow"><span class="dk">Quelle</span><span class="dv" style="color:var(--silv)">🖥️ Digital Screen ${b.screenType?'('+b.screenType+')':''}</span></div>`:'';
    html+=`<div class="det-sub"><span class="badge ${isER?'b-er':'b-ar'}">${isER?'Eingangsrechnung':'Ausgangsrechnung'}</span><span class="mono" style="font-size:11px;color:var(--txt3)">${eh(b.belegNr||'')}</span></div>`;
    html+=`<div class="drow"><span class="dk">Datum</span><span class="dv">${fd(b.date)}</span></div>`;
    html+=`<div class="drow"><span class="dk">Netto</span><span class="dv">${b.net!=null?fm(b.net)+' '+cfg().currency:'–'}</span></div>`;
    html+=`<div class="drow"><span class="dk">${cfg().steuerLabel} (${b.mwstRate||cfg().mwstH}%)</span><span class="dv">${b.mwst!=null?fm(b.mwst)+' '+cfg().currency:'–'}</span></div>`;
    html+=`<div class="drow"><span class="dk">Brutto</span><span class="dv">${b.brutto!=null?fm(b.brutto)+' '+cfg().currency:'–'}</span></div>`;
    html+=`<div class="drow"><span class="dk">Zahlungsart</span><span class="dv">${eh(b.payment||'–')}</span></div>`;
    html+=`<div class="drow"><span class="dk">Kategorie</span><span class="dv">${eh(b.cat||'–')}</span></div>`;
    html+=garantieInfo+aboInfo+screenInfo;
    html+=`<div class="drow"><span class="dk">Erfasst</span><span class="dv">${new Date(b.savedAt||0).toLocaleString('de-DE')}</span></div>`;
    if(b.items&&b.items.length) html+=`<div style="margin-top:10px"><table class="itbl"><thead><tr><th>Artikel</th><th style="text-align:right">Preis</th></tr></thead><tbody>${b.items.map(it=>`<tr><td>${eh(it.name||'–')}</td><td style="text-align:right" class="mono">${(parseFloat(it.price)||0).toFixed(2)} ${cfg().currency}</td></tr>`).join('')}</tbody></table></div>`;
    html+=`<div style="margin-top:15px;display:flex;gap:8px;flex-wrap:wrap">
      ${b.image?`<button class="btn btn-blu btn-sm" onclick="exportStamped()">PDF mit Stempel</button>`:''}
      ${b.image?`<button class="btn btn-g btn-sm" onclick="exportSinglePDF()">PDF speichern</button>`:''}
      <button class="btn btn-red btn-sm" onclick="delBeleg(${b.id})">Löschen</button>
    </div>`;
  }

  document.getElementById('detContent').innerHTML=html;
  document.getElementById('detOvl').classList.add('on');
}
function closeDet(){document.getElementById('detOvl').classList.remove('on');}
function closeDetOuter(e){if(e.target===document.getElementById('detOvl'))closeDet();}
async function delBeleg(id){
  if(!confirm('Beleg löschen?'))return;
  const all=await dba();const b=all.find(x=>x.id===id);
  await dbdel(id);closeDet();
  // WHY: Je nach Beleg-Typ den richtigen Tab aktualisieren
  if(b&&b.type==='priv')renderPrivatBelege();else renderBelege();
  renderHome();toast('Gelöscht','ok');
}
async function exportSinglePDF(){if(!curDet?.image){toast('Kein Bild','wr');return;}await exportBelegPDF(curDet,false);}

// ════════════════════════════════════════════════════════
// ██ MODUL: MwSt ANALYTICS
// ════════════════════════════════════════════════════════
function setPeriod(p,btn){mwstPer=p;document.querySelectorAll('.tab').forEach(b=>b.classList.remove('on'));btn.classList.add('on');renderMwst();}
function filterPer(all){
  const now=new Date();
  return all.filter(b=>{
    if(!b.date)return mwstPer==='all';
    const d=new Date(b.date+'T00:00:00');
    if(mwstPer==='all')return true;
    if(mwstPer==='year')return d.getFullYear()===now.getFullYear();
    if(mwstPer==='month')return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();
    if(mwstPer==='q'){const q=Math.ceil((now.getMonth()+1)/3);return d.getFullYear()===now.getFullYear()&&Math.ceil((d.getMonth()+1)/3)===q;}
    return true;
  });
}
async function renderMwst(){
  const all=await dba(),fi=filterPer(all);
  const ar=fi.filter(b=>b.type==='ar'),er=fi.filter(b=>b.type==='er');
  const arM=ar.reduce((s,b)=>s+(b.mwst||0),0),erM=er.reduce((s,b)=>s+(b.mwst||0),0),saldo=arM-erM;
  document.getElementById('mAR').textContent=fm(arM)+' '+cfg().currency;document.getElementById('mARs').textContent=ar.length+' AR';
  document.getElementById('mER').textContent=fm(erM)+' '+cfg().currency;document.getElementById('mERs').textContent=er.length+' ER';
  if(saldo>=0){document.getElementById('zlCard').style.display='';document.getElementById('exCard').style.display='none';document.getElementById('mZL').textContent=fm(saldo)+' '+cfg().currency;}
  else{document.getElementById('zlCard').style.display='none';document.getElementById('exCard').style.display='';document.getElementById('mEX').textContent=fm(Math.abs(saldo))+' '+cfg().currency;}
  const bm={};all.forEach(b=>{const mo=(b.date||'').substring(0,7);if(!mo)return;if(!bm[mo])bm[mo]={ar:0,er:0,arM:0,erM:0};if(b.type==='ar'){bm[mo].ar+=(b.brutto||0);bm[mo].arM+=(b.mwst||0);}else{bm[mo].er+=(b.brutto||0);bm[mo].erM+=(b.mwst||0);}});
  const months=Object.keys(bm).sort().slice(-12);
  const maxV=Math.max(1,...months.map(m=>Math.max(bm[m].ar,bm[m].er)));
  document.getElementById('mChart').innerHTML=months.map(m=>{const aH=Math.round(bm[m].ar/maxV*74),eH=Math.round(bm[m].er/maxV*74);return`<div class="mcol"><div class="mcol-bars"><div class="mbar ar" style="height:${aH}px"></div><div class="mbar er" style="height:${eH}px"></div></div><div class="mbar-l">${m.substring(5)}</div></div>`;}).join('');
  const ms=Object.keys(bm).sort().reverse();
  document.getElementById('mTbl').innerHTML=ms.map(m=>{const r=bm[m],s=r.arM-r.erM,sc=s>0?'var(--red)':s<0?'var(--grn)':'var(--txt2)';return`<tr><td class="mo">${m}</td><td class="mo" style="color:var(--ylw)">${r.arM>0?fm(r.arM):'–'}</td><td class="mo" style="color:var(--blu)">${r.erM>0?fm(r.erM):'–'}</td><td class="mo" style="color:${sc}">${fm(Math.abs(s))}</td></tr>`;}).join('');
  const byCat={};er.forEach(b=>{byCat[b.cat||'Sonstiges']=(byCat[b.cat||'Sonstiges']||0)+(b.brutto||0);});
  const cats=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,8);const maxC=cats[0]?.[1]||1;
  document.getElementById('catChart').innerHTML=cats.map(([c,v])=>`<div class="barrow"><div class="bar-lbl">${eh(c)}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.round(v/maxC*100)}%;background:rgba(74,128,192,.45)"></div></div><div class="bar-val">${fm(v)}</div></div>`).join('');
  // Inflations-Tracker
  await renderInflationsTracker();
}

// ════════════════════════════════════════════════════════
// ██ MODUL: EINKOMMENSTEUER §32a + GAUGE
// ════════════════════════════════════════════════════════
async function calcSteuer(){
  const all=await dba(),now=new Date();
  const ar=all.filter(b=>b.type==='ar'&&b.date&&new Date(b.date+'T00:00:00').getFullYear()===now.getFullYear());
  const er=all.filter(b=>b.type==='er'&&b.date&&new Date(b.date+'T00:00:00').getFullYear()===now.getFullYear());
  const einnahmen=ar.reduce((s,b)=>s+(b.net||0),0);
  const betrAusg=er.reduce((s,b)=>s+(b.net||0),0);
  const manuell=parseFloat(document.getElementById('stM')?.value||'0')||0;
  const gewinn=Math.max(0,einnahmen-betrAusg-manuell);
  const kinder=parseInt(document.getElementById('stKi')?.value||'0')||0;
  const grundFB=parseInt(document.getElementById('stK')?.value||'1')===3?22458:11604;
  const zvE=Math.max(0,gewinn-grundFB-kinder*9600);
  let est=0;
  if(zvE>277825)est=zvE*.45-17374.99;
  else if(zvE>66760)est=zvE*.42-10636.31;
  else if(zvE>17005)est=((192.59*zvE/10000)+2397)*(zvE/10000)+966.53;
  else if(zvE>0)est=((979.18*zvE/10000)+1400)*(zvE/10000);
  const soli=est>18130?est*.055:0;
  const kirche=(parseFloat(document.getElementById('stKi2')?.value||'0')||0)*est;
  const gesamt=Math.max(0,est+soli+kirche);
  const effRate=gewinn>0?Math.round(gesamt/gewinn*100):0;
  document.getElementById('estJahr').textContent=fmK(Math.round(gesamt))+' €';
  document.getElementById('estG').textContent=fmK(Math.round(gewinn))+' €';
  document.getElementById('estR').textContent=effRate+' %';
  document.getElementById('estM').textContent=fmK(Math.round(gesamt/12))+' €';
  document.getElementById('estSub').textContent=`Einnahmen ${fmK(Math.round(einnahmen))}€ − Ausgaben ${fmK(Math.round(betrAusg+manuell))}€ = Gewinn ${fmK(Math.round(gewinn))}€`;
  const stufen=[{bis:11604,rate:0,col:'var(--grn)'},{bis:17005,rate:14,col:'var(--grn)'},{bis:66760,rate:24,col:'var(--ylw)'},{bis:277825,rate:42,col:'var(--orn)'},{bis:Infinity,rate:45,col:'var(--red)'}];
  document.getElementById('gaugeM').style.left=Math.min(100,Math.round(zvE/300000*100))+'%';
  let stufe=stufen.find(s=>zvE<=s.bis)||stufen[stufen.length-1];
  document.getElementById('gaugeStufe').textContent=stufe.rate+' %';
  document.getElementById('gaugeStufe').style.color=stufe.col;
  const idx=stufen.indexOf(stufe);
  if(idx<stufen.length-1){const next=stufen[idx+1];const diff=next.bis-zvE;document.getElementById('gaugeNext').textContent=`Noch ${fmK(Math.round(diff))} € Gewinn bis zum nächsten Steuersatz (${next.rate}%). Jeder weitere Euro: ${next.rate} Cent Steuer.`;}
  else{document.getElementById('gaugeNext').textContent='Höchster Steuersatz: 45%. Jeder weitere Euro Gewinn: 45 Cent Steuer.';}
  // Vital-Check nur rendern wenn Steuer-View geöffnet
  await renderVitalCheck();
}

// ════════════════════════════════════════════════════════
// ██ MODUL: QUARTAL
// ════════════════════════════════════════════════════════
async function initQuartal(){
  const qs=document.getElementById('qSel');qs.innerHTML='';
  const y=new Date().getFullYear();
  [y-1,y].forEach(yr=>{[1,2,3,4].forEach(q=>{
    const b=document.createElement('button');b.className='qbtn'+(yr===qY&&q===qQ?' on':'');
    b.textContent=`Q${q} ${yr}`;
    b.onclick=()=>{qY=yr;qQ=q;document.querySelectorAll('.qbtn').forEach(x=>x.classList.remove('on'));b.classList.add('on');renderQuartal();};
    qs.appendChild(b);
  });});
  renderQuartal();
}
async function renderQuartal(){
  const all=await dba();
  const fi=all.filter(b=>{if(!b.date)return false;const d=new Date(b.date+'T00:00:00');return d.getFullYear()===qY&&Math.ceil((d.getMonth()+1)/3)===qQ;});
  const ar=fi.filter(b=>b.type==='ar'),er=fi.filter(b=>b.type==='er');
  const arSum=ar.reduce((s,b)=>s+(b.brutto||0),0),erSum=er.reduce((s,b)=>s+(b.brutto||0),0);
  const arM=ar.reduce((s,b)=>s+(b.mwst||0),0),erM=er.reduce((s,b)=>s+(b.mwst||0),0),saldo=arM-erM;
  document.getElementById('qSum').innerHTML=`
    <div class="stitle">Q${qQ} ${qY} — ${fi.length} Belege</div>
    <div class="qsum-grid">
      <div class="qsum-item"><div class="l">Umsatz (AR brutto)</div><div class="v" style="color:var(--ylw)">${fm(arSum)} ${cfg().currency}</div></div>
      <div class="qsum-item"><div class="l">Ausgaben (ER brutto)</div><div class="v" style="color:var(--blu)">${fm(erSum)} ${cfg().currency}</div></div>
      <div class="qsum-item"><div class="l">${cfg().steuerLabel} eingenommen</div><div class="v" style="color:var(--ylw)">${fm(arM)} ${cfg().currency}</div></div>
      <div class="qsum-item"><div class="l">Vorsteuer</div><div class="v" style="color:var(--blu)">${fm(erM)} ${cfg().currency}</div></div>
    </div>
    <div style="margin-top:13px;padding-top:13px;border-top:1px solid var(--br)">
      <div style="font-size:10px;font-weight:300;letter-spacing:.5px;color:var(--txt3);text-transform:uppercase;margin-bottom:5px">${cfg().steuerLabel}-Zahllast</div>
      <div class="mono" style="font-size:22px;font-weight:300;color:${saldo>=0?'var(--red)':'var(--grn)'}">${saldo>=0?'+':''}${fm(saldo)} ${cfg().currency}</div>
    </div>`;
  const ql=document.getElementById('qBList');
  if(!fi.length){ql.innerHTML='<div class="empty" style="padding:16px 0"><p>Keine Belege in diesem Quartal.</p></div>';return;}
  ql.innerHTML=[...fi].sort((a,b)=>(a.date||'')>(b.date||'')?1:-1).map(b=>`<div style="display:flex;align-items:center;gap:9px;padding:9px 0;border-bottom:1px solid var(--br);cursor:pointer" onclick="showDetail(${b.id})">
    <div style="width:2px;height:34px;border-radius:1px;background:${b.type==='er'?'var(--blu)':'var(--ylw)'};opacity:.6;flex-shrink:0"></div>
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:300;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${eh(b.shop||'')}</div>
      <div style="font-size:10px;font-weight:300;color:var(--txt3)" class="mono">${eh(b.belegNr||'')} · ${fd(b.date)}</div>
    </div>
    <div class="mono" style="font-size:12px;font-weight:300;color:${b.type==='er'?'var(--blu)':'var(--ylw)'};flex-shrink:0">${b.brutto!=null?fm(b.brutto)+' '+cfg().currency:'–'}</div>
  </div>`).join('');
}
async function exportQCSV(){const all=await dba();const fi=all.filter(b=>{if(!b.date)return false;const d=new Date(b.date+'T00:00:00');return d.getFullYear()===qY&&Math.ceil((d.getMonth()+1)/3)===qQ;});if(!fi.length){toast('Keine Belege','wr');return;}exportCSVData(fi,`Q${qQ}_${qY}`);}
async function exportQZip(){
  if(typeof JSZip==='undefined'||typeof window.jspdf==='undefined'){toast('Bibliotheken nicht geladen','er');return;}
  const all=await dba();
  const fi=all.filter(b=>{if(!b.date)return false;const d=new Date(b.date+'T00:00:00');return d.getFullYear()===qY&&Math.ceil((d.getMonth()+1)/3)===qQ;});
  if(!fi.length){toast('Keine Belege','wr');return;}
  toast('ZIP wird erstellt …','wr');loadStamp();
  const zip=new JSZip(),folder=zip.folder(`Q${qQ}_${qY}`);
  const rows=[['Belegnummer','Typ','Datum','Händler','Netto',cfg().steuerLabel,'Brutto',cfg().steuerLabel+'%','Kategorie','Zahlung','Abo','Garantie bis']];
  fi.forEach(b=>rows.push([b.belegNr||'',b.type==='er'?'Eingangsrechnung':'Ausgangsrechnung',b.date||'',b.shop||'',b.net!=null?b.net.toFixed(2):'',b.mwst!=null?b.mwst.toFixed(2):'',b.brutto!=null?b.brutto.toFixed(2):'',b.mwstRate||'',b.cat||'',b.payment||'',b.istAbo?'Ja':'',b.garantieBis||'']));
  folder.file(`Q${qQ}_${qY}_belege.csv`,'\uFEFF'+rows.map(r=>r.join(';')).join('\n'));
  let count=0;
  for(const b of fi){
    if(!b.image)continue;
    try{const bytes=await belegPDFBytes(b);if(!bytes)continue;folder.file(`${b.belegNr||'beleg'}_${(b.shop||'').replace(/[^a-z0-9]/gi,'_').substring(0,20)}.pdf`,bytes);count++;}catch(e){console.warn(e);}
  }
  const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`BelegScan_Q${qQ}_${qY}.zip`;a.click();URL.revokeObjectURL(url);
  toast(`ZIP mit ${count} PDFs exportiert ✓`,'ok');
}

async function exportSteuerberaterZip(){
  if(typeof JSZip==='undefined'||typeof window.jspdf==='undefined'){toast('Bibliotheken nicht geladen','er');return;}
  const all=await dba();
  if(!all.length){toast('Keine Belege','wr');return;}
  toast('Steuerberater-Export wird erstellt …','wr');loadStamp();

  const zip=new JSZip();
  const year = new Date().getFullYear();

  // 1. zusammenfassung.csv
  const zusammenfassungRows = [];

  // Übersicht
  const erBelege = all.filter(b => b.type === 'er');
  const arBelege = all.filter(b => b.type === 'ar');
  const rcBelege = all.filter(b => isReverseCharge(b));
  const kmBelege = JSON.parse(localStorage.getItem(VERPFL_KEY) || '[]');

  const gesamtEinnahmen = arBelege.reduce((s, b) => s + (b.brutto || 0), 0);
  const gesamtAusgaben = erBelege.reduce((s, b) => s + (b.brutto || 0), 0);
  const gewinn = gesamtEinnahmen - gesamtAusgaben;
  const mwstZahllast = erBelege.reduce((s, b) => s + (b.mwst || 0), 0) - arBelege.reduce((s, b) => s + (b.mwst || 0), 0);
  const rcSumme = rcBelege.reduce((s, b) => s + (b.brutto || 0), 0);
  const kmSumme = kmBelege.reduce((s, b) => s + (b.pauschale || 0), 0);

  zusammenfassungRows.push(['ÜBERSICHT']);
  zusammenfassungRows.push(['Gesamteinnahmen', gesamtEinnahmen.toFixed(2) + ' €']);
  zusammenfassungRows.push(['Gesamtausgaben', gesamtAusgaben.toFixed(2) + ' €']);
  zusammenfassungRows.push(['Gewinn', gewinn.toFixed(2) + ' €']);
  zusammenfassungRows.push(['MwSt-Zahllast', mwstZahllast.toFixed(2) + ' €']);
  zusammenfassungRows.push(['Reverse-Charge-Summe', rcSumme.toFixed(2) + ' €']);
  zusammenfassungRows.push(['Kilometerpauschale gesamt', kmSumme.toFixed(2) + ' €']);
  zusammenfassungRows.push(['']);

  // ER-Liste
  zusammenfassungRows.push(['EINGANGSRECHNUNGEN (ER)']);
  zusammenfassungRows.push(['Belegnummer', 'Datum', 'Händler', 'Netto', cfg().steuerLabel, 'Brutto', cfg().steuerLabel+'%', 'Kategorie', 'Zahlung', 'Reverse Charge']);
  erBelege.forEach(b => zusammenfassungRows.push([
    b.belegNr || '',
    b.date || '',
    b.shop || '',
    b.net != null ? b.net.toFixed(2) : '',
    b.mwst != null ? b.mwst.toFixed(2) : '',
    b.brutto != null ? b.brutto.toFixed(2) : '',
    b.mwstRate || '',
    b.cat || '',
    b.payment || '',
    isReverseCharge(b) ? 'Ja' : 'Nein'
  ]));
  zusammenfassungRows.push(['']);

  // AR-Liste
  zusammenfassungRows.push(['AUSGANGSRECHNUNGEN (AR)']);
  zusammenfassungRows.push(['Belegnummer', 'Datum', 'Händler', 'Netto', cfg().steuerLabel, 'Brutto', cfg().steuerLabel+'%', 'Kategorie', 'Zahlung']);
  arBelege.forEach(b => zusammenfassungRows.push([
    b.belegNr || '',
    b.date || '',
    b.shop || '',
    b.net != null ? b.net.toFixed(2) : '',
    b.mwst != null ? b.mwst.toFixed(2) : '',
    b.brutto != null ? b.brutto.toFixed(2) : '',
    b.mwstRate || '',
    b.cat || '',
    b.payment || ''
  ]));
  zusammenfassungRows.push(['']);

  // RC-Aufstellung
  zusammenfassungRows.push(['REVERSE CHARGE AUFSTELLUNG']);
  zusammenfassungRows.push(['Belegnummer', 'Datum', 'Anbieter', 'Netto-Betrag', 'Selbst berechnete MwSt (19%)', 'UStVA Zeile 52', 'UStVA Zeile 67']);
  rcBelege.forEach(b => {
    const netto = b.brutto || 0;
    const mwst = netto * 0.19;
    zusammenfassungRows.push([
      b.belegNr || '',
      b.date || '',
      b.shop || '',
      netto.toFixed(2),
      mwst.toFixed(2),
      mwst.toFixed(2), // Zeile 52
      mwst.toFixed(2)  // Zeile 67
    ]);
  });
  zusammenfassungRows.push(['']);

  // Kilometerpauschale
  zusammenfassungRows.push(['KILOMETERPAUSCHALE']);
  zusammenfassungRows.push(['Datum', 'Adresse', 'Stunden', 'Pauschale']);
  kmBelege.forEach(b => zusammenfassungRows.push([
    b.datum || '',
    b.adresse || '',
    b.h || '',
    b.pauschale || ''
  ]));

  zip.file('zusammenfassung.csv', '\uFEFF' + zusammenfassungRows.map(r => r.join(';')).join('\n'));

  // 2. rc_reverse_charge.csv
  const rcRows = [];
  rcRows.push(['REVERSE CHARGE - NICHT IN NORMALER VORSTEUER ENTHALTEN']);
  rcRows.push(['Diese Beträge müssen separat in der UStVA eingetragen werden.']);
  rcRows.push(['']);
  rcRows.push(['Belegnummer', 'Datum', 'Anbieter', 'Netto-Betrag', 'Selbst berechnete MwSt (19%)', 'UStVA Zeile 52 (Schuld)', 'UStVA Zeile 67 (Vorsteuer)']);
  let rcTotalNetto = 0, rcTotalMwst = 0;
  rcBelege.forEach(b => {
    const netto = b.brutto || 0;
    const mwst = netto * 0.19;
    rcRows.push([
      b.belegNr || '',
      b.date || '',
      b.shop || '',
      netto.toFixed(2),
      mwst.toFixed(2),
      mwst.toFixed(2),
      mwst.toFixed(2)
    ]);
    rcTotalNetto += netto;
    rcTotalMwst += mwst;
  });
  rcRows.push(['SUMME', '', '', rcTotalNetto.toFixed(2), rcTotalMwst.toFixed(2), rcTotalMwst.toFixed(2), rcTotalMwst.toFixed(2)]);
  zip.file('rc_reverse_charge.csv', '\uFEFF' + rcRows.map(r => r.join(';')).join('\n'));

  // 3. belege/ Ordner mit PDFs
  const belegeFolder = zip.folder('belege');
  let pdfCount = 0;
  for(const b of all){
    if(!b.image) continue;
    try{
      const bytes = await belegPDFBytesCompressed(b);
      if(!bytes) continue;
      const filename = `${b.belegNr || 'beleg'}.pdf`;
      belegeFolder.file(filename, bytes);
      pdfCount++;
    }catch(e){console.warn(e);}
  }

  // 4. README.txt
  const readme = `Steuerberater-Export BelegScan ${year}

INHALT:
- zusammenfassung.csv: Übersicht mit Kennzahlen und allen Belegen
- rc_reverse_charge.csv: Reverse Charge Beträge für UStVA Zeile 52 und 67
- belege/: Alle Belege als PDFs, benannt nach Belegnummer

HINWEIS ZU REVERSE CHARGE:
Die Beträge in rc_reverse_charge.csv sind NICHT in der normalen Vorsteuer enthalten.
Tragen Sie die Werte aus "UStVA Zeile 52" in die Umsatzsteuer-Voranmeldung Zeile 52 ein.
Tragen Sie die Werte aus "UStVA Zeile 67" in die Umsatzsteuer-Voranmeldung Zeile 67 ein.
`;
  zip.file('README.txt', readme);

  const blob = await zip.generateAsync({type:'blob', compression:'DEFLATE', compressionOptions:{level:6}});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Steuerberater_Export_${year}.zip`;
  a.click();
  URL.revokeObjectURL(url);
  toast(`Steuerberater-Export mit ${pdfCount} PDFs erstellt ✓`,'ok');
}

// ════════════════════════════════════════════════════════
// ██ MODUL: CSV & BACKUP
// ════════════════════════════════════════════════════════
async function exportCSV(){const all=await dba();if(!all.length){toast('Keine Belege','wr');return;}exportCSVData(all,`belege_${new Date().toISOString().split('T')[0]}`);}
function exportCSVData(data,fn){
  const rows=[['Belegnummer','Typ','Datum','Händler','Netto',cfg().steuerLabel,'Brutto',cfg().steuerLabel+'%','Kategorie','Zahlung','Erfasst','Abo','Garantie bis']];
  [...data].sort((a,b)=>(a.date||'')>(b.date||'')?1:-1).forEach(b=>rows.push([b.belegNr||'',b.type==='er'?'Eingangsrechnung':'Ausgangsrechnung',b.date||'',ec(b.shop||''),b.net!=null?b.net.toFixed(2):'',b.mwst!=null?b.mwst.toFixed(2):'',b.brutto!=null?b.brutto.toFixed(2):'',b.mwstRate||'',ec(b.cat||''),ec(b.payment||''),new Date(b.savedAt||0).toLocaleDateString('de-DE'),b.istAbo?'Ja':'',b.garantieBis||'']));
  const blob=new Blob(['\uFEFF'+rows.map(r=>r.join(';')).join('\n')],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=fn+'.csv';a.click();URL.revokeObjectURL(url);
  toast('CSV exportiert ✓','ok');
}
async function exportBackup(){
  const all=await dba();
  const blob=new Blob([JSON.stringify({version:4,exportDate:new Date().toISOString(),profile,belege:all})],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`belegscan_backup_${new Date().toISOString().split('T')[0]}.json`;a.click();URL.revokeObjectURL(url);
  toast('Backup exportiert ✓','ok');
}
async function importBackup(inp){
  const f=inp.files[0];if(!f)return;
  try{const data=JSON.parse(await f.text());if(!data.belege||!Array.isArray(data.belege))throw new Error('Ungültiges Format');if(!confirm(`${data.belege.length} Belege importieren?`))return;for(const b of data.belege){const{id:_,...rest}=b;await dbadd(rest);}toast(`${data.belege.length} Belege importiert ✓`,'ok');renderHome();}catch(e){toast('Import-Fehler: '+e.message,'er');}
  inp.value='';
}

async function importBackup(inp){
  const f=inp.files[0];if(!f)return;
  try{const data=JSON.parse(await f.text());if(!data.belege||!Array.isArray(data.belege))throw new Error('Ungültiges Format');if(!confirm(`${data.belege.length} Belege importieren?`))return;for(const b of data.belege){const{id:_,...rest}=b;await dbadd(rest);}toast(`${data.belege.length} Belege importiert ✓`,'ok');renderHome();}catch(e){toast('Import-Fehler: '+e.message,'er');}
  inp.value='';
}

async function loadExportPreview(){
  // Show warnings about missing receipts / VAT issues first
  await renderExportWarnBox();

  const all = await dba();
  const year = new Date().getFullYear();
  const yearBelege = all.filter(b => b.date && new Date(b.date).getFullYear() === year);

  // Jahresübersicht
  const yearSummary = document.getElementById('exportYearSummary');
  const totalEinnahmen = yearBelege.filter(b => b.type === 'ar').reduce((s, b) => s + (b.brutto || 0), 0);
  const totalAusgaben = yearBelege.filter(b => b.type === 'er').reduce((s, b) => s + (b.brutto || 0), 0);
  const gewinn = totalEinnahmen - totalAusgaben;
  yearSummary.innerHTML = `
    <div style="display:flex;justify-content:space-between;margin-bottom:8px"><span>Einnahmen (AR):</span><span style="color:var(--grn)">${totalEinnahmen.toFixed(2)} €</span></div>
    <div style="display:flex;justify-content:space-between;margin-bottom:8px"><span>Ausgaben (ER):</span><span style="color:var(--red)">${totalAusgaben.toFixed(2)} €</span></div>
    <div style="display:flex;justify-content:space-between;border-top:1px solid var(--br);padding-top:8px"><span><strong>Gewinn:</strong></span><span style="color:var(--gold)"><strong>${gewinn.toFixed(2)} €</strong></span></div>
  `;

  // Quartalsübersicht
  const quarterSummary = document.getElementById('exportQuarterSummary');
  const quarters = [1,2,3,4];
  const quarterData = quarters.map(q => {
    const qBelege = yearBelege.filter(b => {
      const d = new Date(b.date);
      return Math.ceil((d.getMonth() + 1) / 3) === q;
    });
    const einnahmen = qBelege.filter(b => b.type === 'ar').reduce((s, b) => s + (b.brutto || 0), 0);
    const ausgaben = qBelege.filter(b => b.type === 'er').reduce((s, b) => s + (b.brutto || 0), 0);
    return {q, einnahmen, ausgaben, gewinn: einnahmen - ausgaben};
  });
  quarterSummary.innerHTML = quarterData.map(qd => `
    <div style="margin-bottom:12px;padding:8px;border:1px solid var(--br);border-radius:var(--r8)">
      <div style="font-weight:500;margin-bottom:4px">Q${qd.q} ${year}</div>
      <div style="display:flex;justify-content:space-between;font-size:11px"><span>Einnahmen:</span><span style="color:var(--grn)">${qd.einnahmen.toFixed(2)} €</span></div>
      <div style="display:flex;justify-content:space-between;font-size:11px"><span>Ausgaben:</span><span style="color:var(--red)">${qd.ausgaben.toFixed(2)} €</span></div>
      <div style="display:flex;justify-content:space-between;font-size:11px;border-top:1px solid var(--br);padding-top:4px;margin-top:4px"><span>Gewinn:</span><span style="color:var(--gold)">${qd.gewinn.toFixed(2)} €</span></div>
    </div>
  `).join('');

  // Belegliste (letzte 50)
  const belegList = document.getElementById('exportBelegList');
  const recentBelege = all.sort((a, b) => new Date(b.date || '1970-01-01') - new Date(a.date || '1970-01-01')).slice(0, 50);
  belegList.innerHTML = recentBelege.map(b => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--br)">
      <div>
        <div style="font-size:12px;font-weight:500">${b.belegNr || '–'}</div>
        <div style="font-size:10px;color:var(--txt3)">${b.date || '–'} · ${b.shop || '–'}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:12px;font-weight:500;color:${b.type === 'ar' ? 'var(--grn)' : 'var(--red)'}">${(b.brutto || 0).toFixed(2)} €</div>
        <div style="font-size:10px;color:var(--txt3)">${b.type === 'ar' ? 'Einnahme' : 'Ausgabe'}</div>
      </div>
    </div>
  `).join('');
}

// ════════════════════════════════════════════════════════
// ██ MODUL: PDF EXPORT
// ════════════════════════════════════════════════════════
async function exportBelegPDF(b,stamped=false){
  if(typeof window.jspdf==='undefined'){toast('jsPDF nicht geladen','er');return;}
  const{jsPDF}=window.jspdf;
  const img=new Image();
  await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=b.image;});
  const sc=Math.min(1,1200/img.naturalWidth);
  const cw=img.naturalWidth*sc,ch=img.naturalHeight*sc;
  const cv=document.createElement('canvas');cv.width=cw;cv.height=ch;
  const ctx=cv.getContext('2d');ctx.drawImage(img,0,0,cw,ch);
  if(stamped&&b.type==='er'){
    const sw=300,sh=110,sx=cw-sw-12,sy=ch-sh-12;
    ctx.fillStyle='rgba(255,255,255,.93)';ctx.fillRect(sx,sy,sw,sh);
    const tmp=document.createElement('canvas');tmp.width=sw;tmp.height=sh;
    drawStamp(tmp,stamp,b.belegNr||'ER-????',stampTpl);ctx.drawImage(tmp,sx,sy);
  }
  const imgData=cv.toDataURL('image/jpeg',.92);
  const mmW=210,mmH=Math.round(mmW*(ch/cw));
  const pdf=new jsPDF({orientation:mmH>mmW?'portrait':'landscape',unit:'mm',format:[mmW,mmH]});
  pdf.addImage(imgData,'JPEG',0,0,mmW,mmH,undefined,'FAST');
  const fh=11;pdf.setFillColor(255,255,255);pdf.rect(0,mmH-fh,mmW,fh,'F');
  pdf.setFont('helvetica','normal');pdf.setFontSize(7);pdf.setTextColor(80);
  const meta=[b.belegNr||'',b.type==='er'?'Eingangsrechnung':'Ausgangsrechnung',fd(b.date),b.shop||'',b.brutto!=null?fm(b.brutto)+' '+cfg().currency:'',`${cfg().steuerLabel} ${b.mwstRate||cfg().mwstH}%: ${b.mwst!=null?fm(b.mwst)+' '+cfg().currency:''}`,b.cat||'',b.garantieBis?'Garantie bis '+fd(b.garantieBis):''].filter(Boolean).join('  ·  ');
  pdf.text(meta,3,mmH-3);
  pdf.save(`${b.belegNr||'beleg'}.pdf`);
  toast(b.belegNr+' als PDF gespeichert ✓','ok');
}
async function belegPDFBytes(b){
  if(typeof window.jspdf==='undefined')return null;
  const{jsPDF}=window.jspdf;
  const img=new Image();await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=b.image;});
  const sc=Math.min(1,1200/img.naturalWidth);const cw=img.naturalWidth*sc,ch=img.naturalHeight*sc;
  const cv=document.createElement('canvas');cv.width=cw;cv.height=ch;
  const ctx=cv.getContext('2d');ctx.drawImage(img,0,0,cw,ch);
  if(b.type==='er'){
    const sw=300,sh=110,sx=cw-sw-12,sy=ch-sh-12;ctx.fillStyle='rgba(255,255,255,.93)';ctx.fillRect(sx,sy,sw,sh);
    const tmp=document.createElement('canvas');tmp.width=sw;tmp.height=sh;drawStamp(tmp,stamp,b.belegNr||'ER-????',stampTpl);ctx.drawImage(tmp,sx,sy);
  }
  const imgData=cv.toDataURL('image/jpeg',.92);const mmW=210,mmH=Math.round(mmW*(ch/cw));
  const pdf=new jsPDF({orientation:mmH>mmW?'portrait':'landscape',unit:'mm',format:[mmW,mmH]});
  pdf.addImage(imgData,'JPEG',0,0,mmW,mmH,undefined,'FAST');
  const fh=11;pdf.setFillColor(255,255,255);pdf.rect(0,mmH-fh,mmW,fh,'F');
  pdf.setFont('helvetica','normal');pdf.setFontSize(7);pdf.setTextColor(80);
  const meta=[b.belegNr||'',b.type==='er'?'Eingangsrechnung':'Ausgangsrechnung',fd(b.date),b.shop||'',b.brutto!=null?fm(b.brutto)+' '+cfg().currency:'',b.cat||'',b.garantieBis?'Garantie bis '+fd(b.garantieBis):''].filter(Boolean).join('  ·  ');
  pdf.text(meta,3,mmH-3);return pdf.output('arraybuffer');
}

async function belegPDFBytesCompressed(b){
  if(typeof window.jspdf==='undefined')return null;
  const{jsPDF}=window.jspdf;
  const img=new Image();await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=b.image;});

  // Kompression: Ziel < 100KB
  let quality = 0.60;
  let grayscale = false;
  let scale = Math.min(1, 600 / Math.max(img.naturalWidth, img.naturalHeight));
  let cw = img.naturalWidth * scale, ch = img.naturalHeight * scale;
  let size = 0;
  let attempts = 0;

  while(size === 0 || size > 100*1024 && attempts < 10){
    const cv=document.createElement('canvas');
    cv.width=cw; cv.height=ch;
    const ctx=cv.getContext('2d');
    ctx.drawImage(img,0,0,cw,ch);
    if(grayscale){
      const imageData = ctx.getImageData(0,0,cw,ch);
      const data = imageData.data;
      for(let i=0;i<data.length;i+=4){
        const gray = data[i]*0.299 + data[i+1]*0.587 + data[i+2]*0.114;
        data[i]=data[i+1]=data[i+2]=gray;
      }
      ctx.putImageData(imageData,0,0);
    }
    if(b.type==='er'){
      const sw=300,sh=110,sx=cw-sw-12,sy=ch-sh-12;ctx.fillStyle='rgba(255,255,255,.93)';ctx.fillRect(sx,sy,sw,sh);
      const tmp=document.createElement('canvas');tmp.width=sw;tmp.height=sh;drawStamp(tmp,stamp,b.belegNr||'ER-????',stampTpl);ctx.drawImage(tmp,sx,sy);
    }
    const imgData=cv.toDataURL('image/jpeg', quality);
    const mmW=210,mmH=Math.round(mmW*(ch/cw));
    const pdf=new jsPDF({orientation:mmH>mmW?'portrait':'landscape',unit:'mm',format:[mmW,mmH]});
    pdf.addImage(imgData,'JPEG',0,0,mmW,mmH,undefined,'FAST');
    const fh=11;pdf.setFillColor(255,255,255);pdf.rect(0,mmH-fh,mmW,fh,'F');
    pdf.setFont('helvetica','normal');pdf.setFontSize(7);pdf.setTextColor(80);
    const meta=[b.belegNr||'',b.type==='er'?'Eingangsrechnung':'Ausgangsrechnung',fd(b.date),b.shop||'',b.brutto!=null?fm(b.brutto)+' '+cfg().currency:'',b.cat||'',b.garantieBis?'Garantie bis '+fd(b.garantieBis):''].filter(Boolean).join('  ·  ');
    pdf.text(meta,3,mmH-3);
    const buffer = pdf.output('arraybuffer');
    size = buffer.byteLength;

    if(size > 100*1024){
      if(quality > 0.30){
        quality -= 0.10;
      }else if(!grayscale){
        grayscale = true;
      }else{
        scale *= 0.9; // Weiter verkleinern
        cw = img.naturalWidth * scale;
        ch = img.naturalHeight * scale;
      }
    }
    attempts++;
  }

  if(size > 100*1024){
    console.warn(`PDF für ${b.belegNr} ist ${Math.round(size/1024)}KB - Lesbarkeit könnte eingeschränkt sein`);
  }

  return pdf.output('arraybuffer');
}

async function exportStamped(){loadStamp();if(!curDet?.image){toast('Kein Bild','er');return;}await exportBelegPDF(curDet,true);}

// ════════════════════════════════════════════════════════
// ██ MODUL: STEMPEL
// ════════════════════════════════════════════════════════
function loadStamp(){stamp.firma=localStorage.getItem('sf')||'';stamp.frei=localStorage.getItem('sfr')||'';stamp.color=localStorage.getItem('sc')||'#b71c1c';}
function loadStampUI(){
  loadStamp();document.getElementById('sFirma').value=stamp.firma;document.getElementById('sFrei').value=stamp.frei;
  document.getElementById('cPick').value=stamp.color;document.querySelectorAll('.csw').forEach(s=>s.classList.toggle('on',s.dataset.c===stamp.color));
  pickTpl(stampTpl); // WHY: pickTpl setzt inline styles explizit – toggle allein nicht zuverlässig
}
function pickTpl(i){
  stampTpl=parseInt(i);
  localStorage.setItem('stpl',String(stampTpl));
  // Alle entfernen, dann aktiven setzen – kein toggle-Zustandsproblem
  for(let j=0;j<3;j++){
    const el=document.getElementById('tpl'+j);
    if(!el) continue;
    el.classList.remove('on');
    el.style.borderColor='';el.style.color='';el.style.background='';el.style.fontWeight='';
  }
  const active=document.getElementById('tpl'+stampTpl);
  if(active){
    active.classList.add('on');
    active.style.borderColor='var(--gold)';
    active.style.color='var(--gold)';
    active.style.background='rgba(186,142,67,.12)';
    active.style.fontWeight='500';
  }
  refreshStamp();
}
function pickCol(el){document.querySelectorAll('.csw').forEach(s=>s.classList.remove('on'));el.classList.add('on');stamp.color=el.dataset.c;document.getElementById('cPick').value=stamp.color;refreshStamp();}
function freeCol(inp){stamp.color=inp.value;document.querySelectorAll('.csw').forEach(s=>s.classList.remove('on'));refreshStamp();}
function refreshStamp(){stamp.firma=document.getElementById('sFirma').value;stamp.frei=document.getElementById('sFrei').value;const previewNr='ER-'+new Date().getFullYear()+'-Q'+Math.ceil((new Date().getMonth()+1)/3)+'-0001';drawStamp(document.getElementById('stmpC'),stamp,previewNr,0);}
function saveStamp(){localStorage.setItem('sf',stamp.firma);localStorage.setItem('sfr',stamp.frei);localStorage.setItem('sc',stamp.color);toast('Stempel gespeichert','ok');}
// WHY: Einheitlicher Stempel – kein Stil-Wechsel.
// Format: EINGANGSRECHNUNG / Jahr · Quartal · Nummer / Firma / Datum
function drawStamp(cv,cfg2,nr,tpl=0){
  const ctx=cv.getContext('2d'),W=cv.width,H=cv.height,p=10,col=cfg2.color||'#b71c1c';
  ctx.clearRect(0,0,W,H);ctx.save();
  // Doppelrahmen
  ctx.strokeStyle=col;ctx.lineWidth=2.5;ctx.strokeRect(p,p,W-p*2,H-p*2);
  ctx.lineWidth=0.7;ctx.strokeRect(p+4,p+4,W-p*2-8,H-p*2-8);
  ctx.fillStyle=col;ctx.textAlign='center';
  // Typ-Zeile
  const typ=nr.startsWith('AR')||nr.startsWith('ar')?'AUSGANGSRECHNUNG':'EINGANGSRECHNUNG';
  ctx.font=`bold 9px 'Inter',sans-serif`;ctx.letterSpacing='2px';
  ctx.fillText(typ,W/2,p+17);
  // Belegnummer groß
  ctx.font=`bold 17px 'Courier New',monospace`;ctx.letterSpacing='0px';
  ctx.fillText(nr,W/2,p+37);
  // Trennlinie
  ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(p+10,p+43);ctx.lineTo(W-p-10,p+43);ctx.stroke();
  // Firma
  if(cfg2.firma){ctx.font=`300 9px 'Inter',sans-serif`;ctx.fillText(cfg2.firma.substring(0,46),W/2,p+55);}
  // Datum
  ctx.font=`300 9px monospace`;ctx.fillText(new Date().toLocaleDateString('de-DE'),W/2,p+68);
  if(cfg2.frei){ctx.font=`300 8px sans-serif`;ctx.fillText(cfg2.frei.substring(0,52),W/2,p+80);}
  ctx.restore();
}

// ════════════════════════════════════════════════════════
// ██ MODUL: KONTOAUSZUG-ABGLEICH
// WHY: Nutzer fotografiert Kontoauszug → KI liest Buchungen →
// Abgleich gegen alle Belege (priv+biz) → unbekannte Buchungen
// werden mit KI-Vorschlag angezeigt, Nutzer entscheidet.
// ════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════
// ██ MODUL: KONTOAUSZUG-ABGLEICH v2
// WHY: Buchungen persistent in localStorage – bleiben auch
// nach Tab-Wechsel erhalten. Multi-Upload-Queue verarbeitet
// mehrere Fotos sequenziell. Status (offen/erfasst/ignoriert)
// wird pro Buchung gespeichert.
// ════════════════════════════════════════════════════════
const KONTO_STORE = 'bsp_konto_v2';
let kontoQueue = []; // Datei-Queue für Batch-Upload
let kontoRunning = false;

// Buchungen laden/speichern
function kontoLoad(){ try{ return JSON.parse(localStorage.getItem(KONTO_STORE)||'[]'); }catch(_){ return []; } }
function kontoSave(arr){ localStorage.setItem(KONTO_STORE, JSON.stringify(arr)); }

function initKontoView(){
  loadLastBank();
  renderKontoBuchungen();
  updKontoStatus();
}

async function updKontoStatus(){
  const alle = await dbKontoBuchungen();
  const offen = alle.filter(t=>t.status==='offen').length;
  const lbl = document.getElementById('kontoStatusLbl');
  if(lbl) lbl.textContent = alle.length===0 ? 'Noch keine Buchungen geladen' : `${alle.length} Buchungen · ${offen} offen`;
}

function setKontoLog(m,p){
  const el=document.getElementById('kontoLog'); if(el) el.textContent=m;
  if(p!==undefined){ const f=document.getElementById('kontoFill'); if(f) f.style.width=p+'%'; }
}

// ── Multi-Upload Queue ──
function kontoQueueAdd(inp){
  const bankName = document.getElementById('kontoBankInput').value.trim();
  if (!bankName) {
    toast('Bitte zuerst eine Bank eingeben', 'er');
    return;
  }
  
  const files=Array.from(inp.files||[]);
  if(!files.length) return;
  
  // Bank-Name zu jedem File hinzufügen
  files.forEach(f => f.bankName = bankName);
  
  kontoQueue.push(...files);
  renderKontoQueue();
  try{inp.value='';}catch(_){}
  
  // Bank merken
  rememberBank(bankName);
}

function openBankManager() {
  // Einfacher Dialog für Bank-Verwaltung
  const bankName = prompt('Neue Bank hinzufügen (Name):');
  if (bankName && bankName.trim()) {
    addBank(bankName.trim());
  }
}

async function addBank(name) {
  try {
    const id = await dbAddBank({name: name, createdAt: Date.now()});
    toast(`Bank "${name}" hinzugefügt`, 'ok');
    loadBanks();
  } catch (e) {
    toast('Fehler beim Hinzufügen', 'er');
  }
}

async function loadBanks() {
  try {
    const banks = await dbBanks();
    const select = document.getElementById('kontoBankSelect');
    select.innerHTML = '<option value="">Bank wählen...</option>';
    banks.forEach(bank => {
      const opt = document.createElement('option');
      opt.value = bank.id;
      opt.textContent = bank.name;
      select.appendChild(opt);
    });
  } catch (e) {
    console.error('Fehler beim Laden der Banken:', e);
  }
}

async function addBankPrompt() {
  const name = prompt('Neue Bank hinzufügen (Name):');
  if (name && name.trim()) {
    await addBank(name.trim());
  }
}

async function deleteBank(id) {
  if (!confirm('Bank wirklich löschen? Alle zugehörigen Buchungen werden entfernt.')) return;
  try {
    // Lösche Bank
    await dbDelBank(id);
    // Lösche zugehörige Buchungen
    const buchungen = await dbKontoBuchungen();
    for (const b of buchungen) {
      if (b.bankId === id) {
        await dbDelKontoBuchung(b.id);
      }
    }
    toast('Bank und Buchungen gelöscht', 'ok');
    loadBanks();
    loadBankList();
    renderKontoBuchungen();
    updKontoStatus();
  } catch (e) {
    toast('Fehler beim Löschen', 'er');
  }
}

async function loadBankList() {
  try {
    const banks = await dbBanks();
    const list = document.getElementById('bankList');
    if (!banks.length) {
      list.innerHTML = '<p style="font-size:11px;color:var(--txt3)">Noch keine Banken hinzugefügt.</p>';
      return;
    }
    list.innerHTML = banks.map(bank => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--br)">
        <span style="font-size:12px;color:var(--txt)">${eh(bank.name)}</span>
        <button class="btn btn-red btn-sm" style="font-size:10px;padding:4px 8px" onclick="deleteBank(${bank.id})">Löschen</button>
      </div>
    `).join('');
  } catch (e) {
    console.error('Fehler beim Laden der Bankliste:', e);
  }
}

function rememberBank(bankName) {
  localStorage.setItem('lastBank', bankName);
}

function loadLastBank() {
  const lastBank = localStorage.getItem('lastBank');
  if (lastBank) {
    document.getElementById('kontoBankInput').value = lastBank;
  }
}

function renderKontoQueue(){
  const wrap=document.getElementById('kontoQueue');
  const list=document.getElementById('kontoQueueList');
  if(!kontoQueue.length){ if(wrap) wrap.style.display='none'; return; }
  if(wrap) wrap.style.display='block';
  if(list) list.innerHTML=kontoQueue.map((f,i)=>`<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px"><span style="color:var(--txt3)">${i+1}.</span> <span>${f.name||'Foto '+(i+1)}</span></div>`).join('');
}

async function kontoQueueStart(){
  apiKey=localStorage.getItem('cak')||apiKey||'';
  if(!apiKey){toast('Bitte erst API Key hinterlegen','er');openApiSheet();return;}
  if(kontoRunning){toast('Analyse läuft bereits …','wr');return;}
  if(!kontoQueue.length){toast('Keine Dateien in der Warteschlange','wr');return;}

  kontoRunning=true;
  const btn=document.getElementById('kontoQueueBtn');
  if(btn){btn.disabled=true;btn.textContent='⏳ Analysiere …';}
  document.getElementById('kontoProg').style.display='block';

  const total=kontoQueue.length;
  for(let i=0;i<total;i++){
    const f=kontoQueue[i];
    setKontoLog(`📷 Bild ${i+1} von ${total}: ${f.name||'Foto'}`,Math.round((i/total)*80));
    await kontoAnalyseFile(f);
  }
  kontoQueue=[];
  renderKontoQueue();
  setKontoLog(`✓ Alle ${total} Bilder analysiert`,100);
  setTimeout(()=>document.getElementById('kontoProg').style.display='none',1500);
  kontoRunning=false;
  if(btn){btn.disabled=false;btn.textContent='Alle analysieren starten';}
  await kontoAbgleichAlle();
  renderKontoBuchungen();
  updKontoStatus();
}

async function kontoAnalyseFile(file){
  return new Promise(res=>{
    const reader=new FileReader();
    reader.onload=async e=>{
      try{
        const raw=e.target.result;
        const compressed=await compressImage(raw,1024,0.82);
        const mt=compressed.startsWith('data:image/png')?'image/png':'image/jpeg';
        const imgData=compressed.split(',')[1];

        const prompt=`Du bist ein präziser Kontoauszug-Scanner für deutsche Bankkonten.

Lies ALLE sichtbaren Kontobuchungen/Transaktionen aus diesem Kontoauszug oder Banking-Screenshot.

ANTWORTE NUR mit einem JSON-Array, ohne Erklärung, ohne Markdown:
[{"datum":"YYYY-MM-DD","betrag":-29.99,"beschreibung":"REWE SAGT DANKE","typ":"ausgabe"}]

REGELN:
- betrag: negative Zahl für Ausgaben, positive für Eingänge
- datum: immer YYYY-MM-DD Format
- beschreibung: exakt wie auf dem Auszug
- typ: "ausgabe" oder "eingang"
- Nur echte Buchungen, keine Salden`;

        trackApiCost('konto', imgData.length);

        const resp=await fetch('https://api.anthropic.com/v1/messages',{
          method:'POST',
          headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
          body:JSON.stringify({model:'claude-sonnet-4-5',max_tokens:2000,messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:mt,data:imgData}},{type:'text',text:prompt}]}]})
        });
        const txt=await resp.text().catch(()=>'');
        if(!resp.ok){res();return;}
        let data;try{data=JSON.parse(txt);}catch(_){res();return;}
        const rawText=data.content?.filter(c=>c.type==='text').map(c=>c.text).join('')||'';
        let neu=null;
        try{neu=JSON.parse(rawText.trim());}catch(_){}
        if(!neu){const m=rawText.match(/\[[\s\S]*\]/);if(m)try{neu=JSON.parse(m[0]);}catch(_){}}
        if(neu&&neu.length){
          // Zu bestehenden hinzufügen – Duplikate vermeiden (gleicher Betrag+Datum+Beschreibung+Bank)
          const existing = await dbKontoBuchungen();
          let added=0;
          for(const t of neu){
            const dup = existing.find(e => e.datum === t.datum && e.betrag === t.betrag && e.beschreibung === t.beschreibung && e.bankName === file.bankName);
            if(!dup){ 
              await dbAddKontoBuchung({...t, id: Date.now() + Math.random(), status:'offen', vorschlag:null, bankName: file.bankName}); 
              added++; 
            }
          }
          setKontoLog(`✓ +${added} neue Buchungen`,undefined);
        }
      }catch(e){console.error(e);}
      res();
    };
    reader.readAsDataURL(file);
  });
}

async function kontoAbgleichAlle(){
  const alle = await dbKontoBuchungen();
  if(!alle.length) return;
  const belege = await dba();
  for(const t of alle){
    if(t.status !== 'offen') continue;
    if(t.typ === 'eingang') continue;
    const betrag = Math.abs(t.betrag);
    const tDatum = new Date((t.datum || new Date().toISOString().split('T')[0]) + 'T00:00:00');
    const match = belege.find(b => {
      if(!b.brutto || !b.date) return false;
      return Math.abs(Math.abs(b.brutto) - betrag) <= 0.50 && Math.abs((tDatum - new Date(b.date + 'T00:00:00')) / (86400000)) <= 3;
    });
    if(match) {
      await dbAddKontoBuchung({...t, status:'abgeglichen', belegShop:match.shop, belegNr:match.belegNr});
      await dbDelKontoBuchung(t.id);
    } else {
      await dbAddKontoBuchung({...t, vorschlag: guessKategorie(t.beschreibung)});
      await dbDelKontoBuchung(t.id);
    }
  }
}

async function renderKontoBuchungen(){
  const alle = await dbKontoBuchungen();
  // Separate by new status values
  const fehlt     = alle.filter(t => t.status === 'offen'       && t.typ !== 'eingang' && !t.belegStatus ||
                                     t.status === 'offen'       && t.typ !== 'eingang' && t.belegStatus === 'kein_beleg');
  const vermutet  = alle.filter(t => t.belegStatus === 'vermutet');
  const bestaetigt= alle.filter(t => t.belegStatus === 'bestaetigt' || t.status === 'abgeglichen');
  const eingaenge = alle.filter(t => t.typ === 'eingang');

  const uSec=document.getElementById('kontoUnknownSec');
  const mSec=document.getElementById('kontoMatchedSec');

  // --- Offene / Kein-Beleg Buchungen ---
  if(fehlt.length){
    uSec.style.display='block';
    document.getElementById('kontoUnknownCount').textContent=fehlt.length+' ohne Beleg';
    document.getElementById('kontoUnknownList').innerHTML=fehlt.map(t=>{
      const id=t.id;
      const v=t.vorschlag||{kat:'Sonstiges',typ:'priv'};
      return `<div id="ku_${id}" style="background:var(--s2);border:1px solid rgba(192,64,64,.25);
        border-radius:var(--r8);padding:10px 12px;margin-bottom:8px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:7px;margin-bottom:4px">
              <span class="badge b-beleg-fehlt">🔴 Kein Beleg</span>
              ${t.bankName?`<span style="font-size:10px;color:var(--txt3)">${eh(t.bankName)}</span>`:''}
            </div>
            <div style="font-size:12px;font-weight:300;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${eh(t.beschreibung||'')}</div>
            <div style="font-size:10px;font-weight:300;color:var(--txt3)">${fd(t.datum)} · Vorschlag: ${v.kat} (${v.typ==='biz'?'Business':'Privat'})</div>
          </div>
          <div style="font-size:13px;font-weight:300;color:var(--red);margin-left:8px;flex-shrink:0">${fm(Math.abs(t.betrag))} €</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-sm" style="background:rgba(200,164,90,.1);border:1px solid rgba(200,164,90,.3);color:var(--gold);font-size:11px" onclick="kontoBelegScannen('${id}')">📷 Beleg scannen</button>
          <button class="btn btn-sm" style="background:rgba(136,153,170,.1);border:1px solid rgba(136,153,170,.25);color:var(--silv);font-size:11px" onclick="kontoErfasse('${id}','priv')">🏠 Privat erfassen</button>
          <button class="btn btn-sm" style="background:rgba(74,128,192,.1);border:1px solid rgba(74,128,192,.25);color:var(--blu);font-size:11px" onclick="kontoErfasse('${id}','biz')">💼 Business erfassen</button>
          <button class="btn btn-sm" style="background:transparent;border:1px solid var(--br);color:var(--txt3);font-size:11px" onclick="kontoIgnoriere('${id}')">— Ignorieren</button>
        </div>
      </div>`;
    }).join('');
  } else { uSec.style.display='none'; }

  // --- Vermutete Belege (KI-Vorschlag, unbestätigt) ---
  let vermSec = document.getElementById('kontoVermSec');
  if(!vermSec){
    vermSec = document.createElement('div');
    vermSec.id = 'kontoVermSec';
    vermSec.style.marginBottom = '16px';
    uSec.insertAdjacentElement('afterend', vermSec);
  }
  if(vermutet.length){
    vermSec.style.display='block';
    vermSec.innerHTML = `<div style="font-size:11px;font-weight:300;color:var(--ylw);margin-bottom:8px;letter-spacing:.3px;display:flex;justify-content:space-between">
      <span>🟡 BELEG VERMUTET (unbestätigt)</span><span style="color:var(--txt3)">${vermutet.length}</span></div>` +
    vermutet.map(t=>{
      const id=t.id;
      const vbNr  = t.vorschlagBelegNr  || '';
      const vbShop= t.vorschlagBelegShop|| t.beschreibung || '';
      return `<div id="kv_${id}" style="background:var(--s2);border:1px solid rgba(192,144,64,.3);
        border-radius:var(--r8);padding:10px 12px;margin-bottom:8px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:7px;margin-bottom:4px">
              <span class="badge b-beleg-vermutet">🟡 Beleg vermutet</span>
            </div>
            <div style="font-size:12px;font-weight:300;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${eh(t.beschreibung||'')}</div>
            <div style="font-size:10px;font-weight:300;color:var(--txt3)">${fd(t.datum)}${vbShop?' · Vermutet: '+eh(vbShop):''} ${vbNr?'('+eh(vbNr)+')':''}</div>
          </div>
          <div style="font-size:13px;font-weight:300;color:var(--ylw);margin-left:8px;flex-shrink:0">${fm(Math.abs(t.betrag))} €</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-sm" style="background:rgba(58,175,112,.1);border:1px solid rgba(58,175,112,.3);color:var(--grn);font-size:11px" onclick="kontoBestaetigenBeleg('${id}')">✓ Bestätigen</button>
          <button class="btn btn-sm" style="background:rgba(192,64,64,.08);border:1px solid rgba(192,64,64,.2);color:var(--red);font-size:11px" onclick="kontoVermutungAblehnen('${id}')">✗ Ablehnen</button>
        </div>
      </div>`;
    }).join('');
  } else { vermSec.style.display='none'; }

  // --- Abgeglichen / Bestätigt ---
  if(bestaetigt.length){
    mSec.style.display='block';
    document.getElementById('kontoMatchedList').innerHTML=bestaetigt.map(t=>`
      <div style="background:var(--s2);border:1px solid rgba(58,175,112,.15);border-radius:var(--r8);
        padding:9px 12px;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:7px;margin-bottom:3px">
            <span class="badge b-beleg-ok">🟢 ${t.belegStatus==='bestaetigt'?'Bestätigt':'Abgeglichen'}</span>
          </div>
          <div style="font-size:12px;font-weight:300;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${eh(t.beschreibung||'')}</div>
          <div style="font-size:10px;font-weight:300;color:var(--txt3)">${fd(t.datum)} · Beleg: ${eh(t.belegShop||t.vorschlagBelegShop||'')} ${eh(t.belegNr||t.vorschlagBelegNr||'')}</div>
        </div>
        <div style="color:var(--grn);font-size:13px;margin-left:8px;flex-shrink:0">${fm(Math.abs(t.betrag))} €</div>
      </div>`).join('');
  } else { mSec.style.display='none'; }
}

async function kontoErfasse(id, typ){
  const alle = await dbKontoBuchungen();
  const t = alle.find(x => String(x.id) === String(id));
  if(!t) return;

  const v = t.vorschlag || {kat:'Sonstiges',typ:'priv'};
  const item = {
    type: typ === 'priv' ? 'priv' : 'er',
    belegNr: typ === 'priv' ? null : nextNr('er'),
    shop: t.beschreibung || 'Kontoauszug',
    date: t.datum || new Date().toISOString().split('T')[0],
    brutto: Math.abs(t.betrag),
    net: typ === 'priv' ? null : Math.round(Math.abs(t.betrag) / 1.19 * 100) / 100,
    mwst: typ === 'priv' ? null : Math.round((Math.abs(t.betrag) - Math.abs(t.betrag) / 1.19) * 100) / 100,
    mwstRate: typ === 'priv' ? null : 19,
    cat: v.kat, payment: 'Karte',
    items: [], image: null, savedAt: Date.now(),
    istAbo: false, garantieBis: null, isDigitalScreen: false, screenType: null
  };

  try {
    await dbadd(item);
    // Status updaten
    await dbAddKontoBuchung({...t, status: 'erfasst_' + typ});
    await dbDelKontoBuchung(t.id);
    toast('Erfasst als ' + (typ === 'priv' ? 'Privat' : 'Business') + ' ✓', 'ok');
    if(typ === 'biz') renderMwst();
    renderHome();
    renderKontoBuchungen();
    updKontoStatus();
    // Erneut abgleichen damit neue Belege gematcht werden
    setTimeout(async() => { await kontoAbgleichAlle(); renderKontoBuchungen(); }, 300);
  } catch(e) { toast('Fehler: ' + e.message, 'er'); }
}

async function kontoIgnoriere(id){
  const alle = await dbKontoBuchungen();
  const t = alle.find(x => String(x.id) === String(id));
  if(t) {
    await dbAddKontoBuchung({...t, status: 'ignoriert'});
    await dbDelKontoBuchung(t.id);
  }
  renderKontoBuchungen();
  updKontoStatus();
}

async function kontoAllesLoeschen(){
  if(!confirm('Alle Kontoauszug-Daten löschen?')) return;
  const alle = await dbKontoBuchungen();
  for(const b of alle) {
    await dbDelKontoBuchung(b.id);
  }
  renderKontoBuchungen();
  updKontoStatus();
  toast('Kontoauszug-Daten gelöscht','ok');
}

// ════════════════════════════════════════════════════════
// ██ MODUL: BELEG-STATUS FUNKTIONEN
// WHY: Jede Kontobuchung bekommt expliziten Beleg-Status:
// kein_beleg → vermutet → bestaetigt
// ════════════════════════════════════════════════════════

// Merkt die aktuelle KontoBuchung-ID für nachträgliches Einsortieren
let _aktiverKontoBuchungId = null;

function kontoBelegScannen(buchungId){
  // Buchung-ID merken, damit saveBeleg() danach zuordnen kann
  _aktiverKontoBuchungId = buchungId;
  // Scanner öffnen
  openScanner();
  toast('Bitte den fehlenden Beleg scannen …', 'wr');
}

async function kontoBestaetigenBeleg(id){
  const alle = await dbKontoBuchungen();
  const t = alle.find(x => String(x.id) === String(id));
  if(!t) return;
  await dbAddKontoBuchung({...t, belegStatus: 'bestaetigt'});
  await dbDelKontoBuchung(t.id);
  toast('Beleg bestätigt ✓', 'ok');
  renderKontoBuchungen();
  updKontoStatus();
}

async function kontoVermutungAblehnen(id){
  const alle = await dbKontoBuchungen();
  const t = alle.find(x => String(x.id) === String(id));
  if(!t) return;
  // Zurück auf offen / kein_beleg setzen
  await dbAddKontoBuchung({...t, belegStatus: 'kein_beleg', vorschlagBelegId: null, vorschlagBelegNr: null, vorschlagBelegShop: null});
  await dbDelKontoBuchung(t.id);
  toast('Zuordnung abgelehnt – Buchung zurück auf "Kein Beleg"', 'wr');
  renderKontoBuchungen();
  updKontoStatus();
}

// ════════════════════════════════════════════════════════
// ██ KI-GESAMT-ABGLEICH: Alle offenen Buchungen vs. alle Belege
// WHY: Nutzer kann jederzeit auf Knopfdruck alle noch offenen
// Buchungen durch Claude mit allen Belegen abgleichen lassen.
// Claude gibt Paarungen zurück → belegStatus='vermutet'
// ════════════════════════════════════════════════════════
async function kontoKiGesamt(){
  apiKey = localStorage.getItem('cak') || apiKey || '';
  if(!apiKey){ toast('Bitte erst API Key hinterlegen', 'er'); openApiSheet(); return; }

  const alle = await dbKontoBuchungen();
  const offene = alle.filter(t => (t.status === 'offen' || !t.belegStatus) && t.typ !== 'eingang');
  if(!offene.length){ toast('Keine offenen Buchungen zum Abgleichen', 'wr'); return; }

  const belege = await dba();
  const bizBelege = belege.filter(b => b.type !== 'priv');
  if(!bizBelege.length){ toast('Keine Belege vorhanden', 'wr'); return; }

  toast('🤖 KI vergleicht alles …', 'wr');

  // Buchungen und Belege als kompakte Listen für Claude
  const buchungsListe = offene.map((t,i) => `B${i+1}: ${t.datum||'?'} | ${fm(Math.abs(t.betrag))} € | ${(t.beschreibung||'').substring(0,50)}`).join('\n');
  const belegListe = bizBelege.slice(0, 80).map((b,i) => `R${i+1}: ${b.date||'?'} | ${fm(b.brutto||0)} € | ${(b.shop||'').substring(0,40)} | ${b.belegNr||''}`).join('\n');

  const prompt = `Du bist ein Buchhalter-Assistent. Gleiche Konteauszug-Buchungen mit Belegen ab.

KONTOBUCHUNGEN (B1-B${offene.length}):
${buchungsListe}

BELEGE (R1-R${Math.min(bizBelege.length,80)}):
${belegListe}

Antworte NUR mit einem JSON-Array von Paarungen, ohne Erklärung, ohne Markdown:
[{"buchung":"B1","beleg":"R3","sicher":true},{"buchung":"B2","beleg":"R7","sicher":false}]

REGELN:
- Nur wenn Betrag  ±1€ UND Datum  ±5 Tage passen → Paarung
- sicher:true wenn Betrag exakt und Datum  ±2 Tage
- Wenn keine passende Paarung: nicht aufnehmen
- Antwort: nur das JSON-Array, nichts anderes`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body: JSON.stringify({model:'claude-sonnet-4-5',max_tokens:1000,messages:[{role:'user',content:prompt}]})
    });
    trackApiCost('ki_abgleich');
    const txt = await resp.text().catch(() => '');
    if(!resp.ok){ toast('KI-Fehler beim Abgleich', 'er'); return; }
    let data; try{ data = JSON.parse(txt); } catch(_){ toast('Antwort-Fehler', 'er'); return; }
    const rawText = data.content?.filter(c => c.type==='text').map(c => c.text).join('') || '';
    let paarungen = null;
    try{ paarungen = JSON.parse(rawText.trim()); } catch(_){}
    if(!paarungen){ const m = rawText.match(/\[[\s\S]*\]/); if(m) try{ paarungen = JSON.parse(m[0]); } catch(_){} }
    if(!paarungen || !paarungen.length){ toast('KI hat keine Paarungen gefunden', 'wr'); return; }

    let found = 0;
    for(const p of paarungen){
      const bi = parseInt((p.buchung||'').replace('B','')) - 1;
      const ri = parseInt((p.beleg||'').replace('R','')) - 1;
      if(bi < 0 || ri < 0 || bi >= offene.length || ri >= bizBelege.length) continue;
      const buchung = offene[bi];
      const beleg   = bizBelege[ri];
      // Update buchung → belegStatus vermutet
      await dbAddKontoBuchung({...buchung,
        belegStatus: 'vermutet',
        vorschlagBelegId: beleg.id,
        vorschlagBelegNr: beleg.belegNr,
        vorschlagBelegShop: beleg.shop
      });
      await dbDelKontoBuchung(buchung.id);
      found++;
    }
    toast(`🤖 ${found} Paarung${found!==1?'en':''} gefunden – bitte bestätigen`, found>0?'ok':'wr');
    renderKontoBuchungen();
    updKontoStatus();
  } catch(e){
    toast('KI-Fehler: ' + e.message, 'er');
  }
}

// ════════════════════════════════════════════════════════
// ██ MODUL: EXPORT-FEHLER-CHECK
// WHY: Vor dem Absenden an den Steuerberater muss alles stimmen.
// Fehlende Belege, unbestätigte Vorschläge, MwSt-Fehler – alles
// wird geprüft und dem Nutzer klar angezeigt.
// ════════════════════════════════════════════════════════
async function checkExportFehler(){
  const alle    = await dbKontoBuchungen();
  const belege  = await dba();
  const fehler  = [];
  const warnungen = [];

  // 1. Buchungen ohne Beleg
  const ohneBeleg = alle.filter(t => (t.status === 'offen' || t.belegStatus === 'kein_beleg') && t.typ !== 'eingang');
  if(ohneBeleg.length){
    fehler.push(`${ohneBeleg.length} Kontobuchung${ohneBeleg.length!==1?'en':''} ohne zugeordneten Beleg`);
  }

  // 2. Unbestätigte KI-Vermutungen
  const unbestaetigt = alle.filter(t => t.belegStatus === 'vermutet');
  if(unbestaetigt.length){
    warnungen.push(`${unbestaetigt.length} Beleg-Zuordnung${unbestaetigt.length!==1?'en':''} noch nicht bestätigt`);
  }

  // 3. Business-Belege ohne MwSt-Betrag (aber kein Kleinunternehmer)
  if(profile.typ !== 'ku'){
    const ohneMwst = belege.filter(b => b.type !== 'priv' && (b.mwst == null || b.mwst === 0) && b.brutto > 10);
    if(ohneMwst.length){
      warnungen.push(`${ohneMwst.length} Beleg${ohneMwst.length!==1?'e':''} ohne MwSt-Betrag (bitte prüfen)`);
    }

    // 4. MwSt-Rechenfehler (Netto × (1+Satz/100) ≠ Brutto, Abweichung > 0.10€)
    const mwstFehler = belege.filter(b => {
      if(b.type === 'priv' || !b.brutto || !b.net || !b.mwstRate) return false;
      const expected = Math.round(b.net * (1 + b.mwstRate / 100) * 100) / 100;
      return Math.abs(expected - (b.brutto||0)) > 0.10;
    });
    if(mwstFehler.length){
      warnungen.push(`${mwstFehler.length} Beleg${mwstFehler.length!==1?'e':''} mit MwSt-Rechenfehler (Netto × Satz ≠ Brutto)`);
    }
  }

  return { fehler, warnungen };
}

async function renderExportWarnBox(){
  const box = document.getElementById('exportWarnBox');
  if(!box) return;
  const { fehler, warnungen } = await checkExportFehler();
  if(!fehler.length && !warnungen.length){ box.style.display = 'none'; return; }

  const isCritical = fehler.length > 0;
  box.style.display = 'block';
  box.innerHTML = `<div class="export-warn ${isCritical?'critical':''}">
    <div class="ew-title">${isCritical?'⚠️':'ℹ️'} ${isCritical?'Fehler vor Export':'Hinweise vor Export'}</div>
    <ul>
      ${fehler.map(f  => `<li style="color:var(--red)">${eh(f)}</li>`).join('')}
      ${warnungen.map(w => `<li>${eh(w)}</li>`).join('')}
    </ul>
    ${isCritical?`<div style="font-size:10px;font-weight:300;color:var(--txt3);margin-top:8px;line-height:1.5">
      Fehlende Belege im Konto-Tab nachscannen oder als "Ignorieren" markieren.</div>`:''}
  </div>`;
}

// WHY: Kleine Bar-Ausgaben, Eis, Trinkgeld etc. haben keine Quittung.
// Spracheingabe über Web Speech API (nativ in iOS Safari).
// ════════════════════════════════════════════════════════
let micActive=false, recognition=null;

function openSchnell(){
  document.getElementById('sDate').value=new Date().toISOString().split('T')[0];
  document.getElementById('sShop').value='';
  document.getElementById('sBrutto').value='';
  document.getElementById('micTranscript').style.display='none';
  document.getElementById('micTranscript').textContent='';
  document.getElementById('schnellOvl').classList.add('on');
}
function closeSchnell(){document.getElementById('schnellOvl').classList.remove('on');stopMic();}
function closeSchnellOuter(e){if(e.target===document.getElementById('schnellOvl'))closeSchnell();}

function toggleMic(){
  if(micActive) stopMic();
  else startMic();
}

function startMic(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){toast('Spracheingabe nicht unterstützt','er');return;}
  recognition=new SR();
  recognition.lang='de-DE';
  recognition.continuous=false;
  recognition.interimResults=true;
  recognition.onstart=()=>{
    micActive=true;
    document.getElementById('micBtn').style.background='rgba(192,64,64,.15)';
    document.getElementById('micBtn').style.borderColor='rgba(192,64,64,.4)';
    document.getElementById('micBtn').style.color='var(--red)';
    document.getElementById('micLbl').textContent='🔴 Aufnahme läuft …';
    document.getElementById('micTranscript').style.display='block';
    document.getElementById('micTranscript').textContent='…';
  };
  recognition.onresult=e=>{
    const transcript=Array.from(e.results).map(r=>r[0].transcript).join('');
    document.getElementById('micTranscript').textContent=transcript;
    if(e.results[e.results.length-1].isFinal) parseSprachEingabe(transcript);
  };
  recognition.onerror=()=>stopMic();
  recognition.onend=()=>stopMic();
  recognition.start();
}

function stopMic(){
  micActive=false;
  if(recognition) try{recognition.stop();}catch(_){}
  recognition=null;
  document.getElementById('micBtn').style.background='';
  document.getElementById('micBtn').style.borderColor='';
  document.getElementById('micBtn').style.color='';
  document.getElementById('micLbl').textContent='🎤 Sprechen';
}

// WHY: Einfaches NLP – erkennt Betrag und Kategorie aus Freitext
// z.B. "Eis 2,50 Lebensmittel" oder "Kaffee 3 Euro bar"
function parseSprachEingabe(text){
  const t=text.toLowerCase();

  // Betrag extrahieren: "2,50" "3 euro" "1.80"
  const betragMatch=t.match(/(\d+[.,]\d{1,2}|\d+)\s*(?:euro|€|eur)?/);
  if(betragMatch){
    const betrag=parseFloat(betragMatch[1].replace(',','.'));
    if(betrag>0) document.getElementById('sBrutto').value=betrag.toFixed(2);
  }

  // Kategorie erkennen
  const v=guessKategorie(text);
  document.getElementById('sCat').value=v.kat;

  // Shop-Name: alles vor dem Betrag
  const shopRaw=text.replace(/\d+[.,]?\d*\s*(?:euro|€|eur)?/i,'').replace(/\s+/g,' ').trim();
  if(shopRaw) document.getElementById('sShop').value=shopRaw.charAt(0).toUpperCase()+shopRaw.slice(1);
}

function parseManualSprachEingabe(text){
  const t=text.toLowerCase();

  // Betrag extrahieren
  const betragMatch=t.match(/(\d+[.,]\d{1,2}|\d+)\s*(?:euro|€|eur)?/);
  if(betragMatch){
    const betrag=parseFloat(betragMatch[1].replace(',','.'));
    if(betrag>0) document.getElementById('mBrutto').value=betrag.toFixed(2);
  }

  // Kategorie erkennen (Business-Kategorien)
  const v=guessBusinessKategorie(text);
  document.getElementById('mCat').value=v.kat;

  // Shop-Name: alles vor dem Betrag
  const shopRaw=text.replace(/\d+[.,]?\d*\s*(?:euro|€|eur)?/i,'').replace(/\s+/g,' ').trim();
  if(shopRaw) document.getElementById('mShop').value=shopRaw.charAt(0).toUpperCase()+shopRaw.slice(1);
}

function guessBusinessKategorie(text){
  const t=text.toLowerCase();
  if(t.includes('büro')||t.includes('papier')||t.includes('drucker')) return {kat:'Bürobedarf'};
  if(t.includes('software')||t.includes('lizenz')||t.includes('programm')) return {kat:'Software'};
  if(t.includes('beratung')||t.includes('consulting')) return {kat:'Beratung'};
  if(t.includes('marketing')||t.includes('werbung')) return {kat:'Marketing'};
  if(t.includes('reise')||t.includes('flug')||t.includes('hotel')) return {kat:'Reisen'};
  if(t.includes('fortbildung')||t.includes('seminar')||t.includes('schulung')) return {kat:'Fortbildung'};
  if(t.includes('auto')||t.includes('fahrzeug')||t.includes('reparatur')) return {kat:'Fahrzeug'};
  if(t.includes('telefon')||t.includes('internet')||t.includes('mobilfunk')) return {kat:'Telefon/Internet'};
  return {kat:'Sonstiges'};
}

async function saveSchnell(){
  const shop=document.getElementById('sShop').value.trim()||'Schnelleingabe';
  const brutto=parseFloat(document.getElementById('sBrutto').value)||0;
  if(!brutto){toast('Bitte Betrag eingeben','er');return;}
  const item={
    type:'priv',belegNr:null,
    shop,
    date:document.getElementById('sDate').value||new Date().toISOString().split('T')[0],
    brutto,net:null,mwst:null,mwstRate:null,
    cat:document.getElementById('sCat').value,
    payment:document.getElementById('sPay').value,
    items:[],image:null,savedAt:Date.now(),
    istAbo:false,garantieBis:null,isDigitalScreen:false,screenType:null
  };
  try{
    await dbadd(item);
    toast(shop+' ('+fm(brutto)+' €) gespeichert ✓','ok');
    closeSchnell();
    renderPrivatBelege();
    renderHome();
  }catch(e){toast('Fehler: '+e.message,'er');}
}

// ════════════════════════════════════════════════════════
// ██ MODUL: PRIVAT KREISDIAGRAMM + OPTIMIERUNGSPOTENTIAL
// WHY: Nutzer soll sofort sehen wo das Geld hingeht
// und wie viel theoretisch gespart werden könnte.
// ════════════════════════════════════════════════════════

// Farben für Kategorien – konsistent
const KATFARBEN={
  'Lebensmittel':'#4a9e6b','Restaurant':'#c07030','Elektronik':'#4a80c0',
  'Kleidung':'#9b59b6','Tanken':'#e74c3c','Haushalt':'#27ae60',
  'Gesundheit':'#1abc9c','Freizeit':'#f39c12','Reise':'#3498db','Sonstiges':'#7f8c8d'
};

// Kategorien wo Einsparpotential realistisch ist (in %)
const KATSPARPOT={'Restaurant':0.30,'Kleidung':0.25,'Elektronik':0.20,'Freizeit':0.25,'Reise':0.15,'Sonstiges':0.10};

// WHY: Diagramm nach einzelnen POSITIONEN (items) – nicht Kategorien.
// So sieht man z.B. "Gemüse 3,20€ · Brot 1,80€ · Milch 1,20€" statt nur "Lebensmittel"
// Palette generiert – für viele verschiedene Artikel
function itemColor(i){
  const pal=['#4a9e6b','#4a80c0','#c07030','#9b59b6','#e74c3c','#27ae60',
             '#1abc9c','#f39c12','#3498db','#7f8c8d','#e67e22','#2ecc71',
             '#8e44ad','#c0392b','#16a085','#d35400','#2980b9','#27ae60'];
  return pal[i%pal.length];
}

function renderPrivatChart(belege){
  const wrap=document.getElementById('privChartWrap');
  const optCard=document.getElementById('privOptCard');
  if(!belege||!belege.length){
    wrap.style.display='none';
    if(optCard)optCard.style.display='none';
    return;
  }

  // WHY: Alle items aus allen Belegen aggregieren
  const byItem={};
  let totalItems=0;
  belege.forEach(b=>{
    if(b.items&&b.items.length){
      b.items.forEach(it=>{
        const name=(it.name||'Sonstiges').trim();
        const v=parseFloat(it.price)||0;
        byItem[name]=(byItem[name]||0)+v;
        totalItems+=v;
      });
    }
  });

  // Wenn keine Items → fallback auf Kategorien
  const useItems=totalItems>0;
  const byCat={};
  if(!useItems){
    belege.forEach(b=>{const k=b.cat||'Sonstiges';byCat[k]=(byCat[k]||0)+(b.brutto||0);});
  }

  const rawEntries=useItems
    ? Object.entries(byItem).sort((a,b)=>b[1]-a[1])
    : Object.entries(byCat).sort((a,b)=>b[1]-a[1]);

  // Top 12 anzeigen, Rest als "Sonstiges" zusammenfassen
  let entries=rawEntries.slice(0,12);
  if(rawEntries.length>12){
    const restSum=rawEntries.slice(12).reduce((s,[,v])=>s+v,0);
    if(restSum>0) entries.push(['Sonstiges',restSum]);
  }

  const total=entries.reduce((s,[,v])=>s+v,0);
  if(!total){wrap.style.display='none';if(optCard)optCard.style.display='none';return;}

  // Einsparpotential (einfache 15% Schätzung auf Gesamtausgaben)
  if(optCard){
    document.getElementById('privOptBetrag').textContent=fm(total*0.15)+' €';
    optCard.style.display='flex';
  }

  // SVG Donut
  const svg=document.getElementById('privPieChart');
  const cx=55,cy=55,r=48,ri=22;
  let startAngle=-Math.PI/2;
  let paths='';
  entries.forEach(([name,val],i)=>{
    const angle=(val/total)*Math.PI*2;
    const endAngle=startAngle+angle;
    const x1=cx+r*Math.cos(startAngle),y1=cy+r*Math.sin(startAngle);
    const x2=cx+r*Math.cos(endAngle),y2=cy+r*Math.sin(endAngle);
    const ix1=cx+ri*Math.cos(startAngle),iy1=cy+ri*Math.sin(startAngle);
    const ix2=cx+ri*Math.cos(endAngle),iy2=cy+ri*Math.sin(endAngle);
    const large=angle>Math.PI?1:0;
    paths+=`<path d="M${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${large},1 ${x2.toFixed(1)},${y2.toFixed(1)} L${ix2.toFixed(1)},${iy2.toFixed(1)} A${ri},${ri} 0 ${large},0 ${ix1.toFixed(1)},${iy1.toFixed(1)} Z" fill="${itemColor(i)}" stroke="var(--bg)" stroke-width="1.5"/>`;
    startAngle=endAngle;
  });
  // Mittlerer Text: Gesamtsumme
  paths+=`<text x="55" y="51" text-anchor="middle" font-size="12" font-weight="300" fill="var(--txt)" font-family="Inter,sans-serif">${fm(total)}</text>`;
  paths+=`<text x="55" y="63" text-anchor="middle" font-size="8" font-weight="300" fill="var(--txt3)" font-family="Inter,sans-serif">gesamt</text>`;
  svg.innerHTML=paths;
  wrap.style.display='block';

  // Legende
  const leg=document.getElementById('privPieLegend');
  leg.innerHTML=entries.map(([name,val],i)=>{
    const pct=Math.round(val/total*100);
    return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
      <div style="width:8px;height:8px;border-radius:50%;background:${itemColor(i)};flex-shrink:0"></div>
      <span style="color:var(--txt2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${eh(name)}</span>
      <span style="color:var(--txt3);flex-shrink:0;margin-left:6px">${fm(val)} €</span>
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════════════════
// ██ MODUL: VERPFLEGUNGSPAUSCHALE & FAHRTENERFASSUNG
// WHY: Freelancer können pro Außentermin Verpflegungspauschale
// absetzen. Geo nur auf Knopfdruck (kein Background-Tracking).
// Reverse Geocoding via OpenStreetMap Nominatim (kostenlos).
// ════════════════════════════════════════════════════════

let verpflBesuch=null; // aktiver Besuch {start, lat, lon, adresse}
let verpflTimerInterval=null;
const VERPFL_KEY='bsp_verpfl_fahrten';

// Pauschale nach Stunden (§4 Abs.5 EStG Inland 2024)
function calcPauschale(h){
  if(h>=24) return 28;
  if(h>=14) return 14;
  if(h>=8)  return 8;
  return 0;
}

// Luftlinienabstand in km (Haversine)
function haversineKm(lat1,lon1,lat2,lon2){
  const R=6371,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function saveBetriebsstaette(){
  const v=document.getElementById('bsAdresse').value.trim();
  if(!v){toast('Adresse eingeben','er');return;}
  localStorage.setItem('bsp_bs',v);
  document.getElementById('bsHint').textContent='✓ Gespeichert als Betriebsstätte.';
  toast('Betriebsstätte gespeichert','ok');
}

async function verpflAnkunft(){
  const btn=document.getElementById('btnAnkunft');
  btn.disabled=true;btn.textContent='⏳ Standort …';

  navigator.geolocation.getCurrentPosition(async pos=>{
    const {latitude:lat,longitude:lon}=pos.coords;

    // Reverse Geocoding via Nominatim (kein API Key nötig)
    let adresse='Unbekannter Standort';
    try{
      const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=de`,
        {headers:{'User-Agent':'BelegScanPro/1.0'}});
      const d=await r.json();
      const a=d.address||{};
      adresse=[a.road,a.house_number,a.postcode,a.city||a.town||a.village].filter(Boolean).join(' ');
    }catch(e){}

    verpflBesuch={start:Date.now(),lat,lon,adresse};

    // Entfernung zur Betriebsstätte
    let kmText='–';
    const bsGespeichert=localStorage.getItem('bsp_bs_coords');
    if(bsGespeichert){
      try{
        const {lat:bLat,lon:bLon}=JSON.parse(bsGespeichert);
        kmText=haversineKm(lat,lon,bLat,bLon).toFixed(1)+' km';
      }catch(_){}
    }

    // Anzeige
    const info=document.getElementById('verpflStandortInfo');
    info.style.display='block';
    info.innerHTML=`<div style="font-size:11px;color:var(--txt3);margin-bottom:4px">📍 Aktueller Standort</div>
      <div style="font-weight:300;color:var(--txt)">${eh(adresse)}</div>
      <div style="font-size:11px;color:var(--txt3);margin-top:4px">Entfernung Betriebsstätte: ${kmText} (Luftlinie)</div>`;

    document.getElementById('verpflActiveCard').style.display='block';
    document.getElementById('verpflActiveInfo').textContent=`📍 ${eh(adresse)}`;
    document.getElementById('verpflStartInfo').textContent=`Gestartet: ${new Date(verpflBesuch.start).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})} Uhr`;

    // WHY: Timer alle Sekunde aktualisieren
    if(verpflTimerInterval) clearInterval(verpflTimerInterval);
    verpflTimerInterval=setInterval(()=>{
      if(!verpflBesuch){clearInterval(verpflTimerInterval);return;}
      const diff=Math.floor((Date.now()-verpflBesuch.start)/1000);
      const h=Math.floor(diff/3600).toString().padStart(2,'0');
      const m=Math.floor((diff%3600)/60).toString().padStart(2,'0');
      const s=(diff%60).toString().padStart(2,'0');
      const el=document.getElementById('verpflTimer');
      if(el) el.textContent=`${h}:${m}:${s}`;
      updVerpflTages();
    },1000);

    btn.disabled=false;
    btn.innerHTML='<span style="font-size:18px">📍</span><span>Ich bin hier</span><span style="font-size:10px;color:var(--txt3)">Standort aktualisieren</span>';
    document.getElementById('btnAbfahrt').disabled=false;
    updVerpflTages();
    toast('Standort erfasst: '+adresse.substring(0,40),'ok');

  }, err=>{
    btn.disabled=false;btn.innerHTML='<span style="font-size:18px">📍</span><span>Ich bin hier</span><span style="font-size:10px;color:var(--txt3)">Standort erfassen</span>';
    toast('Standort-Zugriff verweigert – Bitte in Einstellungen erlauben','er');
  },{enableHighAccuracy:false,timeout:10000,maximumAge:30000});
}

async function verpflAbfahrt(){
  if(!verpflBesuch){toast('Zuerst Ankunft erfassen','wr');return;}
  const endTime=Date.now();
  const h=(endTime-verpflBesuch.start)/3600000;
  const pauschale=calcPauschale(h);

  const fahrt={
    id:Date.now(),
    datum:new Date().toISOString().split('T')[0],
    adresse:verpflBesuch.adresse,
    lat:verpflBesuch.lat,lon:verpflBesuch.lon,
    startTs:verpflBesuch.start,endTs:endTime,
    h:Math.round(h*10)/10,
    pauschale
  };

  // Speichern
  const existing=JSON.parse(localStorage.getItem(VERPFL_KEY)||'[]');
  existing.unshift(fahrt);
  localStorage.setItem(VERPFL_KEY,JSON.stringify(existing.slice(0,200))); // max 200

  verpflBesuch=null;
  if(verpflTimerInterval){clearInterval(verpflTimerInterval);verpflTimerInterval=null;}
  document.getElementById('verpflActiveCard').style.display='none';
  const timerEl=document.getElementById('verpflTimer');if(timerEl)timerEl.textContent='00:00:00';
  document.getElementById('verpflStandortInfo').style.display='none';
  document.getElementById('btnAbfahrt').disabled=true;

  updVerpflTages();
  renderVerpflFahrten();
  toast(`Besuch erfasst · ${Math.round(h*10)/10}h · Pauschale: ${pauschale} €`,'ok');
}

function updVerpflTages(){
  if(!verpflBesuch){
    document.getElementById('verpflStunden').textContent='0h';
    document.getElementById('verpflPauschale').textContent='0 €';
    return;
  }
  const h=(Date.now()-verpflBesuch.start)/3600000;
  document.getElementById('verpflStunden').textContent=Math.round(h*10)/10+'h';
  document.getElementById('verpflPauschale').textContent=calcPauschale(h)+' €';
  document.getElementById('verpflKm').textContent='– km'; // Geo nur auf Knopfdruck
}

function renderVerpflFahrten(){
  const fahrten=JSON.parse(localStorage.getItem(VERPFL_KEY)||'[]');
  const now=new Date();
  const monat=String(now.getMonth()+1).padStart(2,'0');
  const jahr=now.getFullYear();
  const dieserMonat=fahrten.filter(f=>(f.datum||'').startsWith(`${jahr}-${monat}`));

  const summe=dieserMonat.reduce((s,f)=>s+(f.pauschale||0),0);
  document.getElementById('verpflMonatsSumme').textContent=summe+' €';

  const l=document.getElementById('verpflFahrtenList');
  if(!dieserMonat.length){
    l.innerHTML='<div class="empty" style="padding:16px 0"><p>Keine Fahrten diesen Monat.</p></div>';
    return;
  }
  l.innerHTML=dieserMonat.map(f=>`
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:9px 0;border-bottom:1px solid var(--br);font-size:12px;font-weight:300">
      <div>
        <div style="color:var(--txt)">${fd(f.datum)}</div>
        <div style="font-size:10px;color:var(--txt3);margin-top:2px">${eh(f.adresse||'–')} · ${f.h}h</div>
      </div>
      <div style="color:var(--gold);font-size:13px">${f.pauschale} €</div>
    </div>`).join('');
}

async function geocodeBetriebsstaette(){
  const adresse=localStorage.getItem('bsp_bs');
  if(!adresse)return;
  try{
    const r=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(adresse)}&format=json&limit=1`,
      {headers:{'User-Agent':'BelegScanPro/1.0'}});
    const d=await r.json();
    if(d&&d[0]){
      localStorage.setItem('bsp_bs_coords',JSON.stringify({lat:parseFloat(d[0].lat),lon:parseFloat(d[0].lon)}));
    }
  }catch(e){}
}

function initVerpflView(){
  const bs=localStorage.getItem('bsp_bs');
  if(bs){
    document.getElementById('bsAdresse').value=bs;
    document.getElementById('bsHint').textContent='✓ Gespeichert. Tippe OK um zu aktualisieren.';
    geocodeBetriebsstaette(); // Koordinaten im Hintergrund holen
  }
  renderVerpflFahrten();
  updVerpflTages();
}

// ════════════════════════════════════════════════════════
