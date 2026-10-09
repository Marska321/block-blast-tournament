import { ShapeTier } from "./blocks";

export enum GoalType {
  SCORE = "score",
  LINES = "lines",
  GEMS = "gems",
}

export interface LevelGoal {
  type: GoalType;
  target: number;
  current: number;
}

export interface PrefilledTile {
  row: number;
  col: number;
  color: string;
  isGem?: boolean;
}

export interface WorldTheme {
  name: string;
  gridBgEven: string;
  gridBgOdd: string;
  gridBorder: string;
  containerBg: string;
  accentColor: string;
  gemColor: string;
}

export const WORLD_THEMES: WorldTheme[] = [
  {
    name: "Classic Blue",
    gridBgEven: "#344a7a",
    gridBgOdd: "#18223c",
    gridBorder: "#3b82f6",
    containerBg: "#1a243a",
    accentColor: "#3b82f6",
    gemColor: "#ffd600",
  },
  {
    name: "Forest Canopy",
    gridBgEven: "#334a38",
    gridBgOdd: "#172219",
    gridBorder: "#4caf50",
    containerBg: "#121a14",
    accentColor: "#4caf50",
    gemColor: "#ffd600",
  },
  {
    name: "Ember Forge",
    gridBgEven: "#3d3947",
    gridBgOdd: "#1d1a24",
    gridBorder: "#ff7043",
    containerBg: "#17151c",
    accentColor: "#ff7043",
    gemColor: "#00e5ff",
  },
  {
    name: "Cosmic Drift",
    gridBgEven: "#3e345b",
    gridBgOdd: "#1c172a",
    gridBorder: "#b388ff",
    containerBg: "#151222",
    accentColor: "#b388ff",
    gemColor: "#00e5ff",
  },
];

export interface LevelConfig {
  level: number;
  worldIndex: number;
  gridSize: 8;
  handSize: 3;
  parMoves?: number;
  maxMoves?: number;
  goals: LevelGoal[];
  allowedTiers: ShapeTier[];
  prefilledTiles?: PrefilledTile[];
  starThresholds: [number, number, number];
}

