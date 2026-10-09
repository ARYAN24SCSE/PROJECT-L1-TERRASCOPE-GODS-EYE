// src/data/geoid.js — bundled EGM96 geoid-undulation lookup using static binary grid.
//
// h = H + N: the globe (Cesium ellipsoid) needs ELLIPSOIDAL height (h);
// most real-world elevation sources (barometric altitude, MSL survey data,
// Caltrans/TfL camera priors) give ORTHOMETRIC height (H, "height above mean
// sea level"). N is the local geoid undulation — the gap between the WGS84
// ellipsoid and the geoid (~mean sea level) surface, ranging roughly
// -106..+85 m worldwide. See docs/plans/2026-07-05-entity-height-datum-fix.md.
//
// ATTRIBUTION & LICENSING:
// - EGM96 Geoid Model data produced by the National Geospatial-Intelligence Agency (NGA) / NASA.
// - Bilinear interpolation algorithm derivative of `egm96-universal` (MIT License, Copyright (c) 2020 Nicolas Vanhoren).
// - Binary dataset stored in public/egm96.bin (2,076,480 bytes) as 15-minute grid Int16 (cm).

const INTERVAL = (15 / 60) * (Math.PI / 180); // 15 arcminutes in radians
const NUM_ROWS = 721;
const NUM_COLS = 1440;

let dataView = null;
let readyPromise = null;

function degreesToRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function normalizeRadians(rads, center = 0) {
  return rads - (2 * Math.PI) * Math.floor((rads + Math.PI - center) / (2 * Math.PI));
}

function linearInterpolation(a, b, prop) {
  return a + (b - a) * prop;
}

function bilinearInterpolation(topLeft, bottomLeft, bottomRight, topRight, x, y) {
  const top = linearInterpolation(topLeft, topRight, x);
  const bottom = linearInterpolation(bottomLeft, bottomRight, x);
  return linearInterpolation(top, bottom, y);
}

/**
 * Lazily loads the EGM96 grid binary asset (public/egm96.bin) on demand.
 * Safe to call repeatedly; subsequent calls return the cached promise.
 * @returns {Promise<void>}
 */
export async function ensureGeoidReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      let buffer;
      if (typeof process !== 'undefined' && process.versions && process.versions.node && typeof window === 'undefined') {
        // Node.js runtime (unit tests)
        const fs = await import('node:fs/promises');
        const path = await import('node:path');
        const url = await import('node:url');
        let binPath;
        try {
          const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
          binPath = path.resolve(__dirname, '../../public/egm96.bin');
        } catch {
          binPath = path.resolve(process.cwd(), 'public/egm96.bin');
        }
        const fileBuf = await fs.readFile(binPath);
        buffer = fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.byteLength);
      } else {
        // Browser runtime (Vite web app)
        const response = await fetch('/egm96.bin');
        if (!response.ok) {
          throw new Error(`Failed to load EGM96 geoid data asset: ${response.status} ${response.statusText}`);
        }
        buffer = await response.arrayBuffer();
      }
      dataView = new DataView(buffer);
    })();
  }
  return readyPromise;
}

/**
 * Raw EGM96 mean sea level lookup function.
 * @param {number} latitude
 * @param {number} longitude
 * @returns {number}
 */
export function meanSeaLevel(latitude, longitude) {
  if (!dataView) {
    throw new Error(
      'geoid.js: geoidHeight() called before ensureGeoidReady() resolved — ' +
        'await ensureGeoidReady() first.',
    );
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

  return bilinearInterpolation(topLeft, bottomLeft, bottomRight, topRight, leftProp, topProp);
}

/**
 * Geoid undulation N at a given point, in metres, relative to the WGS84
 * ellipsoid (positive = geoid above ellipsoid). Throws if
 * `ensureGeoidReady()` has not resolved yet.
 * @param {number} latDeg
 * @param {number} lonDeg
 * @returns {number}
 */
export function geoidHeight(latDeg, lonDeg) {
  return meanSeaLevel(latDeg, lonDeg);
}

/**
 * Converts an orthometric (mean-sea-level) height to an ellipsoidal
 * (WGS84 globe-relative) height: h = H + N.
 * @param {number} hMslM - orthometric height in metres (height above MSL)
 * @param {number} latDeg
 * @param {number} lonDeg
 * @returns {number} ellipsoidal height in metres
 */
export function orthometricToEllipsoidal(hMslM, latDeg, lonDeg) {
  return hMslM + geoidHeight(latDeg, lonDeg);
}

/**
 * READOUT-ONLY inverse of {@link orthometricToEllipsoidal}: H = h - N.
 *
 * @param {number} hEllipsoidalM - height above the WGS84 ellipsoid, in metres
 * @param {number|null|undefined} geoidUndulationM - N at that point, in metres
 * @returns {number} height above MSL in metres, or the input when N is unknown
 */
export function ellipsoidalToMslDisplayM(hEllipsoidalM, geoidUndulationM) {
  if (!Number.isFinite(hEllipsoidalM)) return hEllipsoidalM;
  if (!Number.isFinite(geoidUndulationM)) return hEllipsoidalM;
  return hEllipsoidalM - geoidUndulationM;
}

export function ellipsoidToEgm96(latitude, longitude, altitude) {
  return altitude - meanSeaLevel(latitude, longitude);
}

export function egm96ToEllipsoid(latitude, longitude, altitude) {
  return altitude + meanSeaLevel(latitude, longitude);
}
