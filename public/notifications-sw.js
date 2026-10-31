// Replaced with a content-versioned allowlist by the production build.
const OFFLINE = null;
self.addEventListener('install', event => {
  if (!OFFLINE) return;
  // Do not skipWaiting: an update must not replace an in-progress game's worker.
  event.waitUntil((async () => {
    const cache = await caches.open(OFFLINE.cache);
    try {
      await cache.addAll(OFFLINE.assets.map(path => new Request(path, {
        cache: 'reload', credentials: 'omit', redirect: 'error',
      })));
    } catch (error) { await caches.delete(OFFLINE.cache); throw error; }
  })());
});
self.addEventListener('activate', event => event.waitUntil((async () => {
  if (OFFLINE) for (const key of await caches.keys()) {
    if (key.startsWith('blokblaster-offline-') && key !== OFFLINE.cache) await caches.delete(key);
  }
  await self.clients.claim();
})()));
self.addEventListener('message', event => {
  if (event.data?.type === 'OFFLINE_STATUS') event.ports?.[0]?.postMessage({ ready: !!OFFLINE });
});
self.addEventListener('fetch', event => {
  if (!OFFLINE || event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const navigation = event.request.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/index.html');
  const asset = !url.search && url.pathname !== '/' && OFFLINE.assets.includes(url.pathname);
  if (!navigation && !asset) return; // APIs, authentication, promotions and videos remain network-only.
  event.respondWith((async () => {
    // Reading must not recreate an obsolete cache during worker activation.
    const cached = path => caches.match(path, { cacheName: OFFLINE.cache });
    if (navigation) {
      try { return await fetch(event.request, { signal: AbortSignal.timeout(4000) }); }
      catch { return (await cached('/')) || Response.error(); }
    }
    return (await cached(url.pathname)) || fetch(event.request);
  })());
});
self.addEventListener('push', event => {
  let data;
  try { data = event.data.json(); } catch { data = {}; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
  if (data.expiresAt && new Date(data.expiresAt).getTime() <= Date.now()) return;
  event.waitUntil(self.registration.showNotification(
    typeof data.title === 'string' ? data.title.slice(0, 80) : 'Blok Blaster', {
      body: typeof data.message === 'string' ? data.message.slice(0, 240) : 'See what’s new from Playables.',
      icon: '/push-icon-192.png', badge: '/favicon-32.png',
      tag: 'playables-' + (typeof data.id === 'string' ? data.id.slice(0, 80) : 'updates'),
      data: { path: data.path || '/?updates=1' },
    }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  let target = new URL('/?updates=1', self.location.origin);
  try {
    const path = event.notification.data?.path;
    const candidate = new URL(path, self.location.origin);
    if (typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') &&
        !/[\\\s\u0000-\u001f]/.test(path) && candidate.origin === self.location.origin &&
        !candidate.pathname.startsWith('/api/')) target = candidate;
  } catch {}
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Keep an existing run intact; ask the game to open its updates panel.
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin && new URL(client.url).pathname === '/');
    if (existing && target.pathname === '/' && target.search === '?updates=1') {
      await existing.focus(); existing.postMessage({ type: 'OPEN_UPDATES' });
    } else await self.clients.openWindow(target.href);
  })());
});
