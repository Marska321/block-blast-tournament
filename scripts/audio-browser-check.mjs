import assert from "node:assert/strict";
import { gameControl } from './game-control.mjs';
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "vite";
import { chromium } from "playwright";
import { GameEngine, ENGINE_VERSION } from "../shared/engine.js";
import { canPlaceBlockAtPosition } from "../shared/mechanics.js";

process.env.VITE_CASUAL_ONLY = "true";
const server = await createServer({ envDir: false, server: { host: "127.0.0.1", port: 5194, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ headless: true });
await mkdir("output/audio", { recursive: true });
await mkdir("output/playwright/audio", { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => localStorage.setItem("bb_has_seen_landing", "true"));
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("http://127.0.0.1:5194");
  // Render exactly the same instrument as the live game, with real browser DSP.
  const rendered = await page.evaluate(async () => {
    const { scheduleSound } = await import("/src/soundDesign.ts");
    const samples = {};
    for (const cue of ["place", "clear", "allClear", "gameOver"]) {
      const ctx = new OfflineAudioContext(1, 44100 * 2, 44100);
      scheduleSound(ctx, ctx.destination, cue, 0.02, 2);
      samples[cue] = Array.from((await ctx.startRendering()).getChannelData(0));
    }
    const ctx = new OfflineAudioContext(1, 44100 * 6, 44100);
    for (const [cue, start, variation] of [["place", 0.1, 0], ["place", 0.4, 1], ["place", 0.7, 2],
      ["clear", 1.2, 0], ["clear", 2, 4], ["allClear", 3, 0], ["gameOver", 4.5, 0]])
      scheduleSound(ctx, ctx.destination, cue, start, variation);
    return { samples, audition: Array.from((await ctx.startRendering()).getChannelData(0)) };
  });
  for (const [cue, samples] of Object.entries(rendered.samples)) {
    assert.ok(samples.every(Number.isFinite), cue);
    const peak = samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
    assert.ok(peak > 0.02 && peak < 0.9, `${cue}: audible without clipping (${peak})`);
    assert.ok(samples.slice(-4410).every(value => Math.abs(value) < 0.0001), `${cue}: ends in silence`);
  }
  const wav = Buffer.alloc(44 + rendered.audition.length * 2);
  wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(44100, 24); wav.writeUInt32LE(88200, 28); wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(wav.length - 44, 40);
  rendered.audition.forEach((sample, index) => wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + index * 2));
  await writeFile("output/audio/blok-blaster-sound-preview.wav", wav);

  // Find real line clears and combos; resume their valid action logs and place
  // the last piece with the same keyboard controls used by players.
  const fixtures = new Map();
  for (let seed = 1; seed <= 10 && fixtures.size < 3; seed++) {
    const game = new GameEngine({ kind: "classic", seed });
    while (!game.over && game.moves < 100 && fixtures.size < 3) {
      let action;
      for (let slot = 0; slot < 3 && !action; slot++) if (game.tray[slot].active)
        for (let y = 0; y < 8 && !action; y++) for (let x = 0; x < 8 && !action; x++)
          if (canPlaceBlockAtPosition(game.grid, game.tray[slot].shape, x, y)) action = { type: "place", slot, x, y };
      if (!action) break;
      const actions = structuredClone(game.actions);
      const result = game.apply(action);
      if (!result.lines || result.allClear || game.combo >= 5 || result.lines >= 3) continue;
      const phrase = game.combo >= 2 ? "Lekker!" : result.lines >= 2 ? "Great!" : "Nice!";
      if (!fixtures.has(phrase)) fixtures.set(phrase, { actions, action, seed, score: game.score });
    }
  }
  assert.ok(fixtures.has("Nice!") && fixtures.has("Lekker!"));
  for (const [phrase, fixture] of fixtures) {
    await page.evaluate(({ fixture, version }) => localStorage.setItem("bb_in_progress_game", JSON.stringify({
      version, startedAt: Date.now(), options: { kind: "classic", seed: fixture.seed },
      actions: fixture.actions, practice: true, officialSession: null, blockStyle: "bevel",
    })), { fixture, version: ENGINE_VERSION });
    await page.reload();
    await page.locator("#gameCanvas").focus();
    await page.keyboard.press(String(fixture.action.slot + 1));
    for (let x = 0; x < fixture.action.x; x++) await page.keyboard.press("ArrowRight");
    for (let y = 0; y < fixture.action.y; y++) await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    const state = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
    assert.equal(state.score, fixture.score);
    assert.ok(["Nice!", "Great!", "Lekker!", "Duidelik!", "Aweh!", "Amazing!", "Brilliant!"].includes(state.feedback?.text));
    await page.screenshot({ path: `output/playwright/audio/${phrase.slice(0, -1).toLowerCase()}.png` });
  }
  await gameControl(page, '#mute-btn');
  assert.equal(await page.locator("#mute-btn").getAttribute("aria-label"), "Unmute sound");
  await page.reload();
  assert.equal(await page.locator("#mute-btn").getAttribute("aria-pressed"), "true");
  await gameControl(page, '#mute-btn');
  assert.equal(await page.locator("#mute-btn").getAttribute("aria-label"), "Mute sound");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 568 });
  const { floatingTexts } = await page.evaluate(async () => {
    const { floatingTexts } = await import("/src/floatingText.ts");
    floatingTexts.spawnPraise(4, 5, 160, 280, 900, true);
    return { floatingTexts: floatingTexts.getVisibleText() };
  });
  assert.equal(floatingTexts.text, "Perfect!");
  await page.waitForTimeout(150);
  await page.screenshot({ path: "output/playwright/audio/reduced-motion-narrow.png" });
  for (const phrase of ["Duidelik!", "Lekker!", "Aweh!"]) {
    await page.evaluate(async (phrase) => {
      const { floatingTexts } = await import("/src/floatingText.ts");
      for (let i = 0; i < 14; i++) {
        const cue = floatingTexts.spawnPraise(1, 0, 160, 280, 100);
        if (cue.text === phrase) return;
      }
      throw new Error("Praise rotation omitted " + phrase);
    }, phrase);
    await page.waitForTimeout(100);
    await page.screenshot({ path: `output/playwright/audio/rotation-${phrase.slice(0, -1).toLowerCase()}.png` });
  }
  assert.deepEqual(errors, []);
  console.log("Audio/feedback passed: browser DSP renders every cue, no clipping/invalid samples, silent tails, legal clears/combos, mute persistence and narrow reduced-motion praise. Audition WAV exported.");
} finally { await browser.close(); await server.close(); }
