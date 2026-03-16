// â–ˆâ–ˆ MODUL: CLAUDE VISION â€“ BELEGANALYSE
// WHY: Claude bekommt das Bild direkt als base64.
// Der Prompt ist so gebaut dass er maximal prÃ¤zise Zahlen
// extrahiert â€“ auch von schrÃ¤gen, schlecht beleuchteten Fotos.
// Robustes JSON-Parsing mit mehreren Fallback-Strategien.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
async function askClaude(b64){
  // Bildformat erkennen (JPEG oder PNG)
  const mt = b64.startsWith('data:image/png') ? 'image/png'
           : b64.startsWith('data:image/webp') ? 'image/webp'
           : 'image/jpeg';
  // Nur den Base64-Datenteil senden, ohne den data:image/... PrÃ¤fix
  const imgData = b64.split(',')[1];

  if(!imgData) throw new Error('Kein Bilddaten gefunden');

  const prompt = `Du bist ein prÃ¤ziser Belegscanner fÃ¼r die DACH-Region (${cfg().name}).

AUFGABE: Lies alle sichtbaren Daten von diesem Beleg/dieser Rechnung ab.

Das Bild kann sein:
- Papierbeleg / Kassenbon / Quittung
- Gedruckte oder digitale Rechnung  
- Monitor-Screenshot (YouTube, Stripe, PayPal, Online-Rechnung)
- Handgeschriebener Beleg

ANTWORTE AUSSCHLIESSLICH mit diesem JSON-Objekt, ohne ErklÃ¤rung, ohne Markdown:
{
  "shop": "Name des HÃ¤ndlers, Unternehmens oder der Plattform",
  "belegNrExtern": "Rechnungs- oder Belegnummer falls sichtbar, sonst null",
  "date": "YYYY-MM-DD Format, z.B. 2025-03-15",
  "net": 12.34,
  "mwst": 2.34,
  "brutto": 14.68,
  "mwstRate": 19,
  "items": [{"name": "Produktname", "price": 9.99}],
  "category": "Lebensmittel",
  "payment": "Karte",
  "istAbo": false,
  "garantieMonate": null,
  "isDigitalScreen": false,
  "screenType": null
}

WICHTIGE REGELN:
1. BetrÃ¤ge IMMER als Dezimalzahl ohne WÃ¤hrungszeichen (14.68 nicht "14,68 â‚¬")
2. Datum im Format YYYY-MM-DD (2025-03-15 nicht "15.03.2025")
3. Wenn Netto und Brutto sichtbar: berechne MwSt = Brutto - Netto
4. Wenn nur Brutto sichtbar und MwSt-Satz erkennbar: berechne Netto = Brutto / 1.${cfg().mwstH}
5. mwstRate: nur die Zahl (19 nicht "19%")
6. category muss GENAU einer dieser Werte sein: Lebensmittel, Restaurant, Elektronik, Kleidung, Tanken, Haushalt, Gesundheit, Dienstleistung, Software, Sonstiges
7. payment muss GENAU einer dieser Werte sein: Karte, Bar, Ãœberweisung, Online
8. istAbo=true wenn monatliche/jÃ¤hrliche GebÃ¼hr erkennbar
9. garantieMonate=24 fÃ¼r Elektronik/GerÃ¤te, 12 fÃ¼r MÃ¶bel, sonst null
10. Fehlende oder unlesbare Felder: null (nicht 0, nicht "")`;

  setLog('ðŸ¤– Claude analysiert Bild â€¦'); setP(40);

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',   // WHY: Aktuelles Modell mit Vision-Support
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mt, data: imgData }
          },
          { type: 'text', text: prompt }
        ]
      }]
    })
  });

  setP(80);

  // HTTP-Fehler abfangen
  // WHY: resp.json() direkt aufzurufen kann in Safari mit SyntaxError crashen
  // wenn die Antwort kein valides JSON ist (Timeout, Netzwerkfehler, etc.)
  // Deshalb: zuerst Text lesen, dann sicher parsen
  const respText = await resp.text().catch(() => '');

  if(!resp.ok){
    let detail = '';
    try { detail = JSON.parse(respText)?.error?.message || ''; } catch(_) {}
    let errMsg = `API Fehler ${resp.status}`;
    if(resp.status === 401) errMsg = 'ðŸ”‘ API Key ungÃ¼ltig â€“ bitte in Settings prÃ¼fen';
    else if(resp.status === 429) errMsg = 'â³ Rate Limit â€“ kurz warten und nochmal';
    else if(resp.status === 400) errMsg = 'âš ï¸ Anfrage-Fehler: ' + (detail || 'Bild evtl. zu groÃŸ');
    else if(resp.status === 529) errMsg = 'â³ Claude Ã¼berlastet â€“ nochmal versuchen';
    else if(resp.status === 0 || !respText) errMsg = 'ðŸŒ Keine Verbindung â€“ Internet prÃ¼fen';
    else errMsg = `API ${resp.status}: ${detail.substring(0, 80) || respText.substring(0, 60)}`;
    throw new Error(errMsg);
  }

  // Sicher parsen â€“ nie direkt resp.json() in Safari
  let data;
  try {
    data = JSON.parse(respText);
  } catch(e) {
    throw new Error('UngÃ¼ltige API-Antwort â€“ mÃ¶glicherweise Netzwerkproblem. Nochmal versuchen.');
  }

  setLog('ðŸ“‹ Antwort wird verarbeitet â€¦'); setP(90);

  if(!data.content || !Array.isArray(data.content)) {
    throw new Error('Unerwartete API-Antwort â€“ bitte nochmal versuchen.');
  }

  // Antwort-Text aus dem content-Array zusammensetzen
  const rawText = data.content
    .filter(c => c.type === 'text')
    .map(c => c.text)
    .join('');

  if(!rawText) throw new Error('Leere Antwort von Claude');

  // JSON robustissimo parsen: mehrere Fallback-Strategien
  let parsed = null;

  // Versuch 1: direkt parsen (wenn Claude sauber geantwortet hat)
  try { parsed = JSON.parse(rawText.trim()); }
  catch(_) {}

  // Versuch 2: JSON-Block aus Markdown-Fences extrahieren
  if(!parsed){
    const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if(fenced) try { parsed = JSON.parse(fenced[1].trim()); } catch(_) {}
  }

  // Versuch 3: Erstes { ... } im Text suchen
  if(!parsed){
    const braces = rawText.match(/\{[\s\S]*\}/);
    if(braces) try { parsed = JSON.parse(braces[0]); } catch(_) {}
  }

  if(!parsed) throw new Error('Konnte JSON nicht lesen. Claude-Antwort: ' + rawText.substring(0, 100));

  // Typen sicherstellen â€“ manchmal gibt Claude Strings zurÃ¼ck statt Zahlen
  if(typeof parsed.net    === 'string') parsed.net    = parseFloat(parsed.net.replace(',','.'))    || null;
  if(typeof parsed.mwst   === 'string') parsed.mwst   = parseFloat(parsed.mwst.replace(',','.'))   || null;
  if(typeof parsed.brutto === 'string') parsed.brutto = parseFloat(parsed.brutto.replace(',','.')) || null;
  if(typeof parsed.mwstRate === 'string') parsed.mwstRate = parseFloat(parsed.mwstRate) || cfg().mwstH;

  return parsed;
}

