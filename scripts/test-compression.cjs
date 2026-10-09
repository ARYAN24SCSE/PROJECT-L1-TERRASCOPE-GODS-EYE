const fs = require('fs');
const zlib = require('zlib');

const raw = fs.readFileSync('public/egm96.bin');
console.log('Raw Int16 BigEndian size:', raw.length, 'bytes');

const gzippedRaw = zlib.gzipSync(raw);
console.log('Gzipped raw Int16 BE size:', gzippedRaw.length, 'bytes (~', Math.round(gzippedRaw.length/1024), 'KB)');

// Test row-wise delta encoding
// 721 rows, 1440 cols
const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
const values = new Int16Array(721 * 1440);
for (let i = 0; i < values.length; i++) {
  values[i] = view.getInt16(i * 2, false); // big endian
}

// Convert to Little-Endian Int16 Array Buffer
const leBuf = Buffer.from(values.buffer);
const gzippedLE = zlib.gzipSync(leBuf);
console.log('Gzipped raw Int16 LE size:', gzippedLE.length, 'bytes (~', Math.round(gzippedLE.length/1024), 'KB)');

// Row-wise delta
const deltas = new Int16Array(721 * 1440);
for (let r = 0; r < 721; r++) {
  let prev = 0;
  for (let c = 0; c < 1440; c++) {
    const idx = r * 1440 + c;
    const val = values[idx];
    deltas[idx] = val - prev;
    prev = val;
  }
}
const deltaBuf = Buffer.from(deltas.buffer);
const gzippedDelta = zlib.gzipSync(deltaBuf);
console.log('Gzipped row-wise delta Int16 size:', gzippedDelta.length, 'bytes (~', Math.round(gzippedDelta.length/1024), 'KB)');
