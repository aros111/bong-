'use strict';

// ════════════════════════════════════════════════════════
// ██ MODUL: PWA
// ════════════════════════════════════════════════════════
// ██ MODUL: PWA
// ════════════════════════════════════════════════════════
// WHY: SW läuft als externe sw.js – Blob-URL funktioniert nicht
// auf GitHub Pages wegen Security-Restrictions.
let pwaPrompt=null;
function setupPWA(){
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js').catch(e => console.warn('SW:', e));
  }
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();pwaPrompt=e;const b=document.getElementById('pwaBtn');if(b)b.style.display='inline-flex';});
}
function installPWA(){if(pwaPrompt){pwaPrompt.prompt();pwaPrompt.userChoice.then(()=>{pwaPrompt=null;});}}
// ════════════════════════════════════════════════════════
// ██ MODUL: STATE & KONFIGURATION
// ════════════════════════════════════════════════════════
let camStream=null,capB64=null,capThumb=null,scanType='er',curRes=null,curDet=null;
let toastT; // WHY: Muss oben stehen – wird vor toast()-Definition schon genutzt
let apiKey=localStorage.getItem('cak')||'';
let erC=parseInt(localStorage.getItem('erc')||'0');
let arC=parseInt(localStorage.getItem('arc')||'0');
let mwstPer='month';
let qY=new Date().getFullYear(),qQ=Math.ceil((new Date().getMonth()+1)/3);
let stampTpl=parseInt(localStorage.getItem('stpl')||'0');
let stamp={firma:'',frei:'',color:'#b71c1c'};

// WHY: appMode steuert den Potential-Ring und die Home-Ansicht.
// 'biz' = Business (Gold, Steuer-Fristen), 'priv' = Privat (Silber, Sparpotentiale)
let appMode=localStorage.getItem('appMode')||'biz';

let profile={
  land: localStorage.getItem('p_land')||'de',
  typ:  localStorage.getItem('p_typ')||'frei',
  fmt:  localStorage.getItem('p_fmt')||'A',
  done: localStorage.getItem('p_done')==='1'
};

// DACH Steuer-Konfiguration
const LANDCFG={
  de:{name:'Deutschland',flag:'🇩🇪',mwstH:19,mwstL:7,kuLimit:22000,currency:'€',steuerLabel:'MwSt'},
  at:{name:'Österreich',flag:'🇦🇹',mwstH:20,mwstL:10,kuLimit:35000,currency:'€',steuerLabel:'USt'},
  ch:{name:'Schweiz',flag:'🇨🇭',mwstH:8.1,mwstL:2.6,kuLimit:100000,currency:'CHF',steuerLabel:'MWST'},
  other:{name:'Anderes Land',flag:'🌍',mwstH:20,mwstL:10,kuLimit:22000,currency:'€',steuerLabel:'MwSt'}
};
function cfg(){return LANDCFG[profile.land]||LANDCFG.de;}

// ════════════════════════════════════════════════════════
// ██ MODUL: MODUS-TOGGLE (Business ↔ Privat)
// WHY: Derselbe Ring, zwei Bedeutungen. Gold = Steuerpflichten.
// Silber = persönliche Finanzen. Ein Toggle, kein separater Tab.
// ════════════════════════════════════════════════════════
function setMode(m){
  appMode=m;
  localStorage.setItem('appMode',m);
  document.getElementById('modeBiz').className='mode-btn'+(m==='biz'?' on biz':'');
  document.getElementById('modePriv').className='mode-btn'+(m==='priv'?' on priv':'');
  document.getElementById('bizContent').style.display=m==='biz'?'block':'none';
  document.getElementById('privContent').style.display=m==='priv'?'block':'none';
  document.getElementById('ringF').style.stroke=m==='biz'?'var(--gold)':'var(--silv)';
  // WHY: Im Privat-Modus MwSt+Steuer-Tab ausblenden, Privat-Tab einblenden
  // Konto-Tab ist immer sichtbar (zeigt alle Buchungen, egal ob priv/biz)
  const isBiz=m==='biz';
  document.getElementById('navBelege').style.display=isBiz?'':'none';
  document.getElementById('navMwst').style.display=isBiz?'':'none';
  document.getElementById('navSteuer').style.display=isBiz?'':'none';
  document.getElementById('navPriv').style.display=isBiz?'none':'';
  // Konto + Fahrt nur im Business-Modus sichtbar
  const navV=document.getElementById('navVerpfl');
  if(navV) navV.style.display=isBiz?'':'none';
  // Scanner-Default je nach Modus
  if(m==='priv') setScanType('priv');
  else setScanType('er');
  renderHome();
}

