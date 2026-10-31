import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

test('offline worker isolates public shell, preserves network errors and never caches private routes', async () => {
  const listeners: Record<string, Function> = {};
  const cacheName = 'blokblaster-offline-test';
  const shell = new Response('game shell'), asset = new Response('game script');
  const deleted: string[] = [];
  let offline = false, failedInstall = false, claimed = false;
  const source = (await readFile('public/notifications-sw.js', 'utf8')).replace('const OFFLINE = null;',
    `const OFFLINE = ${JSON.stringify({ cache: cacheName, assets: ['/', '/assets/game.js'] })};`);
  runInNewContext(source, { URL, Response, AbortSignal,
    Request: class { constructor(public url: string, public options: unknown) {} },
    self: { location: { origin: 'https://game.test' }, addEventListener: (key: string, cb: Function) => listeners[key] = cb,
      clients: { claim: async () => { claimed = true; } } },
    caches: { match: async (path: string) => path === '/' ? shell : asset,
      open: async () => ({ addAll: async () => { if (failedInstall) throw Error('download failed'); },
      match: async (path: string) => path === '/' ? shell : asset }),
      keys: async () => ['other-app-cache', 'blokblaster-offline-old', cacheName],
      delete: async (name: string) => deleted.push(name) },
    fetch: async () => { if (offline) throw Error('offline'); return new Response('not authorized', { status: 401 }); },
  });
  async function lifecycle(name: string) { let pending; listeners[name]({ waitUntil: (p: Promise<unknown>) => pending = p }); await pending; }
  function request(path: string, method = 'GET', mode = 'cors') {
    let response: Promise<Response> | undefined;
    listeners.fetch({ request: { url: new URL(path, 'https://game.test').href, method, mode }, respondWith: (p: Promise<Response>) => response = p });
    return response;
  }
  for (const path of ['/api/events?channel=updates', '/api/classic', '/api/claim', '/ar/', '/playable/', '/assets/game.js?token=x', 'https://other.test/assets/game.js'])
    assert.equal(request(path), undefined, path);
  assert.equal(request('/', 'POST', 'navigate'), undefined);
  assert.equal((await request('/', 'GET', 'navigate'))?.status, 401, 'never replace access-control errors with the cached page');
  offline = true;
  assert.equal(await request('/?updates=1', 'GET', 'navigate'), shell);
  assert.equal(await request('/assets/game.js'), asset);
  await lifecycle('install'); await lifecycle('activate');
  assert.equal(claimed, true); assert.deepEqual(deleted, ['blokblaster-offline-old']);
  failedInstall = true;
  await assert.rejects(lifecycle('install'), /download failed/);
  assert.equal(deleted.at(-1), cacheName, 'failed installs remove partial caches');
});
