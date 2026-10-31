import { countBlocks, ShapeTier, type TrayBlock } from "./blocks.js";
import { createRNG, type PRNG } from "./prng.js";
import {
  canPlaceAnyBlock,
  canPlaceBlockAtPosition,
  createTrayBlocks,
} from "./mechanics.js";
import { GoalType, LEVEL_DATA, type LevelGoal } from "./levels.js";

export const ENGINE_VERSION = "pilot-1";
export const MAX_ACTIONS = 10000;
export type GameKind = "classic" | "tournament" | "levels";
export type GameAction =
  | { type: "place"; slot: number; x: number; y: number }
  | { type: "revive" }
  | { type: "end" };
export interface GameOptions {
  kind: GameKind;
  seed: number;
  level?: number;
}
export interface MoveResult {
  points: number;
  lines: number;
  gems: number;
  allClear: boolean;
  rows: number[];
  cols: number[];
  cleared: string[];
}

/** Rules only: no DOM, clock, storage, networking, or cosmetic random calls. */
export class GameEngine {
  readonly options: GameOptions;
  readonly rng: PRNG;
  grid: (string | 0)[][];
  tray: TrayBlock[] = [];
  actions: GameAction[] = [];
  score = 0;
  combo = 0;
  maxCombo = 0;
  moves = 0;
  lines = 0;
  over = false;
  completed = false;
  revived = false;
  goals: LevelGoal[] = [];
  gems = new Set<string>();
  obstacles = new Set<string>();
  glowing = new Set<string>();
  golden = new Set<string>();
  revealed = new Set<string>();
  private specialDeal = false;

  constructor(options: GameOptions) {
    if (
      !Number.isSafeInteger(options.seed) ||
      options.seed < 0 ||
      options.seed > 0xffffffff
    )
      throw new Error("Invalid seed");
    if (!["classic", "tournament", "levels"].includes(options.kind))
      throw new Error("Invalid mode");
    if (
      options.kind === "levels" &&
      (!Number.isInteger(options.level) || !LEVEL_DATA[options.level! - 1])
    )
      throw new Error("Invalid level");
    this.options = { ...options };
    this.rng = createRNG(options.seed);
    this.grid = Array.from({ length: 8 }, () => Array<string | 0>(8).fill(0));
    if (this.level) {
      this.goals = this.level.goals.map((g) => ({ ...g, current: 0 }));
      for (const tile of this.level.prefilledTiles || []) {
        this.grid[tile.row][tile.col] = tile.color;
        (tile.isGem ? this.gems : this.obstacles).add(
          `${tile.col},${tile.row}`,
        );
      }
    }
    this.deal();
  }

  get level() {
    return this.options.kind === "levels"
      ? LEVEL_DATA[this.options.level! - 1]
      : undefined;
  }
  get stars() {
    if (!this.completed || !this.level) return 0;
    const t = this.level.starThresholds;
    return this.score >= t[2] ? 3 : this.score >= t[1] ? 2 : 1;
  }

  get canRevive() {
    return this.options.kind !== "tournament" && this.over &&
      !this.completed && !this.revived &&
      this.actions.at(-1)?.type !== "end" &&
      this.grid.some((row) => row.some((cell) => cell === 0));
  }

  private deal(rescue = false) {
    createTrayBlocks({
      availableBlocks: this.tray,
      canvasWidth: 400,
      trayY: 0,
      trayH: 120,
      rng: this.rng,
      handSize: 3,
      grid: this.grid,
      blocksPlaced: this.moves,
      allowedTiers: rescue ? [ShapeTier.HELPER] : this.level?.allowedTiers,
      maxMoves: this.level?.maxMoves,
      isSpecialDeal: rescue || this.specialDeal,
    });
    this.specialDeal = false;
  }

