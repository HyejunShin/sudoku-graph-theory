// Builds the single-file page: inlines src/engine.js into src/index.src.html and writes index.html.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'src', 'index.src.html'), 'utf8');
const engine = fs.readFileSync(path.join(__dirname, 'src', 'engine.js'), 'utf8');
if (engine.includes('</script')) throw new Error('engine.js must not contain a closing script tag');
fs.writeFileSync(path.join(__dirname, 'index.html'), src.replace('/*ENGINE*/', () => engine));
console.log('wrote index.html (' + fs.statSync(path.join(__dirname, 'index.html')).size + ' bytes)');
