import {
  BlockShape,
  TrayBlock,
  getRandomColor,
  getRandomShape,
  getRandomShapeFromPool,
  ShapeTier,
  BLOCK_DEFS,
} from "./blocks.js";
import { PRNG } from "./prng.js";
export function computePieceCellSize(
  shape: BlockShape,
  slotWidth: number,
  slotHeight: number,
  boardCellSize: number,
): number {
  const cols = shape[0].length;
  const rows = shape.length;
  const usableW = Math.max(36, slotWidth * 0.82);
  const usableH = Math.max(36, slotHeight * 0.82);
  const baseScale = 0.72;
  const baseCellSize = boardCellSize * baseScale;
  const maxCellW = usableW / cols;
  const maxCellH = usableH / rows;
  return Math.max(12, Math.floor(Math.min(baseCellSize, maxCellW, maxCellH)));
}

export interface BoardPressureMetrics {
  pressure: number; // 0.0 (calm/generous) to 1.0 (tense/demanding)
  density: number;
  fragmentation: number;
  deadCellRatio: number;
  progressRamp: number;
}

export function computeBoardPressure(
  grid: (string | 0)[][],
  blocksPlaced: number = 0,
  maxMoves?: number,
): BoardPressureMetrics {
  const size = grid.length;
  const totalCells = size * size;
  let filledCells = 0;
  let emptyCells = 0;
  let isolatedDeadHoles = 0;
  let exposedFilledEdges = 0;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const isFilled = grid[r][c] !== 0;
      if (isFilled) {
        filledCells++;
        const neighbors = [
          [r - 1, c],
          [r + 1, c],
          [r, c - 1],
          [r, c + 1],
        ];
        for (const [nr, nc] of neighbors) {
          if (
            nr < 0 ||
            nr >= size ||
            nc < 0 ||
            nc >= size ||
            grid[nr][nc] === 0
          ) {
            exposedFilledEdges++;
          }
        }
      } else {
        emptyCells++;
        const hasEmptyNeighbor = [
          [r - 1, c],
          [r + 1, c],
          [r, c - 1],
          [r, c + 1],
        ].some(
          ([nr, nc]) =>
            nr >= 0 && nr < size && nc >= 0 && nc < size && grid[nr][nc] === 0,
        );

        if (!hasEmptyNeighbor) {
          isolatedDeadHoles++;
        }
      }
    }
  }

  const density = totalCells > 0 ? filledCells / totalCells : 0;
  const fragmentation =
    filledCells > 0 ? Math.min(1.0, exposedFilledEdges / (filledCells * 4)) : 0;
  const deadCellRatio = emptyCells > 0 ? isolatedDeadHoles / emptyCells : 0;

  const targetRamp = maxMoves || 100;
  const progressRamp = Math.min(1.0, blocksPlaced / targetRamp);

  const rawPressure =
    density * 0.38 +
    fragmentation * 0.22 +
    deadCellRatio * 0.25 +
    progressRamp * 0.15;

  const pressure = Math.max(0.0, Math.min(1.0, rawPressure));
  return { pressure, density, fragmentation, deadCellRatio, progressRamp };
}

interface SolvableCandidate {
  shapes: BlockShape[];
  helpfulness: number;
}

function evaluateCandidateSolvability(
  grid: (string | 0)[][],
  shapes: BlockShape[],
): SolvableCandidate | null {
  const size = grid.length;
  let currentGrid = grid.map((r) => [...r]);
  let totalLinesCleared = 0;

  for (const shape of shapes) {
    let placed = false;
    let bestCleared = -1;
    let bestScore = -999;
    let nextGrid: (string | 0)[][] = [];

    for (let gy = 0; gy <= size - shape.length; gy++) {
      for (let gx = 0; gx <= size - shape[0].length; gx++) {
        if (!canPlaceBlockAtPosition(currentGrid, shape, gx, gy)) continue;

        placed = true;
        const sim = currentGrid.map((r) => [...r]);
        for (let r = 0; r < shape.length; r++) {
          for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c]) sim[gy + r][gx + c] = "#solv";
          }
        }

        let cleared = 0;
        const rowsToClear: number[] = [];
        const colsToClear: number[] = [];
        for (let r = 0; r < size; r++) {
          if (sim[r].every((cell) => cell !== 0)) rowsToClear.push(r);
        }
        for (let c = 0; c < size; c++) {
          let full = true;
          for (let r = 0; r < size; r++) {
            if (sim[r][c] === 0) {
              full = false;
              break;
            }
          }
          if (full) colsToClear.push(c);
        }

        cleared = rowsToClear.length + colsToClear.length;
        for (const r of rowsToClear) {
          for (let c = 0; c < size; c++) sim[r][c] = 0;
        }
        for (const c of colsToClear) {
          for (let r = 0; r < size; r++) sim[r][c] = 0;
        }

        const score = cleared * 15 - gy * 0.5;
        if (score > bestScore) {
          bestScore = score;
          bestCleared = cleared;
          nextGrid = sim;
        }
      }
    }

    if (!placed) {
      return null;
    }

    currentGrid = nextGrid;
    totalLinesCleared += Math.max(0, bestCleared);
  }

  let remainingEmpty = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (currentGrid[r][c] === 0) remainingEmpty++;
    }
  }

  const helpfulness = totalLinesCleared * 25 + remainingEmpty;
  return { shapes, helpfulness };
}

