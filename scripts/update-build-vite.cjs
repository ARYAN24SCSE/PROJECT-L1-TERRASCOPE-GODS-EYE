const fs = require('fs');
let code = fs.readFileSync('build/vite.js', 'utf8');
code = code.replace("        'egm96-universal',\n", "");
fs.writeFileSync('build/vite.js', code);
console.log('Updated build/vite.js successfully');
