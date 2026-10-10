import {
  computeLayout,
  computePieceCellSize,
  setBlockStyle,
  setSpriteScale,
  invalidateBoardCache,
  LayoutMetrics,
  drawGrid,
  drawPiece,
  drawGhostBlock,
  drawTray,
  createTrayBlocks,
  findBestGridPlacement,
  checkAndClearLines,
  canPlaceAnyBlock,
  GridOffset,
} from "./gameFunctions";
import { countBlocks, TrayBlock, ShapeTier } from "./blocks";
import { createRNG, PRNG } from "./prng";
import { soundManager } from "./audio";
import { particles } from "./particles";
import { floatingTexts } from "./floatingText";
import { comboBar } from "./comboBar";
import { sessionManager } from "./session";
import {
  createGameOverModal,
  showModal,
  hideModal,
  PerformanceStats,
} from "./modal";
import { GAME_MODES, GameModeId, ModeConfig } from "./modes";
import { chancesManager } from "./chances";
import {
  LEVEL_DATA,
  WORLD_THEMES,
  LevelConfig,
  LevelGoal,
  GoalType,
  levelProgress,
  WorldTheme,
} from "./levels";
import { showLevelSelect, hideLevelSelect } from "./levelSelect";
import {
  showLevelCompleteModal,
  showLevelFailedModal,
  hideLevelModal,
} from "./levelModal";
import { leaderboardManager } from "./leaderboard";
import { showPreTourneyModal, hidePreTourneyModal } from "./preTourneyModal";
import { hideTourneyRulesModal } from "./tourneyRulesModal";
import { authManager } from "./auth";
import {
  requestTournamentSessionToken,
  submitTournamentScore,
} from "./supabaseClient";
import { wallpaperManager } from "./wallpaper";
import { showWallpaperModal } from "./wallpaperModal";
import { getPhotoRevealMode, unlockPhotoReveal } from "./photoReveal";
import { referralManager } from "./referral";
import {
  tournamentConfigManager,
  TournamentSponsorConfig,
} from "./tournamentConfig";

let currentTournamentToken: string | null = null;
let currentTournamentSeed: number = 0;

const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

const scoreDisplayEl = document.getElementById("hud-score-value");
const bestDisplayEl = document.getElementById("hud-best-value");
const muteBtn = document.getElementById("mute-btn");
const themeBtn = document.getElementById("theme-btn");
const wallpaperBtn = document.getElementById("wallpaper-btn");
const leaderboardBtn = document.getElementById("leaderboard-btn");
const chancesBadgeEl = document.getElementById("hud-chances-badge");
const modeLevelsBtn = document.getElementById("mode-levels-btn");
const modeClassicBtn = document.getElementById("mode-classic-btn");
const modeTourneyBtn = document.getElementById("mode-tourney-btn");

// Tournament live banner & stakes indicators
const tournamentBannerEl = document.getElementById("tournament-banner");
const tourneyBannerTitleEl = document.getElementById("tourney-banner-title");
const tourneyBannerSubEl = document.getElementById("tourney-banner-subtitle");
const hudScoreBoxEl = document.getElementById("hud-score-box");
const hudStakesTagEl = document.getElementById("hud-stakes-tag");

// Level HUD elements
const levelHudEl = document.getElementById("level-hud");
const levelHudBadge = document.getElementById("level-hud-badge");
const levelHudWorld = document.getElementById("level-hud-world");
const levelHudGoals = document.getElementById("level-hud-goals");
const levelHudMoves = document.getElementById("level-hud-moves");
const levelMovesValue = document.getElementById("level-moves-value");
const levelMapShortcutBtn = document.getElementById("level-map-shortcut-btn");

let currentMode: ModeConfig = GAME_MODES[GameModeId.LEVELS];
let lastAnnouncedMilestone: number = 0;

// Level Mode State
let currentLevelConfig: LevelConfig | null = null;
let currentWorldTheme: WorldTheme | null = null;
let activeLevelGoals: LevelGoal[] = [];
let levelMovesCount: number = 0;
let levelParMoves: number = 20;
let movesRemaining: number | null = null;
let activeGemPositions: Set<string> = new Set();
let activeObstaclePositions: Set<string> = new Set();
let activeGlowingPositions: Set<string> = new Set();
let activeGoldenPositions: Set<string> = new Set();
let pendingSpecialDeal: boolean = false;
const levelFailCountMap: Record<number, number> = {};
let canReviveInCurrentLevel: boolean = true;
let activeRevealedTiles: Set<string> = new Set();
let allTilesPreviouslyRevealed: boolean = false;

// Expose block style switcher to global scope (e.g. setBlockStyle('candy') or 'bevel')
(window as any).setBlockStyle = setBlockStyle;
(window as any).resetPhotoRevealProgress = () => {
  activeRevealedTiles.clear();
  allTilesPreviouslyRevealed = false;
  saveActiveGameSession();
};

// Paper / Light Theme Mode Management
let isPaperTheme = localStorage.getItem("bb_theme") === "paper";

function applyTheme(paper: boolean) {
  isPaperTheme = paper;
  document.body.classList.toggle("theme-paper", isPaperTheme);
  if (themeBtn) {
    themeBtn.textContent = isPaperTheme ? "🌙" : "☀️";
    themeBtn.setAttribute(
      "title",
      isPaperTheme ? "Switch to Dark Theme" : "Switch to Light Theme"
    );
  }
  setBlockStyle("flat");
  invalidateBoardCache();
  localStorage.setItem("bb_theme", isPaperTheme ? "paper" : "dark");

  const gameContainer = document.getElementById("game-container");
  if (gameContainer) {
    if (isPaperTheme) {
      gameContainer.style.background = "none";
      gameContainer.style.backgroundImage = "none";
      gameContainer.style.backgroundColor = "#fbf8f2";
      document.body.style.background = "#efe7d8";
    } else {
      wallpaperManager.apply();
    }
  }
}

// Player Skill & Strategic Performance Tracking
let totalMovesPlaced = 0;
let totalLinesCleared = 0;
let maxComboAchieved = 0;
let multilineClears = 0;
let cumulativeEfficiency = 0;

function resetPerformanceMetrics() {
  totalMovesPlaced = 0;
  totalLinesCleared = 0;
  maxComboAchieved = 0;
  multilineClears = 0;
  cumulativeEfficiency = 0;
}

function computePerformanceStats(): PerformanceStats {
  const avgEfficiency =
    totalMovesPlaced > 0 ? cumulativeEfficiency / totalMovesPlaced : 0;

  let efficiencyGrade = "D";
  if (avgEfficiency >= 0.82) efficiencyGrade = "A+";
  else if (avgEfficiency >= 0.72) efficiencyGrade = "A";
  else if (avgEfficiency >= 0.62) efficiencyGrade = "B+";
  else if (avgEfficiency >= 0.52) efficiencyGrade = "B";
  else if (avgEfficiency >= 0.4) efficiencyGrade = "C+";
  else if (avgEfficiency >= 0.28) efficiencyGrade = "C";

  const stratScore =
    maxComboAchieved * 0.5 +
    multilineClears * 0.6 +
    (totalLinesCleared / Math.max(1, totalMovesPlaced)) * 3.0;

  let strategicGrade = "Beginner";
  if (stratScore >= 4.2) strategicGrade = "Master";
  else if (stratScore >= 2.8) strategicGrade = "Expert";
  else if (stratScore >= 1.6) strategicGrade = "Skilled";
  else if (stratScore >= 0.8) strategicGrade = "Learning";

  return {
    efficiencyGrade,
    strategicGrade,
    totalMoves: totalMovesPlaced,
    totalLines: totalLinesCleared,
    maxCombo: maxComboAchieved,
  };
}

