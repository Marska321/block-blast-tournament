import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import { GameEngine } from "../shared/engine.js";
import { canPlaceBlockAtPosition } from "../shared/mechanics.js";

// Explicit project guards: this command creates temporary users and exercises
// real hosted transactions. It must never target the production database.
const projectUrl = "https://okjfileghngpcegdwdud.supabase.co";
const appUrl = process.env.STAGING_APP_URL;
if (process.env.SUPABASE_URL !== projectUrl ||
    process.env.VITE_SUPABASE_URL !== projectUrl ||
    !/^https:\/\/block-blast-tournament-staging-[a-z0-9]+\.vercel\.app$/.test(appUrl || "") ||
    !process.env.VERCEL_CLI_PATH)
  throw new Error("Explicit staging database, deployment URL, and Vercel CLI path are required");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(projectUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const publicKey = process.env.VITE_SUPABASE_ANON_KEY;
const demoId = "00000000-0000-4000-8000-000000000001";
const createdUsers = [];
const createdEvents = [];
const checks = [];
function must(condition, label) { if (!condition) throw new Error(label); }
function passed(label) { checks.push(label); console.log(`PASS ${label}`); }

async function api(path, actor, body, expected = 200) {
  const method = body === undefined ? "GET" : "POST";
  const config = ["silent", "show-error", 'max-time = 45', `request = "${method}"`,
    'header = "Content-Type: application/json"', 'write-out = "\\n%{http_code}"'];
  if (actor) config.push(`header = "Authorization: Bearer ${actor.token}"`);
  if (body !== undefined) config.push(`data = ${JSON.stringify(JSON.stringify(body))}`);
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [process.env.VERCEL_CLI_PATH, "curl", `${appUrl}${path}`,
      "--scope", "marios-projects-c0935f0c", "--", "--config", "-"],
      { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let output = "";
    child.stdout.on("data", (data) => { output += data; });
    // CLI diagnostics may contain private authorization details. Never forward them.
    child.stderr.resume();
    child.on("error", () => reject(new Error("Staging HTTP client could not start")));
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`Staging HTTP transport failed for ${path.split("?")[0]}`));
      const split = output.lastIndexOf("\n");
      const status = Number(output.slice(split + 1).trim());
      let data;
      try { data = JSON.parse(output.slice(0, split)); }
      catch { return reject(new Error(`Staging returned non-JSON HTTP ${status}`)); }
      resolve({ status, data });
    });
    child.stdin.end(config.join("\n") + "\n");
  });
  must(result.status === expected,
    `${method} ${path.split("?")[0]} expected HTTP ${expected}, received ${result.status}`);
  return result.data;
}

async function actor(label) {
  const email = `rollout-${randomUUID()}@example.invalid`;
  const created = await admin.auth.admin.createUser({ email, email_confirm: true,
    user_metadata: { staging_test: true } });
  must(!created.error && created.data.user, "Could not create temporary staging account");
  const id = created.data.user.id;
  createdUsers.push(id);
  // Admin-generated links are redeemed locally; no email is sent and CAPTCHA
  // protection is left enabled. A real guest CAPTCHA rehearsal is still required.
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  must(!link.error && link.data.properties?.hashed_token, "Could not issue staging test session");
  const client = createClient(projectUrl, publicKey, options);
  const session = await client.auth.verifyOtp({ type: "magiclink",
    token_hash: link.data.properties.hashed_token });
  must(!session.error && session.data.session, "Could not redeem staging test session");
  const result = { id, label, token: session.data.session.access_token, client };
  await api("/api/profile", result, { nickname: label, adult: true });
  return result;
}

function finish(run, minimum = 100) {
  const game = new GameEngine({ kind: "tournament", seed: Number(run.seed) });
  while (!game.over && game.score < minimum) {
    let action;
    for (let slot = 0; slot < game.tray.length && !action; slot++) {
      const piece = game.tray[slot];
      if (!piece.active) continue;
      for (let y = 0; y < 8 && !action; y++)
        for (let x = 0; x < 8 && !action; x++)
          if (canPlaceBlockAtPosition(game.grid, piece.shape, x, y))
            action = { type: "place", slot, x, y };
    }
    must(action, "Could not construct a legal staging replay");
    game.apply(action);
  }
  if (!game.over) game.apply({ type: "end" });
  return game;
}
const startBody = (player, requestId = randomUUID(), eventId = demoId) => ({
  eventId, requestId, nickname: player.label, adult: true,
});

