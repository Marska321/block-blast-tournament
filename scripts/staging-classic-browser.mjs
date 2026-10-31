import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { randomUUID } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
const projectUrl = "https://okjfileghngpcegdwdud.supabase.co";
const origin = process.env.STAGING_APP_URL;
if (process.env.SUPABASE_URL !== projectUrl || !/^https:\/\/block-blast-tournament-staging-[a-z0-9]+\.vercel\.app$/.test(origin || "") || !process.env.CLASSIC_COOKIE_JAR)
  throw new Error("Explicit staging project, deployment and host cookie required");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(projectUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const client = createClient(projectUrl, process.env.VITE_SUPABASE_ANON_KEY, options);
let userId, browser, failure;
const errors = [];
try {
  const email = `classic-browser-${randomUUID()}@example.invalid`;
  const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { staging_test: true } });
  assert.ok(!created.error && created.data.user); userId = created.data.user.id;
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  assert.ok(!link.error && link.data.properties?.hashed_token);
  const verified = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.data.properties.hashed_token });
  assert.ok(!verified.error && verified.data.session);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", acceptDownloads: true });
  const jar = await readFile(process.env.CLASSIC_COOKIE_JAR, "utf8");
  const cookies = jar.split(/\r?\n/).filter(line => line && (!line.startsWith("#") || line.startsWith("#HttpOnly_"))).map(line => {
    const f = line.replace(/^#HttpOnly_/, "").split("\t");
    assert.equal(f[0], new URL(origin).hostname);
    return { domain: f[0], path: f[2], secure: f[3] === "TRUE", name: f[5], value: f[6], ...(Number(f[4]) > 0 ? { expires: Number(f[4]) } : {}) };
  });
  await context.addCookies(cookies);
  await context.addInitScript(({ session }) => {
    localStorage.setItem("sb-okjfileghngpcegdwdud-auth-token", JSON.stringify(session));
    localStorage.setItem("bb_classic_joined", "true");
    localStorage.setItem("bb_has_seen_landing", "true");
  }, { session: verified.data.session });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.name));
  await mkdir("output/playwright/classic-hosted", { recursive: true });
  await page.goto(origin);
  await page.locator("#leaderboard-btn").click();
  await page.locator("#classicRankedStart").click();
  await page.locator("#classicNickname").fill("Staging browser test");
  assert.equal(await page.locator("#classicEntry input[type=checkbox]").count(), 0);
  await page.getByRole("button", { name: "Start my ranked run", exact: true }).click();
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).ranked !== null, { timeout: 30000 });
  const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
  while ((await state()).score < 100 && !(await state()).over) {
    const current = await state();
    let action;
    for (let slot = 0; slot < 3 && !action; slot++) if (current.pieces[slot].active) {
      const shape = current.pieces[slot].shape;
      for (let y = 0; y <= 8 - shape.length && !action; y++) for (let x = 0; x <= 8 - shape[0].length && !action; x++)
        if (shape.every((row, dy) => row.every((value, dx) => !value || !current.board[y + dy][x + dx]))) action = { slot, x, y };
    }
    assert.ok(action);
    await page.locator("#gameCanvas").focus();
    await page.keyboard.press(String(action.slot + 1));
    for (let i = 0; i < 7; i++) { await page.keyboard.press("ArrowLeft"); await page.keyboard.press("ArrowUp"); }
    for (let x = 0; x < action.x; x++) await page.keyboard.press("ArrowRight");
    for (let y = 0; y < action.y; y++) await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
  }
  if (!(await state()).over) {
    await page.locator("#keyboard-controls summary").click();
    await page.locator("#end-run-btn").click();
  } else await page.getByRole("button", { name: "Finish & save daily score", exact: true }).click();
  await page.getByText(/Accepted · .*Rank #/).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Daily leaderboard & streak", exact: true }).click();
  await page.getByText("1-day streak", { exact: true }).waitFor({ timeout: 30000 });
  await page.getByText("Staging browser test (you)", { exact: true }).waitFor();
  await page.screenshot({ path: "output/playwright/classic-hosted/accepted-board.png", fullPage: true });
  const download = page.waitForEvent("download");
  await page.locator("#classicResultsCard").click();
  await (await download).saveAs("output/playwright/classic-hosted/results-card.png");
  assert.deepEqual(errors, []);
  console.log("Hosted browser passed: nickname entry, server-issued session, real keyboard placements, replay acceptance, own rank, streak, and PNG export under deployed CSP.");
} catch (error) { failure = error; }
finally {
  await browser?.close();
  await client.auth.signOut({ scope: "global" }).catch(() => {});
  if (userId && (await admin.auth.admin.deleteUser(userId)).error) failure ||= new Error("Temporary browser account cleanup failed");
  await mkdir("output/review", { recursive: true });
  await writeFile("output/review/classic-hosted-browser.json", JSON.stringify({ passed: !failure, pageErrors: errors, temporaryAccountRemoved: Boolean(userId) }, null, 2));
}
if (failure) throw failure;
