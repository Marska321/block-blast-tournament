import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { GameEngine } from "../shared/engine.js";
import { canPlaceBlockAtPosition } from "../shared/mechanics.js";
const projectUrl = "https://okjfileghngpcegdwdud.supabase.co";
const appUrl = process.env.STAGING_APP_URL;
if (process.env.SUPABASE_URL !== projectUrl || process.env.VITE_SUPABASE_URL !== projectUrl ||
  !/^https:\/\/block-blast-tournament-staging-[a-z0-9]+\.vercel\.app$/.test(appUrl || "") || !process.env.VERCEL_CLI_PATH)
  throw new Error("Explicit staging database/deployment/CLI are required");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(projectUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const users = [], checks = [];
const passed = label => { checks.push(label); console.log("PASS " + label); };
async function api(path, actor, body, expected = 200) {
  const config = ["silent", "show-error", "max-time = 45", `request = "${body === undefined ? "GET" : "POST"}"`,
    'header = "Content-Type: application/json"', 'write-out = "\\n%{http_code}"'];
  if (actor) config.push(`header = "Authorization: Bearer ${actor.token}"`);
  if (body !== undefined) config.push(`data = ${JSON.stringify(JSON.stringify(body))}`);
  const response = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [process.env.VERCEL_CLI_PATH, "curl", appUrl + path,
      "--scope", "marios-projects-c0935f0c", "--", "--config", "-"], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let output = "";
    child.stdout.on("data", value => output += value); child.stderr.resume();
    child.on("error", () => reject(new Error("Hosted HTTP client could not start")));
    child.on("close", code => {
      if (code) return reject(new Error("Hosted HTTP transport failed"));
      const index = output.lastIndexOf("\n");
      try { resolve({ status: Number(output.slice(index + 1)), data: JSON.parse(output.slice(0, index)) }); }
      catch { reject(new Error("Hosted API returned a non-JSON response")); }
    });
    child.stdin.end(config.join("\n") + "\n");
  });
  assert.equal(response.status, expected, `${path.split("?")[0]} status (safe code: ${response.data.error || "ok"})`);
  return response.data;
}
async function actor(label) {
  const email = `classic-check-${randomUUID()}@example.invalid`;
  const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { staging_test: true } });
  assert.ok(!created.error && created.data.user, "Create temporary staging account");
  const result = { id: created.data.user.id, label };
  users.push(result);
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  assert.ok(!link.error && link.data.properties?.hashed_token, "Issue local test session without sending email");
  result.client = createClient(projectUrl, process.env.VITE_SUPABASE_ANON_KEY, options);
  const verified = await result.client.auth.verifyOtp({ type: "magiclink", token_hash: link.data.properties.hashed_token });
  assert.ok(!verified.error && verified.data.session, "Redeem test session");
  result.token = verified.data.session.access_token;
  return result;
}
function play(game, minimum = Infinity) {
  while (!game.over && game.score < minimum && game.moves < 2000) {
    let action;
    for (let slot = 0; slot < 3 && !action; slot++) if (game.tray[slot].active)
      for (let y = 0; y < 8 && !action; y++) for (let x = 0; x < 8 && !action; x++)
        if (canPlaceBlockAtPosition(game.grid, game.tray[slot].shape, x, y)) action = { type: "place", slot, x, y };
    assert.ok(action, "Construct legal replay"); game.apply(action);
  }
  if (minimum !== Infinity && !game.over) game.apply({ type: "end" });
  return game;
}
const startBody = actor => ({ operation: "start", requestId: randomUUID(), nickname: actor.label });
let failure;
try {
  const publicBoard = await api("/api/classic");
  assert.equal(publicBoard.demo, true);
  await api("/api/classic", null, { operation: "start", requestId: randomUUID(), nickname: "Unauthenticated" }, 401);
  await api("/api/classic", { token: "invalid" }, {}, 401);
  await api("/api/events", null, undefined, 503);
  passed("public Classic board works while private entry requires real authentication and prize APIs stay disabled");
  const a = await actor("Classic staging A"), b = await actor("Classic staging B");
  for (const table of ["classic_profiles", "classic_runs", "classic_daily_best"]) {
    assert.ok((await a.client.from(table).select("*")).error, "Private Classic table is not directly readable");
    assert.ok((await a.client.from(table).insert({ user_id: a.id })).error, "Client table write blocked");
  }
  assert.ok((await a.client.rpc("classic_start", { p_user: a.id, p_request: randomUUID(), p_seed: 1, p_version: "pilot-1", p_nickname: "Forged" })).error);
  passed("authenticated clients cannot read Classic private tables, alter results, or execute trusted routines");
  const request = startBody(a);
  const starts = await Promise.all(Array.from({ length: 3 }, () => api("/api/classic", a, request)));
  assert.equal(new Set(starts.map(run => run.id)).size, 1);
  assert.equal(new Set(starts.map(run => run.seed)).size, 1);
  const run = starts[0], game = play(new GameEngine({ kind: "classic", seed: Number(run.seed) }), 100);
  await api("/api/classic", b, { operation: "submit", sessionId: run.id, actions: game.actions }, 404);
  await api("/api/classic", a, { operation: "submit", sessionId: run.id, actions: game.actions, score: 99999 }, 400);
  await api("/api/classic", a, { operation: "submit", sessionId: run.id, actions: [{ type: "place", slot: 0, x: 99, y: 0 }] }, 400);
  const submissions = await Promise.all(Array.from({ length: 3 }, () => api("/api/classic", a, { operation: "submit", sessionId: run.id, actions: game.actions })));
  assert.deepEqual(submissions[0], submissions[1]); assert.deepEqual(submissions[0], submissions[2]);
  assert.equal(submissions[0].score, game.score); assert.equal(submissions[0].streak.current, 1);
  passed("simultaneous start and submission retries are idempotent; ownership, fabricated scores and illegal actions are rejected");
  const lesser = await api("/api/classic", a, startBody(a));
  const lesserGame = play(new GameEngine({ kind: "classic", seed: Number(lesser.seed) }), 1);
  await api("/api/classic", a, { operation: "submit", sessionId: lesser.id, actions: lesserGame.actions });
  const me = await api("/api/classic", a);
  assert.equal(me.me.score, game.score);
  assert.equal(me.entries.filter(entry => entry.isMe).length, 1);
  for (const entry of me.entries) assert.deepEqual(Object.keys(entry).sort(), ["isMe", "nickname", "pointsToNext", "rank", "score"]);
  assert.equal(me.streak.playedToday, true);
  passed("daily standings keep one best score, expose only safe public fields, and qualify a real daily streak");
  const expired = await api("/api/classic", b, startBody(b));
  const previous = new Date(Date.parse(expired.day + "T12:00:00Z") - 86400000).toISOString().slice(0, 10);
  const update = await admin.from("classic_runs").update({ day: previous, created_at: previous + "T10:00:00+02:00", expires_at: expired.day + "T00:00:00+02:00" }).eq("id", expired.id);
  assert.equal(update.error, null);
  await api("/api/classic", b, { operation: "submit", sessionId: expired.id, actions: play(new GameEngine({ kind: "classic", seed: Number(expired.seed) }), 100).actions }, 410);
  passed("a session from a closed South African day cannot enter a later board");
  const rescueRun = await api("/api/classic", b, startBody(b));
  const rescue = play(new GameEngine({ kind: "classic", seed: Number(rescueRun.seed) }));
  assert.equal(rescue.canRevive, true); rescue.apply({ type: "revive" }); play(rescue);
  assert.equal(rescue.over, true); assert.equal(rescue.canRevive, false);
  await api("/api/classic", b, { operation: "submit", sessionId: rescueRun.id, actions: [...rescue.actions, { type: "revive" }] }, 400);
  const accepted = await api("/api/classic", b, { operation: "submit", sessionId: rescueRun.id, actions: rescue.actions });
  assert.equal(accepted.revives, 1); assert.equal(accepted.score, rescue.score);
  const yesterday = await api("/api/classic?day=" + previous);
  assert.equal(yesterday.closed, true);
  passed("one ranked rescue is accepted, a second rescue is rejected, and finished-day results are available");
} catch (error) { failure = error; }
finally {
  for (const actor of users) {
    if (actor.client) await actor.client.auth.signOut({ scope: "global" }).catch(() => {});
    const deleted = await admin.auth.admin.deleteUser(actor.id);
    if (deleted.error) failure ||= new Error("Temporary staging account cleanup failed");
  }
  await mkdir("output/review", { recursive: true });
  await writeFile("output/review/classic-staging-check.json", JSON.stringify({ passed: !failure, checks, temporaryAccountsRemoved: users.length, prizeAPIsDisabled: true }, null, 2));
}
if (failure) throw failure;
