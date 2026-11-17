import { pathToFileURL } from 'node:url';

export async function checkHealth(origin, request = fetch, now = Date.now()) {
  const failures = [];
  const get = async path => {
    const r = await request(new URL(path, origin), { signal: AbortSignal.timeout(20000), cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r;
  };
  try {
    const html = await (await get('/')).text();
    if (!html.includes('Blok Blaster')) throw new Error('Unexpected homepage');
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"\s]+\.(?:js|css))"/g)].map(m => m[1]);
    if (assets.length < 2) throw new Error('Missing game assets');
    for (const asset of new Set(assets)) {
      const r = await get(asset);
      if (!(r.headers.get('content-type') || '').match(/javascript|text\/css/)) throw new Error('Unexpected asset content type');
      await r.body?.cancel();
    }
  } catch (e) { failures.push({ component: 'game', reason: e.message }); }
  try {
    const r = await get('/api/classic');
    const d = await r.json();
    const day = new Intl.DateTimeFormat('en-CA', {timeZone:'Africa/Johannesburg', year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
    if (d.demo !== false || d.closed !== false || d.day !== day || d.today !== day || !Array.isArray(d.entries) || !Number.isInteger(d.participants) || Math.abs(Date.parse(d.serverTime) - now) > 300000 || !Number.isFinite(Date.parse(d.serverTime)))
      throw new Error('Invalid or stale production leaderboard');
  } catch (e) { failures.push({ component: 'rankings', reason: e.message }); }
  return { origin, checkedAt: new Date(now).toISOString(), healthy: failures.length === 0, failures };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let failed = false;
  for (const origin of ['https://blokblaster.playables.co.za', 'https://blokblaster.vercel.app']) {
    let result = await checkHealth(origin);
    if (!result.healthy) result = await checkHealth(origin);
    console.log(JSON.stringify(result)); failed ||= !result.healthy;
  }
  process.exitCode = failed ? 1 : 0;
}
