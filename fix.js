const fs = require('fs');
let c = fs.readFileSync('js/business/konto-import.js', 'utf8');
c = c.replace(/\\`/g, '`');
c = c.replace(/\\\$/g, '$');
fs.writeFileSync('js/business/konto-import.js', c);
console.log('Fixed');
