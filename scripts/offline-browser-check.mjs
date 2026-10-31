import assert from 'node:assert/strict';
import { gameControl } from './game-control.mjs';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:5197';
const dir = 'output/playwright/launch-review';
await mkdir(dir, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const page = await context.newPage(), errors = [], backend = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => {
  const url = new URL(request.url());
  if (url.pathname.startsWith('/api/') || url.hostname.endsWith('.supabase.co')) backend.push(url.pathname);
});
const checks = [];
try {
  await page.goto(origin);
  await page.locator('#landingModal.active').waitFor();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.screenshot({ path: `${dir}/welcome.png`, fullPage: true });
  assert.match(await page.locator('#landingModal').innerText(), /Promotions · coming soon/);
  await page.locator('#landingStartClassicBtn').click();
  assert.equal(await page.locator('#mode-tourney-btn').isDisabled(), true);
  await page.locator('#gameCanvas').focus(); await page.keyboard.press('1'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).moves === 1);
  const saved = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  assert.equal(backend.length, 0, 'offline installation must not create an account or fetch game APIs');
  const cached = await page.evaluate(async () => {
    const names = (await caches.keys()).filter(name => name.startsWith('blokblaster-offline-'));
    return { names, urls: (await (await caches.open(names[0])).keys()).map(request => request.url) };
  });
  assert.equal(cached.names.length, 1);
  assert.ok(cached.urls.length >= 15);
  assert.ok(cached.urls.every(url => !/\/api\/|supabase|\/ar\/|\/playable\//.test(url)));
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => !!window.render_game_to_text);
  assert.equal(JSON.parse(await page.evaluate(() => window.render_game_to_text())).moves, saved.moves);
  assert.equal(JSON.parse(await page.evaluate(() => window.render_game_to_text())).score, saved.score);
  assert.equal(await page.locator('#connection-status').isVisible(), true);
  await page.screenshot({ path: `${dir}/offline-classic.png`, fullPage: true });
  await gameControl(page, '#leaderboard-btn');
  await page.locator('#offlineInfo.active').waitFor();
  assert.match(await page.locator('#offlineInfo').innerText(), /do not enter the daily leaderboard/);
  await page.keyboard.press('Escape');
  await gameControl(page, '#updates-btn');
  await page.locator('#offlineInfo.active').waitFor(); await page.keyboard.press('Escape');
  const apiOffline = await page.evaluate(async () => {
    try { await fetch('/api/events?channel=updates'); return false; } catch { return true; }
  });
  assert.equal(apiOffline, true, 'offline API must fail, never receive cached news or game HTML');
  await gameControl(page, '#mode-levels-btn');
  await page.locator('[data-level="1"]').click();
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'levels');
  await page.locator('#gameCanvas').focus(); await page.keyboard.press('1'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).moves === 1);
  await page.reload();
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'levels');
  assert.equal(JSON.parse(await page.evaluate(() => window.render_game_to_text())).moves, 1);
  for (const [width, height] of [[320, 568], [844, 390], [1280, 800]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${dir}/offline-level-${width}.png`, fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no horizontal page overflow at ${width}`);
    assert.ok(await page.evaluate(() => {
      const state = JSON.parse(window.render_game_to_text());
      const controlEl = document.querySelector('#keyboard-controls');
      const controls = controlEl.getBoundingClientRect();
      const canvas = document.querySelector('#gameCanvas').getBoundingClientRect();
      return state.pieces.filter(piece => piece.active).every(piece => canvas.top + piece.y + piece.shape.length * piece.cellSize <= (controlEl.hidden ? canvas.bottom : controls.top));
    }), `tray pieces must not be covered by keyboard controls at ${width}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await gameControl(page, '#theme-btn');
  await page.screenshot({ path: `${dir}/offline-light.png`, fullPage: true });
  await context.setOffline(false);
  await page.waitForFunction(() => document.getElementById('connection-status').hidden);
  await page.route('**/api/events?channel=updates', route => route.fulfill({ json: { publicKey: null, announcements: [] } }));
  await gameControl(page, '#updates-btn');
  await page.getByText('No promotion is open right now.', { exact: false }).waitFor();
  await page.screenshot({ path: `${dir}/news-coming-soon.png`, fullPage: true });
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => !!document.activeElement.closest('#updatesModal')), true);
  await page.keyboard.press('Escape');
  await gameControl(page, '#landing-info-btn');
  await page.locator('#landingRulesBtn').click();
  assert.match(await page.locator('#casualInfoModal').innerText(), /saved for offline play/);
  await page.screenshot({ path: `${dir}/about-offline.png`, fullPage: true });
  assert.deepEqual(errors, []);
  checks.push('real production worker installs without notification consent or Auth', 'Classic and Levels survive offline reload with moves and score',
    'network-only features explain offline status; APIs never fall back to HTML', 'promotion tab disabled; empty feed explicitly coming soon',
    '320px, landscape, desktop, light theme, reduced motion and keyboard dialog focus', 'reconnection restores online UI');

  // Check exact secret values locally without displaying or copying them into reports.
  const bundle = (await Promise.all((await readdir('dist/assets')).filter(f => f.endsWith('.js')).map(f => readFile(`dist/assets/${f}`, 'utf8')))).join('');
  for (const file of ['.env.local', '.env.push.local']) {
    let env; try { env = await readFile(file, 'utf8'); } catch { continue; }
    for (const line of env.split(/\r?\n/)) {
      const match = line.match(/^(SUPABASE_SERVICE_ROLE_KEY|WEB_PUSH_PRIVATE_KEY|CRON_SECRET)=(.+)$/);
      if (match) assert.equal(bundle.includes(match[2].replace(/^["']|["']$/g, '')), false, `${match[1]} must not enter public JS`);
    }
  }
  checks.push('public JS does not contain configured server secrets');
  await mkdir('output/review', { recursive: true });
  await writeFile('output/review/launch-offline.json', JSON.stringify({ checks, cacheFiles: cached.urls.length, pageErrors: errors }, null, 2));
  console.log(`PASS ${checks.join('; ')}`);
} finally { await browser.close(); }
