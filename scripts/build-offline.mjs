import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Cache only this release's public game shell, never API data or marketing pages.
const assets = ['/', '/brand-mark.svg', '/favicon.svg', '/favicon.ico', '/favicon-32.png',
  '/apple-touch-icon.png', '/push-icon-192.png', '/push-icon-512.png', '/manifest.webmanifest'];
async function collect(dir) {
  for (const entry of await readdir(`dist/${dir}`, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await collect(path);
    else assets.push(`/${path}`);
  }
}
await collect('assets');
await collect('fonts');
assets.sort();
const source = await readFile('public/notifications-sw.js', 'utf8');
const hash = createHash('sha256').update(source);
let bytes = 0;
for (const asset of assets) {
  const data = await readFile(`dist${asset === '/' ? '/index.html' : asset}`);
  bytes += data.length; hash.update(asset).update(data);
}
const config = { cache: `blokblaster-offline-${hash.digest('hex').slice(0, 20)}`, assets };
await writeFile('dist/notifications-sw.js', source.replace('const OFFLINE = null;', `const OFFLINE = ${JSON.stringify(config)};`));
console.log(`Offline shell: ${assets.length} public files, ${Math.round(bytes / 1024)} KiB.`);
