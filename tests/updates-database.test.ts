import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
let db: PGlite;
const token = "a".repeat(64), origin = "https://game.test";
before(async () => {
  db = new PGlite();
  await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;");
  await db.exec(await readFile("supabase/migrations/20261026165252_player_updates.sql", "utf8"));
  await db.exec("SET ROLE service_role");
});
after(async () => { await db?.close(); });
async function subscribe(endpoint = "https://fcm.googleapis.com/test/" + randomUUID(), hash = token, site = origin) {
  await db.query("SELECT public.game_push_subscribe($1,'{\"p256dh\":\"test\",\"auth\":\"test\"}',$2,$3)", [endpoint, hash, site]);
  return (await db.query<any>("SELECT * FROM public.game_push_subscriptions WHERE endpoint=$1", [endpoint])).rows[0];
}
async function announce(published = true, offset = -1, expiry = 86400) {
  return (await db.query<any>(`INSERT INTO public.game_announcements(title,message,published,publish_at,expires_at)
    VALUES('News','A little news',$1,now()+$2*interval '1 second',now()+$3*interval '1 second') RETURNING id`, [published, offset, expiry])).rows[0].id;
}
async function claim(limit = 50) { return (await db.query<any>("SELECT public.game_push_claim($1) result", [limit])).rows[0].result; }
async function reset() { await db.exec("DELETE FROM public.game_announcements; DELETE FROM public.game_push_subscriptions;"); }

test("announcement tables and sending routines are server-only", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`RESET ROLE; SET ROLE ${role}`);
    for (const table of ["game_announcements", "game_push_subscriptions", "game_push_deliveries"])
      await assert.rejects(db.query(`SELECT * FROM public.${table}`), /permission denied/);
    await assert.rejects(db.query("SELECT public.game_push_enqueue()"), /permission denied/);
    await assert.rejects(db.query("SELECT public.game_push_claim(10)"), /permission denied/);
    await assert.rejects(subscribe(), /permission denied/);
  }
  await db.exec("RESET ROLE; SET ROLE service_role");
});
test("subscription retry is idempotent and cannot steal another browser's endpoint", async () => {
  await reset(); const endpoint = "https://fcm.googleapis.com/test/device";
  const first = await subscribe(endpoint);
  assert.equal((await subscribe(endpoint)).id, first.id);
  await assert.rejects(subscribe(endpoint, "b".repeat(64)), /subscription_owned/);
  await assert.rejects(subscribe(endpoint, token, "https://other.test"), /subscription_owned/);
  const rows = (await db.query<any>("SELECT * FROM public.game_push_subscriptions")).rows;
  assert.equal(rows.length, 1); assert.equal(rows[0].token_hash, token); assert.equal(rows[0].origin, origin);
});
test("queue excludes drafts, future/expired news and late subscribers; overlapping claims do not duplicate", async () => {
  await reset(); const sub = await subscribe();
  await db.query("UPDATE public.game_push_subscriptions SET created_at=now()-interval '2 days' WHERE id=$1", [sub.id]);
  const live = await announce(); await announce(false); await announce(true, 86400, 172800); await announce(true, -86400, -1);
  await subscribe(); // No retrospective promotion push to somebody subscribing after publication.
  await db.exec("SELECT public.game_push_enqueue(); SELECT public.game_push_enqueue();");
  const deliveries = await claim(); assert.equal(deliveries.length, 1); assert.equal(deliveries[0].announcement_id, live);
  assert.deepEqual(await claim(), []);
  const d = deliveries[0];
  await db.query("SELECT public.game_push_finish($1,$2,$3,'sent',201)", [d.announcement_id, d.subscription_id, randomUUID()]);
  assert.equal((await db.query<any>("SELECT state FROM public.game_push_deliveries")).rows[0].state, "sending");
  await db.query("SELECT public.game_push_finish($1,$2,$3,'sent',201)", [d.announcement_id, d.subscription_id, d.lease]);
  await db.exec("SELECT public.game_push_enqueue()"); assert.deepEqual(await claim(), []);
});
test("delivery retries are leased and bounded, cancellation stops pending sends, expired endpoints are removed", async () => {
  await reset(); const sub = await subscribe();
  await db.query("UPDATE public.game_push_subscriptions SET created_at=now()-interval '2 days' WHERE id=$1", [sub.id]);
  const id = await announce(); await db.exec("SELECT public.game_push_enqueue()");
  let priorLease;
  for (let attempt = 0; attempt < 3; attempt++) {
    const [d] = await claim(); assert.ok(d); assert.notEqual(d.lease, priorLease); priorLease = d.lease;
    await db.query("SELECT public.game_push_finish($1,$2,$3,'failed',503)", [id, sub.id, d.lease]);
    assert.deepEqual(await claim(), []);
    await db.exec("UPDATE public.game_push_deliveries SET attempted_at=now()-interval '16 minutes'");
  }
  assert.deepEqual(await claim(), []);
  await db.exec("UPDATE public.game_push_deliveries SET attempts=0,state='pending'; UPDATE public.game_announcements SET published=false");
  assert.deepEqual(await claim(), []);
  await db.exec("UPDATE public.game_announcements SET published=true");
  const [d] = await claim();
  await db.query("SELECT public.game_push_finish($1,$2,$3,'expired',410)", [id, sub.id, d.lease]);
  assert.equal((await db.query("SELECT * FROM public.game_push_subscriptions")).rows.length, 0);
  assert.equal((await db.query("SELECT * FROM public.game_push_deliveries")).rows.length, 0);
});
test("unsubscribe capability is scoped to its origin and cascades queued deliveries", async () => {
  await reset(); const sub = await subscribe(); await subscribe(undefined, "b".repeat(64));
  await db.query("UPDATE public.game_push_subscriptions SET created_at=now()-interval '1 day'");
  await announce(); await db.exec("SELECT public.game_push_enqueue()");
  await db.query("DELETE FROM public.game_push_subscriptions WHERE token_hash=$1 AND origin=$2", [token, "https://other.test"]);
  assert.equal((await db.query("SELECT * FROM public.game_push_subscriptions")).rows.length, 2);
  await db.query("DELETE FROM public.game_push_subscriptions WHERE token_hash=$1 AND origin=$2", [token, origin]);
  const pending = await claim(); assert.equal(pending.length, 1); assert.notEqual(pending[0].subscription_id, sub.id);
});
