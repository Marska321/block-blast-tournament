import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
const svg = await readFile('public/favicon.svg', 'utf8');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const size of [192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%}svg{display:block;width:100%;height:100%}</style>${svg}`);
    await writeFile(`public/push-icon-${size}.png`, await page.screenshot());
  }
} finally { await browser.close(); }
