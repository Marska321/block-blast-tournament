import assert from "node:assert/strict";
import { gameControl } from './game-control.mjs';
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { createServer } from "vite";

const channel = "https://whatsapp.com/channel/0029Vb8yQTpBVJlATADfaH2y";
let server;
let origin = process.env.CASUAL_APP_URL;
if (!origin) {
  process.env.VITE_CASUAL_ONLY = "true";
  process.env.VITE_WHATSAPP_CHANNEL_URL = channel;
  process.env.VITE_SUPABASE_URL = "https://pilot.supabase.co";
  process.env.VITE_SUPABASE_ANON_KEY = "unused-casual-test-key";
  server = await createServer({ envDir: false,
    server: { host: "127.0.0.1", port: 5191, strictPort: true } });
  await server.listen();
  origin = "http://127.0.0.1:5191";
}
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
if (process.env.CASUAL_COOKIE_JAR) {
  const jar = await readFile(process.env.CASUAL_COOKIE_JAR, "utf8");
  const cookies = jar.split(/\r?\n/).filter((line) => line && (!line.startsWith("#") || line.startsWith("#HttpOnly_"))).map((line) => {
    const fields = line.replace(/^#HttpOnly_/, "").split("\t");
    assert.equal(fields[0], new URL(origin).hostname, "Browser cookie must match the exact deployment host");
    return { domain: fields[0], path: fields[2], secure: fields[3] === "TRUE",
      ...(Number(fields[4]) > 0 ? { expires: Number(fields[4]) } : {}),
      name: fields[5], value: fields[6], httpOnly: line.startsWith("#HttpOnly_") };
  });
  assert.ok(cookies.length, "Authenticated browser cookie was not established");
  await context.addCookies(cookies);
} else if (process.env.VERCEL_OIDC_TOKEN && origin.startsWith("https://")) {
  await context.route(`${origin}/**`, (route) => route.continue({ headers: {
    ...route.request().headers(), "x-vercel-trusted-oidc-idp-token": process.env.VERCEL_OIDC_TOKEN,
  } }));
}
await context.addInitScript(() => {
  if (!localStorage.getItem("bbt_level_progress")) localStorage.setItem("bbt_level_progress",
    JSON.stringify({ 1: { stars: 2, bestScore: 777, completed: true } }));
  if (!localStorage.getItem("bb_pilot_classic_best")) localStorage.setItem("bb_pilot_classic_best", "1777");
});
const page = await context.newPage();
const errors = [], backendRequests = [];
page.on("pageerror", (error) => errors.push(error.name));
page.on("request", (request) => {
  const url = new URL(request.url());
  if (url.hostname.endsWith(".supabase.co") || url.pathname.startsWith("/api/"))
    backendRequests.push(url.pathname);
});
const dir = "output/playwright/casual";
await mkdir(dir, { recursive: true });
try {
  const response = await page.goto(origin, { waitUntil: "domcontentloaded" });
  assert.ok(response?.ok());
  assert.match(await page.title(), /Blok Blaster/);
  await page.locator("#landingModal.active").waitFor();
  assert.equal(await page.locator("body").evaluate((el) => el.classList.contains("theme-paper")), false);
  assert.match(await page.locator("#landingModal").innerText(), /No forced ad breaks/);
  assert.ok(!(await page.locator("#landingModal").innerText()).includes("ad-free"));
  assert.match(await page.locator("#landingModal").innerText(), /No account or phone number needed/);
  const follow = page.locator("#landingModal").getByRole("link", { name: "Follow Playables on WhatsApp" });
  assert.equal(await follow.getAttribute("href"), channel);
  assert.equal(await follow.getAttribute("rel"), "noopener noreferrer");
  assert.match(await page.locator("#landingModal").innerText(), /notification bell/);
  await page.screenshot({ path: `${dir}/welcome.png`, fullPage: true });
  await page.locator("#landingStartClassicBtn").click();
  assert.equal(JSON.parse(await page.evaluate(() => window.render_game_to_text())).blockStyle, "bevel");
  assert.equal(await page.locator("#hud-chances-badge").isVisible(), false);
  for (let run = 0; run < 4; run++) {
    await page.locator("#gameCanvas").focus();
    await page.keyboard.press("1");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).moves === 1);
    if (run === 0) await page.screenshot({ path: `${dir}/game.png`, fullPage: true });
    if (!(await page.locator('#keyboard-controls').isVisible())) {
      await page.locator('#play-menu-btn').click();
      await page.getByRole('button', { name: 'Keyboard & accessible board controls', exact: true }).click();
    } else if ((await page.locator("#keyboard-controls").getAttribute("open")) === null)
      await page.locator("#keyboard-controls summary").click();
    await page.locator("#end-run-btn").click();
    await page.getByRole("button", { name: "Play Classic again", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: /prize claims/ }).count(), 0);
    if (run === 0) await page.screenshot({ path: `${dir}/finished.png`, fullPage: true });
    await page.getByRole("button", { name: "Play Classic again", exact: true }).click();
  }
  await gameControl(page, '#leaderboard-btn');
  const progress = page.locator("#leaderboardModalOverlay");
  assert.match(await progress.innerText(), /Classic best: 1,777/);
  assert.match(await progress.innerText(), /Adventure: 2 \/ 180/);
  await page.screenshot({ path: `${dir}/progress.png` });
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#mode-tourney-btn").isDisabled(), true);
  await gameControl(page, '#landing-info-btn');
  await page.locator("#landingRulesBtn").click();
  await page.locator("#casualInfoModal.active").waitFor();
  assert.match(await page.locator("#casualInfoModal").innerText(), /Promotions are coming soon/);
  assert.equal(await page.locator("#casualInfoModal input").count(), 0);
  await page.keyboard.press("Escape");
  await page.locator("#landingStartTourneyBtn").click();
  await page.locator('button[data-level="1"]').click();
  assert.equal(JSON.parse(await page.evaluate(() => window.render_game_to_text())).mode, "levels");
  if ((await page.locator("#keyboard-controls").getAttribute("open")) !== null)
    await page.locator("#keyboard-controls summary").click();
  await page.screenshot({ path: `${dir}/game-dark.png`, fullPage: true });
  await gameControl(page, '#theme-btn');
  assert.equal(await page.locator("body").evaluate((el) => el.classList.contains("theme-paper")), true);
  await page.reload();
  await page.waitForFunction(() => typeof window.render_game_to_text === "function");
  assert.equal(await page.locator("body").evaluate((el) => el.classList.contains("theme-paper")), true);
  assert.equal(await page.locator("meta[name=theme-color]").getAttribute("content"), "#f5f0e6");
  await page.screenshot({ path: `${dir}/game-light.png`, fullPage: true });
  await page.setViewportSize({ width: 320, height: 568 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: `${dir}/levels-small.png`, fullPage: true });
  assert.deepEqual(errors, []);
  assert.deepEqual(backendRequests, []);
  await writeFile(`${dir}/results.json`, JSON.stringify({ passed: true, origin,
    checks: ["optional channel link", "four unlimited casual runs", "existing local progress retained",
      "events and level navigation", "no Auth or API requests", "mobile reduced-motion layout"], errors, backendRequests }, null, 2));
  console.log("Casual browser checks passed: channel, four runs, local progress, Levels, mobile, and zero backend requests.");
} finally {
  await browser.close();
  await server?.close();
}