// Mid-Game Auto-Resume Storage
const STORAGE_KEY_ACTIVE_SESSION = "bb_in_progress_game";

function saveActiveGameSession() {
  if (gameOver) return;
  if (totalMovesPlaced === 0 && score === 0) return;

  try {
    const sessionData = {
      timestamp: Date.now(),
      modeId: currentMode.id,
      score,
      combo,
      totalMovesPlaced,
      totalLinesCleared,
      maxComboAchieved,
      multilineClears,
      cumulativeEfficiency,
      grid: GAME_GRID,
      availableBlocks: availableBlocks.map((b) => ({
        shape: b.shape,
        color: b.color,
        active: b.active,
        originalIndex: b.originalIndex,
        isGlowing: b.isGlowing,
        isGolden: b.isGolden,
      })),
      levelNumber: currentLevelConfig ? currentLevelConfig.level : null,
      levelMovesCount,
      levelParMoves,
      movesRemaining,
      goals: activeLevelGoals.map((g) => ({ ...g })),
      gemPositions: Array.from(activeGemPositions),
      obstaclePositions: Array.from(activeObstaclePositions),
      glowingPositions: Array.from(activeGlowingPositions),
      goldenPositions: Array.from(activeGoldenPositions),
      revealedTiles: Array.from(activeRevealedTiles),
      pendingSpecialDeal,
    };
    localStorage.setItem(
      STORAGE_KEY_ACTIVE_SESSION,
      JSON.stringify(sessionData)
    );
  } catch (e) {}
}

function clearActiveGameSession() {
  try {
    localStorage.removeItem(STORAGE_KEY_ACTIVE_SESSION);
    toastEl?.classList.remove("show");
  } catch (e) {}
}

function tryResumeSavedGameSession(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_SESSION);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (
      !data ||
      !data.grid ||
      !Array.isArray(data.grid) ||
      data.grid.length < 8
    ) {
      return false;
    }
    // Expire if older than 48 hours
    if (Date.now() - (data.timestamp || 0) > 48 * 3600 * 1000) {
      clearActiveGameSession();
      return false;
    }

    if (data.modeId === GameModeId.LEVELS && data.levelNumber) {
      initLevelGame(data.levelNumber, false, true);
      levelMovesCount =
        typeof data.levelMovesCount === "number"
          ? data.levelMovesCount
          : (typeof data.movesRemaining === "number" ? Math.max(0, 20 - data.movesRemaining) : 0);
      levelParMoves =
        typeof data.levelParMoves === "number"
          ? data.levelParMoves
          : 20;

      if (Array.isArray(data.goals) && data.goals.length > 0) {
        const configHasGems = currentLevelConfig?.goals.some((g) => g.type === GoalType.GEMS);
        const savedHasGems = data.goals.some((g: any) => g.type === GoalType.GEMS);
        if (currentLevelConfig && configHasGems && !savedHasGems) {
          // Re-sync goals from current level config if saved session had old goals
          activeLevelGoals = currentLevelConfig.goals.map((g) => ({ ...g, current: 0 }));
        } else {
          activeLevelGoals = data.goals;
        }
      }
      if (Array.isArray(data.gemPositions)) {
        activeGemPositions = new Set(data.gemPositions);
      }
      if (Array.isArray(data.obstaclePositions)) {
        activeObstaclePositions = new Set(data.obstaclePositions);
      }

      // Safeguard: Ensure level with gem goal has jewel blocks on the board
      if (currentLevelConfig && currentLevelConfig.goals.some((g) => g.type === GoalType.GEMS)) {
        const gemGoal = activeLevelGoals.find((g) => g.type === GoalType.GEMS);
        if (gemGoal && gemGoal.current < gemGoal.target && activeGemPositions.size === 0) {
          currentLevelConfig.prefilledTiles?.forEach((tile) => {
            if (tile.isGem) {
              activeGemPositions.add(`${tile.col},${tile.row}`);
              if (GAME_GRID[tile.row]) {
                GAME_GRID[tile.row][tile.col] = tile.color;
              }
            }
          });
        }
      }
    } else if (data.modeId === GameModeId.TOURNAMENT) {
      initTournamentGame(false, true);
    } else {
      initClassicGame(true);
    }

    if (Array.isArray(data.glowingPositions)) {
      activeGlowingPositions = new Set(data.glowingPositions);
    }
    if (Array.isArray(data.goldenPositions)) {
      activeGoldenPositions = new Set(data.goldenPositions);
    }
    if (Array.isArray(data.revealedTiles)) {
      activeRevealedTiles = new Set(data.revealedTiles);
    }
    pendingSpecialDeal = !!data.pendingSpecialDeal;

    GAME_GRID = data.grid;
    score = typeof data.score === "number" ? data.score : 0;
    combo = typeof data.combo === "number" ? data.combo : 0;
    totalMovesPlaced = data.totalMovesPlaced || 0;
    totalLinesCleared = data.totalLinesCleared || 0;
    maxComboAchieved = data.maxComboAchieved || 0;
    multilineClears = data.multilineClears || 0;
    cumulativeEfficiency = data.cumulativeEfficiency || 0;

    if (Array.isArray(data.availableBlocks) && data.availableBlocks.length > 0) {
      availableBlocks.length = 0;
      data.availableBlocks.forEach((b: any, idx: number) => {
        availableBlocks.push({
          shape: b.shape,
          color: b.color,
          active: b.active,
          originalIndex: typeof b.originalIndex === "number" ? b.originalIndex : idx,
          isGlowing: !!b.isGlowing,
          isGolden: !!b.isGolden,
          x: 0,
          y: 0,
        });
      });
      positionTrayBlocks();
    }

    comboBar.update(combo);
    updateScoreUI();
    if (currentMode.id === GameModeId.LEVELS) {
      updateLevelHUD();
    }
    invalidateBoardCache();
    return true;
  } catch (err) {
    clearActiveGameSession();
    return false;
  }
}

let logicalWidth = 400;
let logicalHeight = 650;
let dpr = 1;
let layout: LayoutMetrics;
let gridOffset: GridOffset = { x: 0, y: 0, cellSize: 40 };

let GAME_GRID: (string | 0)[][] = Array.from({ length: currentMode.gridSize }, () =>
  Array(currentMode.gridSize).fill(0)
);

let score = 0;
let combo = 0;
let gameOver = false;

const DRAG_JUMP_LENGTH = 92; // Consistent vertical lift on touch devices to clear user's thumb

function computeDragLift(isTouch: boolean): number {
  if (!isTouch) return 0;
  return DRAG_JUMP_LENGTH;
}

let availableBlocks: TrayBlock[] = [];
let activeBlock: {
  shape: number[][];
  color: string;
  originalIndex: number;
  visualX: number;
  visualY: number;
  grabOffsetX: number;
  pieceCenterRelY: number;
  isTouch: boolean;
  originalX: number;
  originalY: number;
  scale: number;
  isGlowing?: boolean;
  isGolden?: boolean;
} | null = null;

let screenShake = 0;
let rng: PRNG = createRNG(Date.now());

function positionTrayBlocks() {
  if (!layout) return;
  const count = currentMode.handSize;
  const trayWidth = layout.boardSize;
  const trayStartX = layout.boardX;
  const slotWidth = trayWidth / count;
  const centerY = layout.trayY + layout.trayH / 2;

  availableBlocks.forEach((block, i) => {
    if (!block.active) return;
    const pieceCellSize = computePieceCellSize(
      block.shape,
      slotWidth,
      layout.trayH,
      layout.cellSize
    );
    block.cellSize = pieceCellSize;
    const pieceWidth = block.shape[0].length * pieceCellSize;
    const pieceHeight = block.shape.length * pieceCellSize;
    const slotCenterX = trayStartX + slotWidth * i + slotWidth / 2;
    block.x = Math.floor(slotCenterX - pieceWidth / 2);
    block.y = Math.floor(centerY - pieceHeight / 2);
  });
}