function calcFieldsFromItems() {
  const bd = document.getElementById('itemsB');
  if (!bd) return;
  let newBrutto = 0;
  const rows = bd.querySelectorAll('.item-row');
  rows.forEach(r => {
    const val = parseFloat(r.querySelector('.item-price').value.replace(',', '.'));
    if (!isNaN(val)) newBrutto += val;
  });
  if (newBrutto > 0 && Math.abs(parseFloat(document.getElementById('rBrutto').value || 0) - newBrutto) > 0.05) {
    document.getElementById('rBrutto').value = newBrutto.toFixed(2);
    autoCalcMwst();
  }
}

function autoCalcMwst() {
  const brutto = parseFloat(document.getElementById('rBrutto').value.replace(',', '.')) || 0;
  const rate = parseFloat(document.getElementById('rRate').value) || 0;
  if(brutto > 0 && rate >= 0) {
    const netto = brutto / (1 + rate / 100);
    const mwst = brutto - netto;
    document.getElementById('rNet').value = netto.toFixed(2);
    document.getElementById('rMwst').value = mwst.toFixed(2);
  }
}

function addNewItemField(name='', price='') {
  const bd = document.getElementById('itemsB');
  const tr = document.createElement('tr');
  tr.className = 'item-row';
  tr.innerHTML = \`
    <td style="padding-right:5px"><input type="text" class="item-name inp" value="\${eh(name)}" placeholder="Artikel" style="width:100%;font-size:12px;padding:6px"></td>
    <td><input type="text" class="item-price inp" value="\${price}" placeholder="0.00" inputmode="decimal" oninput="calcFieldsFromItems()" style="width:100%;text-align:right;font-size:12px;padding:6px"></td>
    <td style="width:30px;text-align:center"><button tabindex="-1" type="button" class="btn-red" style="padding:4px 8px;border-radius:4px" onclick="this.closest('tr').remove();calcFieldsFromItems()">âœ•</button></td>
  \`;
  bd.appendChild(tr);
}

function showRes(r){
  if(!r)return;
  // WHY: Bei Privat-Scan Privat-Felder + Items befÃ¼llen
  if(scanType==='priv'){
    document.getElementById('pShop').value=r.shop||'';
    document.getElementById('pDate').value=r.date||new Date().toISOString().split('T')[0];
    document.getElementById('pBrutto').value=r.brutto!=null?r.brutto.toFixed(2):'';
    if(r.category)document.getElementById('pCat').value=r.category;
    if(r.payment)document.getElementById('pPay').value=r.payment;
    // WHY: Items immer neu befÃ¼llen â€“ sonst bleibt vorheriger Scan stehen
    const pbd=document.getElementById('itemsB');
    if(pbd) pbd.innerHTML='';
    if(r.items&&r.items.length){
      document.getElementById('itemsSec').style.display='block';
      r.items.forEach(it=>{
        addNewItemField(it.name || '', it.price ? parseFloat(it.price).toFixed(2) : '');
      });
      const appendBtn = document.createElement('tr');
      appendBtn.innerHTML = `<td colspan="3"><button type="button" class="btn btn-sm btn-g" style="width:100%;justify-content:center;margin-top:6px" onclick="addNewItemField()">+ Artikel hinzufÃ¼gen</button></td>`;
      if(pbd) pbd.appendChild(appendBtn);
    } else {
      document.getElementById('itemsSec').style.display='none';
    }
    const rib=document.getElementById('retryKiBtn');if(rib)rib.style.display='none';
    document.getElementById('resWrap').classList.add('on');
    return;
  }
  document.getElementById('rShop').value=r.shop||'';
  document.getElementById('rDate').value=r.date||new Date().toISOString().split('T')[0];
  document.getElementById('rNet').value=r.net!=null?r.net.toFixed(2):'';
  document.getElementById('rMwst').value=r.mwst!=null?r.mwst.toFixed(2):'';
  document.getElementById('rBrutto').value=r.brutto!=null?r.brutto.toFixed(2):'';
  
  // Attach change listeners to manual edits on core fields
  const rb = document.getElementById('rBrutto');
  const rr = document.getElementById('rRate');
  if(rb) rb.oninput = autoCalcMwst;
  if(rr) rr.onchange = autoCalcMwst;

  if(r.mwstRate)document.getElementById('rRate').value=r.mwstRate;
  if(r.category)document.getElementById('rCat').value=r.category;
  if(r.payment)document.getElementById('rPay').value=r.payment;
  const bd=document.getElementById('itemsB');bd.innerHTML='';
  if(r.items&&r.items.length){
    document.getElementById('itemsSec').style.display='block';
    r.items.forEach(it=>{
      addNewItemField(it.name || '', it.price ? parseFloat(it.price).toFixed(2) : '');
    });
    const appendBtn = document.createElement('tr');
    appendBtn.innerHTML = `<td colspan="3"><button type="button" class="btn btn-sm btn-g" style="width:100%;justify-content:center;margin-top:6px" onclick="addNewItemField()">+ Artikel hinzufÃ¼gen</button></td>`;
    bd.appendChild(appendBtn);
  }else {
    document.getElementById('itemsSec').style.display='block';
    const appendBtn = document.createElement('tr');
    appendBtn.innerHTML = `<td colspan="3"><button type="button" class="btn btn-sm btn-g" style="width:100%;justify-content:center;margin-top:6px" onclick="addNewItemField()">+ Artikel hinzufÃ¼gen</button></td>`;
    bd.appendChild(appendBtn);
  }
  
  // KI-erneut-Button ausblenden wenn KI erfolgreich war
  const rib = document.getElementById('retryKiBtn');
  if(rib) rib.style.display='none';
  document.getElementById('resWrap').classList.add('on');
}

// WHY: Zeigt leeres Formular zur manuellen Eingabe.
// Wird aufgerufen wenn kein Key da ist oder KI fehlschlÃ¤gt.
// "KI erneut starten" Button erscheint sobald Key gesetzt wurde.
function showManualForm(){
  // WHY: Bei Privat nur Privat-Felder clearen
  if(scanType==='priv'){
    document.getElementById('pShop').value='';
    document.getElementById('pDate').value=new Date().toISOString().split('T')[0];
    document.getElementById('pBrutto').value='';
    document.getElementById('resWrap').classList.add('on');
    return;
  }
  document.getElementById('rShop').value='';
  document.getElementById('rDate').value=new Date().toISOString().split('T')[0];
  document.getElementById('rNet').value='';
  document.getElementById('rMwst').value='';
  document.getElementById('rBrutto').value='';
  document.getElementById('rRate').value=cfg().mwstH;
  document.getElementById('itemsSec').style.display='none';

  // Banner: Status erklÃ¤ren
  apiKey = localStorage.getItem('cak') || apiKey || '';
  const banner = document.getElementById('scanModeBanner');
  if(banner){
    if(apiKey){
      banner.style.display='block';
      banner.style.background='rgba(74,128,192,.1)';
      banner.style.border='1px solid rgba(74,128,192,.25)';
      banner.style.color='var(--txt2)';
      banner.innerHTML='â„¹ï¸ KI-Analyse fehlgeschlagen. Felder manuell ausfÃ¼llen oder unten erneut starten.';
    } else {
      banner.style.display='block';
      banner.style.background='rgba(200,164,90,.08)';
      banner.style.border='1px solid rgba(200,164,90,.25)';
      banner.style.color='var(--txt2)';
      banner.innerHTML='âš¡ Kein API Key â€“ Felder manuell ausfÃ¼llen. <span onclick="openApiSheet()" style="color:var(--gold);text-decoration:underline;cursor:pointer">Key jetzt einrichten â†’</span>';
    }
  }

  // "KI erneut starten" Button anzeigen wenn Bild vorhanden
  const rib = document.getElementById('retryKiBtn');
  if(rib) rib.style.display = (capB64 && apiKey) ? 'inline-flex' : 'none';

  document.getElementById('resWrap').classList.add('on');
}

// WHY: Startet KI-Analyse erneut mit dem bereits vorhandenen Bild.
// NÃ¼tzlich wenn Key erst nach dem Foto-Upload eingetragen wurde.
function retryKi(){
  apiKey = localStorage.getItem('cak') || '';
  if(!apiKey){ openApiSheet(); return; }
  if(!capB64){ toast('Kein Bild vorhanden â€“ bitte neu scannen','er'); return; }
  document.getElementById('resWrap').classList.remove('on');
  processImg(capB64);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// â–ˆâ–ˆ MODUL: API KEY SHEET
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function openApiSheet(){
  const sheet=document.getElementById('apiOvl');
  sheet.classList.add('on');
  // Zeige aktuellen Status
  if(apiKey){
    document.getElementById('apiKeySheet').value=apiKey;
    document.getElementById('apiSheetStat').style.display='block';
    document.getElementById('apiRemoveBtn').style.display='inline-flex';
  }else{
    document.getElementById('apiKeySheet').value='';
    document.getElementById('apiSheetStat').style.display='none';
    document.getElementById('apiRemoveBtn').style.display='none';
  }
  setTimeout(()=>document.getElementById('apiKeySheet').focus(),300);
}
function closeApiSheet(){document.getElementById('apiOvl').classList.remove('on');}
function closeApiOuter(e){if(e.target===document.getElementById('apiOvl'))closeApiSheet();}
function saveApiKeySheet(){
  const k=document.getElementById('apiKeySheet').value.trim();
  if(!k){toast('Bitte einen API Key eingeben','er');return;}
  if(!k.startsWith('sk-')){toast('Key muss mit sk- beginnen','er');return;}
  apiKey=k;localStorage.setItem('cak',k);
  document.getElementById('apiSheetStat').style.display='block';
  document.getElementById('apiRemoveBtn').style.display='inline-flex';
  updApiStat();updApiBanner();
  // WHY: Wenn gerade ein Bild gescannt wurde aber kein Key da war,
  // jetzt den "KI erneut starten" Button im Formular aktivieren
  const rib = document.getElementById('retryKiBtn');
  if(rib && capB64) rib.style.display='inline-flex';
  const banner = document.getElementById('scanModeBanner');
  if(banner && banner.style.display!=='none'){
    banner.innerHTML='âœ… Key gespeichert! Tippe auf "âš¡ KI erneut starten" um das Bild zu analysieren.';
    banner.style.background='rgba(58,175,112,.08)';
    banner.style.border='1px solid rgba(58,175,112,.2)';
    banner.style.color='var(--grn)';
  }
  toast('âœ“ KI-Erkennung aktiviert','ok');
  setTimeout(closeApiSheet,1200);
}
function removeApiKey(){
  if(!confirm('API Key entfernen?'))return;
  apiKey='';localStorage.removeItem('cak');
  document.getElementById('apiKeySheet').value='';
  document.getElementById('apiSheetStat').style.display='none';
  document.getElementById('apiRemoveBtn').style.display='none';
  updApiStat();updApiBanner();
  toast('Key entfernt','ok');
}
function updApiBanner(){
  // Banner nur zeigen wenn kein Key vorhanden
  const b=document.getElementById('apiBanner');
  if(b)b.style.display=apiKey?'none':'block';
}

function saveApiKey(){
  const k=document.getElementById('apiKey').value.trim();
  if(!k){toast('Bitte Key eingeben','er');return;}
  if(!k.startsWith('sk-')){toast('Key muss mit sk- beginnen','er');return;}
  apiKey=k;
  localStorage.setItem('cak',k);
  updApiStat();updApiBanner();
  toast('âœ“ API Key gespeichert','ok');
}
function clearApiKeySettings(){
  if(!confirm('API Key lÃ¶schen?'))return;
  apiKey='';
  localStorage.removeItem('cak');
  document.getElementById('apiKey').value='';
  updApiStat();updApiBanner();
  toast('Key gelÃ¶scht','ok');
}
function saveAboKeywords(){
  const keywords = document.getElementById('aboKeywordsInput').value.trim();
  if(!keywords){toast('Bitte Keywords eingeben','er');return;}
  localStorage.setItem('aboKeywords', keywords);
  toast('âœ“ Abo-Keywords gespeichert','ok');
}
function updApiStat(){const s=document.getElementById('apiStat');if(s)s.textContent=apiKey?'âœ“ Claude API aktiv. Garantie-WÃ¤chter + Abo-Detektiv + Monitor-Erkennung aktiv.':'Kein Key â€“ manuelle Eingabe. Intelligenz-Module eingeschrÃ¤nkt.';}
function resetCounters(){if(!confirm('ZÃ¤hler zurÃ¼cksetzen?'))return;erC=0;arC=0;localStorage.setItem('erc','0');localStorage.setItem('arc','0');updCounters();toast('ZurÃ¼ckgesetzt','ok');}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// â–ˆâ–ˆ UTILS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// â–ˆâ–ˆ MODUL: API-KOSTEN-TRACKER
// WHY: Nutzer soll sehen wie viel API-Guthaben verbraucht wurde.
// Sonnet 4.5: Input $3/1M Tokens, Output $15/1M Tokens (ca. SchÃ¤tzung)
// Bilder: ca. 1000-4000 Input-Tokens je nach GrÃ¶ÃŸe
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const API_COST_KEY='bsp_api_costs';
// Preise in $ pro 1000 Tokens (claude-sonnet-4-5 SchÃ¤tzung)
const COST_IN=0.003, COST_OUT=0.015;

function trackApiCost(typ, imgB64Len=0){
  // Input-Token-SchÃ¤tzung: Bild ca. imgLen/750 + Prompt ~300 Tokens
  const imgTokens=imgB64Len>0?Math.round(imgB64Len/750):0;
  const promptTokens=400;
  const outputTokens=800; // SchÃ¤tzung Output
  const inputCost=(imgTokens+promptTokens)/1000*COST_IN;
  const outputCost=outputTokens/1000*COST_OUT;
  const callCost=inputCost+outputCost;

  const data=JSON.parse(localStorage.getItem(API_COST_KEY)||'{"calls":0,"cost":0}');
  data.calls++;
  data.cost+=callCost;
  data.last=new Date().toISOString();
  localStorage.setItem(API_COST_KEY,JSON.stringify(data));
  updApiCostDisplay();
}

function updApiCostDisplay(){
  const data=JSON.parse(localStorage.getItem(API_COST_KEY)||'{"calls":0,"cost":0}');
  const el=document.getElementById('apiCostDisp');
  if(!el) return;
  const costEur=data.cost*0.92; // $ â†’ â‚¬ SchÃ¤tzung
  el.innerHTML=`<span style="color:var(--txt)">${data.calls} KI-Calls</span> Â· <span style="color:var(--gold)">~${costEur.toFixed(3)} â‚¬ verbraucht</span>`;
}

function fd(d){if(!d)return'â€“';return new Date(d+'T00:00:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});}
function fm(n){return(n||0).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2});}
function fmK(n){if(Math.abs(n)>=1000)return(n/1000).toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1})+'k';return(n||0).toLocaleString('de-DE');}
function eh(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function ec(s){s=String(s||'');if(/[;"'\n]/.test(s))return'"'+s.replace(/"/g,'""')+'"';return s;}
function toast(msg,type=''){const el=document.getElementById('toast');el.textContent=msg;el.className='show'+(type?' '+type:'');clearTimeout(toastT);toastT=setTimeout(()=>el.className='',3200);}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// â–ˆâ–ˆ INIT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function initApp(){
  loadStamp();updCounters();updApiStat();updApiBanner();
  // MwSt-SÃ¤tze fÃ¼r aktives Land setzen
  const rRate=document.getElementById('rRate');
  if(rRate)rRate.innerHTML=`<option value="${cfg().mwstH}">${cfg().mwstH} %</option><option value="${cfg().mwstL}">${cfg().mwstL} %</option><option value="0">0 %</option>`;
  // Modus-Toggle initialisieren
  setMode(appMode);
}

setupPWA();
initDB().then(()=>{checkOnboarding();}).catch(e=>toast('DB Fehler: '+e.message,'er'));