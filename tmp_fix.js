const fs = require('fs');
let text = fs.readFileSync('js/chat-interface.js', 'utf8');

// Fix Umlauts
text = text.replace(/â‚¬/g, '€');
text = text.replace(/fÃ¼r/g, 'für');
text = text.replace(/verfÃ¼gbar/g, 'verfügbar');
text = text.replace(/WÃ¶rter/g, 'Wörter');
text = text.replace(/ausgefÃ¼hrt/g, 'ausgeführt');
text = text.replace(/ausgelÃ¶st/g, 'ausgelöst');
text = text.replace(/SÃ¤ule/g, 'Säule');
text = text.replace(/prÃ¤zise/g, 'präzise');
text = text.replace(/mÃ¶chte/g, 'möchte');
text = text.replace(/Ã¼/g, 'ü');
text = text.replace(/Ã¶/g, 'ö');
text = text.replace(/Ã¤/g, 'ä');

// Fix 1: Add checks to content
const routerFind = `        const type = (resp && resp.content && resp.content[0] && resp.content[0].text) ? resp.content[0].text.trim().toLowerCase() : "unbekannt";`;
const routerReplace = `        if (!resp || !resp.content || !Array.isArray(resp.content)) { 
           setTyping(null); 
           await _saveMessage('ai', 'API Fehler: Keine korrekte Antwort vom Router erhalten.'); 
           return; 
        }
        const type = (resp.content[0] && resp.content[0].text) ? resp.content[0].text.trim().toLowerCase() : "unbekannt";`;

// Note: Replace string might be slightly different in file currently. 
// Let's use a simpler regex approach to replace the exact line.
text = text.replace(/const type = \(resp && resp\.content && resp\.content\[0\]\.text\) \? resp\.content\[0\]\.text\.trim\(\)\.toLowerCase\(\) : "unbekannt";/, routerReplace);

const sonnetFind = `      let rawText = res.content[0].text.trim();`;
const sonnetReplace = `      if (!res || !res.content || !Array.isArray(res.content)) {
         setTyping(null);
         await _saveMessage('ai', 'API Fehler bei Analyse: Unerwartete Antwort.');
         return;
      }
      let rawText = res.content[0].text.trim();`;
text = text.replace(sonnetFind, sonnetReplace);

const processFind = `      // Check Tool Call
      let toolCall = resp.content.find(c => c.type === 'tool_use');`;
const processReplace = `      // Check content crash
      if (!resp || !resp.content || !Array.isArray(resp.content)) { 
          setTyping(null);
          await _saveMessage('ai', 'API Fehler: Unerwartete oder leere Antwort von der KI.'); 
          return; 
      }
      
      // Check Tool Call
      let toolCall = resp.content.find(c => c.type === 'tool_use');`;
text = text.replace(processFind, processReplace);

fs.writeFileSync('js/chat-interface.js', text, 'utf8');
console.log("REPLACED");
