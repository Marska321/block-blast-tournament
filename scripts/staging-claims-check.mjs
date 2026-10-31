import { createClient } from "@supabase/supabase-js";
import { randomUUID, createHash } from "node:crypto";
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

// Codes and prefilled WhatsApp links remain in memory only. This script never
// opens WhatsApp, sends a message, or pays anyone. All actors are synthetic.
const digest = (code) => createHash("sha256").update(code).digest("hex");
const sender = "+12025550123"; // Reserved fictional number, never contacted.
async function requestClaim(player, eventId) {
  const result = await api("/api/claim", player, { eventId, adult: true });
  const url = new URL(result.whatsappUrl);
  const code = url.searchParams.get("text")?.match(/\nCode: ([A-Za-z0-9_-]+)\n/)?.[1];
  must(url.origin === "https://wa.me" && url.pathname === `/${process.env.TOURNAMENT_WHATSAPP_NUMBER}` && code,
    "Claim message destination or code is invalid");
  return { id: result.claimId, code };
}
async function review(claim, expectedError, overrides = {}) {
  const result = await admin.rpc("pilot_review_claim", {
    p_claim: claim.id, p_hash: digest(claim.code), p_phone: sender,
    p_name: "STAGING TEST", p_adult: true, p_result_reviewed: true,
    p_decision: "approved", p_reason: "Staging rehearsal only; no payments",
    ...overrides,
  });
  if (expectedError) must(result.error?.message === expectedError, `Expected claim review denial: ${expectedError}`);
  else must(!result.error, "Claim review could not be saved");
}
async function operatorReview(claim) {
  const answers = [
    ["Claim reference: ", claim.id],
    ["Code received in the WhatsApp message: ", claim.code],
    ["Sender number in international format (+27…): ", "2025550123"],
    ["Sender number in international format (+27…): ", "+1 (202) 555-0123"],
    ["Private payout name (required for approval): ", "STAGING TEST"],
    ["Adult eligibility manually checked? Type yes: ", "yes"],
    ["Result and abuse/duplicate-account checks completed? Type yes: ", "yes"],
    ["Decision: approved or rejected: ", "approved"],
    ["Reason shown to the claimant (do not include private details): ", "Staging rehearsal only; no payments"],
  ];
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "scripts/claims.ts", "review"],
      { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let pending = "", index = 0, approved = false;
    const timeout = setTimeout(() => { child.kill(); reject(new Error("Operator CLI rehearsal timed out")); }, 45000);
    child.stdout.on("data", (chunk) => {
      const value = chunk.toString();
      approved ||= value.includes(": approved.");
      pending += value;
      if (index < answers.length && pending.includes(answers[index][0])) {
        pending = "";
        child.stdin.write(answers[index++][1] + "\n");
      }
    });
    child.stderr.resume(); // Do not forward operator diagnostics or private input.
    child.on("error", () => { clearTimeout(timeout); reject(new Error("Operator CLI could not start")); });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0 && index === answers.length && approved) resolve();
      else reject(new Error("Operator CLI rehearsal did not approve the synthetic claim"));
    });
  });
}

