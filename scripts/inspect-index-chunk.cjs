const fs = require('fs');
const glob = require('fs').readdirSync('dist/assets').filter(f => f.startsWith('index-') && f.endsWith('.js'));
for (const f of glob) {
  const code = fs.readFileSync('dist/assets/' + f, 'utf8');
  console.log(f + ' total length: ' + code.length + ' bytes');
  console.log('Contains Cesium/Viewer/Cartesian3? ' + code.includes('Cartesian3'));
  console.log('Count of "cesium" occurrences: ' + (code.match(/cesium/gi) || []).length);
  console.log('Count of "Viewer" occurrences: ' + (code.match(/Viewer/g) || []).length);
}
