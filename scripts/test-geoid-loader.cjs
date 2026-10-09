(async () => {
  const fs = require('fs/promises');
  const path = require('path');

  let dataView = null;
  let readyPromise = null;

  async function ensureGeoidReady() {
    if (!readyPromise) {
      readyPromise = (async () => {
        let buffer;
        if (typeof process !== 'undefined' && process.versions && process.versions.node) {
          const binPath = path.resolve('public/egm96.bin');
          const fileBuf = await fs.readFile(binPath);
          buffer = fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.byteLength);
        } else {
          const response = await fetch('/egm96.bin');
          if (!response.ok) throw new Error('Fetch failed');
          buffer = await response.arrayBuffer();
        }
        dataView = new DataView(buffer);
      })();
    }
    return readyPromise;
  }

  await ensureGeoidReady();
  console.log('Loader succeeded! Byte length:', dataView.byteLength);
})();