// ════════════════════════════════════════════════════════
// ██ MODUL: ONBOARDING
// ════════════════════════════════════════════════════════
let obLand='de',obTyp='frei',obFmt='A';
function pickLand(l){obLand=l;document.querySelectorAll('[id^=land-]').forEach(el=>el.classList.remove('on'));document.getElementById('land-'+l).classList.add('on');}
function pickTyp(t){obTyp=t;document.querySelectorAll('[id^=typ-]').forEach(el=>el.classList.remove('on'));document.getElementById('typ-'+t).classList.add('on');document.getElementById('kuWarn').style.display=t==='ku'?'block':'none';}
function pickFmt(f){obFmt=f;document.querySelectorAll('[id^=fmt-]').forEach(el=>el.classList.remove('on'));document.getElementById('fmt-'+f).classList.add('on');}
function obNext(step){document.querySelectorAll('.ob-step').forEach(el=>el.classList.remove('on'));document.getElementById('obs'+step).classList.add('on');}
function obFinish(){
  const k=(document.getElementById('obApiKey').value||'').trim();
  if(k){apiKey=k;localStorage.setItem('cak',k);}
  profile={land:obLand,typ:obTyp,fmt:obFmt,done:true};
  localStorage.setItem('p_land',obLand);localStorage.setItem('p_typ',obTyp);
  localStorage.setItem('p_fmt',obFmt);localStorage.setItem('p_done','1');
  document.getElementById('onboarding').classList.remove('on');
  initApp();
}
function resetOnboarding(){if(!confirm('Neu einrichten?'))return;localStorage.removeItem('p_done');profile.done=false;document.getElementById('onboarding').classList.add('on');}
function checkOnboarding(){if(!profile.done){document.getElementById('onboarding').classList.add('on');}else{initApp();}}

// ════════════════════════════════════════════════════════
// ██ MODUL: NAV
// ════════════════════════════════════════════════════════
function showView(v){
  document.querySelectorAll('.view').forEach(el=>el.classList.remove('on'));
  const vEl=document.getElementById('v-'+v);
  if(!vEl)return;
  vEl.classList.add('on');
  document.querySelectorAll('.ni[data-v]').forEach(el=>el.classList.toggle('on',el.dataset.v===v));
  if(v==='home')renderHome();
  if(v==='belege')renderBelege();
  if(v==='priv')renderPrivatBelege();
  if(v==='konto')initKontoView();
  if(v==='verpfl'){initVerpflView();}
  if(v==='mwst')renderMwst();
  if(v==='steuer')calcSteuer();
  if(v==='quartal')initQuartal();
  if(v==='export-preview')loadExportPreview();
  if(v==='settings'){loadStampUI();updCounters();updSettingsInfo();}
}
function resetApiCost(){
  if(!confirm('API-Verbrauch zurücksetzen?')) return;
  localStorage.removeItem('bsp_api_costs');
  updApiCostDisplay();
  toast('Verbrauch zurückgesetzt','ok');
}
function updSettingsInfo(){
  document.getElementById('settLandInp').value=profile.land||'de';
  document.getElementById('settTypInp').value=profile.typ||'frei';
  document.getElementById('settFmtInp').value=profile.fmt||'A';
  document.getElementById('settTaxNr').value=profile.taxNr||'';
  
  const keyInp=document.getElementById('apiKey');
  if(keyInp) keyInp.value=localStorage.getItem('cak')||'';
  updApiCostDisplay();
  updApiStat();
  loadAboKeywords();
}

window.updateProfileSettings = function(){
  profile.land = document.getElementById('settLandInp').value;
  profile.typ = document.getElementById('settTypInp').value;
  profile.fmt = document.getElementById('settFmtInp').value;
  profile.taxNr = document.getElementById('settTaxNr').value;
  localStorage.setItem('p_land', profile.land);
  localStorage.setItem('p_typ', profile.typ);
  localStorage.setItem('p_fmt', profile.fmt);
  localStorage.setItem('p_taxNr', profile.taxNr);
  if(typeof renderHome === 'function') renderHome();
};

// ════════════════════════════════════════════════════════
// ██ MODUL: BELEGNUMMER – GoBD-konform
// WHY: Finanzamtkonform = keine Lücken, keine Änderungen.
// Die Nummer wird einmal vergeben und ist danach fest.
// ════════════════════════════════════════════════════════
function nextNr(t){
  const y=new Date().getFullYear(),q=Math.ceil((new Date().getMonth()+1)/3);
  const prefix=t==='er'?'ER':'AR';
  let cnt;
  if(t==='er'){erC++;localStorage.setItem('erc',erC);cnt=erC;}
  else{arC++;localStorage.setItem('arc',arC);cnt=arC;}
  const n=String(cnt).padStart(4,'0');
  if(profile.fmt==='A')return`${prefix}-${y}-${n}`;
  if(profile.fmt==='B')return`${y}-Q${q}-${prefix}-${n}`;
  return`${y}-${prefix}-${n}`;
}
function updCounters(){
  const y=new Date().getFullYear(),q=Math.ceil((new Date().getMonth()+1)/3);
  const fmtNr=(t,c)=>{const p=t==='er'?'ER':'AR',n=String(c+1).padStart(4,'0');if(profile.fmt==='A')return`${p}-${y}-${n}`;if(profile.fmt==='B')return`${y}-Q${q}-${p}-${n}`;return`${y}-${p}-${n}`;};
  const e=document.getElementById('erND'),a=document.getElementById('arND');
  if(e)e.textContent=fmtNr('er',erC);if(a)a.textContent=fmtNr('ar',arC);
}

// ════════════════════════════════════════════════════════
