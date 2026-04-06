const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Strip old cache busters (e.g. ?v=4.5.11)
html = html.replace(/\.js\?v=[a-z0-9.]+/g, '.js');
html = html.replace(/\.css\?v=[a-z0-9.]+/g, '.css');

// Add new cache buster
html = html.replace(/\.js/g, '.js?v=4.5.12');
html = html.replace(/\.css/g, '.css?v=4.5.12');

// Fix accidental replacements if there are already query params but not ?v=
// e.g. third-party scripts could be affected, let's verify if there are any third-party scripts.
// In Bong, it's pretty safe as all scripts are internal.
fs.writeFileSync('index.html', html, 'utf8');
console.log('Cache busters applied to index.html');
