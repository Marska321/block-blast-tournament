import assert from "node:assert/strict";
import test from "node:test";
import { createECDH, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { announcementPath } from "../shared/updates.js";
import { validateSubscription, validateAnnouncement, subscriptionToken, updatesWrite, dispatchUpdates, cronAuthorized } from "../server/updates.js";
import type { ApiRequest } from "../server/http.js";
function subscription() {
  const key = createECDH("prime256v1"); key.generateKeys();
  return { endpoint: "https://fcm.googleapis.com/fcm/send/test", keys: { p256dh: key.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") } };
}
test("push endpoints cannot target internal addresses, other sites, credentials or non-TLS transports", () => {
  const sub = subscription(); assert.deepEqual(validateSubscription(sub), sub);
  for (const endpoint of ["http://fcm.googleapis.com/a", "https://127.0.0.1/a", "https://metadata.google.internal/a", "https://fcm.googleapis.com.evil.test/a", "https://u:p@fcm.googleapis.com/a", "https://fcm.googleapis.com:8443/a", "https://example.com/a", "https://fcm.googleapis.com/a#x"])
    assert.throws(() => validateSubscription({ ...sub, endpoint }), /invalid_subscription/);
  assert.throws(() => validateSubscription({ ...sub, keys: { auth: "bad" } }), /invalid_subscription/);
  assert.throws(() => subscriptionToken("short"), /invalid_subscription_token/);
  assert.equal(subscriptionToken("a".repeat(64)).length, 64);
});
test("announcement validation keeps links inside the game and bounds message/date content", () => {
  for (const path of ["https://evil.test/", "//evil.test/", "/\\evil.test/", "/api/claims", "javascript:alert(1)", "/\n/evil.test"])
    assert.throws(() => announcementPath(path));
  assert.equal(announcementPath("/?updates=1"), "/?updates=1");
  const good = validateAnnouncement({ title: "News", message: "A new event soon" }); assert.equal(good.path, "/?updates=1");
  for (const extra of [{ title: "" }, { title: "x".repeat(81) }, { message: "x".repeat(241) }, { expires_at: "2020-01-01" }, { publish_at: "invalid" }])
    assert.throws(() => validateAnnouncement({ title: "News", message: "Hi", ...extra }));
});
test("subscription writes require the exact allowed origin and a capability; no account is needed", async () => {
  const old = { ...process.env };
  try {
    process.env.UPDATES_ORIGINS = "https://game.test";
    process.env.WEB_PUSH_PUBLIC_KEY = "key"; process.env.WEB_PUSH_PRIVATE_KEY = "private"; process.env.WEB_PUSH_SUBJECT = "https://game.test";
    const calls: any[] = [];
    const db = { rpc: async (name: string, args: unknown) => { calls.push({ name, args }); return { data: true, error: null }; } } as unknown as SupabaseClient;
    const req = { headers: { origin: "https://game.test", "content-type": "application/json" }, body: { operation: "subscribe", token: "a".repeat(64), subscription: subscription() } } as unknown as ApiRequest;
    assert.deepEqual(await updatesWrite(req, db), { subscribed: true });
    assert.equal(calls[0].args.p_token_hash, subscriptionToken("a".repeat(64)));
    await assert.rejects(updatesWrite({ ...req, headers: { ...req.headers, origin: "https://evil.test" } } as ApiRequest, db), /origin_not_allowed/);
    await assert.rejects(updatesWrite({ ...req, headers: { ...req.headers, "content-type": "text/plain" } } as ApiRequest, db), /json_required/);
    assert.equal(calls.length, 1);
    process.env.VERCEL = "1"; process.env.VERCEL_URL = "game-candidate.vercel.app";
    await updatesWrite({ ...req, headers: { ...req.headers, origin: "https://game-candidate.vercel.app" } } as ApiRequest, db);
    assert.equal(calls.length, 2);
    process.env.CRON_SECRET = "s".repeat(64);
    assert.equal(cronAuthorized(undefined), false); assert.equal(cronAuthorized("Bearer wrong"), false);
    assert.equal(cronAuthorized(`Bearer ${process.env.CRON_SECRET}`), true);
  } finally { process.env = old; }
});
test("sender encrypts real Web Push payloads, removes expired endpoints and records transient failures safely", async () => {
  const old = { ...process.env };
  try {
    const vapid = webpush.generateVAPIDKeys();
    process.env.WEB_PUSH_PUBLIC_KEY = vapid.publicKey; process.env.WEB_PUSH_PRIVATE_KEY = vapid.privateKey; process.env.WEB_PUSH_SUBJECT = "https://game.test";
    const sub = subscription(), writes: any[] = [];
    let claimed = false;
    const deliveries = ["good", "gone", "retry"].map(id => ({ ...sub, announcement_id: id, subscription_id: id, lease: id, title: "News", message: "Hello", path: "/?updates=1", expires_at: new Date(Date.now() + 86400000).toISOString() }));
    const db = { rpc: async (name: string, args: any) => {
      writes.push({ name, args });
      if (name === "game_push_claim") { const result = claimed ? [] : deliveries; claimed = true; return { data: result, error: null }; }
      return { data: null, error: null };
    } } as unknown as SupabaseClient;
    const send = async (subscription: any, payload: any, options: any) => {
      const data = JSON.parse(payload);
      const encrypted = webpush.generateRequestDetails(subscription, payload, options);
      assert.ok(Buffer.isBuffer(encrypted.body)); assert.ok(!encrypted.body.toString().includes("Hello"));
      assert.equal(options.TTL <= 86400, true);
      if (data.id === "gone") throw { statusCode: 410 };
      if (data.id === "retry") throw { statusCode: 503, body: "private provider data" };
      return {};
    };
    assert.deepEqual(await dispatchUpdates(db, send as any), { sent: 1, expired: 1, failed: 1 });
    const finishes = writes.filter(w => w.name === "game_push_finish");
    assert.equal(finishes.length, 3); assert.deepEqual(finishes.map(w => w.args.p_state).sort(), ["expired", "failed", "sent"]);
    assert.ok(!JSON.stringify(finishes).includes("private provider data"));
  } finally { process.env = old; }
});
