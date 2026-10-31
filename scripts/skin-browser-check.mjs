import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "vite";
import { chromium } from "playwright";
import { GameEngine, ENGINE_VERSION } from "../shared/engine.js";
import { canPlaceBlockAtPosition } from "../shared/mechanics.js";

// Legal replay fixtures stop just before score milestones; the actual crossing
// action is performed using the browser's keyboard controls, with no score edits.
const game = new GameEngine({ kind: "classic", seed: 1 });
const fixtures = [];
while (!game.over && game.score < 2500) {
  let action;
  for (let slot = 0; slot < 3 && !action; slot++) if (game.tray[slot].active)
    for (let y = 0; y < 8 && !action; y++) for (let x = 0; x < 8 && !action; x++)
      if (canPlaceBlockAtPosition(game.grid, game.tray[slot].shape, x, y)) action = { type: "place", slot, x, y };
  assert.ok(action);
  const before = { actions: structuredClone(game.actions), score: game.score };
  game.apply(action);
  for (const milestone of [1000, 2500]) if (before.score < milestone && game.score >= milestone)
    fixtures.push({ ...before, action, milestone, expected: game.score });
}
assert.equal(fixtures.length, 2);
let server;
let origin = process.env.CASUAL_APP_URL;
if (!origin) {
  process.env.VITE_CASUAL_ONLY = "true";
  server = await createServer({ envDir: false, server: { host: "127.0.0.1", port: 5193, strictPort: true } });
  await server.listen();
  origin = "http://127.0.0.1:5193";
}
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
if (process.env.UI_REVIEW_COOKIE) {
  const { readFile } = await import("node:fs/promises");
  const jar = await readFile(process.env.UI_REVIEW_COOKIE, "utf8");
  const cookies = jar.split(/\r?\n/).filter((line) => line && (!line.startsWith("#") || line.startsWith("#HttpOnly_"))).map((line) => {
    const f = line.replace(/^#HttpOnly_/, "").split("\t");
    assert.equal(f[0], new URL(origin).hostname);
    return { domain: f[0], path: f[2], secure: f[3] === "TRUE", name: f[5], value: f[6],
      ...(Number(f[4]) > 0 ? { expires: Number(f[4]) } : {}) };
  });
  await context.addCookies(cookies);
}
await context.addInitScript(() => localStorage.setItem("bb_has_seen_landing", "true"));
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.name));
const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
await mkdir("output/playwright/skins", { recursive: true });
try {
  await page.goto(origin);
  await page.locator("#mode-classic-btn").click();
  assert.equal((await state()).blockStyle, "bevel");
  await page.screenshot({ path: "output/playwright/skins/starting-bevel.png" });
  let previousStyle = "bevel";
  for (const fixture of fixtures) {
    await page.evaluate(({ actions, version, blockStyle }) => {
      localStorage.setItem("bb_in_progress_game", JSON.stringify({ version, startedAt: Date.now(),
        options: { kind: "classic", seed: 1 }, actions, practice: true, officialSession: null, blockStyle }));
    }, { actions: fixture.actions, version: ENGINE_VERSION, blockStyle: previousStyle });
    await page.reload();
    await page.waitForFunction(() => typeof window.render_game_to_text === "function");
    assert.equal((await state()).score, fixture.score);
    assert.equal((await state()).blockStyle, previousStyle);
    await page.locator("#gameCanvas").focus();
    await page.keyboard.press(String(fixture.action.slot + 1));
    for (let x = 0; x < fixture.action.x; x++) await page.keyboard.press("ArrowRight");
    for (let y = 0; y < fixture.action.y; y++) await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    const crossed = await state();
    assert.equal(crossed.score, fixture.expected);
    assert.ok(crossed.feedback?.text, "legal milestone clear shows praise");
    assert.notEqual(crossed.blockStyle, previousStyle);
    assert.notEqual(crossed.blockStyle, "flat");
    previousStyle = crossed.blockStyle;
    await page.waitForTimeout(250);
    await page.screenshot({ path: `output/playwright/skins/milestone-${fixture.milestone}.png` });
    await page.locator("#theme-btn").click();
    assert.equal((await state()).blockStyle, previousStyle);
    await page.reload();
    await page.waitForFunction(() => typeof window.render_game_to_text === "function");
    assert.equal((await state()).blockStyle, previousStyle);
  }
  await page.locator("#mode-classic-btn").click();
  assert.equal((await state()).blockStyle, "bevel");
  assert.deepEqual(errors, []);
  console.log("Skin progression passed: bevel start, legal 1,000/2,500 milestones, both themes, reload preservation, and new-run reset.");
} finally { await browser.close(); await server?.close(); }
