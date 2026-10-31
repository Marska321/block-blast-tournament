import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createServer } from "vite";
import { chromium } from "playwright";
import { GameEngine, replay } from "../shared/engine.ts";

// UI integration fixtures only. No Supabase project or WhatsApp recipient is contacted.
process.env.VITE_CASUAL_ONLY = "false";
process.env.VITE_SUPABASE_URL = "https://pilot.supabase.co";
process.env.VITE_SUPABASE_ANON_KEY = "browser-fixture-public-key";
const server = await createServer({
  server: { host: "127.0.0.1", port: 5190, strictPort: true },
  envDir: false,
});
await server.listen();
const browser = await chromium.launch({ headless: true });
const dir = "output/playwright";
await mkdir(dir, { recursive: true });
const errors = [];
const submitted = [];
const starts = new Map();
const actor = "11111111-1111-4111-8111-111111111111";
const event = {
  id: "33333333-3333-4333-8333-333333333333",
  cup_id: "browser_fixture",
  title: "Browser fixture cup",
  prize_pool: "Test vouchers",
  prize_tiers: [{ rank: "1ST", reward: "Test only" }],
  prize_slots: 3,
  starts_at: new Date(Date.now() - 3600_000).toISOString(),
  ends_at: new Date(Date.now() + 3600_000).toISOString(),
  state: "open",
  is_demo: false,
};
let failSubmit = true;
let receipt = null;
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
const payload = Buffer.from(
  JSON.stringify({
    sub: actor,
    exp: Math.floor(Date.now() / 1000) + 3600,
    role: "authenticated",
  }),
).toString("base64url");
const token = `e30.${payload}.fixture`;
await context.addInitScript(
  ({ actor, token }) => {
    if (!localStorage.getItem("sb-pilot-auth-token"))
      localStorage.setItem(
        "sb-pilot-auth-token",
        JSON.stringify({
          access_token: token,
          refresh_token: "fixture-refresh",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: "bearer",
          user: {
            id: actor,
            aud: "authenticated",
            is_anonymous: true,
            app_metadata: { provider: "anonymous", providers: [] },
            user_metadata: {},
            created_at: new Date().toISOString(),
          },
        }),
      );
    if (!localStorage.getItem("bbt_level_progress"))
      localStorage.setItem(
        "bbt_level_progress",
        JSON.stringify({ 1: { stars: 2, bestScore: 777, completed: true } }),
      );
  },
  { actor, token },
);
await context.route("https://pilot.supabase.co/**", (r) =>
  r.fulfill({
    json: {
      id: actor,
      aud: "authenticated",
      is_anonymous: true,
      app_metadata: {},
      user_metadata: {},
    },
  }),
);
await context.route("**/api/**", async (r) => {
  const url = new URL(r.request().url());
  const body = r.request().postDataJSON();
  let data = {};
  let status = 200;
  switch (url.pathname) {
    case "/api/events":
      data = {
        events: [event],
        serverTime: new Date().toISOString(),
        claimsEnabled: true,
      };
      break;
    case "/api/session-token": {
      assert.equal(body.adult, true);
      assert.ok(r.request().headers().authorization);
      if (!starts.has(body.requestId))
        starts.set(body.requestId, {
          id: randomUUID(),
          user_id: actor,
          request_id: body.requestId,
          event_id: event.id,
          kind: "tournament",
          level: null,
          seed: 123,
          engine_version: "pilot-1",
          status: "started",
          created_at: new Date().toISOString(),
          expires_at: event.ends_at,
        });
      data = starts.get(body.requestId);
      break;
    }
    case "/api/submit-score": {
      submitted.push(body);
      assert.deepEqual(Object.keys(body).sort(), ["actions", "sessionId"]);
      if (failSubmit) {
        status = 503;
        data = {
          error: "storage_unavailable",
          message: "Simulated interruption. Retry the saved run.",
        };
        break;
      }
      const run = [...starts.values()].find((s) => s.id === body.sessionId);
      assert.ok(run);
      const game = replay({ kind: "tournament", seed: run.seed }, body.actions);
      assert.equal(game.over, true);
      receipt = {
        success: true,
        scoreId: run.id,
        score: game.score,
        stars: 0,
        rank: 1,
        eventId: event.id,
        acceptedAt: new Date().toISOString(),
      };
      data = receipt;
      break;
    }
    case "/api/check-referral-rewards":
      data = {
        remaining: 2,
        baseUsed: 1,
        bonusEarned: 0,
        bonusUsed: 0,
        day: "2026-10-21",
      };
      break;
    case "/api/leaderboard":
      data = {
        event,
        tournament: receipt
          ? [
              {
                rank: 1,
                user_id: actor,
                nickname: "<img src=x onerror=alert(1)>",
                score: receipt.score,
                run_id: receipt.scoreId,
                accepted_at: receipt.acceptedAt,
              },
            ]
          : [],
        me: receipt ? { rank: 1, user_id: actor, score: receipt.score } : null,
        stars: [],
        myStars: 0,
        maxStars: 180,
        serverTime: new Date().toISOString(),
      };
      break;
    case "/api/claims":
      data = { claims: [] };
      break;
    case "/api/claim":
      data = {
        claimId: randomUUID(),
        status: "pending",
        expiresAt: new Date(Date.now() + 1800_000).toISOString(),
        whatsappUrl: "https://wa.me/27820000000?text=fixture-only",
      };
      break;
    case "/api/profile":
      data = { success: true };
      break;
    case "/api/verify-referral":
      data = { attributed: false };
      break;
    case "/api/submit-progress": {
      const game = replay(
        { kind: "levels", level: body.level, seed: body.seed },
        body.actions,
      );
      assert.ok(game.completed);
      data = {
        success: true,
        scoreId: randomUUID(),
        score: game.score,
        stars: game.stars,
        rank: null,
        eventId: null,
        acceptedAt: new Date().toISOString(),
      };
      break;
    }
    default:
      status = 404;
      data = { error: "missing_fixture" };
  }
  await r.fulfill({ status, json: data });
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
const state = () =>
  page.evaluate(() => JSON.parse(window.render_game_to_text()));
const check = async (label, fn) => {
  await fn();
  console.log(`PASS ${label}`);
};
try {
  await page.goto("http://127.0.0.1:5190");
  await check("official prize rules use the server event despite local visual overrides", async () => {
    await page.locator("#landingCupTitle").getByText("Browser fixture cup", { exact: true }).waitFor();
    await page.evaluate(() => window.setTournamentConfig({
      sponsorName: "Untrusted local preview", totalPrizePool: "R999999", tournamentTitle: "Invented cup",
    }));
    await page.locator("#landingRulesBtn").click();
    assert.equal(await page.locator("#rulesModalSubtitle").innerText(), "Browser fixture cup • Test vouchers");
    assert.equal((await page.locator("#tourneyRulesModal").innerText()).includes("R999999"), false);
    await page.locator("#closeRulesModalBtn").click();
  });
  await check("welcome dialog traps focus and closes accessibly", async () => {
    await page.locator("#landingModal.active").waitFor();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      assert.equal(
        await page.evaluate(
          () => !!document.activeElement?.closest("#landingModal"),
        ),
        true,
      );
    }
    await page.screenshot({ path: `${dir}/mobile-welcome.png` });
    await page.keyboard.press("Escape");
    await page.locator("#landingModal").waitFor({ state: "hidden" });
    assert.equal(
      await page.locator("#landingModal").getAttribute("hidden"),
      "",
    );
    assert.equal(
      JSON.parse(
        await page.evaluate(() => localStorage.getItem("bbt_level_progress")),
      )[1].bestScore,
      777,
    );
  });
  await check(
    "keyboard placement, accessible board, and reload resume",
    async () => {
      await page.locator("#mode-classic-btn").click();
      await page.locator("#gameCanvas").focus();
      await page.keyboard.press("1");
      await page.keyboard.press("Enter");
      assert.ok((await state()).score > 0);
      const before = await state();
      await page.reload();
      await page.waitForFunction(() => !!window.render_game_to_text);
      const after = await state();
      assert.equal(after.score, before.score);
      assert.deepEqual(after.board, before.board);
      assert.equal(after.moves, 1);
      await page.locator("#keyboard-controls summary").click();
      assert.equal(
        await page.locator('#accessible-board [role="gridcell"]').count(),
        64,
      );
      await page.screenshot({ path: `${dir}/mobile-accessible-board.png` });
      await page.locator("#keyboard-controls summary").click();
    },
  );
  await check(
    "dragging uses the same rule engine as keyboard placement",
    async () => {
      const snapshot = await state();
      let chosen;
      for (let slot = 0; slot < 3 && !chosen; slot++) {
        const p = snapshot.pieces[slot];
        if (!p.active) continue;
        for (let y = 0; y <= 8 - p.shape.length && !chosen; y++)
          for (let x = 0; x <= 8 - p.shape[0].length && !chosen; x++)
            if (
              p.shape.every((row, dy) =>
                row.every(
                  (v, dx) => !v || snapshot.board[y + dy][x + dx] === 0,
                ),
              )
            )
              chosen = { slot, x, y, p };
      }
      assert.ok(chosen);
      const bounds = await page.locator("#gameCanvas").boundingBox();
      const { p, x, y } = chosen;
      const board = snapshot.boardLayout;
      const grabX = (p.shape[0].length * p.cellSize) / 2,
        grabY = (p.shape.length * p.cellSize) / 2;
      await page.mouse.move(bounds.x + p.x + grabX, bounds.y + p.y + grabY);
      await page.mouse.down();
      await page.mouse.move(
        bounds.x + board.x + (x + p.shape[0].length / 2) * board.cellSize,
        bounds.y + board.y + (y + p.shape.length / 2) * board.cellSize,
        { steps: 8 },
      );
      await page.mouse.up();
      assert.equal((await state()).moves, snapshot.moves + 1);
      await page.screenshot({ path: `${dir}/mobile-gameplay.png` });
    },
  );
  await check(
    "official run waits for server seed and a verified guest session",
    async () => {
      await page.locator("#mode-tourney-btn").click();
      await page.locator("#startOfficialRunBtn:enabled").waitFor();
      await page
        .getByRole("button", { name: "Choose nickname / age eligibility" })
        .click();
      await page.locator("#pilotNickname").fill("Pilot player");
      await page.locator("#authModal input[type=checkbox]").check();
      await page
        .getByRole("button", { name: "Save nickname", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          document.activeElement?.textContent ===
          "Choose nickname / age eligibility",
      );
      await page.locator("#startOfficialRunBtn").click();
      await page.waitForFunction(
        () => JSON.parse(window.render_game_to_text()).mode === "tournament",
      );
      assert.equal(starts.size, 1);
      assert.equal(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("bb_in_progress_game")).options
              .seed,
        ),
        123,
      );
      await page.locator("#gameCanvas").focus();
      await page.keyboard.press("1");
      await page.keyboard.press("Enter");
      const before = await state();
      await page.reload();
      await page.waitForFunction(
        () => JSON.parse(window.render_game_to_text()).mode === "tournament",
      );
      assert.equal((await state()).score, before.score);
      assert.deepEqual((await state()).board, before.board);
      assert.equal(starts.size, 1);
    },
  );
  await check(
    "failed submissions survive reload and retries reuse the exact replay",
    async () => {
      await page.locator("#keyboard-controls summary").click();
      await page.locator("#end-run-btn").click();
      await page.waitForFunction(() =>
        document
          .querySelector("#submissionStatus")
          ?.textContent?.includes("retry needed"),
      );
      assert.equal(
        await page
          .locator("#submissionStatus")
          .textContent()
          .then((t) => t.includes("Accepted")),
        false,
      );
      await page.reload();
      await page.locator("#pendingSubmission.active").waitFor();
      failSubmit = false;
      await page
        .getByRole("button", { name: "Retry saving the previous run" })
        .click();
      await page.waitForFunction(() =>
        document
          .querySelector("#pendingSubmission")
          ?.textContent?.includes("Score accepted"),
      );
      assert.ok(receipt);
      assert.deepEqual(submitted[0], submitted[1]);
      await page.keyboard.press("Escape");
    },
  );
  await check(
    "leaderboard treats hostile nicknames as text and claims remain pending",
    async () => {
      event.ends_at = new Date(Date.now() - 60_000).toISOString();
      event.state = "closed";
      await page.locator("#leaderboard-btn").click();
      await page
        .getByRole("button", { name: "Tournament", exact: true })
        .click();
      await page.locator(".lb-safe-row").waitFor();
      assert.equal(
        await page.locator("#leaderboardModalOverlay img").count(),
        0,
      );
      assert.ok(
        (await page.locator(".lb-safe-row").textContent()).includes(
          "<img src=x onerror=alert(1)>",
        ),
      );
      await page
        .getByRole("button", { name: "Request manual prize review (18+)" })
        .click();
      await page
        .getByRole("link", { name: "Open WhatsApp to send your claim" })
        .waitFor();
      assert.ok(
        (await page.locator("#leaderboardModalOverlay").textContent()).includes(
          "Opening WhatsApp does not approve",
        ),
      );
      await page.screenshot({ path: `${dir}/claim-pending.png` });
      await page.keyboard.press("Escape");
    },
  );
  await check("browser and Node replay results agree", async () => {
    const actions = [{ type: "place", slot: 0, x: 0, y: 0 }, { type: "end" }];
    const expected = replay({ kind: "tournament", seed: 123 }, actions);
    const actual = await page.evaluate(async (actions) => {
      const { replay } = await import("/shared/engine.ts");
      const game = replay({ kind: "tournament", seed: 123 }, actions);
      return { score: game.score, grid: game.grid };
    }, actions);
    assert.equal(actual.score, expected.score);
    assert.deepEqual(actual.grid, expected.grid);
  });
  await check(
    "small-screen layout, reduced motion, and zoom remain usable",
    async () => {
      await page.setViewportSize({ width: 320, height: 568 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.locator("#mode-classic-btn").click();
      await page.screenshot({ path: `${dir}/small-mobile.png` });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      assert.ok(
        !(
          await page.locator("meta[name=viewport]").getAttribute("content")
        ).includes("user-scalable=no"),
      );
      await page.setViewportSize({ width: 844, height: 390 });
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: `${dir}/landscape.png` });
      assert.ok((await page.locator("#hud-overlay").boundingBox()).y >= 0);
    },
  );
  assert.deepEqual(errors, []);
  await writeFile(
    `${dir}/browser-results.json`,
    JSON.stringify(
      {
        passed: true,
        pageErrors: errors,
        submittedReplays: submitted.length,
        startedSessions: starts.size,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  await server.close();
}