export const LEVEL_DATA: LevelConfig[] = [
  // ==========================================
  // WORLD 1: Ocean Depths (Levels 1–5)
  // Tiers: HELPER only
  // Goal: Learn placement, line clears, introductory combos
  // ==========================================
  {
    level: 1,
    worldIndex: 0,
    gridSize: 8,
    handSize: 3,
    goals: [{ type: GoalType.LINES, target: 2, current: 0 }],
    allowedTiers: [ShapeTier.HELPER],
    starThresholds: [100, 250, 500],
  },
  {
    level: 2,
    worldIndex: 0,
    gridSize: 8,
    handSize: 3,
    goals: [{ type: GoalType.LINES, target: 3, current: 0 }],
    allowedTiers: [ShapeTier.HELPER],
    starThresholds: [150, 400, 700],
  },
  {
    level: 3,
    worldIndex: 0,
    gridSize: 8,
    handSize: 3,
    goals: [{ type: GoalType.SCORE, target: 400, current: 0 }],
    allowedTiers: [ShapeTier.HELPER],
    starThresholds: [400, 700, 1100],
  },
  {
    level: 4,
    worldIndex: 0,
    gridSize: 8,
    handSize: 3,
    goals: [{ type: GoalType.LINES, target: 4, current: 0 }],
    allowedTiers: [ShapeTier.HELPER],
    starThresholds: [250, 550, 900],
  },
  {
    level: 5,
    worldIndex: 0,
    gridSize: 8,
    handSize: 3,
    goals: [
      { type: GoalType.LINES, target: 3, current: 0 },
      { type: GoalType.SCORE, target: 500, current: 0 },
    ],
    allowedTiers: [ShapeTier.HELPER],
    starThresholds: [500, 900, 1400],
  },

  // ==========================================
  // WORLD 2: Forest Canopy (Levels 6–10)
  // Tiers: HELPER + FILLER
  // Goal: Move limits introduced, first gem blocks, obstacle tiles
  // ==========================================
  {
    level: 6,
    worldIndex: 1,
    gridSize: 8,
    handSize: 3,
    maxMoves: 25,
    goals: [{ type: GoalType.LINES, target: 5, current: 0 }],
    allowedTiers: [ShapeTier.HELPER, ShapeTier.FILLER],
    starThresholds: [400, 800, 1500],
  },
  {
    level: 7,
    worldIndex: 1,
    gridSize: 8,
    handSize: 3,
    maxMoves: 22,
    goals: [{ type: GoalType.SCORE, target: 800, current: 0 }],
    allowedTiers: [ShapeTier.HELPER, ShapeTier.FILLER],
    starThresholds: [800, 1200, 1800],
  },
  {
    level: 8,
    worldIndex: 1,
    gridSize: 8,
    handSize: 3,
    maxMoves: 20,
    goals: [{ type: GoalType.GEMS, target: 3, current: 0 }],
    allowedTiers: [ShapeTier.HELPER, ShapeTier.FILLER],
    prefilledTiles: [
      { row: 2, col: 1, color: "#66bb6a", isGem: true },
      { row: 2, col: 6, color: "#66bb6a", isGem: true },
      { row: 5, col: 3, color: "#66bb6a", isGem: true },
    ],
    starThresholds: [300, 600, 1000],
  },
  {
    level: 9,
    worldIndex: 1,
    gridSize: 8,
    handSize: 3,
    maxMoves: 22,
    goals: [
      { type: GoalType.LINES, target: 4, current: 0 },
      { type: GoalType.GEMS, target: 2, current: 0 },
    ],
    allowedTiers: [ShapeTier.HELPER, ShapeTier.FILLER],
    prefilledTiles: [
      { row: 3, col: 2, color: "#66bb6a", isGem: true },
      { row: 4, col: 5, color: "#66bb6a", isGem: true },
      { row: 1, col: 4, color: "#2e7d32" },
      { row: 6, col: 3, color: "#2e7d32" },
    ],
    starThresholds: [500, 900, 1400],
  },
  {
    level: 10,
    worldIndex: 1,
    gridSize: 8,
    handSize: 3,
    maxMoves: 20,
    goals: [
      { type: GoalType.GEMS, target: 2, current: 0 },
      { type: GoalType.LINES, target: 4, current: 0 },
    ],
    allowedTiers: [ShapeTier.HELPER, ShapeTier.FILLER],
    prefilledTiles: [
      { row: 0, col: 0, color: "#1b5e20" },
      { row: 0, col: 7, color: "#1b5e20" },
      { row: 7, col: 0, color: "#1b5e20" },
      { row: 7, col: 7, color: "#1b5e20" },
      { row: 3, col: 3, color: "#43a047", isGem: true },
      { row: 4, col: 4, color: "#43a047", isGem: true },
    ],
    starThresholds: [600, 1200, 1800],
  },

  // ==========================================
  // WORLD 3: Ember Forge (Levels 11–15)
  // Tiers: HELPER + FILLER + SPANNER
  // Goal: Long lines require clear space, tight move budgets, multi-gem clusters
  // ==========================================
  {
    level: 11,
    worldIndex: 2,
    gridSize: 8,
    handSize: 3,
    maxMoves: 20,
    goals: [
      { type: GoalType.GEMS, target: 3, current: 0 },
      { type: GoalType.LINES, target: 4, current: 0 },
    ],
    allowedTiers: [ShapeTier.HELPER, ShapeTier.FILLER, ShapeTier.SPANNER],
    prefilledTiles: [
      { row: 2, col: 2, color: "#00e5ff", isGem: true },
      { row: 3, col: 4, color: "#00e5ff", isGem: true },
      { row: 5, col: 5, color: "#00e5ff", isGem: true },
    ],
    starThresholds: [500, 1000, 1600],
  },
  {
    level: 12,
    worldIndex: 2,
    gridSize: 8,
    handSize: 3,
    maxMoves: 18,
    goals: [{ type: GoalType.GEMS, target: 4, current: 0 }],
    allowedTiers: [ShapeTier.HELPER, ShapeTier.FILLER, ShapeTier.SPANNER],
    prefilledTiles: [
      { row: 1, col: 2, color: "#00e5ff", isGem: true },
      { row: 1, col: 5, color: "#00e5ff", isGem: true },
      { row: 6, col: 2, color: "#00e5ff", isGem: true },
      { row: 6, col: 5, color: "#00e5ff", isGem: true },
    ],
    starThresholds: [500, 1000, 1600],
  },
  {
    level: 13,
    worldIndex: 2,
    gridSize: 8,
    handSize: 3,
    maxMoves: 20,
    goals: [
      { type: GoalType.GEMS, target: 4, current: 0 },
      { type: GoalType.LINES, target: 4, current: 0 },
    ],
    allowedTiers: [ShapeTier.HELPER, ShapeTier.FILLER, ShapeTier.SPANNER],
    prefilledTiles: [
      { row: 3, col: 1, color: "#00e5ff", isGem: true },
      { row: 3, col: 6, color: "#00e5ff", isGem: true },
      { row: 4, col: 1, color: "#00e5ff", isGem: true },
      { row: 4, col: 6, color: "#00e5ff", isGem: true },
    ],
    starThresholds: [600, 1200, 1800],
  },
  {
    level: 14,
    worldIndex: 2,
    gridSize: 8,
    handSize: 3,
    maxMoves: 18,
    goals: [
      { type: GoalType.GEMS, target: 4, current: 0 },
      { type: GoalType.LINES, target: 4, current: 0 },
    ],
    allowedTiers: [ShapeTier.HELPER, ShapeTier.FILLER, ShapeTier.SPANNER],
    prefilledTiles: [
      { row: 2, col: 2, color: "#00e5ff", isGem: true },
      { row: 2, col: 5, color: "#00e5ff", isGem: true },
      { row: 5, col: 2, color: "#00e5ff", isGem: true },
      { row: 5, col: 5, color: "#00e5ff", isGem: true },
      { row: 3, col: 3, color: "#374151" },
      { row: 4, col: 4, color: "#374151" },
    ],
    starThresholds: [800, 1400, 2200],
  },
  {
    level: 15,
    worldIndex: 2,
    gridSize: 8,
    handSize: 3,
    maxMoves: 16,
    goals: [
      { type: GoalType.GEMS, target: 2, current: 0 },
      { type: GoalType.LINES, target: 4, current: 0 },
    ],
    allowedTiers: [ShapeTier.HELPER, ShapeTier.FILLER, ShapeTier.SPANNER],
    prefilledTiles: [
      { row: 0, col: 3, color: "#374151" },
      { row: 0, col: 4, color: "#374151" },
      { row: 7, col: 3, color: "#374151" },
      { row: 7, col: 4, color: "#374151" },
      { row: 3, col: 0, color: "#374151" },
      { row: 4, col: 0, color: "#374151" },
      { row: 3, col: 7, color: "#374151" },
      { row: 4, col: 7, color: "#374151" },
      { row: 2, col: 3, color: "#00e5ff", isGem: true },
      { row: 5, col: 4, color: "#00e5ff", isGem: true },
    ],
    starThresholds: [700, 1400, 2200],
  },

  // ==========================================
  // WORLD 4: Cosmic Drift (Levels 16–20)
  // Tiers: ALL TIERS (CHUNK added)
  // Goal: High friction, giant 3x3s, intricate gem clearing, expert puzzles
  // ==========================================
  {
    level: 16,
    worldIndex: 3,
    gridSize: 8,
    handSize: 3,
    maxMoves: 18,
    goals: [
      { type: GoalType.LINES, target: 5, current: 0 },
      { type: GoalType.GEMS, target: 4, current: 0 },
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 1, col: 1, color: "#b388ff", isGem: true },
      { row: 1, col: 6, color: "#b388ff", isGem: true },
      { row: 6, col: 1, color: "#b388ff", isGem: true },
      { row: 6, col: 6, color: "#b388ff", isGem: true },
      { row: 3, col: 3, color: "#4a148c" },
      { row: 3, col: 4, color: "#4a148c" },
      { row: 4, col: 3, color: "#4a148c" },
      { row: 4, col: 4, color: "#4a148c" },
    ],
    starThresholds: [800, 1500, 2500],
  },
  {
    level: 17,
    worldIndex: 3,
    gridSize: 8,
    handSize: 3,
    maxMoves: 16,
    goals: [{ type: GoalType.GEMS, target: 5, current: 0 }],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 0, col: 2, color: "#b388ff", isGem: true },
      { row: 0, col: 5, color: "#b388ff", isGem: true },
      { row: 3, col: 3, color: "#b388ff", isGem: true },
      { row: 7, col: 2, color: "#b388ff", isGem: true },
      { row: 7, col: 5, color: "#b388ff", isGem: true },
      { row: 2, col: 0, color: "#7c4dff" },
      { row: 5, col: 7, color: "#7c4dff" },
    ],
    starThresholds: [700, 1400, 2300],
  },
  {
    level: 18,
    worldIndex: 3,
    gridSize: 8,
    handSize: 3,
    maxMoves: 16,
    goals: [
      { type: GoalType.GEMS, target: 4, current: 0 },
      { type: GoalType.LINES, target: 5, current: 0 },
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 2, col: 3, color: "#b388ff", isGem: true },
      { row: 2, col: 4, color: "#b388ff", isGem: true },
      { row: 5, col: 3, color: "#b388ff", isGem: true },
      { row: 5, col: 4, color: "#b388ff", isGem: true },
      { row: 3, col: 2, color: "#7c4dff" },
      { row: 4, col: 5, color: "#7c4dff" },
    ],
    starThresholds: [800, 1600, 2600],
  },
  {
    level: 19,
    worldIndex: 3,
    gridSize: 8,
    handSize: 3,
    maxMoves: 15,
    goals: [
      { type: GoalType.GEMS, target: 6, current: 0 },
      { type: GoalType.LINES, target: 5, current: 0 },
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 1, col: 2, color: "#b388ff", isGem: true },
      { row: 1, col: 5, color: "#b388ff", isGem: true },
      { row: 3, col: 1, color: "#b388ff", isGem: true },
      { row: 3, col: 6, color: "#b388ff", isGem: true },
      { row: 6, col: 2, color: "#b388ff", isGem: true },
      { row: 6, col: 5, color: "#b388ff", isGem: true },
      { row: 4, col: 3, color: "#311b92" },
      { row: 4, col: 4, color: "#311b92" },
    ],
    starThresholds: [1200, 2000, 3000],
  },
  {
    level: 20,
    worldIndex: 3,
    gridSize: 8,
    handSize: 3,
    maxMoves: 14,
    goals: [
      { type: GoalType.SCORE, target: 2000, current: 0 },
      { type: GoalType.GEMS, target: 4, current: 0 },
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 0, col: 0, color: "#b388ff", isGem: true },
      { row: 0, col: 7, color: "#b388ff", isGem: true },
      { row: 7, col: 0, color: "#b388ff", isGem: true },
      { row: 7, col: 7, color: "#b388ff", isGem: true },
      { row: 3, col: 2, color: "#512da8" },
      { row: 3, col: 5, color: "#512da8" },
      { row: 4, col: 2, color: "#512da8" },
      { row: 4, col: 5, color: "#512da8" },
    ],
    starThresholds: [2000, 2800, 3800],
  },
];

