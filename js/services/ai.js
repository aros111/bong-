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
    async process({ prompt, imageB64, images = [], model, maxTokens = 1024 }) {
      const apiKey = (BSP.state.settings && BSP.state.settings._apiKey) || localStorage.getItem('bsp_apikey') || '';
      if (!apiKey) throw new Error('Bitte zuerst API-Key in den Einstellungen eintragen');

      const content = [];
      
      // Handle single or multiple images
      const allImages = images.length ? images : (imageB64 ? [imageB64] : []);
      
      allImages.forEach(img => {
        const mediaType = img.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
        const data = img.replace(/^data:[^;]+;base64,/, '');
        content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data } });
      });

      content.push({ type: 'text', text: prompt });

      // Dynamische Weiche: Sonnet 3.5 für Bilder, Haiku 3.0 für Text
      const usedModel = model || (allImages.length ? MODEL_SONNET : MODEL_HAIKU);

      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: usedModel,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content }]
        })
      });

      if (!resp.ok) {
        if (resp.status === 401) throw new Error('API Key ungültig oder abgelaufen');
        throw new Error(`API Fehler ${resp.status}`);
      }

      const data = await resp.json();
      const text = data.content?.filter(c => c.type === 'text').map(c => c.text).join('') || '';

      // Kosten & Stats
      const usage = data.usage || {};
      const costTable = COST_TABLE[usedModel] || COST_TABLE[MODEL_HAIKU];
      const cost = ((usage.input_tokens || 0) / 1e6 * costTable.input) +
                   ((usage.output_tokens || 0) / 1e6 * costTable.output);

      BSP.state.apiCosts = (BSP.state.apiCosts || 0) + cost;
      localStorage.setItem('bsp_apiCosts', BSP.state.apiCosts);
      BSP.emit('api:used', { cost, model: usedModel });

      return text;
    }
  };

  // ── Währungsumrechnung (EZB API) ───────────────────────────
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

  // ── Zentrale Wrapper-Funktion mit Interceptors ────────────────
  BSP.callClaude = async function(params) {
    let injectedPrompt = params.prompt || '';
    
    // Wenn JSON erwartet wird, injiziere die DATEV Export Regeln (Klartext & Währung)
    if (injectedPrompt.includes('{') || injectedPrompt.toLowerCase().includes('json')) {
      injectedPrompt += `\n\nZUSATZ-REGELN FÜR DEN DATEV-EXPORT (WICHTIG):
1. KLARTEXT-HINWEIS: Wenn die gekauften Artikel sehr technisch, kryptisch oder englisch benannt sind (z.B. "USB-C PD 100W GaN", "AirPods Pro", "SSD NVMe 2TB", "AWS EC2 instance", "O2 Free M"), MUSST du ein Feld "klartext" im JSON ausgeben, das in kurzem, einfachem Deutsch erklärt, was das ist (z.B. "Laptop-Ladegerät USB-C", "Kabellose Kopfhörer Apple", "Festplatte intern", "Server-Hosting", "Handyvertrag"). Ist die Bezeichnung völlig trivial (z.B. "Briefmarken", "Tanken"), lass das Feld komplett weg.
2. WÄHRUNG: Analysiere zwingend, in welcher Währung der Beleg ausgestellt ist. Gib als "waehrung" den ISO-Code zurück (z.B. "EUR", "USD", "CHF", "GBP").`;
    }

    const jsonString = await AI.process({ ...params, prompt: injectedPrompt });

    try {
      const parsed = JSON.parse(jsonString);
      
      // Task 4: Fremdwährung erkannt -> EZB Kurs abrufen
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
      // Wenn Response kein JSON ist, oder Parse fehlschlägt
      return jsonString;
    }
  };

  // Redundante ask-Funktion für Abwärtskompatibilität
  BSP.ask = async function(params) {
    return AI.process(params);
  };

  // ── Bild komprimieren ────────────────────────────────────────
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

  BSP.compressImage = function(dataUrl, maxPx = 600, maxKB = 100) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let currentMaxPx = maxPx;
        
        const attempt = (px) => {
          const scale = Math.min(1, px / Math.max(img.width, img.height));
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

          let q = 0.6; // Startqualität wie gefordert
          let result;
          do {
            result = canvas.toDataURL('image/jpeg', q);
            if (result.length * 3 / 4 <= maxKB * 1024) return result;
            q -= 0.05;
          } while (q >= 0.35); // Hard limit 0.35

          return null; // Zu groß bei dieser Auflösung
        };

        let finalResult = attempt(currentMaxPx);
        
        // Wenn bei 0.35 noch zu groß, Auflösung iterativ reduzieren
        while (!finalResult && currentMaxPx > 200) {
          currentMaxPx -= 100;
          finalResult = attempt(currentMaxPx);
        }

        if (finalResult) {
          resolve(finalResult);
        } else {
          reject(new Error("Bild konnte nicht ausreichend komprimiert werden – bitte in besserer Beleuchtung neu fotografieren oder näher heranzoomen."));
        }
      };
      img.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
      img.src = dataUrl;
    });
  };

  console.log('[BSP] ai.js injected.');
})();