function resizeCanvas() {
  const container = document.getElementById("game-container");
  const rect = container ? container.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
  logicalWidth = Math.min(rect.width || window.innerWidth, 500);
  logicalHeight = rect.height || window.innerHeight;

  cachedCanvasRect = null;
  dpr = Math.min(window.devicePixelRatio || 1, 2.0);
  setSpriteScale(dpr); // re-renders cached block sprites at the new pixel density
  invalidateBoardCache();
  canvas.width = Math.floor(logicalWidth * dpr);
  canvas.height = Math.floor(logicalHeight * dpr);

  canvas.style.width = `${logicalWidth}px`;
  canvas.style.height = `${logicalHeight}px`;

  // Measure the real HUD height instead of assuming it (Levels mode adds a tall goal panel)
  const hudEl = document.getElementById("hud-overlay");
  const canvasTop = canvas.getBoundingClientRect().top;
  const hudBottom = hudEl ? hudEl.getBoundingClientRect().bottom - canvasTop : 92;
  const topInset = Math.max(70, Math.ceil(hudBottom));

  layout = computeLayout(logicalWidth, logicalHeight, topInset, currentMode.gridSize);
  gridOffset = {
    x: layout.boardX,
    y: layout.boardY,
    cellSize: layout.cellSize,
  };

  // Re-anchor tray pieces if game in progress
  positionTrayBlocks();
}

function updateHUDChances() {
  if (currentMode.id !== GameModeId.TOURNAMENT) {
    if (chancesBadgeEl) chancesBadgeEl.style.display = "none";
    if (tournamentBannerEl) tournamentBannerEl.style.display = "none";
    if (hudStakesTagEl) hudStakesTagEl.style.display = "none";
    if (hudScoreBoxEl) hudScoreBoxEl.classList.remove("prize-active");
    return;
  }

  const left = chancesManager.getChancesRemaining();
  const conf = tournamentConfigManager.getConfig();

  if (chancesBadgeEl) {
    chancesBadgeEl.style.display = "flex";
    chancesBadgeEl.textContent = `🎟️ ${left} TICKET${left === 1 ? "" : "S"}`;
    chancesBadgeEl.className = left > 0 ? "chances-pill active" : "chances-pill empty";
  }

  if (tournamentBannerEl) {
    tournamentBannerEl.style.display = "flex";
    tournamentBannerEl.className = "tournament-live-bar official";
    if (tourneyBannerTitleEl) tourneyBannerTitleEl.textContent = `🏆 ${conf.sponsorName.toUpperCase()} PRIZE RUN`;
    if (tourneyBannerSubEl) tourneyBannerSubEl.textContent = `${conf.totalPrizePool} Prize Pool • Top 10 Payouts`;
  }

  if (hudStakesTagEl) {
    hudStakesTagEl.style.display = "inline-block";
    const isVerified = authManager.isWhatsAppVerified();
    if (isVerified) {
      hudStakesTagEl.textContent = "VERIFIED PRO ✓";
      hudStakesTagEl.className = "hud-stakes-tag verified";
    } else {
      hudStakesTagEl.textContent = "OFFICIAL RUN";
      hudStakesTagEl.className = "hud-stakes-tag official";
    }
  }

  if (hudScoreBoxEl) {
    hudScoreBoxEl.classList.add("prize-active");
  }
}

function updateModeButtons() {
  modeLevelsBtn?.classList.toggle("active", currentMode.id === GameModeId.LEVELS);
  modeClassicBtn?.classList.toggle("active", currentMode.id === GameModeId.CLASSIC);
  modeTourneyBtn?.classList.toggle("active", currentMode.id === GameModeId.TOURNAMENT);
}

function updateLevelHUD() {
  if (!levelHudEl) return;

  if (currentMode.id !== GameModeId.LEVELS || !currentLevelConfig || !currentWorldTheme) {
    levelHudEl.style.display = "none";
    return;
  }

  levelHudEl.style.display = "flex";

  if (levelHudBadge) levelHudBadge.textContent = `LEVEL ${currentLevelConfig.level}`;
  if (levelHudWorld) levelHudWorld.textContent = currentWorldTheme.name;

  if (levelHudGoals) {
    levelHudGoals.innerHTML = activeLevelGoals
      .map((g) => {
        let isDone = g.current >= g.target;
        if (g.type === GoalType.GEMS) {
          return `
            <div class="goal-chip gem-goal-chip ${isDone ? "completed" : ""}">
              <svg viewBox="0 0 24 24" width="16" height="16" style="flex-shrink: 0; filter: drop-shadow(0 0 3px rgba(0, 229, 255, 0.6));">
                <polygon points="12,2 21,12 12,22 3,12" fill="#00e5ff" stroke="#ffffff" stroke-width="1.6" />
                <polygon points="12,6 17,12 12,18 7,12" fill="#ffffff" opacity="0.65" />
              </svg>
              <span>Gems: <strong>${Math.min(g.current, g.target)}/${g.target}</strong></span>
            </div>
          `;
        }
        let label = "";
        if (g.type === GoalType.LINES) {
          label = `🎯 Lines: ${Math.min(g.current, g.target)}/${g.target}`;
        } else if (g.type === GoalType.SCORE) {
          label = `⭐ Score: ${Math.min(g.current, g.target)}/${g.target}`;
        }
        return `<div class="goal-chip ${isDone ? "completed" : ""}">${label}</div>`;
      })
      .join("");
  }

  if (levelHudMoves && levelMovesValue) {
    if (levelParMoves > 0) {
      levelHudMoves.style.display = "flex";
      levelMovesValue.textContent = `${levelMovesCount}/${levelParMoves}`;
      const isUnderPar = levelMovesCount <= levelParMoves;
      levelHudMoves.className = `level-hud-moves ${isUnderPar ? "under-par" : "over-par"}`;
      const movesLabel = levelHudMoves.querySelector(".moves-label");
      if (movesLabel) {
        movesLabel.textContent = isUnderPar ? "MOVES / PAR" : "MOVES TAKEN";
      }
    } else {
      levelHudMoves.style.display = "none";
    }
  }
}