const PROGRESS_KEY = "bbt_level_progress";

export interface LevelProgressRecord {
  stars: number;
  bestScore: number;
  completed: boolean;
}

export type LevelProgressMap = Record<number, LevelProgressRecord>;

export class LevelProgressManager {
  private progress: LevelProgressMap = {};

  constructor() {
    this.load();
  }

  private load() {
    try {
      const saved = localStorage.getItem(PROGRESS_KEY);
      if (saved) {
        this.progress = JSON.parse(saved);
      }
    } catch {
      this.progress = {};
    }
  }

  private save() {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(this.progress));
    } catch {
      // Storage full or disabled
    }
  }

  public getHighestUnlocked(): number {
    let highest = 1;
    for (const [lvlStr, data] of Object.entries(this.progress)) {
      const lvl = parseInt(lvlStr, 10);
      if (data.completed && lvl >= highest) {
        highest = lvl + 1;
      }
    }
    return Math.min(highest, LEVEL_DATA.length);
  }

  public getLevelProgress(level: number): LevelProgressRecord {
    return this.progress[level] || { stars: 0, bestScore: 0, completed: false };
  }

  public completeLevel(level: number, score: number, stars: number) {
    const existing = this.progress[level];
    this.progress[level] = {
      stars: Math.max(existing?.stars || 0, stars),
      bestScore: Math.max(existing?.bestScore || 0, score),
      completed: true,
    };
    this.save();
  }

  public getTotalStars(): number {
    return Object.values(this.progress).reduce((sum, p) => sum + (p.stars || 0), 0);
  }

  public calculateStars(score: number, thresholds: [number, number, number]): number {
    if (score >= thresholds[2]) return 3;
    if (score >= thresholds[1]) return 2;
    if (score >= thresholds[0]) return 1;
    return 1; // Passing the level awards at least 1 star
  }

  public resetProgress() {
    this.progress = {};
    localStorage.removeItem(PROGRESS_KEY);
  }
}

export const levelProgress = new LevelProgressManager();
