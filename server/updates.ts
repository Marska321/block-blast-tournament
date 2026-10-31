import { createHash, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { ApiError, body, rateLimit, type ApiRequest, type ApiResponse } from "./http.js";
import { announcementPath } from "../shared/updates.js";

export function updatesDatabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.UPDATES_ENABLED !== "true" || !url || !key)
    throw new ApiError(503, "updates_unavailable", "Updates are temporarily unavailable. Please try again later.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function pushConfigured() {
  return !!(process.env.WEB_PUSH_PUBLIC_KEY && process.env.WEB_PUSH_PRIVATE_KEY && process.env.WEB_PUSH_SUBJECT);
}
export function validateSubscription(value: unknown): webpush.PushSubscription {
  if (!value || typeof value !== "object") throw new ApiError(400, "invalid_subscription");
  const sub = value as webpush.PushSubscription;
  let endpoint: URL;
  try { endpoint = new URL(sub.endpoint); } catch { throw new ApiError(400, "invalid_subscription"); }
  // Restrict outbound requests to browser vendors' push services (SSRF protection).
  const host = endpoint.hostname;
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.port || endpoint.hash ||
      sub.endpoint.length > 2048 || endpoint.pathname === "/" ||
      !(host === "fcm.googleapis.com" || host === "updates.push.services.mozilla.com" ||
        host === "push.services.mozilla.com" || host === "web.push.apple.com" ||
        /^[a-z0-9-]+\.push\.apple\.com$/.test(host) ||
        /^[a-z0-9-]+\.notify\.windows\.com$/.test(host)))
    throw new ApiError(400, "invalid_subscription");
  const { p256dh, auth } = sub.keys || {};
  if (typeof p256dh !== "string" || !/^[A-Za-z0-9_-]{87}$/.test(p256dh) ||
      Buffer.from(p256dh, "base64url")[0] !== 4 ||
      typeof auth !== "string" || !/^[A-Za-z0-9_-]{22}$/.test(auth))
    throw new ApiError(400, "invalid_subscription");
  return { endpoint: endpoint.href, keys: { p256dh, auth } };
}
export function subscriptionToken(value: unknown) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw new ApiError(400, "invalid_subscription_token");
  return createHash("sha256").update(value).digest("hex");
}
export function validateAnnouncement(input: Record<string, unknown>) {
  const { title, message } = input;
  if (typeof title !== "string" || !title.trim() || title.trim().length > 80 ||
      typeof message !== "string" || !message.trim() || message.trim().length > 240 ||
      /[\u0000-\u001f\u007f]/.test(title + message)) throw new Error("Use a title of 1–80 characters and a message of 1–240 characters.");
  const publish = new Date(String(input.publish_at || new Date().toISOString()));
  const expiry = new Date(String(input.expires_at || new Date(publish.getTime() + 7 * 86400000).toISOString()));
  if (!Number.isFinite(publish.getTime()) || !Number.isFinite(expiry.getTime()) || expiry <= publish || expiry.getTime() - publish.getTime() > 30 * 86400000)
    throw new Error("Expiry must be after publication and within 30 days.");
  return { title: title.trim(), message: message.trim(), path: announcementPath(input.path || "/?updates=1"),
    publish_at: publish.toISOString(), expires_at: expiry.toISOString() };
}
async function checked<T>(result: { data: T; error: unknown }): Promise<T> {
  if (result.error) throw new ApiError(503, "updates_storage_unavailable", "Could not save your notification settings. Please try again.");
  return result.data;
}
export async function updatesFeed(db: SupabaseClient) {
  const now = new Date().toISOString();
  const announcements = await checked(await db.from("game_announcements")
    .select("id,title,message,path,publish_at,expires_at").eq("published", true)
    .lte("publish_at", now).gt("expires_at", now).order("publish_at", { ascending: false }).limit(20));
  return { announcements, publicKey: pushConfigured() ? process.env.WEB_PUSH_PUBLIC_KEY : null };
}
export async function updatesWrite(req: ApiRequest, db: SupabaseClient) {
  const origin = req.headers.origin;
  const allowed = (process.env.UPDATES_ORIGINS || "").split(",").map(s => s.trim());
  // Vercel's own deployment hostname lets us verify the exact protected build
  // before promoting it. Never trust the caller-supplied Host header here.
  if (process.env.VERCEL === "1" && /^[a-z0-9.-]+\.vercel\.app$/.test(process.env.VERCEL_URL || ""))
    allowed.push(`https://${process.env.VERCEL_URL}`);
  if (typeof origin !== "string" || !allowed.includes(origin)) throw new ApiError(403, "origin_not_allowed");
  const contentType = req.headers["content-type"] || "";
  if (!contentType.startsWith("application/json")) throw new ApiError(415, "json_required");
  const input = body(req);
  if (Buffer.byteLength(JSON.stringify(input)) > 4096) throw new ApiError(413, "subscription_too_large");
  const tokenHash = subscriptionToken(input.token);
  if (input.operation === "unsubscribe") {
    await checked(await db.from("game_push_subscriptions").delete().eq("token_hash", tokenHash).eq("origin", origin));
    return { subscribed: false };
  }
  if (input.operation !== "subscribe" || !pushConfigured()) throw new ApiError(503, "push_unavailable");
  const subscription = validateSubscription(input.subscription);
  const result = await db.rpc("game_push_subscribe", {
    p_endpoint: subscription.endpoint, p_keys: subscription.keys, p_token_hash: tokenHash, p_origin: origin,
  });
  if (result.error?.message === "subscription_owned") throw new ApiError(409, "subscription_owned");
  await checked(result);
  return { subscribed: true };
}
interface Delivery {
  announcement_id: string; subscription_id: string; lease: string;
  endpoint: string; keys: webpush.PushSubscription["keys"];
  title: string; message: string; path: string; expires_at: string;
}
export async function dispatchUpdates(db: SupabaseClient, send = webpush.sendNotification) {
  if (!pushConfigured()) throw new ApiError(503, "push_unavailable");
  await checked(await db.rpc("game_push_enqueue"));
  const totals = { sent: 0, expired: 0, failed: 0 };
  const deadline = Date.now() + 40000;
  // Bounded batches and leases allow safe overlapping/manual/scheduled invocations.
  for (let batch = 0; batch < 20 && Date.now() < deadline; batch++) {
    const deliveries = await checked(await db.rpc("game_push_claim", { p_limit: 10 })) as Delivery[];
    if (!deliveries?.length) break;
    await Promise.all(deliveries.map(async delivery => {
      let state = "sent", status = 201;
      try {
        if (new Date(delivery.expires_at).getTime() <= Date.now()) { state = "expired"; }
        else {
          const subscription = validateSubscription({ endpoint: delivery.endpoint, keys: delivery.keys });
          await send(subscription, JSON.stringify({ id: delivery.announcement_id, title: delivery.title,
            message: delivery.message, path: announcementPath(delivery.path), expiresAt: delivery.expires_at }), {
            TTL: Math.max(1, Math.min(86400, Math.floor((new Date(delivery.expires_at).getTime() - Date.now()) / 1000))),
            urgency: "normal", timeout: 5000,
            vapidDetails: { subject: process.env.WEB_PUSH_SUBJECT!, publicKey: process.env.WEB_PUSH_PUBLIC_KEY!, privateKey: process.env.WEB_PUSH_PRIVATE_KEY! },
          });
        }
      } catch (error) {
        status = Number((error as { statusCode?: number }).statusCode) || 0;
        state = status === 404 || status === 410 ? "expired" : "failed";
      }
      await checked(await db.rpc("game_push_finish", { p_announcement: delivery.announcement_id,
        p_subscription: delivery.subscription_id, p_lease: delivery.lease, p_state: state, p_status: status }));
      totals[state as keyof typeof totals]++;
    }));
  }
  return totals;
}
export function cronAuthorized(auth: unknown) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || typeof auth !== "string") return false;
  const expected = Buffer.from(`Bearer ${secret}`), actual = Buffer.from(auth);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export async function updatesRoute(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      res.setHeader("Allow", "GET, POST"); throw new ApiError(405, "method_not_allowed");
    }
    if (req.query.operation === "dispatch") {
      if (req.method !== "GET" || !cronAuthorized(req.headers.authorization)) throw new ApiError(401, "unauthorized");
      return res.status(200).json(await dispatchUpdates(updatesDatabase()));
    }
    const db = updatesDatabase();
    const ip = String(req.headers["x-vercel-forwarded-for"] || req.socket?.remoteAddress || "unknown").slice(0, 80);
    await rateLimit(db, `updates:${req.method}:${createHash("sha256").update(ip).digest("hex")}`, req.method === "POST" ? 15 : 90);
    res.status(200).json(req.method === "GET" ? await updatesFeed(db) : await updatesWrite(req, db));
  } catch (error) {
    const safe = error instanceof ApiError ? error : new ApiError(500, "updates_error", "Updates could not be loaded. Please try again.");
    // Endpoints, capability tokens and push provider response bodies must stay private.
    console.error(JSON.stringify({ event: "updates_request", code: safe.code, status: safe.status }));
    res.status(safe.status).json({ error: safe.code, message: safe.message });
  }
}