function initLevelGame(
  levelNum: number,
  _isReplay: boolean = false,
  isResume: boolean = false
) {
  hideModal();
  hideLevelModal();
  hideLevelSelect();
  hidePreTourneyModal();
  hideTourneyRulesModal();

  if (!isResume) {
    clearActiveGameSession();
    resetPerformanceMetrics();
    activeGlowingPositions.clear();
    activeGoldenPositions.clear();
    pendingSpecialDeal = false;
    lastAnnouncedMilestone = 0;
  }

  currentMode = GAME_MODES[GameModeId.LEVELS];
  const config = LEVEL_DATA[levelNum - 1] || LEVEL_DATA[0];
  currentLevelConfig = config;
  currentWorldTheme = WORLD_THEMES[config.worldIndex];
  activeLevelGoals = config.goals.map((g) => ({ ...g, current: 0 }));
  levelParMoves = config.parMoves || config.maxMoves || 20;
  if (!isResume) {
    levelMovesCount = 0;
  }
  movesRemaining = null;
  canReviveInCurrentLevel = true;

  if (!isResume) {
    activeRevealedTiles.clear();
    allTilesPreviouslyRevealed = false;
  }

  activeGemPositions.clear();
  activeObstaclePositions.clear();

  GAME_GRID = Array.from({ length: 8 }, () => Array(8).fill(0));

  // Populate prefilled tiles and gems
  if (config.prefilledTiles) {
    config.prefilledTiles.forEach((tile) => {
      GAME_GRID[tile.row][tile.col] = tile.color;
      if (tile.isGem) {
        activeGemPositions.add(`${tile.col},${tile.row}`);
      } else {
        activeObstaclePositions.add(`${tile.col},${tile.row}`);
      }
    });
  }

  score = 0;
  combo = 0;
  gameOver = false;
  activeBlock = null;

  rng = createRNG(Date.now());
  resizeCanvas();

  createTrayBlocks({
    availableBlocks,
    canvasWidth: logicalWidth,
    trayY: layout.trayY,
    trayH: layout.trayH,
    boardCellSize: layout.cellSize,
    boardX: layout.boardX,
    boardSize: layout.boardSize,
    rng,
    handSize: currentMode.handSize,
    allowedTiers: config.allowedTiers,
    failCount: levelFailCountMap[config.level] || 0,
    grid: GAME_GRID,
    blocksPlaced: totalMovesPlaced,
    maxMoves: config.maxMoves,
  });

  particles.clear();
  floatingTexts.clear();
  comboBar.reset();
  updateScoreUI();
  updateHUDChances();
  updateModeButtons();
  updateLevelHUD();

  // Apply background: if paper theme is active use paper, otherwise apply user wallpaper
  const gameContainer = document.getElementById("game-container");
  if (gameContainer) {
    if (isPaperTheme) {
      gameContainer.style.background = "none";
      gameContainer.style.backgroundImage = "none";
      gameContainer.style.backgroundColor = "#fbf8f2";
      document.body.style.background = "#efe7d8";
    } else {
      wallpaperManager.apply();
    }
  }
}

function initClassicGame(isResume: boolean = false) {
  hideModal();
  hideLevelModal();
  hideLevelSelect();
  hidePreTourneyModal();
  hideTourneyRulesModal();

  if (!isResume) {
    clearActiveGameSession();
    resetPerformanceMetrics();
    activeGlowingPositions.clear();
    activeGoldenPositions.clear();
    pendingSpecialDeal = false;
    lastAnnouncedMilestone = 0;
    activeRevealedTiles.clear();
    allTilesPreviouslyRevealed = false;
  }

  currentMode = GAME_MODES[GameModeId.CLASSIC];
  currentLevelConfig = null;
  currentWorldTheme = null;
  activeGemPositions.clear();
  activeObstaclePositions.clear();

  // Classic is free endless play: unranked warmup stakes
  chancesManager.setPracticeMode(true);

  GAME_GRID = Array.from({ length: currentMode.gridSize }, () =>
    Array(currentMode.gridSize).fill(0)
  );
  score = 0;
  combo = 0;
  gameOver = false;
  activeBlock = null;

  rng = createRNG(Date.now());
  resizeCanvas();

  createTrayBlocks({
    availableBlocks,
    canvasWidth: logicalWidth,
    trayY: layout.trayY,
    trayH: layout.trayH,
    boardCellSize: layout.cellSize,
    boardX: layout.boardX,
    boardSize: layout.boardSize,
    rng,
    handSize: currentMode.handSize,
    grid: GAME_GRID,
    blocksPlaced: totalMovesPlaced,
  });

  particles.clear();
  floatingTexts.clear();
  comboBar.reset();
  updateScoreUI();
  updateHUDChances();
  updateModeButtons();
  updateLevelHUD();

  const gameContainer = document.getElementById("game-container");
  if (gameContainer) {
    if (isPaperTheme) {
      gameContainer.style.background = "none";
      gameContainer.style.backgroundImage = "none";
      gameContainer.style.backgroundColor = "#fbf8f2";
      document.body.style.background = "#efe7d8";
    } else {
      wallpaperManager.apply(false); // Player's personal wallpaper
    }
  }
}

function initTournamentGame(
  isPractice: boolean = false,
  isResume: boolean = false
) {
  hideModal();
  hideLevelModal();
  hideLevelSelect();
  hidePreTourneyModal();
  hideTourneyRulesModal();

  if (!isResume) {
    clearActiveGameSession();
    resetPerformanceMetrics();
    activeGlowingPositions.clear();
    activeGoldenPositions.clear();
    pendingSpecialDeal = false;
    lastAnnouncedMilestone = 0;
    activeRevealedTiles.clear();
    allTilesPreviouslyRevealed = false;
  }

  currentMode = GAME_MODES[GameModeId.TOURNAMENT];
  currentLevelConfig = null;
  currentWorldTheme = null;
  activeGemPositions.clear();
  activeObstaclePositions.clear();

  chancesManager.setPracticeMode(isPractice);

  if (!isPractice && !isResume) {
    const hasChance = chancesManager.consumeChance();
    if (!hasChance) {
      chancesManager.setPracticeMode(true);
    }
  }

  GAME_GRID = Array.from({ length: currentMode.gridSize }, () =>
    Array(currentMode.gridSize).fill(0)
  );
  score = 0;
  combo = 0;
  gameOver = false;
  activeBlock = null;
  const activeTourneyId = tournamentConfigManager.getActiveTournamentId();
  const session = sessionManager.startSession(undefined, activeTourneyId);
  rng = createRNG(session.seed);
  currentTournamentSeed = session.seed;
  currentTournamentToken = null;

  if (!isPractice && !isResume) {
    const profile = authManager.getProfile();
    const playerId = profile?.id || "guest_" + Math.random().toString(36).substring(2, 9);
    requestTournamentSessionToken(playerId, "classic")
      .then((data) => {
        currentTournamentToken = data.token;
        if (data.seed) {
          currentTournamentSeed = data.seed;
        }
      })
      .catch((err) => {
        console.warn("Could not retrieve session token:", err);
      });
  }

  resizeCanvas();

  createTrayBlocks({
    availableBlocks,
    canvasWidth: logicalWidth,
    trayY: layout.trayY,
    trayH: layout.trayH,
    boardCellSize: layout.cellSize,
    boardX: layout.boardX,
    boardSize: layout.boardSize,
    rng,
    handSize: currentMode.handSize,
    grid: GAME_GRID,
    blocksPlaced: totalMovesPlaced,
  });

  particles.clear();
  floatingTexts.clear();
  comboBar.reset();
  updateScoreUI();
  updateHUDChances();
  updateModeButtons();
  updateLevelHUD();

  // Apply dedicated SPONSOR Wallpaper for official prize tournament
  const gameContainer = document.getElementById("game-container");
  if (gameContainer) {
    if (isPaperTheme) {
      gameContainer.style.background = "none";
      gameContainer.style.backgroundImage = "none";
      gameContainer.style.backgroundColor = "#fbf8f2";
      document.body.style.background = "#efe7d8";
    } else {
      wallpaperManager.apply(true); // Dedicated SPONSOR wallpaper!
    }
  }
}

function updateScoreUI() {
  if (scoreDisplayEl) {
    scoreDisplayEl.textContent = score.toLocaleString();
  }
  if (bestDisplayEl) {
    const best = Math.max(score, leaderboardManager.getTourneyBestScore());
    bestDisplayEl.textContent = best > 0 ? best.toLocaleString() : "6,177";
  }
}

// Unified Pointer Handlers
let cachedCanvasRect: DOMRect | null = null;

function getCanvasCoords(clientX: number, clientY: number): { x: number; y: number } {
  if (!cachedCanvasRect) {
    cachedCanvasRect = canvas.getBoundingClientRect();
  }
  const scaleX = logicalWidth / cachedCanvasRect.width;
  const scaleY = logicalHeight / cachedCanvasRect.height;
  return {
    x: (clientX - cachedCanvasRect.left) * scaleX,
    y: (clientY - cachedCanvasRect.top) * scaleY,
  };
}