  apply(action: GameAction): MoveResult {
    if (this.actions.length >= MAX_ACTIONS)
      throw new Error("Run action limit reached");
    const result: MoveResult = {
      points: 0,
      lines: 0,
      gems: 0,
      allClear: false,
      rows: [],
      cols: [],
      cleared: [],
    };
    if (action.type === "revive") {
      if (!this.canRevive)
        throw new Error("Revive unavailable");
      this.revived = true;
      this.over = false;
      this.deal(true);
    } else if (action.type === "end") {
      if (this.over || this.level) throw new Error("Cannot end this run");
      this.over = true;
    } else if (action.type === "place") {
      if (this.over) throw new Error("Run already finished");
      const { slot, x, y } = action;
      if (![slot, x, y].every(Number.isInteger) || slot < 0 || slot > 2)
        throw new Error("Invalid placement");
      const piece = this.tray[slot];
      if (
        !piece?.active ||
        !canPlaceBlockAtPosition(this.grid, piece.shape, x, y)
      )
        throw new Error("Illegal placement");
      for (let dy = 0; dy < piece.shape.length; dy++)
        for (let dx = 0; dx < piece.shape[dy].length; dx++) {
          if (!piece.shape[dy][dx]) continue;
          this.grid[y + dy][x + dx] = piece.color;
          if (piece.isGolden) this.golden.add(`${x + dx},${y + dy}`);
          if (piece.isGlowing) this.glowing.add(`${x + dx},${y + dy}`);
        }
      piece.active = false;
      this.moves++;
      for (let row = 0; row < 8; row++)
        if (this.grid[row].every(Boolean)) result.rows.push(row);
      for (let col = 0; col < 8; col++)
        if (this.grid.every((row) => Boolean(row[col]))) result.cols.push(col);
      const cleared = new Set<string>();
      for (const row of result.rows)
        for (let col = 0; col < 8; col++) cleared.add(`${col},${row}`);
      for (const col of result.cols)
        for (let row = 0; row < 8; row++) cleared.add(`${col},${row}`);
      const multiplier = [...cleared].some((k) => this.golden.has(k))
        ? 2
        : [...cleared].some((k) => this.glowing.has(k))
          ? 1.5
          : 1;
      for (const key of cleared) {
        const [cx, cy] = key.split(",").map(Number);
        if (this.gems.delete(key)) result.gems++;
        this.obstacles.delete(key);
        this.golden.delete(key);
        this.glowing.delete(key);
        this.revealed.add(key);
        this.grid[cy][cx] = 0;
      }
      result.cleared = [...cleared];
      result.lines = result.rows.length + result.cols.length;
      this.lines += result.lines;
      this.combo = result.lines ? this.combo + 1 : 0;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      result.allClear =
        result.lines > 0 &&
        this.grid.every((row) => row.every((cell) => cell === 0));
      result.points = countBlocks(piece.shape) * 10;
      if (result.lines)
        result.points += Math.round(
          (result.lines * 100 * this.combo + cleared.size * 5) * multiplier,
        );
      if (result.allClear) result.points += 500;
      this.score += result.points;
      if (result.allClear || this.combo >= 4) this.specialDeal = true;
      for (const goal of this.goals) {
        if (goal.type === GoalType.SCORE) goal.current = this.score;
        if (goal.type === GoalType.LINES) goal.current += result.lines;
        if (goal.type === GoalType.GEMS) goal.current += result.gems;
      }
      if (this.level && this.goals.every((g) => g.current >= g.target)) {
        this.completed = this.over = true;
        const bonus =
          Math.max(
            0,
            (this.level.parMoves || this.level.maxMoves || 20) - this.moves,
          ) * 120;
        this.score += bonus;
        result.points += bonus;
      }
      if (!this.over && this.tray.every((p) => !p.active)) this.deal();
      if (
        !this.over &&
        !canPlaceAnyBlock({ grid: this.grid, availableBlocks: this.tray })
      )
        this.over = true;
    } else throw new Error("Unknown action");
    this.actions.push({ ...action });
    return result;
  }
}

export function validateActions(value: unknown): asserts value is GameAction[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_ACTIONS)
    throw new Error("Invalid actions");
  for (const action of value) {
    if (
      !action ||
      typeof action !== "object" ||
      !["place", "revive", "end"].includes(action.type)
    )
      throw new Error("Invalid action");
    const keys = Object.keys(action).sort().join(",");
    if (keys !== (action.type === "place" ? "slot,type,x,y" : "type"))
      throw new Error("Unexpected action fields");
  }
}

export function replay(options: GameOptions, actions: GameAction[]) {
  if (actions.length) validateActions(actions);
  const game = new GameEngine(options);
  for (const action of actions) game.apply(action);
  return game;
}
