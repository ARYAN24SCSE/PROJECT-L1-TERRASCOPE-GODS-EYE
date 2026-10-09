import { build } from 'vite';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const result = await build({
  configFile: 'vite.config.js',
  build: {
    write: false,
    metafile: true,
    rollupOptions: {
      output: {
        metafile: true,
      },
    },
  },
});

console.log('Build finished, analyzing chunks...');
const output = Array.isArray(result) ? result[0].output : result.output;

for (const item of output) {
  if (item.type === 'chunk' && item.fileName.startsWith('assets/index')) {
    console.log(`Chunk: ${item.fileName} (${(item.code.length / 1024 / 1024).toFixed(2)} MB)`);
    const moduleEntries = Object.entries(item.modules || {}).map(([id, info]) => ({
      id,
      bytes: info.renderedLength,
    })).sort((a, b) => b.bytes - a.bytes);

    console.log(`Top 30 modules in ${item.fileName}:`);
    for (const mod of moduleEntries.slice(0, 30)) {
      console.log(`  ${(mod.bytes / 1024).toFixed(1)} KB - ${mod.id}`);
    }

    // Group by node_modules package or src directory
    const groups = {};
    for (const mod of moduleEntries) {
      let key = 'other';
      if (mod.id.includes('node_modules')) {
        const parts = mod.id.split('node_modules/');
        const pkgParts = parts[parts.length - 1].split('/');
        key = pkgParts[0].startsWith('@') ? `${pkgParts[0]}/${pkgParts[1]}` : pkgParts[0];
      } else if (mod.id.includes('src/')) {
        const parts = mod.id.split('src/')[1].split('/');
        key = `src/${parts[0]}`;
      }
      groups[key] = (groups[key] || 0) + mod.bytes;
    }

    const groupEntries = Object.entries(groups).sort((a, b) => b[1] - a[1]);
    console.log(`\nGroup breakdown for ${item.fileName}:`);
    for (const [group, bytes] of groupEntries) {
      console.log(`  ${(bytes / 1024).toFixed(1)} KB - ${group}`);
    }
  }
}
