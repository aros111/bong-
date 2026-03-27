const fs = require('fs');
const f = 'c:/Users/obuch/Downloads/bong-new/js/business/export.js';
let c = fs.readFileSync(f, 'utf8');
c = c.replace(/\\`/g, '`');
c = c.replace(/\\\$/g, '$');
fs.writeFileSync(f, c);
console.log('Fixed export.js escaping');