let failure;
try {
  const events = await api("/api/events");
  must(events.events.some((e) => e.id === demoId && e.is_demo), "Demo event is not available");
  await api("/api/session-token", null, { eventId: demoId, requestId: randomUUID() }, 401);
  await api("/api/session-token", { token: "invalid" }, {}, 401);
  passed("hosted API reaches the staging database and requires authentication");

  const a = await actor("Staging Check A");
  const b = await actor("Staging Check B");
  const profiles = await a.client.from("pilot_profiles").select("user_id");
  must(!profiles.error && profiles.data.length === 1 && profiles.data[0].user_id === a.id,
    "Profile ownership is not enforced");
  const claims = await a.client.from("pilot_claims").select("*");
  must(Boolean(claims.error), "Private claim records are readable directly");
  const walletWrite = await a.client.from("pilot_wallets").insert({ user_id: a.id, day: "2099-01-01" });
  must(Boolean(walletWrite.error), "Client wallet writes are permitted");
  const scoreWrite = await a.client.from("pilot_runs").insert({ user_id: a.id });
  must(Boolean(scoreWrite.error), "Client official run writes are permitted");
  const rpcWrite = await a.client.rpc("pilot_profile", { p_user: b.id, p_nickname: "forged", p_adult: true });
  must(Boolean(rpcWrite.error), "Client privileged RPC execution is permitted");
  passed("real authenticated accounts cannot read private claims, other profiles, or mutate trusted state");

  await api("/api/verify-referral", a, { referrerId: a.id }, 400);
  await api("/api/verify-referral", b, { referrerId: a.id });
  const request = startBody(a);
  const simultaneous = await Promise.all(Array.from({ length: 3 }, () => api("/api/session-token", a, request)));
  must(new Set(simultaneous.map((r) => r.id)).size === 1, "Start retries issued multiple sessions");
  const runA = simultaneous[0];
  const [secondA, thirdA] = await Promise.all([
    api("/api/session-token", a, startBody(a)), api("/api/session-token", a, startBody(a)),
  ]);
  await api("/api/session-token", a, startBody(a), 409);
  const initialBalance = await api("/api/check-referral-rewards", a);
  must(initialBalance.baseUsed === 3 && initialBalance.remaining === 0, "Daily tickets were not consumed atomically");
  passed("simultaneous starts are idempotent and enforce three shared base attempts");

  const gameA = finish(runA);
  const submissionA = { sessionId: runA.id, actions: gameA.actions };
  await api("/api/submit-score", b, submissionA, 404);
  await api("/api/submit-score", a, { ...submissionA, score: 999999 }, 400);
  await api("/api/submit-score", a,
    { sessionId: runA.id, actions: [{ type: "place", slot: 0, x: -1, y: 0 }] }, 400);
  const acceptedA = await Promise.all(Array.from({ length: 3 }, () => api("/api/submit-score", a, submissionA)));
  must(acceptedA.every((r) => r.score === gameA.score && r.scoreId === runA.id), "Accepted score differs from deterministic replay");
  must(acceptedA.filter((r) => r.duplicate).length === 2, "Concurrent score retries were not recognized");
  passed("wrong-owner and fabricated results are rejected; simultaneous submissions persist one calculated score");

  const runB = await api("/api/session-token", b, startBody(b));
  const gameB = finish(runB);
  must(gameB.score >= 100, "Referral replay did not qualify");
  await Promise.all(Array.from({ length: 3 }, () =>
    api("/api/submit-score", b, { sessionId: runB.id, actions: gameB.actions })));
  const balance1 = await api("/api/check-referral-rewards", a);
  const balance2 = await api("/api/check-referral-rewards", a);
  must(balance1.bonusEarned === 1 && balance2.bonusEarned === 1 && balance2.remaining === 1,
    "Referral retry or balance GET produced duplicate credits");
  passed("a qualifying accepted referral credits once and balance reads do not mutate rewards");

  const secondEvent = randomUUID();
  const eventInsert = await admin.from("pilot_events").insert({ id: secondEvent,
    cup_id: `staging-check-${secondEvent}`, title: "STAGING CHECK — no prizes",
    prize_pool: "No real prizes", prize_tiers: [], prize_slots: 1, is_demo: true,
    starts_at: new Date(Date.now() - 60000).toISOString(),
    ends_at: new Date(Date.now() + 3600000).toISOString(), state: "open" });
  must(!eventInsert.error, "Could not prepare second staging cup");
  createdEvents.push(secondEvent);
  await api("/api/session-token", a, startBody(a, randomUUID(), secondEvent));
  await api("/api/session-token", a, startBody(a), 409);
  const otherBoard = await api(`/api/leaderboard?eventId=${secondEvent}`, a);
  must(otherBoard.tournament.length === 0 && otherBoard.me === null,
    "Standings leaked across separate cups");
  passed("tickets are shared across cups while accepted standings stay separate");

  const lower = finish(secondA, 1);
  await api("/api/submit-score", a, { sessionId: secondA.id, actions: lower.actions });
  const board = await api(`/api/leaderboard?eventId=${demoId}`, a);
  must(board.tournament.filter((s) => s.user_id === a.id).length === 1 && board.me.user_id === a.id,
    "Leaderboard duplicated the player or identified the wrong current account");
  must(board.me.score === Math.max(gameA.score, lower.score), "Leaderboard did not retain the best run");
  const expired = await admin.from("pilot_runs").update({ expires_at: new Date(Date.now() - 60000).toISOString() }).eq("id", thirdA.id);
  must(!expired.error, "Could not prepare expiry check");
  await api("/api/submit-score", a, { sessionId: thirdA.id, actions: finish(thirdA).actions }, 410);
  await api("/api/claim", a, { eventId: demoId, adult: true }, events.claimsEnabled ? 409 : 503);
  const approvals = await a.client.from("pilot_claims").insert({ user_id: a.id, event_id: demoId, status: "approved" });
  must(Boolean(approvals.error), "Client claim approval is permitted");
  passed("standings retain one best result, expired sessions fail, and claims cannot self-approve");
} catch (error) {
  failure = error instanceof Error ? error.message : "Staging verification failed";
} finally {
  for (const id of createdUsers) {
    const result = await admin.auth.admin.deleteUser(id);
    if (result.error) failure = "Temporary staging account cleanup failed";
  }
  for (const id of createdEvents) await admin.from("pilot_events").delete().eq("id", id);
  await mkdir("output/review", { recursive: true });
  await writeFile("output/review/staging-check.json", JSON.stringify({
    checkedAt: new Date().toISOString(), deployment: appUrl, checks,
    temporaryAccountsRemoved: createdUsers.length, failure: failure || null,
    limitations: ["Admin-created test accounts; real guest CAPTCHA remains a manual rehearsal",
      "Manual WhatsApp sending and adult/result review remain an operator rehearsal"],
  }, null, 2));
}
if (failure) { console.error(failure); process.exitCode = 1; }
else console.log(`Hosted staging checks passed: ${checks.length} groups; temporary accounts removed.`);