let failure;
try {
  const eventId = randomUUID();
  const inserted = await admin.from("pilot_events").insert({ id: eventId,
    cup_id: `staging-claims-${eventId}`, title: "STAGING CLAIM REHEARSAL — NO PAYOUT",
    prize_pool: "Test only — no payments", prize_tiers: [], prize_slots: 2, is_demo: false,
    starts_at: new Date(Date.now() - 7200000).toISOString(),
    ends_at: new Date(Date.now() + 3600000).toISOString(), state: "open" });
  must(!inserted.error, "Could not create staging claim rehearsal event");
  createdEvents.push(eventId);
  const a = await actor("Staging Claim A"), b = await actor("Staging Claim B");
  for (const player of [a, b]) {
    const run = await api("/api/session-token", player, {
      eventId, requestId: randomUUID(), nickname: player.label, adult: true,
    });
    const game = finish(run);
    await api("/api/submit-score", player, { sessionId: run.id, actions: game.actions });
  }
  const closed = await admin.from("pilot_events").update({ ends_at: new Date().toISOString(), state: "closed" }).eq("id", eventId);
  must(!closed.error, "Could not close staging rehearsal event");
  await api("/api/claim", null, { eventId, adult: true }, 401);
  await api("/api/claim", a, { eventId, adult: false }, 403);
  const first = await requestClaim(a, eventId);
  const stored = await admin.from("pilot_claims").select("code_hash,status,phone,full_name").eq("id", first.id).single();
  must(!stored.error && stored.data.code_hash === digest(first.code) &&
    stored.data.status === "pending" && stored.data.phone === null && stored.data.full_name === null,
    "Claim creation did not leave a private hash-only pending record");
  passed("hosted claim creation requires authentication/adult attestation and stores only a hash without approval");

  const replacement = await requestClaim(a, eventId);
  must(first.id === replacement.id && first.code !== replacement.code, "Replacement did not rotate the claim code");
  await review(first, "claim_code_invalid");
  await review(replacement, "review_required", { p_adult: false });
  await review(replacement, "review_required", { p_result_reviewed: false });
  const expired = await admin.from("pilot_claims").update({ code_expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", replacement.id);
  must(!expired.error, "Could not prepare claim expiry check");
  await review(replacement, "claim_code_invalid");
  const live = await requestClaim(a, eventId);
  passed("replaced/expired codes and incomplete adult or result review cannot approve claims");

  await operatorReview(live);
  await review(live, "claim_unavailable");
  const approved = await api("/api/claims", a);
  must(approved.claims.length === 1 && approved.claims[0].status === "approved",
    "Original player session cannot see the operator decision");
  const allowed = ["id", "event_id", "status", "reviewed_at", "review_reason"];
  must(Object.keys(approved.claims[0]).every((key) => allowed.includes(key)),
    "Claim status API exposed private review details");
  passed("local operator command approves once; the original session sees status without private contacts or codes");

  const second = await requestClaim(b, eventId);
  await review(second, "duplicate_phone_review");
  await review(second, null, { p_decision: "rejected", p_name: "", p_adult: false,
    p_result_reviewed: false, p_reason: "Duplicate contact reviewed; claim rejected" });
  const rejected = await api("/api/claims", b);
  must(rejected.claims.length === 1 && rejected.claims[0].status === "rejected" &&
    rejected.claims[0].review_reason === "Duplicate contact reviewed; claim rejected",
    "Duplicate-contact rejection was not recorded or isolated to its owner");
  passed("duplicate contact approvals are blocked while explicit rejections remain possible");
} catch (error) {
  failure = error instanceof Error ? error.message : "Staging claim verification failed";
} finally {
  for (const id of createdEvents) {
    const result = await admin.from("pilot_claims").delete().eq("event_id", id);
    if (result.error) failure = "Temporary claim cleanup failed";
  }
  for (const id of createdUsers) {
    const result = await admin.auth.admin.deleteUser(id);
    if (result.error) failure = "Temporary staging account cleanup failed";
  }
  for (const id of createdEvents) {
    const result = await admin.from("pilot_events").delete().eq("id", id);
    if (result.error) failure = "Temporary staging event cleanup failed";
  }
  await mkdir("output/review", { recursive: true });
  await writeFile("output/review/staging-claims-check.json", JSON.stringify({
    checkedAt: new Date().toISOString(), deployment: appUrl, checks,
    temporaryAccountsRemoved: createdUsers.length, failure: failure || null,
    limitations: ["Synthetic accounts and operator inputs; no WhatsApp message or payment sent",
      "Real guest CAPTCHA and human eligibility/result review remain manual rehearsals"],
  }, null, 2));
}
if (failure) { console.error(failure); process.exitCode = 1; }
else console.log(`Hosted claim checks passed: ${checks.length} groups; temporary records removed.`);
