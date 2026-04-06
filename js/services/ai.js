'use strict';

(() => {
  const API_URL = 'https://api.anthropic.com/v1/messages';
  const MODEL_HAIKU = 'claude-haiku-4-5-20251001';
  const MODEL_SONNET = 'claude-sonnet-4-5';

  const COST_TABLE = {
    'claude-haiku-4-5-20251001': { input: 0.25, output: 1.25 },
    'claude-sonnet-4-5': { input: 3.00, output: 15.00 }
  };

  const AI = {
    async process({ prompt, imageB64, images = [], model, maxTokens = 1024, tools = null, system = null }) {
      const apiKey = (BSP.state.settings && BSP.state.settings._apiKey) || localStorage.getItem('bsp_apikey') || '';
      if (!apiKey) throw new Error('Bitte zuerst API-Key in den Einstellungen eintragen');

      const content = [];
      
      // Handle single or multiple images
      const allImages = images.length ? images : (imageB64 ? [imageB64] : []);
      
      allImages.forEach(img => {
        if (img.startsWith('data:application/pdf')) {
          const data = img.replace(/^data:application\/pdf;base64,/, '');
          content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } });
        } else {
          const mediaType = img.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
          const data = img.replace(/^data:[^;]+;base64,/, '');
          content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data } });
        }
      });

      content.push({ type: 'text', text: prompt });

      // Dynamische Weiche: Sonnet 3.5 fÃ¼r Bilder, Haiku 3.0 fÃ¼r Text
      const usedModel = model || (allImages.length ? MODEL_SONNET : MODEL_HAIKU);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      try {
        const payload = {
          model: usedModel,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content }]
        };
        if (tools && tools.length > 0) payload.tools = tools;
        if (system) payload.system = system;

        const fetchPromise = fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-beta': 'pdfs-2024-09-25',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          signal: controller.signal,
          body: JSON.stringify(payload)
        });

        const resp = await fetchPromise;
        clearTimeout(timeoutId);

        if (!resp.ok) {
          if (resp.status === 401) throw new Error('API Key ungÃ¼ltig oder abgelaufen');
          throw new Error(`API Fehler ${resp.status}`);
        }

        const data = await resp.json();
      let rawText = data.content?.filter(c => c.type === 'text').map(c => c.text).join('') || '';

      // Hardcode JSON Stripper directly on Raw Text (User Instruction)
      rawText = rawText.replace(/```json/gi, '').replace(/```/gi, '').trim();
      if (rawText.indexOf('{') !== -1) {
        rawText = rawText.substring(rawText.indexOf('{'), rawText.lastIndexOf('}') + 1);
      }

      // Kosten & Stats
      const usage = data.usage || {};
      const costTable = COST_TABLE[usedModel] || COST_TABLE[MODEL_HAIKU];
      const cost = ((usage.input_tokens || 0) / 1e6 * costTable.input) +
                   ((usage.output_tokens || 0) / 1e6 * costTable.output);

      BSP.state.apiCosts = (BSP.state.apiCosts || 0) + cost;
      localStorage.setItem('bsp_apiCosts', BSP.state.apiCosts);
      BSP.emit('api:used', { cost, model: usedModel });

      return rawText;
      } catch (err) {
        if (err.name === 'AbortError') {
          throw new Error('KI-Anfrage Timeout nach 60s. Bitte Ã¼berprÃ¼fen Sie Ihre Internetverbindung oder verkleinern Sie das Bild/PDF.');
        }
        throw err;
      }
    }
  };

  // â”€â”€ WÃ¤hrungsumrechnung (EZB API) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function fetchECBRate(currency, dateStr) {
    if (!currency || currency === 'EUR') return 1;
    try {
      const url = `https://data-api.ecb.europa.eu/service/data/EXR/D.${currency}.EUR.SP00.A?endPeriod=${dateStr || new Date().toISOString().split('T')[0]}&lastNObservations=1`;
      const res = await fetch(url, { headers: { 'Accept': 'text/xml' }});
      if (!res.ok) return null;
      const xml = await res.text();
      const match = xml.match(/<generic:ObsValue value="([0-9.]+)"\/>/);
      if (match && match[1]) return parseFloat(match[1]);
      return null;
    } catch (e) {
      console.warn('[BSP] EZB Fetch Error:', e);
      return null;
    }
  }

  // â”€â”€ Zentrale Wrapper-Funktion mit Interceptors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  BSP.callClaude = async function(params) {
    let injectedPrompt = params.prompt || '';
    
    // Wenn JSON erwartet wird, injiziere die DATEV Export Regeln (Klartext & WÃ¤hrung)
    if (injectedPrompt.includes('{') || injectedPrompt.toLowerCase().includes('json')) {
      injectedPrompt += `\n\nZUSATZ-REGELN FÃœR DEN DATEV-EXPORT (WICHTIG):
1. KLARTEXT-HINWEIS: Wenn die gekauften Artikel sehr technisch, kryptisch oder englisch benannt sind (z.B. "USB-C PD 100W GaN", "AirPods Pro", "SSD NVMe 2TB", "AWS EC2 instance", "O2 Free M"), MUSST du ein Feld "klartext" im JSON ausgeben, das in kurzem, einfachem Deutsch erklÃ¤rt, was das ist (z.B. "Laptop-LadegerÃ¤t USB-C", "Kabellose KopfhÃ¶rer Apple", "Festplatte intern", "Server-Hosting", "Handyvertrag"). Ist die Bezeichnung vÃ¶llig trivial (z.B. "Briefmarken", "Tanken"), lass das Feld komplett weg.
2. WÃ„HRUNG: Analysiere zwingend, in welcher WÃ¤hrung der Beleg ausgestellt ist. Gib als "waehrung" den ISO-Code zurÃ¼ck (z.B. "EUR", "USD", "CHF", "GBP").`;
    }

    let text = await AI.process({ ...params, prompt: injectedPrompt });

    try {
      const parsed = JSON.parse(text);
      
      // Task 4: FremdwÃ¤hrung erkannt -> EZB Kurs abrufen
      if (parsed.waehrung && parsed.waehrung.toUpperCase() !== 'EUR' && parsed.brutto) {
        const rate = await fetchECBRate(parsed.waehrung.toUpperCase(), parsed.datum);
        if (rate) {
          parsed.originalWaehrung = parsed.waehrung.toUpperCase();
          parsed.originalBrutto = Number(parsed.brutto);
          parsed.originalNetto = parsed.netto ? Number(parsed.netto) : null;
          parsed.wechselkurs = rate;
          
          parsed.brutto = Number((parsed.originalBrutto / rate).toFixed(2));
          if (parsed.netto) parsed.netto = Number((parsed.originalNetto / rate).toFixed(2));
          if (parsed.mwst) parsed.mwst = Number((parsed.mwst / rate).toFixed(2));
          
          parsed.waehrung = 'EUR';
        }
      }
      return JSON.stringify(parsed);
    } catch(e) {
      // Wenn Response kein JSON ist, oder Parse fehlschlÃ¤gt
      return text;
    }
  };

  // Redundante ask-Funktion fÃ¼r AbwÃ¤rtskompatibilitÃ¤t
  BSP.ask = async function(params) {
    return AI.process(params);
  };

  // â”€â”€ Bild komprimieren â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  BSP.b64toBlob = function(b64Data) {
    const parts = b64Data.split(',');
    const contentType = parts[0].split(':')[1].split(';')[0];
    const byteCharacters = atob(parts[1]);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
      }
      byteArrays.push(new Uint8Array(byteNumbers));
    }
    return new Blob(byteArrays, {type: contentType});
  };

  BSP.compressImage = function(dataUrl, maxPx = 1600, maxKB = 4900) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

        let q = 0.8; 
        let result = canvas.toDataURL('image/jpeg', q);
        
        while (result.length * 3 / 4 > maxKB * 1024 && q > 0.6) {
           q -= 0.1;
           result = canvas.toDataURL('image/jpeg', q);
        }
        
        resolve(result); 
      };
      img.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
      img.src = dataUrl;
    });
  };
})();
