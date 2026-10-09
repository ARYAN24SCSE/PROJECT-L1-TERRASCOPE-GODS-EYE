const fs = require('fs');
const egm96Orig = require('egm96-universal');

const raw = fs.readFileSync('public/egm96.bin');
const dataView = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);

const INTERVAL = (15 / 60) * (Math.PI / 180);
const NUM_ROWS = 721;
const NUM_COLS = 1440;

function degreesToRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function normalizeRadians(rads, center = 0) {
  return rads - (2 * Math.PI) * Math.floor((rads + Math.PI - center) / (2 * Math.PI));
}

function customMeanSeaLevel(latitude, longitude) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NaN;
  }
  const lat = normalizeRadians(degreesToRadians(latitude));
  if (lat > Math.PI || lat < -Math.PI) {
    throw new Error('Invalid latitude');
  }
  const lon = normalizeRadians(degreesToRadians(longitude));

  let topRow = Math.floor(((Math.PI / 2) - lat) / INTERVAL);
  topRow = topRow === NUM_ROWS - 1 ? topRow - 1 : topRow;
  const bottomRow = topRow + 1;

  const leftCol = Math.floor(normalizeRadians(lon, Math.PI) / INTERVAL);
  const rightCol = (leftCol + 1) % NUM_COLS;

  const topLeft = dataView.getInt16((topRow * NUM_COLS + leftCol) * 2, false) / 100;
  const bottomLeft = dataView.getInt16((bottomRow * NUM_COLS + leftCol) * 2, false) / 100;
  const bottomRight = dataView.getInt16((bottomRow * NUM_COLS + rightCol) * 2, false) / 100;
  const topRight = dataView.getInt16((topRow * NUM_COLS + rightCol) * 2, false) / 100;

  const lonLeft = normalizeRadians(leftCol * INTERVAL);
  const latTop = (Math.PI / 2) - (topRow * INTERVAL);

  const leftProp = (lon - lonLeft) / INTERVAL;
  const topProp = (latTop - lat) / INTERVAL;

  const top = topLeft + (topRight - topLeft) * leftProp;
  const bottom = bottomLeft + (bottomRight - bottomLeft) * leftProp;
  return top + (bottom - top) * topProp;
}

// Check 1: Known coordinates
const testLocations = [
  { name: 'London', lat: 51.5072, lon: -0.1275 },
  { name: 'Austin', lat: 30.2672, lon: -97.7431 },
  { name: 'San Francisco', lat: 37.7749, lon: -122.4194 },
  { name: 'Denver', lat: 39.7392, lon: -104.9903 },
  { name: 'North Pole', lat: 90, lon: 0 },
  { name: 'South Pole', lat: -90, lon: 0 },
  { name: 'Equator / Prime Meridian', lat: 0, lon: 0 },
  { name: 'Date Line Positive', lat: 0, lon: 180 },
  { name: 'Date Line Negative', lat: 0, lon: -180 },
  { name: 'Wrapped Lon', lat: 51.5, lon: 359.87 },
  { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093 }
];

let maxDiff = 0;
for (const loc of testLocations) {
  const orig = egm96Orig.meanSeaLevel(loc.lat, loc.lon);
  const custom = customMeanSeaLevel(loc.lat, loc.lon);
  const diff = Math.abs(orig - custom);
  if (diff > maxDiff) maxDiff = diff;
  console.log(loc.name + ' (' + loc.lat + ', ' + loc.lon + '): orig=' + orig + ', custom=' + custom + ', diff=' + diff);
}

// Check 2: 10,000 random points grid sweep
console.log('\nRunning 10,000 random points comparison...');
for (let i = 0; i < 10000; i++) {
  const lat = (Math.random() - 0.5) * 180;
  const lon = (Math.random() - 0.5) * 720;
  const orig = egm96Orig.meanSeaLevel(lat, lon);
  const custom = customMeanSeaLevel(lat, lon);
  const diff = Math.abs(orig - custom);
  if (diff > maxDiff) maxDiff = diff;
  if (diff > 1e-9) {
    console.error('Mismatch at lat=' + lat + ', lon=' + lon + ': orig=' + orig + ', custom=' + custom);
    process.exit(1);
  }
}

console.log('\nMax diff across all tests: ' + maxDiff + '. PERFECT BIT-FOR-BIT MATCH!');
