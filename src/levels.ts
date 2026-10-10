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
  {
    name: "Golden Oasis",
    gridBgEven: "#4a3b1a",
    gridBgOdd: "#261d0a",
    gridBorder: "#f59e0b",
    containerBg: "#1c1405",
    accentColor: "#f59e0b",
    gemColor: "#ec4899",
  },
  {
    name: "Sakura Blossom",
    gridBgEven: "#4a192c",
    gridBgOdd: "#230a14",
    gridBorder: "#f472b6",
    containerBg: "#19060e",
    accentColor: "#f472b6",
    gemColor: "#38bdf8",
  },
  {
    name: "Ocean Abyss",
    gridBgEven: "#064e3b",
    gridBgOdd: "#022019",
    gridBorder: "#10b981",
    containerBg: "#01140f",
    accentColor: "#10b981",
    gemColor: "#fbbf24",
  },
  {
    name: "Neon Cyberpunk",
    gridBgEven: "#4c0519",
    gridBgOdd: "#18020a",
    gridBorder: "#f43f5e",
    containerBg: "#120107",
    accentColor: "#f43f5e",
    gemColor: "#a855f7",
  },
  {
    name: "Bakery Cafe",
    gridBgEven: "#452618",
    gridBgOdd: "#24130a",
    gridBorder: "#d97706",
    containerBg: "#1a0c06",
    accentColor: "#d97706",
    gemColor: "#38bdf8",
  },
  {
    name: "Frostbite Glacier",
    gridBgEven: "#1e3a5f",
    gridBgOdd: "#0b1d33",
    gridBorder: "#38bdf8",
    containerBg: "#061324",
    accentColor: "#38bdf8",
    gemColor: "#f43f5e",
  },
  {
    name: "Obsidian Core",
    gridBgEven: "#292524",
    gridBgOdd: "#141211",
    gridBorder: "#a8a29e",
    containerBg: "#0c0a09",
    accentColor: "#a8a29e",
    gemColor: "#22c55e",
  },
  {
    name: "Celestial Aurora",
    gridBgEven: "#312e81",
    gridBgOdd: "#171442",
    gridBorder: "#818cf8",
    containerBg: "#0e0c29",
    accentColor: "#818cf8",
    gemColor: "#ffd600",
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

  // ==========================================
  // WORLD 5: Golden Oasis (Levels 21–25)
  // ==========================================
  {
    level: 21,
    worldIndex: 4,
    gridSize: 8,
    handSize: 3,
    maxMoves: 18,
    goals: [
      { type: GoalType.LINES, target: 5, current: 0 },
      { type: GoalType.GEMS, target: 4, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 2, col: 2, color: "#ec4899", isGem: true },
      { row: 2, col: 5, color: "#ec4899", isGem: true },
      { row: 5, col: 2, color: "#ec4899", isGem: true },
      { row: 5, col: 5, color: "#ec4899", isGem: true },
      { row: 3, col: 3, color: "#b45309" },
      { row: 4, col: 4, color: "#b45309" },
    ],
    starThresholds: [2670, 4410, 6660],
  },
  {
    level: 22,
    worldIndex: 4,
    gridSize: 8,
    handSize: 3,
    maxMoves: 18,
    goals: [
      { type: GoalType.SCORE, target: 2820, current: 0 },
      { type: GoalType.GEMS, target: 4, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 1, col: 3, color: "#ec4899", isGem: true },
      { row: 1, col: 4, color: "#ec4899", isGem: true },
      { row: 6, col: 3, color: "#ec4899", isGem: true },
      { row: 6, col: 4, color: "#ec4899", isGem: true },
      { row: 3, col: 1, color: "#f59e0b" },
      { row: 4, col: 6, color: "#f59e0b" },
    ],
    starThresholds: [2740, 4520, 6820],
  },
  {
    level: 23,
    worldIndex: 4,
    gridSize: 8,
    handSize: 3,
    maxMoves: 17,
    goals: [
      { type: GoalType.LINES, target: 6, current: 0 },
      { type: GoalType.SCORE, target: 3095, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 2, col: 3, color: "#ec4899", isGem: true },
      { row: 3, col: 5, color: "#ec4899", isGem: true },
      { row: 5, col: 4, color: "#ec4899", isGem: true },
      { row: 4, col: 2, color: "#ec4899", isGem: true },
      { row: 3, col: 3, color: "#b45309" },
      { row: 4, col: 4, color: "#b45309" },
    ],
    starThresholds: [2810, 4630, 6980],
  },
  {
    level: 24,
    worldIndex: 4,
    gridSize: 8,
    handSize: 3,
    maxMoves: 16,
    goals: [
      { type: GoalType.GEMS, target: 4, current: 0 },
      { type: GoalType.LINES, target: 6, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 1, col: 1, color: "#ec4899", isGem: true },
      { row: 1, col: 6, color: "#ec4899", isGem: true },
      { row: 6, col: 1, color: "#ec4899", isGem: true },
      { row: 6, col: 6, color: "#ec4899", isGem: true },
      { row: 2, col: 2, color: "#b45309" },
      { row: 5, col: 5, color: "#b45309" },
    ],
    starThresholds: [2880, 4740, 7140],
  },
  {
    level: 25,
    worldIndex: 4,
    gridSize: 8,
    handSize: 3,
    maxMoves: 15,
    goals: [
      { type: GoalType.SCORE, target: 4200, current: 0 },
      { type: GoalType.GEMS, target: 4, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 3, col: 3, color: "#ec4899", isGem: true },
      { row: 3, col: 4, color: "#ec4899", isGem: true },
      { row: 4, col: 3, color: "#ec4899", isGem: true },
      { row: 4, col: 4, color: "#ec4899", isGem: true },
      { row: 1, col: 3, color: "#f59e0b" },
      { row: 6, col: 4, color: "#f59e0b" },
    ],
    starThresholds: [2950, 4850, 7300],
  },

  // ==========================================
  // WORLD 6: Sakura Blossom (Levels 26–30)
  // ==========================================
  {
    level: 26,
    worldIndex: 5,
    gridSize: 8,
    handSize: 3,
    maxMoves: 18,
    goals: [
      { type: GoalType.LINES, target: 5, current: 0 },
      { type: GoalType.GEMS, target: 4, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 2, col: 2, color: "#38bdf8", isGem: true },
      { row: 2, col: 5, color: "#38bdf8", isGem: true },
      { row: 5, col: 2, color: "#38bdf8", isGem: true },
      { row: 5, col: 5, color: "#38bdf8", isGem: true },
      { row: 3, col: 3, color: "#be185d" },
      { row: 4, col: 4, color: "#be185d" },
    ],
    starThresholds: [3020, 4960, 7460],
  },
  {
    level: 27,
    worldIndex: 5,
    gridSize: 8,
    handSize: 3,
    maxMoves: 18,
    goals: [
      { type: GoalType.SCORE, target: 3120, current: 0 },
      { type: GoalType.GEMS, target: 4, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 1, col: 3, color: "#38bdf8", isGem: true },
      { row: 1, col: 4, color: "#38bdf8", isGem: true },
      { row: 6, col: 3, color: "#38bdf8", isGem: true },
      { row: 6, col: 4, color: "#38bdf8", isGem: true },
      { row: 3, col: 1, color: "#f472b6" },
      { row: 4, col: 6, color: "#f472b6" },
    ],
    starThresholds: [3090, 5070, 7620],
  },
  {
    level: 28,
    worldIndex: 5,
    gridSize: 8,
    handSize: 3,
    maxMoves: 17,
    goals: [
      { type: GoalType.LINES, target: 6, current: 0 },
      { type: GoalType.SCORE, target: 3420, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 2, col: 3, color: "#38bdf8", isGem: true },
      { row: 3, col: 5, color: "#38bdf8", isGem: true },
      { row: 5, col: 4, color: "#38bdf8", isGem: true },
      { row: 4, col: 2, color: "#38bdf8", isGem: true },
      { row: 3, col: 3, color: "#be185d" },
      { row: 4, col: 4, color: "#be185d" },
    ],
    starThresholds: [3160, 5180, 7780],
  },
  {
    level: 29,
    worldIndex: 5,
    gridSize: 8,
    handSize: 3,
    maxMoves: 16,
    goals: [
      { type: GoalType.GEMS, target: 4, current: 0 },
      { type: GoalType.LINES, target: 6, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 1, col: 1, color: "#38bdf8", isGem: true },
      { row: 1, col: 6, color: "#38bdf8", isGem: true },
      { row: 6, col: 1, color: "#38bdf8", isGem: true },
      { row: 6, col: 6, color: "#38bdf8", isGem: true },
      { row: 2, col: 2, color: "#be185d" },
      { row: 5, col: 5, color: "#be185d" },
    ],
    starThresholds: [3230, 5290, 7940],
  },
  {
    level: 30,
    worldIndex: 5,
    gridSize: 8,
    handSize: 3,
    maxMoves: 15,
    goals: [
      { type: GoalType.SCORE, target: 4600, current: 0 },
      { type: GoalType.GEMS, target: 4, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 3, col: 3, color: "#38bdf8", isGem: true },
      { row: 3, col: 4, color: "#38bdf8", isGem: true },
      { row: 4, col: 3, color: "#38bdf8", isGem: true },
      { row: 4, col: 4, color: "#38bdf8", isGem: true },
      { row: 1, col: 3, color: "#f472b6" },
      { row: 6, col: 4, color: "#f472b6" },
    ],
    starThresholds: [3300, 5400, 8100],
  },

  // ==========================================
  // WORLD 7: Ocean Abyss (Levels 31–35)
  // ==========================================
  {
    level: 31,
    worldIndex: 6,
    gridSize: 8,
    handSize: 3,
    maxMoves: 18,
    goals: [
      { type: GoalType.LINES, target: 6, current: 0 },
      { type: GoalType.GEMS, target: 4, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 2, col: 2, color: "#fbbf24", isGem: true },
      { row: 2, col: 5, color: "#fbbf24", isGem: true },
      { row: 5, col: 2, color: "#fbbf24", isGem: true },
      { row: 5, col: 5, color: "#fbbf24", isGem: true },
      { row: 3, col: 3, color: "#047857" },
      { row: 4, col: 4, color: "#047857" },
    ],
    starThresholds: [3370, 5510, 8260],
  },
  {
    level: 32,
    worldIndex: 6,
    gridSize: 8,
    handSize: 3,
    maxMoves: 18,
    goals: [
      { type: GoalType.SCORE, target: 3420, current: 0 },
      { type: GoalType.GEMS, target: 4, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 1, col: 3, color: "#fbbf24", isGem: true },
      { row: 1, col: 4, color: "#fbbf24", isGem: true },
      { row: 6, col: 3, color: "#fbbf24", isGem: true },
      { row: 6, col: 4, color: "#fbbf24", isGem: true },
      { row: 3, col: 1, color: "#10b981" },
      { row: 4, col: 6, color: "#10b981" },
    ],
    starThresholds: [3440, 5620, 8420],
  },
  {
    level: 33,
    worldIndex: 6,
    gridSize: 8,
    handSize: 3,
    maxMoves: 17,
    goals: [
      { type: GoalType.LINES, target: 7, current: 0 },
      { type: GoalType.SCORE, target: 3745, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 2, col: 3, color: "#fbbf24", isGem: true },
      { row: 3, col: 5, color: "#fbbf24", isGem: true },
      { row: 5, col: 4, color: "#fbbf24", isGem: true },
      { row: 4, col: 2, color: "#fbbf24", isGem: true },
      { row: 3, col: 3, color: "#047857" },
      { row: 4, col: 4, color: "#047857" },
    ],
    starThresholds: [3510, 5730, 8580],
  },
  {
    level: 34,
    worldIndex: 6,
    gridSize: 8,
    handSize: 3,
    maxMoves: 16,
    goals: [
      { type: GoalType.GEMS, target: 4, current: 0 },
      { type: GoalType.LINES, target: 7, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 1, col: 1, color: "#fbbf24", isGem: true },
      { row: 1, col: 6, color: "#fbbf24", isGem: true },
      { row: 6, col: 1, color: "#fbbf24", isGem: true },
      { row: 6, col: 6, color: "#fbbf24", isGem: true },
      { row: 2, col: 2, color: "#047857" },
      { row: 5, col: 5, color: "#047857" },
    ],
    starThresholds: [3580, 5840, 8740],
  },
  {
    level: 35,
    worldIndex: 6,
    gridSize: 8,
    handSize: 3,
    maxMoves: 15,
    goals: [
      { type: GoalType.SCORE, target: 5000, current: 0 },
      { type: GoalType.GEMS, target: 4, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 3, col: 3, color: "#fbbf24", isGem: true },
      { row: 3, col: 4, color: "#fbbf24", isGem: true },
      { row: 4, col: 3, color: "#fbbf24", isGem: true },
      { row: 4, col: 4, color: "#fbbf24", isGem: true },
      { row: 1, col: 3, color: "#10b981" },
      { row: 6, col: 4, color: "#10b981" },
    ],
    starThresholds: [3650, 5950, 8900],
  },

  // ==========================================
  // WORLD 8: Neon Cyberpunk (Levels 36–40)
  // ==========================================
  {
    level: 36,
    worldIndex: 7,
    gridSize: 8,
    handSize: 3,
    maxMoves: 17,
    goals: [
      { type: GoalType.LINES, target: 6, current: 0 },
      { type: GoalType.GEMS, target: 4, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 2, col: 2, color: "#a855f7", isGem: true },
      { row: 2, col: 5, color: "#a855f7", isGem: true },
      { row: 5, col: 2, color: "#a855f7", isGem: true },
      { row: 5, col: 5, color: "#a855f7", isGem: true },
      { row: 3, col: 3, color: "#9f1239" },
      { row: 4, col: 4, color: "#9f1239" },
    ],
    starThresholds: [3720, 6060, 9060],
  },
  {
    level: 37,
    worldIndex: 7,
    gridSize: 8,
    handSize: 3,
    maxMoves: 17,
    goals: [
      { type: GoalType.SCORE, target: 3720, current: 0 },
      { type: GoalType.GEMS, target: 4, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 1, col: 3, color: "#a855f7", isGem: true },
      { row: 1, col: 4, color: "#a855f7", isGem: true },
      { row: 6, col: 3, color: "#a855f7", isGem: true },
      { row: 6, col: 4, color: "#a855f7", isGem: true },
      { row: 3, col: 1, color: "#f43f5e" },
      { row: 4, col: 6, color: "#f43f5e" },
    ],
    starThresholds: [3790, 6170, 9220],
  },
  {
    level: 38,
    worldIndex: 7,
    gridSize: 8,
    handSize: 3,
    maxMoves: 16,
    goals: [
      { type: GoalType.LINES, target: 7, current: 0 },
      { type: GoalType.SCORE, target: 4070, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 2, col: 3, color: "#a855f7", isGem: true },
      { row: 3, col: 5, color: "#a855f7", isGem: true },
      { row: 5, col: 4, color: "#a855f7", isGem: true },
      { row: 4, col: 2, color: "#a855f7", isGem: true },
      { row: 3, col: 3, color: "#9f1239" },
      { row: 4, col: 4, color: "#9f1239" },
    ],
    starThresholds: [3860, 6280, 9380],
  },
  {
    level: 39,
    worldIndex: 7,
    gridSize: 8,
    handSize: 3,
    maxMoves: 15,
    goals: [
      { type: GoalType.GEMS, target: 4, current: 0 },
      { type: GoalType.LINES, target: 7, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 1, col: 1, color: "#a855f7", isGem: true },
      { row: 1, col: 6, color: "#a855f7", isGem: true },
      { row: 6, col: 1, color: "#a855f7", isGem: true },
      { row: 6, col: 6, color: "#a855f7", isGem: true },
      { row: 2, col: 2, color: "#9f1239" },
      { row: 5, col: 5, color: "#9f1239" },
    ],
    starThresholds: [3930, 6390, 9540],
  },
  {
    level: 40,
    worldIndex: 7,
    gridSize: 8,
    handSize: 3,
    maxMoves: 14,
    goals: [
      { type: GoalType.SCORE, target: 5400, current: 0 },
      { type: GoalType.GEMS, target: 4, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 3, col: 3, color: "#a855f7", isGem: true },
      { row: 3, col: 4, color: "#a855f7", isGem: true },
      { row: 4, col: 3, color: "#a855f7", isGem: true },
      { row: 4, col: 4, color: "#a855f7", isGem: true },
      { row: 1, col: 3, color: "#f43f5e" },
      { row: 6, col: 4, color: "#f43f5e" },
    ],
    starThresholds: [4000, 6500, 9700],
  },

  // ==========================================
  // WORLD 9: Bakery Cafe (Levels 41–45)
  // ==========================================
  {
    level: 41,
    worldIndex: 8,
    gridSize: 8,
    handSize: 3,
    maxMoves: 17,
    goals: [
      { type: GoalType.LINES, target: 7, current: 0 },
      { type: GoalType.GEMS, target: 4, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 2, col: 2, color: "#38bdf8", isGem: true },
      { row: 2, col: 5, color: "#38bdf8", isGem: true },
      { row: 5, col: 2, color: "#38bdf8", isGem: true },
      { row: 5, col: 5, color: "#38bdf8", isGem: true },
      { row: 3, col: 3, color: "#78350f" },
      { row: 4, col: 4, color: "#78350f" },
    ],
    starThresholds: [4070, 6610, 9860],
  },
  {
    level: 42,
    worldIndex: 8,
    gridSize: 8,
    handSize: 3,
    maxMoves: 17,
    goals: [
      { type: GoalType.SCORE, target: 4020, current: 0 },
      { type: GoalType.GEMS, target: 4, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 1, col: 3, color: "#38bdf8", isGem: true },
      { row: 1, col: 4, color: "#38bdf8", isGem: true },
      { row: 6, col: 3, color: "#38bdf8", isGem: true },
      { row: 6, col: 4, color: "#38bdf8", isGem: true },
      { row: 3, col: 1, color: "#d97706" },
      { row: 4, col: 6, color: "#d97706" },
    ],
    starThresholds: [4140, 6720, 10020],
  },
  {
    level: 43,
    worldIndex: 8,
    gridSize: 8,
    handSize: 3,
    maxMoves: 16,
    goals: [
      { type: GoalType.LINES, target: 8, current: 0 },
      { type: GoalType.SCORE, target: 4395, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 2, col: 3, color: "#38bdf8", isGem: true },
      { row: 3, col: 5, color: "#38bdf8", isGem: true },
      { row: 5, col: 4, color: "#38bdf8", isGem: true },
      { row: 4, col: 2, color: "#38bdf8", isGem: true },
      { row: 3, col: 3, color: "#78350f" },
      { row: 4, col: 4, color: "#78350f" },
    ],
    starThresholds: [4210, 6830, 10180],
  },
  {
    level: 44,
    worldIndex: 8,
    gridSize: 8,
    handSize: 3,
    maxMoves: 15,
    goals: [
      { type: GoalType.GEMS, target: 4, current: 0 },
      { type: GoalType.LINES, target: 8, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 1, col: 1, color: "#38bdf8", isGem: true },
      { row: 1, col: 6, color: "#38bdf8", isGem: true },
      { row: 6, col: 1, color: "#38bdf8", isGem: true },
      { row: 6, col: 6, color: "#38bdf8", isGem: true },
      { row: 2, col: 2, color: "#78350f" },
      { row: 5, col: 5, color: "#78350f" },
    ],
    starThresholds: [4280, 6940, 10340],
  },
  {
    level: 45,
    worldIndex: 8,
    gridSize: 8,
    handSize: 3,
    maxMoves: 14,
    goals: [
      { type: GoalType.SCORE, target: 5800, current: 0 },
      { type: GoalType.GEMS, target: 4, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 3, col: 3, color: "#38bdf8", isGem: true },
      { row: 3, col: 4, color: "#38bdf8", isGem: true },
      { row: 4, col: 3, color: "#38bdf8", isGem: true },
      { row: 4, col: 4, color: "#38bdf8", isGem: true },
      { row: 1, col: 3, color: "#d97706" },
      { row: 6, col: 4, color: "#d97706" },
    ],
    starThresholds: [4350, 7050, 10500],
  },

  // ==========================================
  // WORLD 10: Frostbite Glacier (Levels 46–50)
  // ==========================================
  {
    level: 46,
    worldIndex: 9,
    gridSize: 8,
    handSize: 3,
    maxMoves: 16,
    goals: [
      { type: GoalType.LINES, target: 7, current: 0 },
      { type: GoalType.GEMS, target: 4, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 2, col: 2, color: "#f43f5e", isGem: true },
      { row: 2, col: 5, color: "#f43f5e", isGem: true },
      { row: 5, col: 2, color: "#f43f5e", isGem: true },
      { row: 5, col: 5, color: "#f43f5e", isGem: true },
      { row: 3, col: 3, color: "#0369a1" },
      { row: 4, col: 4, color: "#0369a1" },
    ],
    starThresholds: [4420, 7160, 10660],
  },
  {
    level: 47,
    worldIndex: 9,
    gridSize: 8,
    handSize: 3,
    maxMoves: 16,
    goals: [
      { type: GoalType.SCORE, target: 4320, current: 0 },
      { type: GoalType.GEMS, target: 4, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 1, col: 3, color: "#f43f5e", isGem: true },
      { row: 1, col: 4, color: "#f43f5e", isGem: true },
      { row: 6, col: 3, color: "#f43f5e", isGem: true },
      { row: 6, col: 4, color: "#f43f5e", isGem: true },
      { row: 3, col: 1, color: "#38bdf8" },
      { row: 4, col: 6, color: "#38bdf8" },
    ],
    starThresholds: [4490, 7270, 10820],
  },
  {
    level: 48,
    worldIndex: 9,
    gridSize: 8,
    handSize: 3,
    maxMoves: 15,
    goals: [
      { type: GoalType.LINES, target: 8, current: 0 },
      { type: GoalType.SCORE, target: 4720, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 2, col: 3, color: "#f43f5e", isGem: true },
      { row: 3, col: 5, color: "#f43f5e", isGem: true },
      { row: 5, col: 4, color: "#f43f5e", isGem: true },
      { row: 4, col: 2, color: "#f43f5e", isGem: true },
      { row: 3, col: 3, color: "#0369a1" },
      { row: 4, col: 4, color: "#0369a1" },
    ],
    starThresholds: [4560, 7380, 10980],
  },
  {
    level: 49,
    worldIndex: 9,
    gridSize: 8,
    handSize: 3,
    maxMoves: 14,
    goals: [
      { type: GoalType.GEMS, target: 4, current: 0 },
      { type: GoalType.LINES, target: 8, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 1, col: 1, color: "#f43f5e", isGem: true },
      { row: 1, col: 6, color: "#f43f5e", isGem: true },
      { row: 6, col: 1, color: "#f43f5e", isGem: true },
      { row: 6, col: 6, color: "#f43f5e", isGem: true },
      { row: 2, col: 2, color: "#0369a1" },
      { row: 5, col: 5, color: "#0369a1" },
    ],
    starThresholds: [4630, 7490, 11140],
  },
  {
    level: 50,
    worldIndex: 9,
    gridSize: 8,
    handSize: 3,
    maxMoves: 13,
    goals: [
      { type: GoalType.SCORE, target: 6200, current: 0 },
      { type: GoalType.GEMS, target: 4, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 3, col: 3, color: "#f43f5e", isGem: true },
      { row: 3, col: 4, color: "#f43f5e", isGem: true },
      { row: 4, col: 3, color: "#f43f5e", isGem: true },
      { row: 4, col: 4, color: "#f43f5e", isGem: true },
      { row: 1, col: 3, color: "#38bdf8" },
      { row: 6, col: 4, color: "#38bdf8" },
    ],
    starThresholds: [4700, 7600, 11300],
  },

  // ==========================================
  // WORLD 11: Obsidian Core (Levels 51–55)
  // ==========================================
  {
    level: 51,
    worldIndex: 10,
    gridSize: 8,
    handSize: 3,
    maxMoves: 16,
    goals: [
      { type: GoalType.LINES, target: 8, current: 0 },
      { type: GoalType.GEMS, target: 4, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 2, col: 2, color: "#22c55e", isGem: true },
      { row: 2, col: 5, color: "#22c55e", isGem: true },
      { row: 5, col: 2, color: "#22c55e", isGem: true },
      { row: 5, col: 5, color: "#22c55e", isGem: true },
      { row: 3, col: 3, color: "#44403c" },
      { row: 4, col: 4, color: "#44403c" },
    ],
    starThresholds: [4770, 7710, 11460],
  },
  {
    level: 52,
    worldIndex: 10,
    gridSize: 8,
    handSize: 3,
    maxMoves: 16,
    goals: [
      { type: GoalType.SCORE, target: 4620, current: 0 },
      { type: GoalType.GEMS, target: 4, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 1, col: 3, color: "#22c55e", isGem: true },
      { row: 1, col: 4, color: "#22c55e", isGem: true },
      { row: 6, col: 3, color: "#22c55e", isGem: true },
      { row: 6, col: 4, color: "#22c55e", isGem: true },
      { row: 3, col: 1, color: "#a8a29e" },
      { row: 4, col: 6, color: "#a8a29e" },
    ],
    starThresholds: [4840, 7820, 11620],
  },
  {
    level: 53,
    worldIndex: 10,
    gridSize: 8,
    handSize: 3,
    maxMoves: 15,
    goals: [
      { type: GoalType.LINES, target: 9, current: 0 },
      { type: GoalType.SCORE, target: 5045, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 2, col: 3, color: "#22c55e", isGem: true },
      { row: 3, col: 5, color: "#22c55e", isGem: true },
      { row: 5, col: 4, color: "#22c55e", isGem: true },
      { row: 4, col: 2, color: "#22c55e", isGem: true },
      { row: 3, col: 3, color: "#44403c" },
      { row: 4, col: 4, color: "#44403c" },
    ],
    starThresholds: [4910, 7930, 11780],
  },
  {
    level: 54,
    worldIndex: 10,
    gridSize: 8,
    handSize: 3,
    maxMoves: 14,
    goals: [
      { type: GoalType.GEMS, target: 4, current: 0 },
      { type: GoalType.LINES, target: 9, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 1, col: 1, color: "#22c55e", isGem: true },
      { row: 1, col: 6, color: "#22c55e", isGem: true },
      { row: 6, col: 1, color: "#22c55e", isGem: true },
      { row: 6, col: 6, color: "#22c55e", isGem: true },
      { row: 2, col: 2, color: "#44403c" },
      { row: 5, col: 5, color: "#44403c" },
    ],
    starThresholds: [4980, 8040, 11940],
  },
  {
    level: 55,
    worldIndex: 10,
    gridSize: 8,
    handSize: 3,
    maxMoves: 13,
    goals: [
      { type: GoalType.SCORE, target: 6600, current: 0 },
      { type: GoalType.GEMS, target: 4, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 3, col: 3, color: "#22c55e", isGem: true },
      { row: 3, col: 4, color: "#22c55e", isGem: true },
      { row: 4, col: 3, color: "#22c55e", isGem: true },
      { row: 4, col: 4, color: "#22c55e", isGem: true },
      { row: 1, col: 3, color: "#a8a29e" },
      { row: 6, col: 4, color: "#a8a29e" },
    ],
    starThresholds: [5050, 8150, 12100],
  },

  // ==========================================
  // WORLD 12: Celestial Aurora (Levels 56–60)
  // ==========================================
  {
    level: 56,
    worldIndex: 11,
    gridSize: 8,
    handSize: 3,
    maxMoves: 16,
    goals: [
      { type: GoalType.LINES, target: 8, current: 0 },
      { type: GoalType.GEMS, target: 4, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 2, col: 2, color: "#ffd600", isGem: true },
      { row: 2, col: 5, color: "#ffd600", isGem: true },
      { row: 5, col: 2, color: "#ffd600", isGem: true },
      { row: 5, col: 5, color: "#ffd600", isGem: true },
      { row: 3, col: 3, color: "#4338ca" },
      { row: 4, col: 4, color: "#4338ca" },
    ],
    starThresholds: [5120, 8260, 12260],
  },
  {
    level: 57,
    worldIndex: 11,
    gridSize: 8,
    handSize: 3,
    maxMoves: 16,
    goals: [
      { type: GoalType.SCORE, target: 4920, current: 0 },
      { type: GoalType.GEMS, target: 4, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 1, col: 3, color: "#ffd600", isGem: true },
      { row: 1, col: 4, color: "#ffd600", isGem: true },
      { row: 6, col: 3, color: "#ffd600", isGem: true },
      { row: 6, col: 4, color: "#ffd600", isGem: true },
      { row: 3, col: 1, color: "#818cf8" },
      { row: 4, col: 6, color: "#818cf8" },
    ],
    starThresholds: [5190, 8370, 12420],
  },
  {
    level: 58,
    worldIndex: 11,
    gridSize: 8,
    handSize: 3,
    maxMoves: 15,
    goals: [
      { type: GoalType.LINES, target: 9, current: 0 },
      { type: GoalType.SCORE, target: 5370, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 2, col: 3, color: "#ffd600", isGem: true },
      { row: 3, col: 5, color: "#ffd600", isGem: true },
      { row: 5, col: 4, color: "#ffd600", isGem: true },
      { row: 4, col: 2, color: "#ffd600", isGem: true },
      { row: 3, col: 3, color: "#4338ca" },
      { row: 4, col: 4, color: "#4338ca" },
    ],
    starThresholds: [5260, 8480, 12580],
  },
  {
    level: 59,
    worldIndex: 11,
    gridSize: 8,
    handSize: 3,
    maxMoves: 14,
    goals: [
      { type: GoalType.GEMS, target: 4, current: 0 },
      { type: GoalType.LINES, target: 9, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 1, col: 1, color: "#ffd600", isGem: true },
      { row: 1, col: 6, color: "#ffd600", isGem: true },
      { row: 6, col: 1, color: "#ffd600", isGem: true },
      { row: 6, col: 6, color: "#ffd600", isGem: true },
      { row: 2, col: 2, color: "#4338ca" },
      { row: 5, col: 5, color: "#4338ca" },
    ],
    starThresholds: [5330, 8590, 12740],
  },
  {
    level: 60,
    worldIndex: 11,
    gridSize: 8,
    handSize: 3,
    maxMoves: 13,
    goals: [
      { type: GoalType.SCORE, target: 7000, current: 0 },
      { type: GoalType.GEMS, target: 4, current: 0 }
    ],
    allowedTiers: [
      ShapeTier.HELPER,
      ShapeTier.FILLER,
      ShapeTier.SPANNER,
      ShapeTier.CHUNK,
    ],
    prefilledTiles: [
      { row: 3, col: 3, color: "#ffd600", isGem: true },
      { row: 3, col: 4, color: "#ffd600", isGem: true },
      { row: 4, col: 3, color: "#ffd600", isGem: true },
      { row: 4, col: 4, color: "#ffd600", isGem: true },
      { row: 1, col: 3, color: "#818cf8" },
      { row: 6, col: 4, color: "#818cf8" },
    ],
    starThresholds: [5400, 8700, 12900],
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
