// Raster fallbacks are derived from the same vector artwork; no external assets.
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';

const publicDirectory = new URL('../public/', import.meta.url);
const svg = await readFile(new URL('favicon.svg', publicDirectory), 'utf8');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const iconImages = [];
  for (const size of [16, 32, 48, 180]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%}svg{display:block;width:100%;height:100%}</style>${svg}`);
    const png = await page.screenshot({ omitBackground: true });
    if (size === 32) await writeFile(new URL('favicon-32.png', publicDirectory), png);
    if (size === 180) await writeFile(new URL('apple-touch-icon.png', publicDirectory), png);
    else iconImages.push({ size, png });
  }
  // ICO directory containing lossless PNG entries for legacy browser requests.
  const directory = Buffer.alloc(6 + 16 * iconImages.length);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(iconImages.length, 4);
  let imageOffset = directory.length;
  iconImages.forEach(({ size, png }, index) => {
    const entryOffset = 6 + 16 * index;
    directory[entryOffset] = size;
    directory[entryOffset + 1] = size;
    directory.writeUInt16LE(1, entryOffset + 4);
    directory.writeUInt16LE(32, entryOffset + 6);
    directory.writeUInt32LE(png.length, entryOffset + 8);
    directory.writeUInt32LE(imageOffset, entryOffset + 12);
    imageOffset += png.length;
  });
  await writeFile(new URL('favicon.ico', publicDirectory), Buffer.concat([directory, ...iconImages.map(({ png }) => png)]));
} finally {
  await browser.close();
}
console.log('Generated favicon.ico (16/32/48px), favicon-32.png and apple-touch-icon.png.');