let toastEl: HTMLElement | null = null;
function showGameOverToast(message: string) {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.id = "gameOverToastBanner";
    toastEl.className = "game-over-toast-banner";
    const container = document.getElementById("game-container") || document.body;
    container.appendChild(toastEl);
  }
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(() => {
    toastEl?.classList.remove("show");
  }, 2200);
}

function checkBoardGameOver(): boolean {
  if (gameOver) return false;
  if (!availableBlocks.some((b) => b.active)) return false;

  if (!canPlaceAnyBlock({ grid: GAME_GRID, availableBlocks })) {
    gameOver = true;
    clearActiveGameSession();
    soundManager.playGameOver();

    // Instant on-screen DOM toast + canvas milestone so player immediately knows no space remains
    showGameOverToast("🚫 NO SPACE FOR BRICKS — OUT OF MOVES!");
    const centerBoardX = layout.boardX + layout.boardSize / 2;
    const centerBoardY = layout.boardY + layout.boardSize / 2;
    floatingTexts.spawnMilestone(
      "🏁 GAME OVER — NO SPACE FOR BRICKS",
      "No moves left on the board!",
      centerBoardX,
      centerBoardY
    );

    if (currentMode.id === GameModeId.LEVELS && currentLevelConfig) {
      const currentLvl = currentLevelConfig.level;
      levelFailCountMap[currentLvl] = (levelFailCountMap[currentLvl] || 0) + 1;

      setTimeout(() => {
        showLevelFailedModal({
          level: currentLvl,
          score,
          reason: "No space for blocks!",
          canRevive: canReviveInCurrentLevel,
          onRetry: () => initLevelGame(currentLvl),
          onReviveMoves: () => {
            canReviveInCurrentLevel = false;
            gameOver = false;
            // Keep board, jewel blocks, and obstacles 100% intact
            updateLevelHUD();
            soundManager.playClear(2);

            floatingTexts.spawnMilestone(
              "✨ RESCUED!",
              "Rescue pieces incoming — keep going!",
              layout.boardX + layout.boardSize / 2,
              layout.boardY + layout.boardSize / 2
            );

            // ALWAYS generate fresh, guaranteed-playable rescue pieces upon revive!
            createTrayBlocks({
              availableBlocks,
              canvasWidth: logicalWidth,
              trayY: layout.trayY,
              trayH: layout.trayH,
              boardCellSize: layout.cellSize,
              boardX: layout.boardX,
              boardSize: layout.boardSize,
              rng,
              handSize: currentMode.handSize,
              allowedTiers: [ShapeTier.HELPER],
              failCount: Math.max(3, (levelFailCountMap[currentLvl] || 0) + 2),
              grid: GAME_GRID,
              blocksPlaced: totalMovesPlaced,
              maxMoves: currentLevelConfig?.maxMoves,
              isSpecialDeal: true,
            });
            saveActiveGameSession();
          },
          onOpenMap: () =>
            showLevelSelect({
              onSelectLevel: (lvl) => initLevelGame(lvl),
              onClose: () => {},
            }),
        });
      }, 300);
    } else {
      // Classic or Official Tournament Mode
      const isTournament = currentMode.id === GameModeId.TOURNAMENT;
      try {
        leaderboardManager.recordTourneyScore(score);
        sessionManager.finishSession(score);
      } catch (e) {
        console.warn("Session score storage error:", e);
      }

      if (isTournament) {
        try {
          const profile = authManager.getProfile();
          const playerId = profile?.id || "guest_player";
          const nickname = profile?.nickname || "Guest Player";
          const activeTourneyId = tournamentConfigManager.getActiveTournamentId();

          submitTournamentScore({
            playerId,
            fullName: profile?.fullName || null,
            nickname,
            phone: profile?.phone,
            country: profile?.country,
            isVerified: !!profile?.verified,
            mode: "classic",
            tournamentId: activeTourneyId,
            score,
            linesCleared: totalLinesCleared,
            movesPlaced: totalMovesPlaced,
            maxCombo: maxComboAchieved,
            seed: currentTournamentSeed || Date.now(),
            token: currentTournamentToken || undefined,
          }).catch((err) => {
            console.warn("Async tournament score submit fallback:", err);
          });
        } catch (authErr) {
          console.warn("Tournament profile retrieval fallback:", authErr);
        }
      }

      // Display Game Over Modal with performance metrics
      setTimeout(() => {
        try {
          showModal(score, currentMode.name, computePerformanceStats());
        } catch (modalErr) {
          console.error("showModal execution fallback:", modalErr);
          showModal(score, currentMode.name);
        }
      }, 300);
    }

    // Verify any pending referral if newcomer completed a game
    try {
      referralManager.verifyPendingReferralOnFirstGame(score).then((res) => {
        if (res.verified) {
          updateHUDChances();
          const cbX = gridOffset.x + (currentMode.gridSize * gridOffset.cellSize) / 2;
          const cbY = gridOffset.y + (currentMode.gridSize * gridOffset.cellSize) / 2;
          floatingTexts.spawnMilestone("🎁 WELCOME BONUS!", "+1 Bonus Ticket Unlocked!", cbX, cbY);
        }
      });
    } catch {}

    return true;
  }
  return false;
}

function handlePointerDown(clientX: number, clientY: number, isTouch: boolean) {
  if (gameOver) return;

  const { x, y } = getCanvasCoords(clientX, clientY);

  for (let i = 0; i < availableBlocks.length; i++) {
    const block = availableBlocks[i];
    if (!block.active) continue;

    const blockSize = block.cellSize || Math.floor(layout.cellSize * 0.72);
    const w = block.shape[0].length * blockSize;
    const h = block.shape.length * blockSize;
    const hitPadding = isTouch ? 18 : 6;

    if (
      x >= block.x - hitPadding &&
      x <= block.x + w + hitPadding &&
      y >= block.y - hitPadding &&
      y <= block.y + h + hitPadding
    ) {
      const pieceCenterRelX = (block.shape[0].length * layout.cellSize) / 2;
      const pieceCenterRelY = (block.shape.length * layout.cellSize) / 2;
      const lift = computeDragLift(isTouch);

      activeBlock = {
        shape: block.shape,
        color: block.color,
        originalIndex: i,
        visualX: x - pieceCenterRelX,
        visualY: y - pieceCenterRelY - lift,
        grabOffsetX: pieceCenterRelX,
        pieceCenterRelY,
        isTouch,
        originalX: block.x,
        originalY: block.y,
        scale: blockSize / layout.cellSize,
        isGlowing: block.isGlowing,
        isGolden: block.isGolden,
      };

      soundManager.playPlace();
      break;
    }
  }
}

function handlePointerMove(clientX: number, clientY: number) {
  if (!activeBlock) return;

  const { x, y } = getCanvasCoords(clientX, clientY);
  const currentLift = computeDragLift(activeBlock.isTouch);
  activeBlock.visualX = x - activeBlock.grabOffsetX;
  activeBlock.visualY = y - activeBlock.pieceCenterRelY - currentLift;
}

