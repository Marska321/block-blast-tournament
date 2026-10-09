import { PRNG } from "./prng";

export type BlockShape = number[][];

export enum ShapeTier {
  HELPER = "helper",   // Small dots, 2-lines, 3-lines, small corners
  FILLER = "filler",   // Standard L, J, T-shapes, Z/S, large L-corners
  SPANNER = "spanner", // Long 4-lines and 5-lines
  CHUNK = "chunk",     // 2x2, 3x3 squares, 2x3, 3x2 rectangles
}

export interface PieceDef {
  name: string;
  shape: BlockShape;
  weight: number;
  tier: ShapeTier;
}

export interface TrayBlock {
  shape: BlockShape;
  x: number;
  y: number;
  color: string;
  active: boolean;
  originalIndex: number;
  cellSize?: number;
  isGlowing?: boolean;
  isGolden?: boolean;
}

/**
 * Canonical 37 Block Blast shapes:
 * 1. Single block (1x1) - 1 shape
 * 2. Straight lines (2, 3, 4, 5 cells, H & V) - 8 shapes
 * 3. Small corners (3 cells, 2x2 with one cell missing) - 4 orientations
 * 4. 2x2 square and 3x3 square - 2 shapes
 * 5. 2x3 and 3x2 rectangles - 2 shapes
 * 6. L and J pieces (4 cells long with a foot) - 8 shapes (4 orientations each)
 * 7. T piece (Tetris T) - 4 orientations
 * 8. S and Z pieces - 4 shapes (2 orientations each)
 * 9. Big corner (5 cells, L with both arms 3 long) - 4 orientations
 */
