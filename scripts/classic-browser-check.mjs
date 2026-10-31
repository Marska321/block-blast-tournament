import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { createServer } from "vite";
import { chromium } from "playwright";
import { classicBoard, classicWrite } from "../server/classic.js";
import { GameEngine, ENGINE_VERSION } from "../shared/engine.js";
import { canPlaceBlockAtPosition } from "../shared/mechanics.js";

// Local integration: real routes, engine and PostgreSQL routines; Auth/CAPTCHA
// are isolated browser fixtures. No hosted accounts, messages or claims.
process.env.VITE_CASUAL_ONLY = "true";
process.env.VITE_CLASSIC_RANKED_ENABLED = "true";
process.env.VITE_SUPABASE_URL = "https://pilot.supabase.co";
process.env.VITE_SUPABASE_ANON_KEY = "fixture-public-key";
process.env.VITE_TURNSTILE_SITE_KEY = "fixture-sitekey";
process.env.CLASSIC_DEMO = "true";
const db = new PGlite();
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
  CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;`);
await db.exec(await readFile("supabase/schema.sql", "utf8"));
await db.exec(await readFile("supabase/classic.sql", "utf8"));
const actor = randomUUID();
await db.query("INSERT INTO auth.users VALUES($1)", [actor]);
await db.exec("SET ROLE service_role");
const adapter = {
  async rpc(name, args) {
    assert.ok(["classic_board", "classic_start", "classic_accept", "pilot_rate_limit"].includes(name));
    const keys = Object.keys(args);
    try {
      const result = await db.query(`SELECT public.${name}(${keys.map((key, index) => `${key}=>$${index + 1}`).join(",")}) r`,
        keys.map(key => typeof args[key] === "object" && args[key] !== null ? JSON.stringify(args[key]) : args[key]));
      return { data: result.rows[0].r, error: null };
    } catch (error) { return { data: null, error: { message: error.message } }; }
  },
  from(table) {
    assert.equal(table, "classic_runs");
    const filters = {};
    return { select() { return this; }, eq(key, value) { filters[key] = value; return this; },
      async maybeSingle() {
        const result = await db.query("SELECT * FROM public.classic_runs WHERE id=$1 AND user_id=$2", [filters.id, filters.user_id]);
        return { data: result.rows[0] || null, error: null };
      } };
  },
};
const server = await createServer({ envDir: false, server: { host: "127.0.0.1", port: 5196, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
const token = `e30.${Buffer.from(JSON.stringify({ sub: actor, exp: Math.floor(Date.now() / 1000) + 3600, role: "authenticated" })).toString("base64url")}.fixture`;
const user = { id: actor, aud: "authenticated", role: "authenticated", is_anonymous: true,
  app_metadata: { provider: "anonymous", providers: [] }, user_metadata: {}, created_at: new Date().toISOString() };
let authRequests = 0, apiRequests = 0, failStart = true, failSubmit = true, hostile = false;
const sessions = [];
await context.addInitScript(() => localStorage.setItem("bb_has_seen_landing", "true"));
await context.route("https://challenges.cloudflare.com/**", route => route.fulfill({ contentType: "application/javascript",
  body: 'window.turnstile={render(el,options){setTimeout(()=>options.callback("fixture-captcha"),20);return "fixture";},remove(){}};' }));
await context.route("https://pilot.supabase.co/**", async route => {
  authRequests++;
  if (route.request().url().includes("/signup")) {
    const body = route.request().postDataJSON();
    assert.equal(body.gotrue_meta_security.captcha_token, "fixture-captcha");
  }
  await route.fulfill({ json: { access_token: token, refresh_token: "fixture-refresh", expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user } });
});
await context.route("**/api/classic*", async route => {
  apiRequests++;
  const request = route.request(), url = new URL(request.url());
  const auth = request.headers().authorization;
  if ((request.method() === "POST" && !auth) || (auth && auth !== `Bearer ${token}`))
    return route.fulfill({ status: 401, json: { error: "authentication_required" } });
  const req = { body: request.method() === "POST" ? request.postDataJSON() : undefined,
    query: Object.fromEntries(url.searchParams), headers: {} };
  try {
    let data = await (request.method() === "GET" ? classicBoard : classicWrite)(req, { db: adapter, userId: auth ? actor : null });
    if (req.body?.operation === "start") {
      sessions.push(data);
      if (failStart) { failStart = false; return route.abort("failed"); }
    }
    if (req.body?.operation === "submit" && failSubmit) { failSubmit = false; return route.abort("failed"); }
    if (hostile && request.method() === "GET") data = { ...data, entries: [{ rank: 1, nickname: "<img src=x onerror=alert(1)>", score: 900, isMe: false, pointsToNext: null }] };
    await route.fulfill({ json: data });
  } catch (error) { await route.fulfill({ status: error.status || 500, json: { error: error.code, message: error.message } }); }
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const firstLegal = game => {
  for (let slot = 0; slot < 3; slot++) if (game.tray[slot].active)
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++)
      if (canPlaceBlockAtPosition(game.grid, game.tray[slot].shape, x, y)) return { type: "place", slot, x, y };
};
async function naturalFailure(session) {
  const game = new GameEngine({ kind: "classic", seed: Number(session.seed) });
  let before, action;
  while (!game.over && game.moves < 1000) { before = structuredClone(game.actions); action = firstLegal(game); assert.ok(action); game.apply(action); }
  assert.equal(game.over, true);
  await page.evaluate(({ session, before, version }) => localStorage.setItem("bb_in_progress_game", JSON.stringify({
    version, startedAt: Date.now(), options: { kind: "classic", seed: Number(session.seed) }, actions: before,
    officialSession: null, rankedSession: session, practice: false, blockStyle: "bevel",
  })), { session, before, version: ENGINE_VERSION });
  await page.reload();
  await page.locator("#gameCanvas").focus();
  await page.keyboard.press(String(action.slot + 1));
  for (let x = 0; x < action.x; x++) await page.keyboard.press("ArrowRight");
  for (let y = 0; y < action.y; y++) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.locator("#classicReviveBtn").waitFor();
  return game;
}
await mkdir("output/playwright/classic-daily", { recursive: true });
try {
  await page.goto("http://127.0.0.1:5196");
  await page.locator("#mode-classic-btn").click();
  assert.equal(apiRequests, 0); assert.equal(authRequests, 0);
  await page.locator("#leaderboard-btn").click();
  await page.locator("#classicRankedStart").waitFor();
  assert.equal(authRequests, 0);
  await page.locator("#classicRankedStart").click();
  assert.equal(await page.locator("#classicEntry input[type=checkbox]").count(), 0);
  await page.locator("#classicNickname").fill("Browser player");
  await page.getByRole("button", { name: "Start my ranked run", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Connection interrupted" }).waitFor();
  assert.equal((await state()).ranked, null);
  await page.getByRole("button", { name: "Start my ranked run", exact: true }).click();
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).ranked !== null);
  assert.equal(sessions[0].id, sessions[1].id); assert.equal(sessions[0].seed, sessions[1].seed);
  assert.equal(await page.locator("#classicBoard.active").count(), 0);
  assert.equal(await page.locator("#classicEntry.active").count(), 0);
  const first = await naturalFailure(sessions[1]);
  assert.equal((await db.query("SELECT count(*)::integer n FROM public.classic_daily_best WHERE user_id=$1", [actor])).rows[0].n, 0);
  await page.locator("#classicReviveBtn").click();
  assert.equal((await state()).revive.used, true);
  assert.equal((await state()).score, first.score);
  await page.reload();
  assert.equal((await state()).revive.used, true);
  await page.locator("#keyboard-controls summary").click();
  await page.locator("#end-run-btn").click();
  await page.getByText(/retry needed — Connection interrupted/).waitFor();
  await page.reload();
  await page.locator("#leaderboard-btn").click();
  await page.getByRole("button", { name: "Retry saving daily score" }).click();
  await page.getByText(/Accepted · .*Rank #/).waitFor();
  await page.getByRole("button", { name: "Refresh board" }).click();
  await page.getByText("1-day streak", { exact: true }).waitFor();
  await page.screenshot({ path: "output/playwright/classic-daily/accepted-board.png", fullPage: true });
  assert.equal((await db.query("SELECT count(*)::integer n FROM public.classic_runs WHERE status='accepted' AND user_id=$1", [actor])).rows[0].n, 1);
  const download = page.waitForEvent("download");
  await page.locator("#classicResultsCard").click();
  await (await download).saveAs("output/playwright/classic-daily/live-card.png");
  await page.getByRole("button", { name: "Yesterday", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Final results" }).waitFor();
  const finalDownload = page.waitForEvent("download");
  await page.locator("#classicResultsCard").click();
  await (await finalDownload).saveAs("output/playwright/classic-daily/final-empty-card.png");
  await page.setViewportSize({ width: 320, height: 568 });
  await page.screenshot({ path: "output/playwright/classic-daily/narrow-board.png", fullPage: true });
  hostile = true;
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page.getByText("<img src=x onerror=alert(1)>", { exact: true }).waitFor();
  assert.equal(await page.locator("#classicBoard img").count(), 0);
  hostile = false;
  await page.getByRole("button", { name: "Play for today's board", exact: true }).click();
  await page.getByRole("button", { name: "Start my ranked run", exact: true }).click();
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).ranked !== null && !JSON.parse(window.render_game_to_text()).over);
  await naturalFailure(sessions.at(-1));
  await page.getByRole("button", { name: "Finish & save daily score", exact: true }).click();
  await page.getByText(/Accepted · .*Rank #/).waitFor();
  assert.equal(await page.locator("#classicReviveBtn").count(), 0);
  assert.equal((await state()).ranked.finalized, true);
  assert.deepEqual(errors, []);
  console.log("Daily Classic browser flow passed with real SQL: local no-Auth play, public board, guest/CAPTCHA entry, lost-start retry, legal replay, rescue/resume, lost-acceptance retry, single score, streak, safe names, day selection, PNG cards and narrow layout.");
} finally { await browser.close(); await server.close(); await db.close(); }