export function createTrayBlocks({
  availableBlocks,
  canvasWidth,
  trayY,
  trayH = 120,
  boardCellSize = 42,
  boardX,
  boardSize,
  rng,
  handSize = 3,
  allowedTiers,
  failCount = 0,
  grid,
  blocksPlaced = 0,
  maxMoves,
  isSpecialDeal = false,
}: {
  availableBlocks: TrayBlock[];
  canvasWidth: number;
  trayY: number;
  trayH?: number;
  boardCellSize?: number;
  boardX?: number;
  boardSize?: number;
  rng: PRNG;
  handSize?: number;
  allowedTiers?: ShapeTier[];
  failCount?: number;
  grid?: (string | 0)[][];
  blocksPlaced?: number;
  maxMoves?: number;
  isSpecialDeal?: boolean;
}) {
  availableBlocks.length = 0;
  const count = handSize;
  const trayWidth = boardSize || canvasWidth;
  const trayStartX =
    boardX !== undefined ? boardX : Math.floor((canvasWidth - trayWidth) / 2);
  const slotWidth = trayWidth / count;
  const centerY = trayY + trayH / 2;

  let effectiveTiers = allowedTiers;
  if (allowedTiers && allowedTiers.length > 0) {
    if (failCount >= 3) {
      effectiveTiers = [ShapeTier.HELPER];
    } else if (failCount >= 2) {
      effectiveTiers = allowedTiers.filter((t) => t !== ShapeTier.CHUNK);
    }
  }

  const sampleShapes = (tiers?: ShapeTier[]): BlockShape[] => {
    const list: BlockShape[] = [];
    for (let i = 0; i < count; i++) {
      const shape =
        tiers && tiers.length > 0
          ? getRandomShapeFromPool(tiers, rng)
          : getRandomShape(rng);
      list.push(shape);
    }
    return list;
  };

  let chosenShapes: BlockShape[] | null = null;

  // If a grid is provided, run Constructive Solvability with Board Pressure ranking
  if (grid && grid.length > 0) {
    const pressureMetrics = computeBoardPressure(grid, blocksPlaced, maxMoves);
    const solvableCandidates: SolvableCandidate[] = [];
    const candidateRounds = 7;

    for (let c = 0; c < candidateRounds; c++) {
      const candidateShapes = sampleShapes(effectiveTiers);
      const evalRes = evaluateCandidateSolvability(grid, candidateShapes);
      if (evalRes) {
        solvableCandidates.push(evalRes);
      }
    }

    if (solvableCandidates.length > 0) {
      // Sort from least helpful to most helpful
      solvableCandidates.sort((a, b) => a.helpfulness - b.helpfulness);
      // Low pressure picks high quantile (most helpful), high pressure picks lower quantile
      const quantile = Math.max(0, Math.min(1, 1.0 - pressureMetrics.pressure));
      const pickIdx = Math.round(quantile * (solvableCandidates.length - 1));
      chosenShapes = solvableCandidates[pickIdx].shapes;
    } else {
      // Fallback: If no unconstrained candidate was solvable on a crowded board,
      // generate from HELPER tier so the player gets placeable pieces to clear space
      const helperCandidates: SolvableCandidate[] = [];
      for (let c = 0; c < 5; c++) {
        const helperShapes = sampleShapes([ShapeTier.HELPER]);
        const evalRes = evaluateCandidateSolvability(grid, helperShapes);
        if (evalRes) {
          helperCandidates.push(evalRes);
        }
      }
      if (helperCandidates.length > 0) {
        chosenShapes = helperCandidates[helperCandidates.length - 1].shapes;
      }
    }
  }

  // Final fallback to standard random draw if needed
  if (!chosenShapes) {
    chosenShapes = sampleShapes(effectiveTiers);
  }

  // Solvability Guarantee: If grid is provided, ensure at least one piece (and ideally all pieces)
  // can definitely be placed into the board's existing empty spaces so board blocks/jewels are never destroyed!
  if (grid && grid.length > 0) {
    const checkCanPlace = (shape: BlockShape): boolean => {
      const gSize = grid.length;
      for (let gy = 0; gy <= gSize - shape.length; gy++) {
        for (let gx = 0; gx <= gSize - shape[0].length; gx++) {
          if (canPlaceBlockAtPosition(grid, shape, gx, gy)) return true;
        }
      }
      return false;
    };

    const hasPlayable = chosenShapes.some((shape) => checkCanPlace(shape));
    if (!hasPlayable) {
      // Find all shapes from the catalog that fit into current empty spaces on the board
      const fittingShapes: BlockShape[] = [];
      for (const def of BLOCK_DEFS) {
        if (checkCanPlace(def.shape)) {
          fittingShapes.push(def.shape);
        }
      }

      if (fittingShapes.length > 0) {
        // Sort ascending by cell count (e.g. 1x1 dot, 2x1 domino first)
        fittingShapes.sort((a, b) => {
          const countA = a.reduce(
            (sum, row) => sum + row.reduce((s, c) => s + c, 0),
            0,
          );
          const countB = b.reduce(
            (sum, row) => sum + row.reduce((s, c) => s + c, 0),
            0,
          );
          return countA - countB;
        });

        chosenShapes = [];
        for (let i = 0; i < count; i++) {
          chosenShapes.push(fittingShapes[i % fittingShapes.length]);
        }
      } else {
        // As long as there is any empty cell on the board, a 1x1 dot can always fit
        chosenShapes = Array.from({ length: count }, () => [[1]]);
      }
    }
  }

  // Special All Clear deal theme roll
  let specialColor: string | null = null;
  let specialGlowing = false;
  let specialGolden = false;

  if (isSpecialDeal) {
    const roll = rng.next ? rng.next() : Math.random();
    const curatedPalette = [
      "#ff007f",
      "#00f0ff",
      "#ffd700",
      "#a855f7",
      "#10b981",
      "#ff5722",
    ];
    const pickColor =
      curatedPalette[
        Math.floor(
          (rng.next ? rng.next() : Math.random()) * curatedPalette.length,
        )
      ];

    if (roll < 0.45) {
      // Monochromatic Glowing Deal: All pieces share vibrant color & pulse with radiant aura
      specialColor = pickColor;
      specialGlowing = true;
    } else if (roll < 0.75) {
      // Pure Monochromatic Deal: All pieces share single curated color
      specialColor = pickColor;
    } else {
      // Royal Golden Deal: All pieces gleam with metallic gold stars
      specialColor = "#ffd700";
      specialGolden = true;
    }
  }

  for (let i = 0; i < count; i++) {
    const shape = chosenShapes[i];
    const color = specialColor || getRandomColor(rng);

    const cols = shape[0].length;
    const rows = shape.length;

    // Scale each piece individually to fit its slot with safe margins
    const pieceCellSize = computePieceCellSize(
      shape,
      slotWidth,
      trayH,
      boardCellSize,
    );
    const pieceWidth = cols * pieceCellSize;
    const pieceHeight = rows * pieceCellSize;

    const slotCenterX = trayStartX + slotWidth * i + slotWidth / 2;
    const x = Math.floor(slotCenterX - pieceWidth / 2);
    const y = Math.floor(centerY - pieceHeight / 2);

    availableBlocks.push({
      shape,
      color,
      x,
      y,
      active: true,
      originalIndex: i,
      cellSize: pieceCellSize,
      isGlowing: specialGlowing,
      isGolden: specialGolden,
    });
  }
}

export function canPlaceBlockAtPosition(
  grid: (string | 0)[][],
  shape: BlockShape,
  gridX: number,
  gridY: number,
): boolean {
  const gridSize = grid.length;
  if (
    gridX < 0 ||
    gridY < 0 ||
    gridX + shape[0].length > gridSize ||
    gridY + shape.length > gridSize
  ) {
    return false;
  }

  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (shape[y][x] && grid[gridY + y][gridX + x] !== 0) {
        return false;
      }
    }
  }

  return true;
}

export function canPlaceAnyBlock({
  grid,
  availableBlocks,
}: {
  grid: (string | 0)[][];
  availableBlocks: TrayBlock[];
}): boolean {
  const gridSize = grid.length;
  for (const block of availableBlocks) {
    if (!block.active) continue;

    for (let gy = 0; gy <= gridSize - block.shape.length; gy++) {
      for (let gx = 0; gx <= gridSize - block.shape[0].length; gx++) {
        if (canPlaceBlockAtPosition(grid, block.shape, gx, gy)) {
          return true;
        }
      }
    }
  }
  return false;
}
