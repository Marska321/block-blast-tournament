import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const origin = "https://block-blast-tournament-staging.vercel.app";
const token = process.env.VERCEL_OIDC_TOKEN;
if (!token) throw new Error("A private staging development OIDC token is required");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1, reducedMotion: "reduce" });
// Never send the Vercel credential to Supabase, Cloudflare, or other origins.
await context.route(`${origin}/**`, (route) => route.continue({ headers: {
  ...route.request().headers(), "x-vercel-trusted-oidc-idp-token": token,
} }));
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.name));
await mkdir("output/playwright/staging", { recursive: true });
try {
  const response = await page.goto(origin, { waitUntil: "domcontentloaded" });
  if (!response?.ok()) throw new Error(`Staging page returned HTTP ${response?.status()}`);
  await page.waitForFunction(() => typeof window.render_game_to_text === "function");
  await page.getByText("Demo adaptive cup", { exact: false }).first().waitFor({ timeout: 20000 });
  await page.screenshot({ path: "output/playwright/staging/welcome.png", fullPage: true });
  await page.locator("#landingStartClassicBtn").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "output/playwright/staging/welcome-actions.png", fullPage: true });
  await page.locator("#closeLandingBtn").click();
  await page.locator("#mode-classic-btn").click();
  await page.keyboard.press("1");
  await page.keyboard.press("Enter");
  const state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  if (state.mode !== "classic" || state.moves !== 1 || state.score <= 0)
    throw new Error("Hosted keyboard placement did not update gameplay state");
  await page.screenshot({ path: "output/playwright/staging/game.png", fullPage: true });
  await writeFile("output/playwright/staging/state.json", JSON.stringify({
    pageStatus: response.status(), errors, state,
    body: (await page.locator("body").innerText()).slice(0, 5000),
  }, null, 2));
  if (errors.length) throw new Error("Staging browser reported a JavaScript error");
  console.log("Hosted browser loaded the demo event and completed a keyboard placement.");
} finally { await browser.close(); }
