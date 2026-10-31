import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

let release = 1;
const worker = await readFile('dist/notifications-sw.js', 'utf8');
const config = JSON.parse(worker.match(/const OFFLINE = (.*);/)[1]);
const headers = JSON.parse(await readFile('vercel.json', 'utf8')).headers.find(h => h.source === '/').headers;
const root = resolve('dist');
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  res.setHeader('Cache-Control', 'no-store');
  if (path === '/notifications-sw.js') {
    console.log('Serving test worker release', release);
    res.setHeader('Content-Type', 'text/javascript');
    return res.end(worker.replace(config.cache, `blokblaster-offline-test-${release}`).replace(
      '"/brand-mark.svg"', release === 3 ? '"/missing-release-file.svg"' : '"/brand-mark.svg"'));
  }
  const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
  if (!file.startsWith(root + '\\') && !file.startsWith(root + '/')) { res.writeHead(403); return res.end(); }
  try {
    const data = await readFile(file);
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf' };
    res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
    if (extname(file) === '.html') for (const h of headers) res.setHeader(h.key, h.value);
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(done => server.listen(5198, '127.0.0.1', done));
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  let page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5198');
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  assert.deepEqual(await page.evaluate(() => caches.keys()), ['blokblaster-offline-test-1']);
  release = 2;
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration('/')).update());
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration('/')).waiting);
  assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration('/')).active.state), 'activated');
  await page.close();
  page = await context.newPage();
  await page.goto('http://127.0.0.1:5198');
  await page.waitForFunction(async () => JSON.stringify(await caches.keys()) === '["blokblaster-offline-test-2"]');
  release = 3;
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration('/')).update());
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.getRegistration('/');
    return !reg.installing && !reg.waiting;
  });
  await page.waitForFunction(async () => JSON.stringify(await caches.keys()) === '["blokblaster-offline-test-2"]');
  await context.setOffline(true); await page.reload();
  await page.locator('#landingStartClassicBtn').click();
  await page.locator('#gameCanvas').focus(); await page.keyboard.press('1'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).moves === 1);
  assert.deepEqual(errors, []);
  console.log('PASS real browser update waits for open games; activation cleans only old game cache; failed install preserves working offline release; offline game loads under deployed CSP.');
} finally { await browser.close(); await new Promise(done => server.close(done)); }
