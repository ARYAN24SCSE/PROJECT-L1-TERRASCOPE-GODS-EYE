const fs = require('fs');
console.log(fs.readFileSync('scripts/check-package-boundaries.mjs', 'utf8').substring(0, 1500));