function handlePointerUp() {
  if (!activeBlock) return;

  const placement = findBestGridPlacement({
    grid: GAME_GRID,
    block: activeBlock,
    blockVisualX: activeBlock.visualX,
    blockVisualY: activeBlock.visualY,
    offset: gridOffset,
  });

  if (placement.canPlace) {
    totalMovesPlaced++;

    // 1. Place onto grid & register special piece aura
    for (let y = 0; y < activeBlock.shape.length; y++) {
      for (let x = 0; x < activeBlock.shape[y].length; x++) {
        if (activeBlock.shape[y][x]) {
          const gx = placement.gridX + x;
          const gy = placement.gridY + y;
          const key = `${gx},${gy}`;
          GAME_GRID[gy][gx] = activeBlock.color;
          if (activeBlock.isGlowing) {
            activeGlowingPositions.add(key);
          }
          if (activeBlock.isGolden) {
            activeGoldenPositions.add(key);
          }
        }
      }
    }

    // 2. Mark piece consumed
    availableBlocks[activeBlock.originalIndex].active = false;

    // 3. Track moves placed in Level mode
    const isLevelMode = currentMode.id === GameModeId.LEVELS && currentLevelConfig !== null;
    if (isLevelMode) {
      levelMovesCount++;
    }

    // 4. Clear lines & spawn particles + collect gems
    let glowingBlocksBlasted = 0;
    let goldenBlocksBlasted = 0;
    const gridSize = GAME_GRID.length;

    // Detect if any glowing or golden blocks are within cleared lines
    for (let r = 0; r < gridSize; r++) {
      if (GAME_GRID[r].every((c) => c !== 0)) {
        for (let c = 0; c < gridSize; c++) {
          const key = `${c},${r}`;
          if (activeGlowingPositions.has(key)) glowingBlocksBlasted++;
          if (activeGoldenPositions.has(key)) goldenBlocksBlasted++;
        }
      }
    }
    for (let c = 0; c < gridSize; c++) {
      let colFull = true;
      for (let r = 0; r < gridSize; r++) {
        if (GAME_GRID[r][c] === 0) {
          colFull = false;
          break;
        }
      }
      if (colFull) {
        for (let r = 0; r < gridSize; r++) {
          const key = `${c},${r}`;
          if (activeGlowingPositions.has(key)) glowingBlocksBlasted++;
          if (activeGoldenPositions.has(key)) goldenBlocksBlasted++;
        }
      }
    }

    const { linesCleared, clearedBlockCount, gemsCleared, isAllClear, rowsToClear, colsToClear } = checkAndClearLines(
      GAME_GRID,
      gridOffset,
      isLevelMode ? activeGemPositions : undefined,
      isLevelMode ? activeObstaclePositions : undefined,
      activeBlock.color
    );

    // Option A: Unmask / scratch-off background wallpaper tiles under cleared rows & cols
    if (linesCleared > 0 && rowsToClear && colsToClear) {
      let newlyRevealed = 0;
      for (const r of rowsToClear) {
        for (let x = 0; x < gridSize; x++) {
          const key = `${x},${r}`;
          if (!activeRevealedTiles.has(key)) {
            activeRevealedTiles.add(key);
            newlyRevealed++;
          }
        }
      }
      for (const c of colsToClear) {
        for (let y = 0; y < gridSize; y++) {
          const key = `${c},${y}`;
          if (!activeRevealedTiles.has(key)) {
            activeRevealedTiles.add(key);
            newlyRevealed++;
          }
        }
      }

      if (newlyRevealed > 0) {
        const totalTiles = gridSize * gridSize;
        const percent = Math.round((activeRevealedTiles.size / totalTiles) * 100);
        const centerBoardX = gridOffset.x + (gridSize * gridOffset.cellSize) / 2;
        const centerBoardY = gridOffset.y + (gridSize * gridOffset.cellSize) / 2;

        if (activeRevealedTiles.size === totalTiles && !allTilesPreviouslyRevealed) {
          allTilesPreviouslyRevealed = true;
          unlockPhotoReveal();
          floatingTexts.spawnMilestone("🌟 100% PHOTO REVEALED!", "Full Wallpaper Unmasked!", centerBoardX, centerBoardY);
          particles.spawnFireworks(centerBoardX, centerBoardY, 48);
          soundManager.playAllClear();
        } else if (newlyRevealed >= 8) {
          floatingTexts.spawnMilestone(`🖼️ +${newlyRevealed} TILES REVEALED`, `${percent}% Photo Unmasked`, centerBoardX, centerBoardY);
        }
      }
    }

    // Clean up cleared glowing and golden positions from board
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (GAME_GRID[r][c] === 0) {
          const key = `${c},${r}`;
          activeGlowingPositions.delete(key);
          activeGoldenPositions.delete(key);
        }
      }
    }

    // Track Skill & Efficiency Metrics
    if (linesCleared > 0) {
      totalLinesCleared += linesCleared;
      if (linesCleared >= 2) multilineClears++;
    }
    let occupiedCount = 0;
    for (let r = 0; r < GAME_GRID.length; r++) {
      for (let c = 0; c < GAME_GRID[r].length; c++) {
        if (GAME_GRID[r][c] !== 0) occupiedCount++;
      }
    }
    const density = occupiedCount / (GAME_GRID.length * GAME_GRID.length);
    const moveEff = linesCleared > 0
      ? Math.min(1.0, 0.45 + 0.25 * linesCleared)
      : Math.max(0.2, 1.0 - density * 0.7);
    cumulativeEfficiency += moveEff;

    // 5. Scoring & combo calculation
    const blockPoints = countBlocks(activeBlock.shape) * 10;
    let earnedPoints = blockPoints;

    let specialMultiplier = 1.0;
    if (goldenBlocksBlasted > 0) {
      specialMultiplier = 2.0;
    } else if (glowingBlocksBlasted > 0) {
      specialMultiplier = 1.5;
    }

    if (linesCleared > 0) {
      combo++;
      if (combo > maxComboAchieved) maxComboAchieved = combo;
      const baseLinePoints = linesCleared * 100 * combo + clearedBlockCount * 5;
      const lineMultiplier = Math.round(baseLinePoints * specialMultiplier);
      earnedPoints += lineMultiplier;
      score += earnedPoints;

      const centerDropX =
        gridOffset.x + (placement.gridX + activeBlock.shape[0].length / 2) * gridOffset.cellSize;
      const centerDropY =
        gridOffset.y + (placement.gridY + activeBlock.shape.length / 2) * gridOffset.cellSize;

      if (isAllClear) {
        // Triumphant ALL CLEAR Celebration (+500 pts, chime, fireworks, screen shake)
        const allClearBonus = 500;
        score += allClearBonus;
        soundManager.playAllClear();
        screenShake = 16;
        const centerBoardX = gridOffset.x + (gridSize * gridOffset.cellSize) / 2;
        const centerBoardY = gridOffset.y + (gridSize * gridOffset.cellSize) / 2;
        floatingTexts.spawnAllClear(centerBoardX, centerBoardY, allClearBonus);
        particles.spawnFireworks(centerBoardX, centerBoardY, 40);
        pendingSpecialDeal = true;
      } else {
        soundManager.playClear(combo);
        // Trigger juicy screen shake on combos & multi-lines!
        screenShake = Math.min(12, linesCleared * 3.5 + (combo >= 2 ? combo * 2.5 : 0));
        floatingTexts.spawnPraise(linesCleared, combo, centerDropX, centerDropY);
        floatingTexts.spawnScoreBonus(earnedPoints, centerDropX, centerDropY - 26);
      }

      // High streaks trigger special piece deals in next tray refill
      if (combo >= 4) {
        pendingSpecialDeal = true;
      }
      if (combo >= 5) {
        if (unlockPhotoReveal()) {
          const centerBoardX = gridOffset.x + (gridSize * gridOffset.cellSize) / 2;
          const centerBoardY = gridOffset.y + (gridSize * gridOffset.cellSize) / 2;
          floatingTexts.spawnMilestone("🔓 PHOTO GLASS UNLOCKED!", "Glass Mode Unlocked in Settings", centerBoardX, centerBoardY);
        }
      }
    } else {
      combo = 0;
      score += earnedPoints;
      soundManager.playPlace();
    }

    comboBar.update(combo);
    updateScoreUI();

    // In Official Prize Runs, celebrate competitive milestone ranks!
    if (
      currentMode.id !== GameModeId.LEVELS &&
      !chancesManager.isPracticeMode() &&
      linesCleared > 0
    ) {
      const centerBoardX = gridOffset.x + (gridSize * gridOffset.cellSize) / 2;
      const centerBoardY = gridOffset.y + (gridSize * gridOffset.cellSize) / 2;

      if (score >= 9500 && lastAnnouncedMilestone < 9500) {
        lastAnnouncedMilestone = 9500;
        soundManager.playAllClear();
        floatingTexts.spawnMilestone("👑 PODIUM CONTENDER!", "Estimated Rank #1 - #3 ($100-$250)", centerBoardX, centerBoardY);
      } else if (score >= 5000 && lastAnnouncedMilestone < 5000) {
        lastAnnouncedMilestone = 5000;
        soundManager.playClear(4);
        floatingTexts.spawnMilestone("🔥 TOP 10 CASH ZONE!", "Inside Weekly Cash Payouts", centerBoardX, centerBoardY);
      } else if (score >= 2500 && lastAnnouncedMilestone < 2500) {
        lastAnnouncedMilestone = 2500;
        soundManager.playClear(3);
        floatingTexts.spawnMilestone("⭐ TOP 20 ACHIEVED!", "Approaching Cash Prize Line", centerBoardX, centerBoardY);
      } else if (score >= 1000 && lastAnnouncedMilestone < 1000) {
        lastAnnouncedMilestone = 1000;
        floatingTexts.spawnMilestone("🎖️ TOP 50 ENTRY!", "Official Run Advancing", centerBoardX, centerBoardY);
      }
    }

    // 6. Level Mode Goal Checking & Victory Condition
    if (isLevelMode && currentLevelConfig) {
      activeLevelGoals.forEach((goal) => {
        if (goal.type === GoalType.LINES) {
          goal.current += linesCleared;
        } else if (goal.type === GoalType.SCORE) {
          goal.current = score;
        } else if (goal.type === GoalType.GEMS) {
          goal.current += gemsCleared;
        }
      });

      updateLevelHUD();

      const allGoalsMet = activeLevelGoals.every((g) => g.current >= g.target);
      if (allGoalsMet) {
        gameOver = true;
        clearActiveGameSession();

        const currentLvl = currentLevelConfig.level;
        const parMoves = currentLevelConfig.parMoves || currentLevelConfig.maxMoves || 20;
        const movesSaved = Math.max(0, parMoves - levelMovesCount);
        const efficiencyBonus = movesSaved * 120;

        if (movesSaved > 0) {
          score += efficiencyBonus;
          updateScoreUI();
          soundManager.playAllClear();
          particles.spawnFireworks(
            layout.boardX + layout.boardSize / 2,
            layout.boardY + layout.boardSize / 2
          );
          floatingTexts.spawnMilestone(
            "🎯 EFFICIENCY MASTER!",
            `+${efficiencyBonus.toLocaleString()} PTS (${movesSaved} MOVES SAVED)`,
            layout.boardX + layout.boardSize / 2,
            layout.boardY + layout.boardSize / 2
          );
        } else {
          soundManager.playClear(4);
        }

        const stars = levelProgress.calculateStars(
          score,
          currentLevelConfig.starThresholds
        );
        levelProgress.completeLevel(currentLvl, score, stars);
        levelFailCountMap[currentLvl] = 0;
        referralManager.verifyPendingReferralOnFirstGame(score);

        setTimeout(() => {
          showLevelCompleteModal({
            level: currentLvl,
            score,
            stars,
            movesUsed: levelMovesCount,
            parMoves,
            movesSaved,
            efficiencyBonus,
            hasNextLevel: currentLvl < LEVEL_DATA.length,
            onNextLevel: () => initLevelGame(currentLvl + 1),
            onRetry: () => initLevelGame(currentLvl, true),
            onOpenMap: () =>
              showLevelSelect({
                onSelectLevel: (lvl) => initLevelGame(lvl),
                onClose: () => {},
              }),
            onGoTournament: () => promptTournamentEntry(),
          });
        }, 350);

        activeBlock = null;
        return;
      }
    } else {
      // Tournament mode anti-cheat log
      sessionManager.logMove(
        activeBlock.originalIndex,
        placement.gridX,
        placement.gridY,
        linesCleared,
        earnedPoints
      );
    }

    // 7. Refill tray if all pieces used
    const allConsumed = availableBlocks.every((b) => !b.active);
    if (allConsumed) {
      createTrayBlocks({
        availableBlocks,
        canvasWidth: logicalWidth,
        trayY: layout.trayY,
        trayH: layout.trayH,
        boardCellSize: layout.cellSize,
        boardX: layout.boardX,
        boardSize: layout.boardSize,
        rng,
        handSize: currentMode.handSize,
        allowedTiers: currentLevelConfig?.allowedTiers,
        failCount: currentLevelConfig ? levelFailCountMap[currentLevelConfig.level] || 0 : 0,
        grid: GAME_GRID,
        blocksPlaced: totalMovesPlaced,
        maxMoves: currentLevelConfig?.maxMoves,
        isSpecialDeal: pendingSpecialDeal,
      });
      pendingSpecialDeal = false;
    }

    // Save valid state to local storage for seamless mid-game resume
    saveActiveGameSession();
  }

  activeBlock = null;

  // 8. Check Game Over (Board Blocked) - checks whether piece was placed or dropped without valid placement
  checkBoardGameOver();
}

