const fs = require('fs');
const content = fs.readFileSync('node_modules/egm96-universal/dist/egm96-universal.cjs.js', 'utf8');
const start = content.indexOf('var data = "') + 12;
const end = content.indexOf('";', start);
const base64Str = content.slice(start, end);
const buf = Buffer.from(base64Str, 'base64');
console.log('Raw binary length:', buf.length, 'bytes');

if (!fs.existsSync('public')) fs.mkdirSync('public');
fs.writeFileSync('public/egm96.bin', buf);
console.log('Saved public/egm96.bin');
