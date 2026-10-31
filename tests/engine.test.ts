import assert from "node:assert/strict";
import test from "node:test";
import {
  ENGINE_VERSION,
  GameEngine,
  replay,
  validateActions,
  type GameAction,
} from "../shared/engine";
import { canPlaceBlockAtPosition } from "../shared/mechanics";
import { LEVEL_DATA } from "../shared/levels";

export function play(seed = 123, count = 20) {
  const game = new GameEngine({ kind: "tournament", seed });
  for (let i = 0; i < count && !game.over; i++) {
    let action: GameAction | null = null;
    for (let slot = 0; slot < 3 && !action; slot++)
      if (game.tray[slot].active)
        for (let y = 0; y < 8 && !action; y++)
          for (let x = 0; x < 8 && !action; x++)
            if (canPlaceBlockAtPosition(game.grid, game.tray[slot].shape, x, y))
              action = { type: "place", slot, x, y };
    if (!action) break;
    game.apply(action);
  }
  if (!game.over) game.apply({ type: "end" });
  return game;
}
test("replays reconstruct the exact board, score, special state, and tray after adaptive deals", () => {
  for (const seed of [0, 1, 123, 0xffffffff]) {
    const original = play(seed, 30);
    const rebuilt = replay(
      original.options,
      JSON.parse(JSON.stringify(original.actions)),
    );
    assert.equal(rebuilt.score, original.score);
    assert.deepEqual(rebuilt.grid, original.grid);
    assert.deepEqual(rebuilt.tray, original.tray);
    assert.deepEqual(rebuilt.golden, original.golden);
    assert.deepEqual(rebuilt.revealed, original.revealed);
  }
  assert.equal(ENGINE_VERSION, "pilot-1");
});
test("rejects illegal, out-of-board, fractional, consumed, and post-finish moves", () => {
  const game = new GameEngine({ kind: "tournament", seed: 1 });
  assert.throws(() => game.apply({ type: "place", slot: 0, x: -1, y: 0 }));
  assert.throws(() => game.apply({ type: "place", slot: 0, x: 0.5, y: 0 }));
  game.apply({ type: "place", slot: 0, x: 0, y: 0 });
  assert.throws(() => game.apply({ type: "place", slot: 0, x: 6, y: 6 }));
  game.apply({ type: "end" });
  assert.throws(() => game.apply({ type: "place", slot: 1, x: 4, y: 4 }));
  assert.throws(() => game.apply({ type: "revive" }));
});
test("line intersections count each cell once and special multipliers and all-clear are calculated", () => {
  const game = new GameEngine({ kind: "classic", seed: 4 });
  game.grid = Array.from({ length: 8 }, () => Array(8).fill(0));
  for (let i = 0; i < 8; i++) {
    game.grid[0][i] = "#fff";
    game.grid[i][0] = "#fff";
  }
  game.grid[0][0] = 0;
  game.tray[0] = {
    shape: [[1]],
    x: 0,
    y: 0,
    color: "#fff",
    active: true,
    originalIndex: 0,
    isGolden: true,
  };
  const result = game.apply({ type: "place", slot: 0, x: 0, y: 0 });
  assert.equal(result.lines, 2);
  assert.equal(result.cleared.length, 15);
  assert.equal(result.allClear, true);
  assert.equal(game.score, 10 + (200 + 15 * 5) * 2 + 500);
});
test("levels preserve board and gems on a single permitted rescue", () => {
  const game = new GameEngine({ kind: "levels", level: 8, seed: 22 });
  const grid = structuredClone(game.grid),
    gems = [...game.gems];
  game.over = true;
  game.apply({ type: "revive" });
  assert.deepEqual(game.grid, grid);
  assert.deepEqual([...game.gems], gems);
  game.over = true;
  assert.throws(() => game.apply({ type: "revive" }));
  assert.throws(() => replay({ kind: "levels", level: 0, seed: 1 }, []));
});
test("Classic permits one replayed rescue after running out of space, with no board or score reset", () => {
  const game = new GameEngine({ kind: "classic", seed: 1 });
  const fill = () => {
    for (let i = 0; i < 300 && !game.over; i++) {
      let action: GameAction | undefined;
      for (let slot = 0; slot < 3 && !action; slot++) if (game.tray[slot].active)
        for (let y = 0; y < 8 && !action; y++) for (let x = 0; x < 8 && !action; x++)
          if (canPlaceBlockAtPosition(game.grid, game.tray[slot].shape, x, y))
            action = { type: "place", slot, x, y };
      assert.ok(action);
      game.apply(action);
    }
    assert.equal(game.over, true);
  };
  assert.throws(() => game.apply({ type: "revive" }));
  fill();
  assert.equal(game.canRevive, true);
  const board = structuredClone(game.grid), score = game.score;
  game.apply({ type: "revive" });
  assert.deepEqual(game.grid, board);
  assert.equal(game.score, score);
  assert.equal(game.over, false);
  assert.equal(game.revived, true);
  const resumed = replay(game.options, game.actions);
  assert.equal(resumed.revived, true);
  assert.deepEqual(resumed.tray, game.tray);
  fill();
  assert.equal(game.canRevive, false);
  assert.throws(() => game.apply({ type: "revive" }));
  assert.equal(replay(game.options, game.actions).canRevive, false);
  const ended = new GameEngine({ kind: "classic", seed: 1 });
  ended.apply({ type: "end" });
  assert.throws(() => ended.apply({ type: "revive" }));
});
test("levels calculate goals, efficiency bonuses, and stars through the same rules", () => {
  const game = new GameEngine({ kind: "levels", level: 1, seed: 8 });
  game.grid = Array.from({ length: 8 }, () => Array(8).fill(0));
  for (let row = 0; row < 2; row++)
    for (let col = 1; col < 8; col++) game.grid[row][col] = "#fff";
  game.tray[0] = {
    shape: [[1], [1]],
    x: 0,
    y: 0,
    color: "#fff",
    active: true,
    originalIndex: 0,
  };
  game.apply({ type: "place", slot: 0, x: 0, y: 0 });
  assert.equal(game.completed, true);
  assert.equal(game.over, true);
  assert.equal(game.stars, 3);
  assert.equal(game.score, 20 + 200 + 16 * 5 + 500 + 19 * 120);
  assert.equal(LEVEL_DATA.length * 3, 180);
});
test("strict replay parsing rejects fabricated aggregate fields and unbounded inputs", () => {
  assert.throws(() =>
    validateActions([{ type: "place", slot: 0, x: 0, y: 0, score: 99999 }]),
  );
  assert.throws(() => validateActions([{ type: "unknown" }]));
  assert.throws(() => validateActions(Array(10001).fill({ type: "end" })));
  assert.throws(() => new GameEngine({ kind: "tournament", seed: NaN }));
});