// Unified Pointer Events (mouse + touch + pen) - replaces separate mouse/touch listeners
let activePointerId: number | null = null;

canvas.addEventListener(
  "pointerdown",
  (e) => {
    if (activePointerId !== null) return;
    e.preventDefault();
    cachedCanvasRect = canvas.getBoundingClientRect();
    handlePointerDown(e.clientX, e.clientY, e.pointerType !== "mouse");
    if (activeBlock) {
      activePointerId = e.pointerId;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {}
    }
  },
  { passive: false }
);

canvas.addEventListener(
  "pointermove",
  (e) => {
    if (e.pointerId !== activePointerId) return;
    e.preventDefault();
    handlePointerMove(e.clientX, e.clientY);
  },
  { passive: false }
);

const endPointer = (e: PointerEvent) => {
  if (activePointerId !== null && e.pointerId !== activePointerId) return;
  activePointerId = null;
  cachedCanvasRect = null;
  handlePointerUp();
};
canvas.addEventListener("pointerup", endPointer);
window.addEventListener("pointerup", endPointer);

const cancelPointer = (e: PointerEvent) => {
  if (activePointerId !== null && e.pointerId !== activePointerId) return;
  activePointerId = null;
  cachedCanvasRect = null;
  activeBlock = null; // cancelled gesture: return piece to tray, never place it
  checkBoardGameOver();
};
canvas.addEventListener("pointercancel", cancelPointer);
window.addEventListener("pointercancel", cancelPointer);

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

window.addEventListener("resize", () => {
  resizeCanvas();
});

// Re-layout whenever the HUD or container changes size (e.g. switching Levels <-> Classic/Blitz)
const hudOverlayEl = document.getElementById("hud-overlay");
if (hudOverlayEl && "ResizeObserver" in window) {
  let lastHudH = 0;
  new ResizeObserver(() => {
    const h = Math.round(hudOverlayEl.getBoundingClientRect().height);
    if (h !== lastHudH) {
      lastHudH = h;
      resizeCanvas();
    }
  }).observe(hudOverlayEl);
}
const gameContainerEl = document.getElementById("game-container");
if (gameContainerEl && "ResizeObserver" in window) {
  new ResizeObserver(() => {
    resizeCanvas();
  }).observe(gameContainerEl);
}

