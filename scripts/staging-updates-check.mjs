import assert from 'node:assert/strict';
import { randomBytes, createECDH, createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import webpush from 'web-push';
import eventsRoute from '../api/events.ts';
import { dispatchUpdates } from '../server/updates.ts';
if (process.env.SUPABASE_URL !== 'https://okjfileghngpcegdwdud.supabase.co') throw new Error('Explicit staging database required.');
const origin = 'http://127.0.0.1:5198', ids = [], endpoint = 'https://fcm.googleapis.com/fcm/send/verification-' + randomUUID();
const vapid = webpush.generateVAPIDKeys(), ecdh = createECDH('prime256v1'); ecdh.generateKeys();
const sub = { endpoint, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } };
process.env.UPDATES_ENABLED = 'true'; process.env.UPDATES_ORIGINS = origin; process.env.VITE_CASUAL_ONLY = 'true';
process.env.WEB_PUSH_PUBLIC_KEY = vapid.publicKey; process.env.WEB_PUSH_PRIVATE_KEY = vapid.privateKey;
process.env.WEB_PUSH_SUBJECT = 'https://block-blast-tournament-staging.vercel.app'; process.env.CRON_SECRET = randomBytes(32).toString('hex');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
async function announcement(title, published = true) {
  const result = await db.from('game_announcements').insert({ title, message: 'Verification only — no promotion or payout.', published,
    expires_at: new Date(Date.now() + 3600000).toISOString() }).select('id').single();
  assert.ok(!result.error, 'Create isolated staging announcement'); ids.push(result.data.id); return result.data.id;
}
const server = await createServer({ envDir: false, server: { host: '127.0.0.1', port: 5198, strictPort: true }, plugins: [{
  name: 'staging-updates-api', configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url, origin); if (url.pathname !== '/api/events') return next();
      req.query = Object.fromEntries(url.searchParams);
      if (req.method === 'POST') {
        let data = ''; for await (const chunk of req) data += chunk;
        req.body = JSON.parse(data);
      }
      res.status = code => { res.statusCode = code; return res; };
      res.json = data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
      await eventsRoute(req, res);
    });
  },
}] });
let browser, failure; const errors = [], checks = [];
try {
  await announcement('Staging news check');
  await server.listen(); browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(subscription => {
    localStorage.setItem('bb_has_seen_landing', 'true');
    Object.defineProperty(window, 'Notification', { value: { permission: 'granted', requestPermission: async () => 'granted' } });
    let current = null;
    const reg = { pushManager: { getSubscription: async () => current, subscribe: async () => current = {
      toJSON: () => subscription, unsubscribe: async () => { current = null; return true; },
    } } };
    Object.defineProperty(navigator, 'serviceWorker', { value: { ready: Promise.resolve(reg), register: async () => reg, getRegistration: async () => reg, addEventListener() {} } });
  }, sub);
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.name));
  await page.goto(origin); await page.locator('#updates-btn').click();
  await page.getByRole('heading', { name: 'Staging news check' }).waitFor(); checks.push('browser reads live staging feed through actual API handler');
  await page.getByRole('button', { name: 'Enable notifications', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#updatesModal [role=status]')?.textContent.startsWith('Notifications are on'));
  const token = await page.evaluate(() => localStorage.getItem('bb_push_management_token'));
  const stored = await db.from('game_push_subscriptions').select('id,token_hash,origin').eq('endpoint', endpoint).single();
  assert.ok(!stored.error); assert.equal(stored.data.token_hash, createHash('sha256').update(token).digest('hex')); assert.equal(stored.data.origin, origin);
  checks.push('UI opt-in persists hashed capability and vendor keys in staging without Auth');
  const a = await announcement('Staging dispatch check');
  let accepted = 0;
  const sender = async (subscription, payload, options) => {
    assert.equal(subscription.endpoint, endpoint, 'Only this verification device may be sent to');
    assert.equal(JSON.parse(payload).id, a); assert.ok(webpush.generateRequestDetails(subscription, payload, options).body.length > 0); accepted++; return {};
  };
  // Guard against contacting any device; the transport is injected and never makes a network push.
  assert.equal((await db.from('game_push_subscriptions').select('id', { head: true, count: 'exact' })).count, 1);
  assert.deepEqual(await dispatchUpdates(db, sender), { sent: 1, expired: 0, failed: 0 }); assert.equal(accepted, 1);
  assert.deepEqual(await dispatchUpdates(db, sender), { sent: 0, expired: 0, failed: 0 });
  checks.push('real staging queue claims, encrypts, records and deduplicates delivery with isolated transport');
  const protectedResponse = await context.request.get(origin + '/api/events?channel=updates&operation=dispatch'); assert.equal(protectedResponse.status(), 401);
  const forbidden = await context.request.post(origin + '/api/events?channel=updates', { headers: { Origin: 'https://evil.test' }, data: { operation: 'unsubscribe', token } }); assert.equal(forbidden.status(), 403);
  checks.push('HTTP dispatcher authentication and cross-origin write denial');
  await page.getByRole('button', { name: 'Turn off notifications', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#updatesModal [role=status]')?.textContent.startsWith('Notifications are off'));
  assert.equal((await db.from('game_push_subscriptions').select('id', { count: 'exact', head: true }).eq('endpoint', endpoint)).count, 0);
  checks.push('UI unsubscribe removes staging device and queued deliveries');
  await mkdir('output/playwright/updates-staging', { recursive: true });
  await page.screenshot({ path: 'output/playwright/updates-staging/removed.png', fullPage: true });
  assert.deepEqual(errors, []);
  const publicDb = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  assert.ok((await publicDb.from('game_push_subscriptions').select('*')).error);
  assert.ok((await publicDb.rpc('game_push_claim', { p_limit: 10 })).error); checks.push('real staging anon key cannot read subscriptions or claim sends');
} catch (error) { failure = error.message; }
finally {
  await db.from('game_push_subscriptions').delete().eq('endpoint', endpoint);
  if (ids.length) await db.from('game_announcements').delete().in('id', ids);
  await browser?.close(); await server.close();
  await mkdir('output/review', { recursive: true });
  await writeFile('output/review/updates-staging.json', JSON.stringify({ checkedAt: new Date().toISOString(), checks, failure: failure || null,
    temporaryDataRemoved: true, limitations: ['Local HTTP API with actual staging database; browser subscription and push transport are fixtures; no physical-device/vendor delivery or hosted Vercel runtime verified.'] }, null, 2));
}
if (failure) { console.error(failure); process.exitCode = 1; } else console.log('PASS', checks.join('; '));
