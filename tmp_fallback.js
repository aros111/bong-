const fs = require('fs');
let code = fs.readFileSync('js/services/ai.js', 'utf8');

const targetRegex = /const usedModel = model \|\| \(allImages\.length \? MODEL_SONNET : MODEL_HAIKU\);[\s\S]*?throw err;\s*\}\s*\}\s*\};/;

const newBlock = `const usedModel = model || (allImages.length ? MODEL_SONNET : MODEL_HAIKU);

      let modelChain = [usedModel];
      if (usedModel.includes('sonnet')) {
         modelChain = ['claude-sonnet-4-5', 'claude-3-5-sonnet-20241022', 'claude-3-5-sonnet-20240620'];
      } else if (usedModel.includes('haiku')) {
         modelChain = ['claude-haiku-4-5-20251001', 'claude-3-5-haiku-20241022', 'claude-3-haiku-20240307'];
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      let data = null;
      let finalModel = usedModel;
      let lastError = null;

      for (let m of modelChain) {
        try {
          const payload = {
            model: m,
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

          if (!resp.ok) {
            if (resp.status === 404 || resp.status === 400) {
               lastError = new Error("API Fehler " + resp.status + " für Modell " + m);
               continue; // Fallback to next string
            }
            if (resp.status === 401) throw new Error('API Key ungültig oder abgelaufen');
            throw new Error('API Fehler ' + resp.status);
          }

          data = await resp.json();
          finalModel = m;
          lastError = null;
          break; // Success!

        } catch (err) {
           if (err.name === 'AbortError') {
             throw new Error('KI-Anfrage Timeout nach 60s. Bitte überprüfen Sie Ihre Internetverbindung oder verkleinern Sie das Bild/PDF.');
           }
           if (err.message && err.message.includes('API Key')) throw err;
           lastError = err;
        }
      }

      clearTimeout(timeoutId);

      if (lastError) {
         throw new Error("KI momentan nicht erreichbar, bitte später versuchen.");
      }

      // Falls Tools im Spiel sind: Das volle JSON-Objekt ans Chat-Interface ausliefern!
      if (tools && tools.length > 0) {
         return data;
      }

      let rawText = data.content?.filter(c => c.type === 'text').map(c => c.text).join('') || '';

      // Hardcode JSON Stripper directly on Raw Text (User Instruction)
      rawText = rawText.replace(/\`\`\`json/gi, '').replace(/\`\`\`/gi, '').trim();
      if (rawText.indexOf('{') !== -1) {
        rawText = rawText.substring(rawText.indexOf('{'), rawText.lastIndexOf('}') + 1);
      }

      // Kosten & Stats
      const usage = data.usage || {};
      const costTable = COST_TABLE[finalModel] || COST_TABLE[MODEL_HAIKU];
      if (costTable) {
         const cost = ((usage.input_tokens || 0) / 1e6 * costTable.input) +
                      ((usage.output_tokens || 0) / 1e6 * costTable.output);
         BSP.state.apiCosts = (BSP.state.apiCosts || 0) + cost;
         localStorage.setItem('bsp_apiCosts', BSP.state.apiCosts);
         BSP.emit('api:used', { cost, model: finalModel });
      }

      return rawText;
    }
  };`;

if (!targetRegex.test(code)) {
   console.error("Regex did not match.");
   process.exit(1);
}

code = code.replace(targetRegex, newBlock);
fs.writeFileSync('js/services/ai.js', code, 'utf8');
console.log("REPLACED");