// Mute toggle
muteBtn?.addEventListener("click", () => {
  const isMuted = soundManager.toggleMute();
  if (muteBtn) muteBtn.textContent = isMuted ? "🔇" : "🔊";
});

// Theme toggle (Paper / Dark mode)
themeBtn?.addEventListener("click", () => {
  applyTheme(!isPaperTheme);
});

// Wallpaper & Theme Customization Modal
wallpaperBtn?.addEventListener("click", () => {
  showWallpaperModal();
});

wallpaperManager.onChange(() => {
  if (currentMode.id === GameModeId.TOURNAMENT) {
    wallpaperManager.apply(true);
  } else {
    applyTheme(isPaperTheme);
  }
  invalidateBoardCache();
});

// 3-Way Mode Switch Buttons
leaderboardBtn?.addEventListener("click", () => {
  leaderboardManager.show(currentMode.id === GameModeId.LEVELS ? "stars" : "tourney");
});

modeLevelsBtn?.addEventListener("click", () => {
  showLevelSelect({
    onSelectLevel: (lvl) => initLevelGame(lvl),
    onClose: () => {},
  });
});

levelMapShortcutBtn?.addEventListener("click", () => {
  showLevelSelect({
    onSelectLevel: (lvl) => initLevelGame(lvl),
    onClose: () => {},
  });
});

const levelRestartBtn = document.getElementById("level-restart-btn");
levelRestartBtn?.addEventListener("click", () => {
  if (currentMode.id === GameModeId.LEVELS && currentLevelConfig) {
    initLevelGame(currentLevelConfig.level, true);
  }
});

function promptTournamentEntry() {
  const chancesLeft = chancesManager.getChancesRemaining();
  showPreTourneyModal({
    chancesRemaining: chancesLeft,
    onStartOfficial: () => {
      initTournamentGame(false);
    },
    onGoToClassic: () => {
      initClassicGame();
    },
    onInviteWhatsApp: () => {
      authManager.openReferralShare();
    },
    onClose: () => {},
  });
}

modeClassicBtn?.addEventListener("click", () => {
  initClassicGame();
});

modeTourneyBtn?.addEventListener("click", () => {
  promptTournamentEntry();
});

chancesBadgeEl?.addEventListener("click", () => {
  promptTournamentEntry();
});

tournamentBannerEl?.addEventListener("click", () => {
  promptTournamentEntry();
});

// Setup Tournament Game Over Modal
createGameOverModal({
  onRestart: () => {
    hideModal();
    if (currentMode.id === GameModeId.CLASSIC) {
      initClassicGame();
    } else {
      const left = chancesManager.getChancesRemaining();
      if (left > 0) {
        initTournamentGame(false);
      } else {
        promptTournamentEntry();
      }
    }
  },
  onGoToClassic: () => {
    hideModal();
    initClassicGame();
  },
});

// Main Game Render Loop
function gameLoop() {
  ctx.save();
  ctx.scale(dpr, dpr);

  // Screen shake on combos & multi-line blasts
  if (screenShake > 0) {
    const sx = (Math.random() - 0.5) * screenShake;
    const sy = (Math.random() - 0.5) * screenShake;
    ctx.translate(sx, sy);
    screenShake *= 0.82;
    if (screenShake < 0.3) screenShake = 0;
  }

  // Clear frame
  ctx.clearRect(0, 0, logicalWidth, logicalHeight);

  if (isPaperTheme) {
    ctx.fillStyle = "#fbf8f2";
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);
  } else if (wallpaperManager.isCustomActive(currentMode.id === GameModeId.TOURNAMENT)) {
    // Semi-transparent contrast scrim over custom uploaded photos OR tournament sponsor wallpaper
    ctx.fillStyle = `rgba(10, 15, 29, ${wallpaperManager.getDimming()})`;
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);
  }

  // Draw Grid with theme and gem markers
  drawGrid(
    ctx,
    GAME_GRID,
    gridOffset,
    currentWorldTheme || undefined,
    currentMode.id === GameModeId.LEVELS ? activeGemPositions : undefined,
    currentMode.id === GameModeId.LEVELS ? activeObstaclePositions : undefined,
    isPaperTheme,
    activeGlowingPositions,
    activeGoldenPositions,
    activeRevealedTiles,
    getPhotoRevealMode()
  );

  // Draw Particles & Floating Praise Text
  particles.updateAndDraw(ctx);
  floatingTexts.updateAndDraw(ctx);

  // Draw Available Blocks in Tray (with framing, slot cradles, and dynamic solvability dimming)
  drawTray(ctx, availableBlocks, layout, undefined, isPaperTheme, GAME_GRID);

  // Draw Ghost Block & Dragged Piece
  if (activeBlock) {
    activeBlock.scale += (1.0 - activeBlock.scale) * 0.28;

    const placement = findBestGridPlacement({
      grid: GAME_GRID,
      block: activeBlock,
      blockVisualX: activeBlock.visualX,
      blockVisualY: activeBlock.visualY,
      offset: gridOffset,
    });

    if (placement.canPlace) {
      drawGhostBlock(
        ctx,
        activeBlock.shape,
        placement.gridX,
        placement.gridY,
        gridOffset,
        activeBlock.color,
        GAME_GRID,
        currentMode.id === GameModeId.LEVELS ? activeGemPositions : undefined,
        currentWorldTheme ? currentWorldTheme.gemColor : "#ffd600"
      );
    }

    const drawBlockSize = Math.floor(layout.cellSize * activeBlock.scale);
    drawPiece(
      ctx,
      activeBlock.shape,
      activeBlock.visualX,
      activeBlock.visualY,
      drawBlockSize,
      activeBlock.color,
      0.94,
      activeBlock.isGlowing,
      activeBlock.isGolden
    );
  }

  // Continuous deadlock detector: If no piece can be placed and tray is idle, trigger Game Over immediately
  if (!gameOver && !activeBlock && availableBlocks.some((b) => b.active)) {
    checkBoardGameOver();
  }

  ctx.restore();
  requestAnimationFrame(gameLoop);
}

// Initialise Theme and Game State
applyTheme(isPaperTheme);

// Attempt Mid-Game Auto-Resume; otherwise start latest unlocked level
const startLevel = levelProgress.getHighestUnlocked();
if (!tryResumeSavedGameSession()) {
  initLevelGame(startLevel);
}
gameLoop();

// Poll for completed challenge referrals on game load
referralManager.pollReferralRewards().then((unclaimed) => {
  if (unclaimed > 0) {
    updateHUDChances();
    setTimeout(() => {
      floatingTexts.spawnMilestone(
        "🎉 CHALLENGE ACCEPTED!",
        `+${unclaimed} Bonus Tournament Ticket${unclaimed > 1 ? "s" : ""} Unlocked!`,
        logicalWidth / 2,
        logicalHeight / 2
      );
    }, 1200);
  }
});

// Expose sponsor & tournament configuration helper to window for easy administrative customization
(window as any).tournamentConfig = tournamentConfigManager;
(window as any).setTournamentConfig = (config: Partial<TournamentSponsorConfig>) => {
  tournamentConfigManager.updateConfig(config);
  updateHUDChances();
  console.log("Tournament config updated:", tournamentConfigManager.getConfig());
};
(window as any).getTournamentConfig = () => tournamentConfigManager.getConfig();