export const BLOCK_DEFS: PieceDef[] = [
  // ==========================================
  // 1. SINGLE BLOCK (1x1) - 1 shape
  // ==========================================
  { name: "dot", shape: [[1]], weight: 3.0, tier: ShapeTier.HELPER },

  // ==========================================
  // 2. STRAIGHT LINES (2, 3, 4, 5 cells, H & V) - 8 shapes
  // ==========================================
  // 2 cells
  { name: "line_2h", shape: [[1, 1]], weight: 4.0, tier: ShapeTier.HELPER },
  { name: "line_2v", shape: [[1], [1]], weight: 4.0, tier: ShapeTier.HELPER },

  // 3 cells
  { name: "line_3h", shape: [[1, 1, 1]], weight: 4.0, tier: ShapeTier.HELPER },
  { name: "line_3v", shape: [[1], [1], [1]], weight: 4.0, tier: ShapeTier.HELPER },

  // 4 cells
  { name: "line_4h", shape: [[1, 1, 1, 1]], weight: 2.5, tier: ShapeTier.SPANNER },
  { name: "line_4v", shape: [[1], [1], [1], [1]], weight: 2.5, tier: ShapeTier.SPANNER },

  // 5 cells
  { name: "line_5h", shape: [[1, 1, 1, 1, 1]], weight: 1.5, tier: ShapeTier.SPANNER },
  { name: "line_5v", shape: [[1], [1], [1], [1], [1]], weight: 1.5, tier: ShapeTier.SPANNER },

  // ==========================================
  // 3. SMALL CORNER (3 cells, 2x2 with one missing) - 4 orientations
  // ==========================================
  {
    name: "corner_sm_bl",
    shape: [
      [1, 0],
      [1, 1],
    ],
    weight: 3.0,
    tier: ShapeTier.HELPER,
  },
  {
    name: "corner_sm_br",
    shape: [
      [0, 1],
      [1, 1],
    ],
    weight: 3.0,
    tier: ShapeTier.HELPER,
  },
  {
    name: "corner_sm_tl",
    shape: [
      [1, 1],
      [1, 0],
    ],
    weight: 3.0,
    tier: ShapeTier.HELPER,
  },
  {
    name: "corner_sm_tr",
    shape: [
      [1, 1],
      [0, 1],
    ],
    weight: 3.0,
    tier: ShapeTier.HELPER,
  },

  // ==========================================
  // 4. SQUARES (2x2 and 3x3) - 2 shapes
  // ==========================================
  {
    name: "square_2",
    shape: [
      [1, 1],
      [1, 1],
    ],
    weight: 4.0,
    tier: ShapeTier.CHUNK,
  },
  {
    name: "square_3",
    shape: [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ],
    weight: 1.5,
    tier: ShapeTier.CHUNK,
  },

  // ==========================================
  // 5. RECTANGLES (2x3 and 3x2) - 2 shapes
  // ==========================================
  {
    name: "rect_2x3",
    shape: [
      [1, 1, 1],
      [1, 1, 1],
    ],
    weight: 2.0,
    tier: ShapeTier.CHUNK,
  },
  {
    name: "rect_3x2",
    shape: [
      [1, 1],
      [1, 1],
      [1, 1],
    ],
    weight: 2.0,
    tier: ShapeTier.CHUNK,
  },

  // ==========================================
  // 6. L AND J PIECES (4 cells long with a foot) - 8 shapes
  // ==========================================
  // L pieces (4 orientations)
  {
    name: "l_1",
    shape: [
      [1, 0],
      [1, 0],
      [1, 1],
    ],
    weight: 2.5,
    tier: ShapeTier.FILLER,
  },
  {
    name: "l_2",
    shape: [
      [1, 1, 1],
      [1, 0, 0],
    ],
    weight: 2.5,
    tier: ShapeTier.FILLER,
  },
  {
    name: "l_3",
    shape: [
      [1, 1],
      [0, 1],
      [0, 1],
    ],
    weight: 2.5,
    tier: ShapeTier.FILLER,
  },
  {
    name: "l_4",
    shape: [
      [0, 0, 1],
      [1, 1, 1],
    ],
    weight: 2.5,
    tier: ShapeTier.FILLER,
  },

  // J pieces (4 orientations)
  {
    name: "j_1",
    shape: [
      [0, 1],
      [0, 1],
      [1, 1],
    ],
    weight: 2.5,
    tier: ShapeTier.FILLER,
  },
  {
    name: "j_2",
    shape: [
      [1, 0, 0],
      [1, 1, 1],
    ],
    weight: 2.5,
    tier: ShapeTier.FILLER,
  },
  {
    name: "j_3",
    shape: [
      [1, 1],
      [1, 0],
      [1, 0],
    ],
    weight: 2.5,
    tier: ShapeTier.FILLER,
  },
  {
    name: "j_4",
    shape: [
      [1, 1, 1],
      [0, 0, 1],
    ],
    weight: 2.5,
    tier: ShapeTier.FILLER,
  },

  // ==========================================
  // 7. T PIECE (Tetris T) - 4 orientations
  // ==========================================
  {
    name: "t_down",
    shape: [
      [1, 1, 1],
      [0, 1, 0],
    ],
    weight: 2.5,
    tier: ShapeTier.FILLER,
  },
  {
    name: "t_up",
    shape: [
      [0, 1, 0],
      [1, 1, 1],
    ],
    weight: 2.5,
    tier: ShapeTier.FILLER,
  },
  {
    name: "t_right",
    shape: [
      [1, 0],
      [1, 1],
      [1, 0],
    ],
    weight: 2.5,
    tier: ShapeTier.FILLER,
  },
  {
    name: "t_left",
    shape: [
      [0, 1],
      [1, 1],
      [0, 1],
    ],
    weight: 2.5,
    tier: ShapeTier.FILLER,
  },

  // ==========================================
  // 8. S AND Z PIECES - 4 shapes (2 orientations each)
  // ==========================================
  // S piece (horizontal & vertical)
  {
    name: "s_h",
    shape: [
      [0, 1, 1],
      [1, 1, 0],
    ],
    weight: 2.0,
    tier: ShapeTier.FILLER,
  },
  {
    name: "s_v",
    shape: [
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    weight: 2.0,
    tier: ShapeTier.FILLER,
  },

  // Z piece (horizontal & vertical)
  {
    name: "z_h",
    shape: [
      [1, 1, 0],
      [0, 1, 1],
    ],
    weight: 2.0,
    tier: ShapeTier.FILLER,
  },
  {
    name: "z_v",
    shape: [
      [0, 1],
      [1, 1],
      [1, 0],
    ],
    weight: 2.0,
    tier: ShapeTier.FILLER,
  },

  // ==========================================
  // 9. BIG CORNER (5 cells, L with both arms 3 long) - 4 orientations
  // ==========================================
  {
    name: "corner_big_bl",
    shape: [
      [1, 0, 0],
      [1, 0, 0],
      [1, 1, 1],
    ],
    weight: 2.0,
    tier: ShapeTier.FILLER,
  },
  {
    name: "corner_big_br",
    shape: [
      [0, 0, 1],
      [0, 0, 1],
      [1, 1, 1],
    ],
    weight: 2.0,
    tier: ShapeTier.FILLER,
  },
  {
    name: "corner_big_tl",
    shape: [
      [1, 1, 1],
      [1, 0, 0],
      [1, 0, 0],
    ],
    weight: 2.0,
    tier: ShapeTier.FILLER,
  },
  {
    name: "corner_big_tr",
    shape: [
      [1, 1, 1],
      [0, 0, 1],
      [0, 0, 1],
    ],
    weight: 2.0,
    tier: ShapeTier.FILLER,
  },
];

// Vibrant authentic casual candy colors (matches official Block Blast palette)
export const BLOCK_COLORS = [
  "#e91e63", // Magenta / Hot Pink
  "#4caf50", // Vibrant Emerald Green
  "#00bcd4", // Vivid Cyan Blue
  "#ff9800", // Bright Tangerine Orange
  "#ffd600", // Sunny Yellow
  "#9c27b0", // Deep Orchid Purple
  "#2979ff", // Electric Cobalt Blue
  "#f44336", // Coral Crimson Red
];

const totalWeight = BLOCK_DEFS.reduce((sum, item) => sum + item.weight, 0);

export function getRandomShape(rng?: PRNG): BlockShape {
  const randVal = rng ? rng.next() * totalWeight : Math.random() * totalWeight;
  let running = randVal;
  for (const def of BLOCK_DEFS) {
    running -= def.weight;
    if (running <= 0) {
      return def.shape;
    }
  }
  return BLOCK_DEFS[0].shape;
}

export function getRandomShapeFromPool(
  allowedTiers: ShapeTier[],
  rng?: PRNG
): BlockShape {
  const pool = BLOCK_DEFS.filter((d) => allowedTiers.includes(d.tier));
  if (pool.length === 0) return getRandomShape(rng);

  const poolWeight = pool.reduce((sum, item) => sum + item.weight, 0);
  const randVal = rng ? rng.next() * poolWeight : Math.random() * poolWeight;
  let running = randVal;
  for (const def of pool) {
    running -= def.weight;
    if (running <= 0) {
      return def.shape;
    }
  }
  return pool[0].shape;
}

export function getRandomColor(rng?: PRNG): string {
  const idx = rng
    ? rng.nextInt(0, BLOCK_COLORS.length)
    : Math.floor(Math.random() * BLOCK_COLORS.length);
  return BLOCK_COLORS[idx];
}

export function countBlocks(shape: BlockShape): number {
  let count = 0;
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (shape[y][x]) count++;
    }
  }
  return count;
}
