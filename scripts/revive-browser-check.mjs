import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { createServer } from "vite";
import { chromium } from "playwright";
import { GameEngine, ENGINE_VERSION } from "../shared/engine.js";
import { canPlaceBlockAtPosition } from "../shared/mechanics.js";

const game = new GameEngine({ kind: "classic", seed: 1 });
function finishFixture() {
  let last;
  while (!game.over && game.moves < 500) {
    let action;
    for (let slot = 0; slot < 3 && !action; slot++) if (game.tray[slot].active)
      for (let y = 0; y < 8 && !action; y++) for (let x = 0; x < 8 && !action; x++)
        if (canPlaceBlockAtPosition(game.grid, game.tray[slot].shape, x, y)) action = { type: "place", slot, x, y };
    assert.ok(action);
    last = { actions: structuredClone(game.actions), action };
    game.apply(action);
  }
  assert.equal(game.over, true);
  return { ...last, score: game.score, board: structuredClone(game.grid) };
}
const first = finishFixture();
game.apply({ type: "revive" });
const rescueActions = structuredClone(game.actions);
const second = finishFixture();
let server, origin = process.env.CASUAL_APP_URL;
if (!origin) {
  process.env.VITE_CASUAL_ONLY = "true";
  server = await createServer({ envDir: false, server: { host: "127.0.0.1", port: 5195, strictPort: true } });
  await server.listen();
  origin = "http://127.0.0.1:5195";
}
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
if (process.env.UI_REVIEW_COOKIE) {
  const jar = await readFile(process.env.UI_REVIEW_COOKIE, "utf8");
  await context.addCookies(jar.split(/\r?\n/).filter(line => line && (!line.startsWith("#") || line.startsWith("#HttpOnly_"))).map(line => {
    const f = line.replace(/^#HttpOnly_/, "").split("\t");
    assert.equal(f[0], new URL(origin).hostname);
    return { domain: f[0], path: f[2], secure: f[3] === "TRUE", name: f[5], value: f[6],
      ...(Number(f[4]) > 0 ? { expires: Number(f[4]) } : {}) };
  }));
}
await context.addInitScript(() => localStorage.setItem("bb_has_seen_landing", "true"));
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const load = async (actions) => {
  await page.evaluate(({ actions, version }) => localStorage.setItem("bb_in_progress_game", JSON.stringify({
    version, startedAt: Date.now(), options: { kind: "classic", seed: 1 }, actions,
    practice: true, officialSession: null, blockStyle: "bevel",
  })), { actions, version: ENGINE_VERSION });
  await page.reload();
  await page.waitForFunction(() => typeof window.render_game_to_text === "function");
};
const place = async ({ action }) => {
  await page.locator("#gameCanvas").focus();
  await page.keyboard.press(String(action.slot + 1));
  for (let x = 0; x < action.x; x++) await page.keyboard.press("ArrowRight");
  for (let y = 0; y < action.y; y++) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
};
await mkdir("output/playwright/revive", { recursive: true });
try {
  await page.goto(origin);
  await page.locator("#mode-classic-btn").click();
  assert.equal((await state()).selection.visible, false);
  await page.locator("#gameCanvas").focus();
  await page.keyboard.press("ArrowRight");
  assert.equal((await state()).selection.visible, true);
  await page.screenshot({ path: "output/playwright/revive/keyboard-cursor.png" });
  const canvas = await page.locator("#gameCanvas").boundingBox();
  const layout = (await state()).boardLayout;
  await page.mouse.click(canvas.x + layout.x + 6, canvas.y + layout.y + 6);
  assert.equal((await state()).selection.visible, false);
  await page.screenshot({ path: "output/playwright/revive/pointer-no-cursor.png" });

  await load(first.actions);
  await place(first);
  await page.locator("#classicReviveBtn").waitFor();
  assert.deepEqual((await state()).board, first.board);
  assert.equal((await state()).score, first.score);
  await page.screenshot({ path: "output/playwright/revive/free-offer.png" });
  await page.reload();
  await page.locator("#classicReviveBtn").waitFor();
  await page.locator("#classicReviveBtn").click();
  assert.equal((await state()).over, false);
  assert.deepEqual((await state()).board, first.board);
  assert.equal((await state()).score, first.score);
  assert.equal((await state()).revive.used, true);
  await page.reload();
  assert.equal((await state()).revive.used, true);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("bb_in_progress_game")));
  assert.deepEqual(saved.actions, rescueActions);
  await page.screenshot({ path: "output/playwright/revive/rescued-reloaded.png" });

  await load(second.actions);
  await place(second);
  await page.locator("#gameOverModal.active").waitFor();
  assert.equal(await page.locator("#classicReviveBtn").count(), 0);
  assert.equal((await state()).revive.available, false);
  assert.match(await page.locator("#gameOverModal").innerText(), /no revives left/);
  await page.screenshot({ path: "output/playwright/revive/limit-reached.png" });
  await page.getByRole("button", { name: "Play Classic again", exact: true }).click();
  assert.equal((await state()).revive.used, false);
  assert.deepEqual(errors, []);
  console.log("Classic revive/cursor passed: one free rescue, unchanged board/score, pending and used state survive reload, second rescue blocked, fresh run resets, keyboard-only cursor and pointer dismissal.");
} finally { await browser.close(); await server?.close(); }
