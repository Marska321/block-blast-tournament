import assert from 'node:assert/strict';
import { gameControl } from './game-control.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import webpush from 'web-push';
const vapid = webpush.generateVAPIDKeys();
process.env.VITE_CASUAL_ONLY = 'true';
const server = await createServer({ envDir: false, server: { host: '127.0.0.1', port: 5196, strictPort: true } });
await server.listen();
const origin = 'http://127.0.0.1:5196', browser = await chromium.launch({ headless: true });
const dir = 'output/playwright/updates'; await mkdir(dir, { recursive: true });
const errors = [], writes = [], checks = [];
async function scenario({ permission = 'default', ios = false, unsupported = false, failFeed = false, failSave = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', ...(ios ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1' } : {}) });
  await context.addInitScript(({ permission, unsupported }) => {
    localStorage.setItem('bb_has_seen_landing', 'true');
    window.permissionRequests = 0; let state = permission;
    Object.defineProperty(window, 'Notification', { configurable: true, value: {
      get permission() { return state; }, requestPermission: async () => { window.permissionRequests++; state = state === 'denied' ? state : 'granted'; return state; },
    } });
    if (unsupported) { delete window.PushManager; }
    let sub = localStorage.getItem('bb_push_registered') ? makeSub() : null;
    function makeSub() { return { toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/browser-test', keys: { p256dh: 'test', auth: 'test' } }), unsubscribe: async () => { sub = null; return true; } }; }
    const reg = { pushManager: { getSubscription: async () => sub, subscribe: async () => { sub = makeSub(); return sub; } } };
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {
      ready: Promise.resolve(reg), register: async () => reg, getRegistration: async () => reg, addEventListener() {},
    } });
  }, { permission, unsupported });
  let fail = failFeed, saveFails = failSave, readCount = 0, authCount = 0;
  await context.route('**/api/events?channel=updates', async route => {
    if (route.request().method() === 'POST') {
      const input = route.request().postDataJSON(); writes.push(input.operation);
      if (saveFails && input.operation === 'subscribe') { saveFails = false; return route.fulfill({ status: 503, json: { message: 'Try again' } }); }
      return route.fulfill({ json: { subscribed: input.operation === 'subscribe' } });
    }
    readCount++;
    if (fail) { fail = false; return route.fulfill({ status: 503, json: { message: 'Unavailable' } }); }
    return route.fulfill({ json: { publicKey: vapid.publicKey, announcements: [{
      id: 'test-news', title: 'Your next little challenge.', message: '<img src=x onerror=alert(1)> A fresh puzzle is on its way. Watch this space.',
      path: '/?updates=1', publish_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86400000).toISOString(),
    }] } });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', req => { if (new URL(req.url()).hostname.endsWith('.supabase.co')) authCount++; });
  await page.goto(origin);
  await gameControl(page, '#mode-classic-btn');
  await page.locator('#gameCanvas').focus(); await page.keyboard.press('1'); await page.keyboard.press('Enter');
  assert.equal(JSON.parse(await page.evaluate(() => window.render_game_to_text())).moves, 1);
  assert.equal(await page.evaluate(() => window.permissionRequests), 0); assert.equal(readCount, 0); assert.equal(authCount, 0);
  await gameControl(page, '#updates-btn');
  const panel = page.locator('#updatesModal');
  if (failFeed) {
    await panel.getByRole('button', { name: 'Try again', exact: true }).click();
    checks.push('feed outage and retry');
  }
  await panel.getByRole('heading', { name: 'Your next little challenge.' }).waitFor();
  assert.equal(await panel.locator('.updates-item img').count(), 0);
  assert.match(await panel.locator('.updates-item p').innerText(), /<img/);
  assert.equal(await page.evaluate(() => window.permissionRequests), 0);
  if (ios) {
    assert.match(await panel.locator('[role=status]').innerText(), /Add to Home Screen/);
    assert.equal(await panel.getByRole('button', { name: 'Enable notifications', exact: true }).isVisible(), false);
    await page.screenshot({ path: `${dir}/iphone-install.png`, fullPage: true }); checks.push('iPhone Home Screen guidance');
  } else if (unsupported) {
    assert.match(await panel.locator('[role=status]').innerText(), /doesn’t support/); checks.push('unsupported browser still reads news');
  } else if (permission === 'denied') {
    assert.match(await panel.locator('[role=status]').innerText(), /blocked/); checks.push('blocked permission guidance');
  } else {
    await page.screenshot({ path: `${dir}/before-opt-in.png`, fullPage: true });
    await panel.getByRole('button', { name: 'Enable notifications', exact: true }).click();
    if (failSave) {
      await page.waitForFunction(() => document.querySelector('#updatesModal [role=status]')?.textContent.includes('could not be enabled'));
      assert.equal(await page.evaluate(() => localStorage.getItem('bb_push_registered')), null);
      await panel.getByRole('button', { name: 'Enable notifications', exact: true }).click(); checks.push('failed save never claims success; retry works');
    }
    await page.waitForFunction(() => document.querySelector('#updatesModal [role=status]')?.textContent.startsWith('Notifications are on'));
    assert.equal((await page.evaluate(() => localStorage.getItem('bb_push_management_token'))).length, 64);
    await page.screenshot({ path: `${dir}/enabled.png`, fullPage: true });
    await panel.getByRole('button', { name: 'Turn off notifications', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#updatesModal [role=status]')?.textContent.startsWith('Notifications are off'));
    assert.equal(await page.evaluate(() => localStorage.getItem('bb_push_management_token')), null);
    await page.screenshot({ path: `${dir}/unsubscribed.png`, fullPage: true }); checks.push('opt-in, subscription save and unsubscribe without Auth');
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.keyboard.press('Escape'); assert.equal(await panel.isVisible(), false);
  await page.waitForFunction(() => document.activeElement?.id === 'play-menu-btn');
  assert.equal(JSON.parse(await page.evaluate(() => window.render_game_to_text())).moves, 1);
  assert.equal(authCount, 0); await context.close();
}
try {
  await scenario(); await scenario({ permission: 'denied' }); await scenario({ ios: true });
  await scenario({ unsupported: true }); await scenario({ failFeed: true, failSave: true });
  // Exercise the actual served worker and manifest separately from permission fixtures.
  const context = await browser.newContext(); const page = await context.newPage();
  await page.goto(origin); const manifest = await (await context.request.get(origin + '/manifest.webmanifest')).json();
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) assert.equal((await context.request.get(origin + icon.src)).status(), 200);
  assert.equal(await page.evaluate(async () => { await navigator.serviceWorker.register('/notifications-sw.js'); return (await navigator.serviceWorker.ready).active.scriptURL.endsWith('/notifications-sw.js'); }), true);
  await context.close(); checks.push('real worker activation and install icons');
  assert.deepEqual(errors, []); assert.ok(writes.includes('subscribe') && writes.includes('unsubscribe'));
  await mkdir('output/review', { recursive: true });
  await writeFile('output/review/updates-browser.json', JSON.stringify({ checks, pageErrors: errors, note: 'Permission and push subscription fixtures; no player broadcast or actual vendor delivery.' }, null, 2));
  console.log('PASS', checks.join('; '));
} finally { await browser.close(); await server.close(); }
