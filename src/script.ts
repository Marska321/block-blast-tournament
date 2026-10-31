import { initUpdates } from "./updates";
import { initOffline } from "./offline";
import {
  computeLayout,
  computePieceCellSize,
  setBlockStyle,
  getBlockStyle,
  BLOCK_STYLE_PRESETS,
  resetSessionBlockStyle,
  triggerRandomBlockStyleMutation,
  setSpriteScale,
  invalidateBoardCache,
  LayoutMetrics,
  drawGrid,
  drawPiece,
  drawGhostBlock,
  drawTray,
  findBestGridPlacement,
  GridOffset,
} from "./gameFunctions";
import { TrayBlock } from "./blocks";

import { soundManager } from "./audio";
import { particles } from "./particles";
import { floatingTexts } from "./floatingText";
import { comboBar } from "./comboBar";
import {
  beginSubmission,
  hasUnsavedSubmission,
  showPendingSubmission,
} from "./session";
import {
  GameEngine,
  ENGINE_VERSION,
  MAX_ACTIONS,
  replay,
  type GameAction,
} from "../shared/engine";
import type { RunSession } from "../shared/contracts";
import type { ClassicSession } from "../shared/classic";
import { configureClassicStart, requestClassicSession, openClassicEntry, beginClassicSubmission } from "./classic";
import { installDialogs, dialog, text } from "./dialogs";
import { storage } from "./storage";
import { queueLevelProgress } from "./progressSync";
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
  ensureGuest,
  requestRun,
  getSelectedEvent,
  RequestError,
  existingSession,
} from "./supabaseClient";
import { wallpaperManager, updateLifetimeBestScore } from "./wallpaper";
import { showWallpaperModal } from "./wallpaperModal";
import { getPhotoRevealMode, unlockPhotoReveal } from "./photoReveal";
import { showLandingModal, isFirstTimeUser } from "./landingModal";
import { referralManager } from "./referral";
import { CASUAL_ONLY, CLASSIC_RANKED_ENABLED, showCasualInfo } from "./launch";
import {
  tournamentConfigManager,
  TournamentSponsorConfig,
} from "./tournamentConfig";

let engine: GameEngine;
let officialSession: RunSession | null = null;
let rankedSession: ClassicSession | null = null;
let rankedFinalized = false;
let runStartedAt = Date.now();
let startingOfficial = false;
let handledGameOver = false;
installDialogs();

const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

const scoreDisplayEl = document.getElementById("hud-score-value");
const bestDisplayEl = document.getElementById("hud-best-value");
const muteBtn = document.getElementById("mute-btn");
const themeBtn = document.getElementById("theme-btn");
const wallpaperBtn = document.getElementById("wallpaper-btn");
const landingInfoBtn = document.getElementById("landing-info-btn");
const leaderboardBtn = document.getElementById("leaderboard-btn");
const chancesBadgeEl = document.getElementById("hud-chances-badge");
const modeLevelsBtn = document.getElementById("mode-levels-btn");
const modeClassicBtn = document.getElementById("mode-classic-btn");
const modeTourneyBtn = document.getElementById("mode-tourney-btn");
if (CASUAL_ONLY) {
  document.body.classList.add("casual-launch");
  if (modeTourneyBtn) {
    modeTourneyBtn.textContent = "Promotions · soon";
    (modeTourneyBtn as HTMLButtonElement).disabled = true;
    modeTourneyBtn.title = "Promotions are coming soon. Enable alerts using the bell.";
  }
  if (modeLevelsBtn) modeLevelsBtn.textContent = "Levels";
  if (modeClassicBtn) modeClassicBtn.textContent = "Classic";
  leaderboardBtn?.setAttribute("aria-label", CLASSIC_RANKED_ENABLED ? "Daily leaderboard and streak" : "View your progress");
  leaderboardBtn?.setAttribute("title", CLASSIC_RANKED_ENABLED ? "Daily leaderboard and streak" : "Your progress");
  landingInfoBtn?.setAttribute("aria-label", "Game info and event updates");
}

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
let activeGemPositions: Set<string> = new Set();
let activeObstaclePositions: Set<string> = new Set();
let activeGlowingPositions: Set<string> = new Set();
let activeGoldenPositions: Set<string> = new Set();
let canReviveInCurrentLevel: boolean = true;
let activeRevealedTiles: Set<string> = new Set();

// Expose block style switcher to global scope (e.g. setBlockStyle('candy') or 'bevel')
(window as any).setBlockStyle = setBlockStyle;
(window as any).resetPhotoRevealProgress = () => {
  activeRevealedTiles.clear();
  saveActiveGameSession();
};

// Paper / Light Theme Mode Management
let isPaperTheme = storage.get("bb_theme") === "paper";

function applyTheme(paper: boolean) {
  isPaperTheme = paper;
  document.body.classList.toggle("theme-paper", isPaperTheme);
  if (themeBtn) {
    themeBtn.textContent = isPaperTheme ? "🌙" : "☀️";
    themeBtn.setAttribute(
      "title",
      isPaperTheme ? "Switch to Dark Theme" : "Switch to Light Theme",
    );
    themeBtn.setAttribute("aria-label", isPaperTheme ? "Switch to Dark Theme" : "Switch to Light Theme");
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isPaperTheme ? "#f5f0e6" : "#18313a");
  invalidateBoardCache();
  storage.set("bb_theme", isPaperTheme ? "paper" : "dark");
  if (CASUAL_ONLY) {
    document.body.style.background = "";
    const surface = document.getElementById("game-container");
    if (surface) surface.style.background = "var(--bb-surface)";
    return;
  }

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
  if (!engine || rankedFinalized || (engine.over && !engine.canRevive)) return;
  storage.set(
    STORAGE_KEY_ACTIVE_SESSION,
    JSON.stringify({
      version: ENGINE_VERSION,
      startedAt: runStartedAt,
      options: engine.options,
      actions: engine.actions,
      officialSession,
      rankedSession,
      practice: !officialSession && !rankedSession,
      blockStyle: getBlockStyle(),
    }),
  );
}
function clearActiveGameSession() {
  storage.remove(STORAGE_KEY_ACTIVE_SESSION);
}
function tryResumeSavedGameSession(): boolean {
  try {
    const saved = JSON.parse(storage.get(STORAGE_KEY_ACTIVE_SESSION) || "null");
    if (
      !saved ||
      saved.version !== ENGINE_VERSION ||
      (CASUAL_ONLY && saved.options?.kind === "tournament") ||
      Date.now() - saved.startedAt >= 48 * 3600_000
    )
      return false;
    if (
      saved.options.kind === "tournament" &&
      (!saved.officialSession ||
        saved.practice ||
        saved.officialSession.engine_version !== ENGINE_VERSION ||
        Date.now() >= Date.parse(saved.officialSession.expires_at) ||
        saved.options.seed !== Number(saved.officialSession.seed))
    )
      return false;
    const restored = replay(saved.options, saved.actions);
    if (restored.over && !restored.canRevive) return false;
    officialSession = saved.officialSession;
    rankedSession = CLASSIC_RANKED_ENABLED && saved.options.kind === "classic" ? saved.rankedSession || null : null;
    if (rankedSession && (rankedSession.engine_version !== ENGINE_VERSION || Number(rankedSession.seed) !== saved.options.seed))
      return false;
    rankedFinalized = false;
    runStartedAt = saved.startedAt;
    setupEngine(restored);
    if (BLOCK_STYLE_PRESETS.some((style) => style.id === saved.blockStyle))
      setBlockStyle(saved.blockStyle);
    lastAnnouncedMilestone = [1000, 2500, 5000, 8000, 12000, 16000, 20000]
      .filter((milestone) => restored.score >= milestone).pop() || 0;
    if (restored.over) checkBoardGameOver();
    return true;
  } catch {
    clearActiveGameSession();
    return false;
  }
}

let logicalWidth = 400;
let logicalHeight = 650;
let dpr = 1;
let layout: LayoutMetrics;
let gridOffset: GridOffset = { x: 0, y: 0, cellSize: 40 };

let GAME_GRID: (string | 0)[][] = Array.from(
  { length: currentMode.gridSize },
  () => Array(currentMode.gridSize).fill(0),
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
      layout.cellSize,
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
  const rect = container
    ? container.getBoundingClientRect()
    : { width: window.innerWidth, height: window.innerHeight };
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
  const hudBottom = hudEl
    ? hudEl.getBoundingClientRect().bottom - canvasTop
    : 92;
  const topInset = Math.max(70, Math.ceil(hudBottom));

  layout = computeLayout(
    logicalWidth,
    logicalHeight - (document.querySelector("#keyboard-controls summary")?.getBoundingClientRect().height || 30) - 8,
    topInset,
    currentMode.gridSize,
  );
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
    if (hudStakesTagEl) {
      hudStakesTagEl.style.display = rankedSession ? "inline-block" : "none";
      hudStakesTagEl.className = "hud-stakes-tag practice";
      hudStakesTagEl.textContent = "DAILY CLASSIC · MIDNIGHT SAST";
    }
    if (hudScoreBoxEl) hudScoreBoxEl.classList.remove("prize-active");
    return;
  }

  const left = chancesManager.getChancesRemaining();
  const event = getSelectedEvent();

  if (chancesBadgeEl) {
    chancesBadgeEl.style.display = "flex";
    chancesBadgeEl.textContent = `🎟️ ${left} TICKET${left === 1 ? "" : "S"}`;
    chancesBadgeEl.className =
      left > 0 ? "chances-pill active" : "chances-pill empty";
  }

  if (tournamentBannerEl) {
    tournamentBannerEl.style.display = "flex";
    tournamentBannerEl.className = "tournament-live-bar official";
    if (tourneyBannerTitleEl)
      tourneyBannerTitleEl.textContent = event?.is_demo ? "🏆 DEMO RUN" : `🏆 ${event?.title || "EVENT RUN"}`;
    if (tourneyBannerSubEl) {
      tourneyBannerSubEl.textContent = event?.is_demo
        ? "Demo only — no prizes or payouts"
        : `${event?.prize_pool || "Event details unavailable"} • Accepted scores remain provisional`;
    }
  }

  if (hudStakesTagEl) {
    hudStakesTagEl.style.display = "inline-block";
    hudStakesTagEl.textContent = "PROVISIONAL RUN";
    hudStakesTagEl.className = "hud-stakes-tag official";
  }

  if (hudScoreBoxEl) {
    hudScoreBoxEl.classList.add("prize-active");
  }
}

function updateModeButtons() {
  modeLevelsBtn?.classList.toggle(
    "active",
    currentMode.id === GameModeId.LEVELS,
  );
  modeClassicBtn?.classList.toggle(
    "active",
    currentMode.id === GameModeId.CLASSIC,
  );
  modeTourneyBtn?.classList.toggle(
    "active",
    currentMode.id === GameModeId.TOURNAMENT,
  );
}

function updateLevelHUD() {
  if (!levelHudEl) return;

  if (
    currentMode.id !== GameModeId.LEVELS ||
    !currentLevelConfig ||
    !currentWorldTheme
  ) {
    levelHudEl.style.display = "none";
    return;
  }

  levelHudEl.style.display = "flex";

  if (levelHudBadge)
    levelHudBadge.textContent = `LEVEL ${currentLevelConfig.level}`;
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

function setupEngine(next: GameEngine) {
  hideModal();
  hideLevelModal();
  hideLevelSelect();
  hidePreTourneyModal();
  hideTourneyRulesModal();
  hideGameOverToast();
  engine = next;
  currentMode =
    GAME_MODES[
      next.options.kind === "levels"
        ? GameModeId.LEVELS
        : next.options.kind === "tournament"
          ? GameModeId.TOURNAMENT
          : GameModeId.CLASSIC
    ];
  currentLevelConfig = next.level || null;
  currentWorldTheme = next.level ? WORLD_THEMES[next.level.worldIndex] : null;
  levelParMoves = next.level
    ? next.level.parMoves || next.level.maxMoves || 20
    : 0;
  handledGameOver = false;
  keyboardCursorVisible = false;
  activeBlock = null;
  lastAnnouncedMilestone = 0;
  chancesManager.setPracticeMode(next.options.kind !== "tournament");
  resetPerformanceMetrics();
  resetSessionBlockStyle();
  particles.clear();
  floatingTexts.clear();
  comboBar.reset();
  syncEngine();
  resizeCanvas();
  updateModeButtons();
  updateHUDChances();
  canvas.focus({ preventScroll: true });
  if (CASUAL_ONLY) applyTheme(isPaperTheme);
  else if (isPaperTheme) applyTheme(true);
  else wallpaperManager.apply(next.options.kind === "tournament");
}
function syncEngine() {
  GAME_GRID = engine.grid;
  availableBlocks = engine.tray;
  score = engine.score;
  combo = engine.combo;
  gameOver = engine.over;
  totalMovesPlaced = engine.moves;
  totalLinesCleared = engine.lines;
  maxComboAchieved = engine.maxCombo;
  levelMovesCount = engine.moves;
  activeLevelGoals = engine.goals;
  activeGemPositions = engine.gems;
  activeObstaclePositions = engine.obstacles;
  activeGoldenPositions = engine.golden;
  activeGlowingPositions = engine.glowing;
  activeRevealedTiles = engine.revealed;
  canReviveInCurrentLevel = !engine.revived;
  positionTrayBlocks();
  comboBar.update(combo);
  updateScoreUI();
  updateLevelHUD();
  invalidateBoardCache();
  updateAccessibleGame();
}
function initLevelGame(levelNum: number, _isReplay = false, _isResume = false) {
  clearActiveGameSession();
  officialSession = null;
  rankedSession = null;
  rankedFinalized = false;
  runStartedAt = Date.now();
  setupEngine(
    new GameEngine({
      kind: "levels",
      level: levelNum,
      seed: crypto.getRandomValues(new Uint32Array(1))[0],
    }),
  );
  saveActiveGameSession();
}
function initClassicGame(_isResume = false) {
  clearActiveGameSession();
  officialSession = null;
  rankedSession = null;
  rankedFinalized = false;
  runStartedAt = Date.now();
  setupEngine(
    new GameEngine({
      kind: "classic",
      seed: crypto.getRandomValues(new Uint32Array(1))[0],
    }),
  );
  saveActiveGameSession();
}
configureClassicStart(async (nickname) => {
  const issued = await requestClassicSession(nickname);
  clearActiveGameSession();
  officialSession = null;
  rankedSession = issued;
  rankedFinalized = false;
  runStartedAt = Date.now();
  setupEngine(new GameEngine({ kind: "classic", seed: Number(issued.seed) }));
  saveActiveGameSession();
});

function finalizeRankedClassic(finished: GameEngine) {
  if (engine !== finished || !rankedSession || rankedFinalized) return;
  rankedFinalized = true;
  clearActiveGameSession();
  beginClassicSubmission(rankedSession, finished.actions);
  document.getElementById("classicReviveBtn")?.remove();
}
async function initTournamentGame(_isPractice = false, _isResume = false) {
  if (CASUAL_ONLY) { showCasualInfo(); return; }
  if (startingOfficial) return;
  if (hasUnsavedSubmission()) {
    showPendingSubmission();
    return;
  }
  const event = getSelectedEvent();
  if (!event) {
    promptTournamentEntry();
    return;
  }
  if (!authManager.isAdult()) {
    authManager.show(() => {
      if (authManager.isAdult()) void initTournamentGame();
    });
    return;
  }
  startingOfficial = true;
  const { overlay, card } = dialog(
    "startingOfficial",
    "Starting your official run",
  );
  const status = text("p", "Connecting securely…");
  status.setAttribute("role", "status");
  card.append(status);
  try {
    const guest = await ensureGuest();
    let pending: { requestId: string; eventId: string; userId: string } | null =
      null;
    try {
      pending = JSON.parse(storage.get("bb_pilot_pending_start") || "null");
    } catch {}
    if (
      !pending ||
      pending.eventId !== event.id ||
      pending.userId !== guest.user.id
    ) {
      pending = {
        requestId: crypto.randomUUID(),
        eventId: event.id,
        userId: guest.user.id,
      };
      if (!storage.set("bb_pilot_pending_start", JSON.stringify(pending)))
        throw new Error(
          "Browser storage is unavailable. Official runs need storage for safe retries.",
        );
    }
    const issued = await requestRun({
      kind: "tournament",
      eventId: event.id,
      requestId: pending.requestId,
      nickname: authManager.getProfile().nickname,
      adult: true,
    });
    if (
      issued.status !== "started" ||
      Date.now() >= Date.parse(issued.expires_at)
    ) {
      storage.remove("bb_pilot_pending_start");
      throw new Error(
        "That attempt has expired. Open the event again to start a new ticket.",
      );
    }
    officialSession = issued;
    runStartedAt = Date.parse(issued.created_at);
    storage.remove("bb_pilot_pending_start");
    await authManager.refreshIdentity();
    await referralManager.attribute();
    setupEngine(
      new GameEngine({ kind: "tournament", seed: Number(issued.seed) }),
    );
    saveActiveGameSession();
    overlay.classList.remove("active");
    void chancesManager
      .refresh()
      .then(updateHUDChances)
      .catch(() => {});
  } catch (error) {
    status.textContent =
      error instanceof Error ? error.message : "Official play is unavailable.";
    if (error instanceof RequestError && !error.retryable)
      storage.remove("bb_pilot_pending_start");
    const retry = text("button", "Retry starting this attempt", "modal-button");
    retry.onclick = () => {
      overlay.classList.remove("active");
      void initTournamentGame();
    };
    card.append(retry);
    const casual = text("button", "Play Classic", "modal-secondary-button");
    casual.onclick = () => {
      overlay.classList.remove("active");
      initClassicGame();
    };
    card.append(casual);
  } finally {
    startingOfficial = false;
  }
}

function updateScoreUI() {
  if (scoreDisplayEl) {
    scoreDisplayEl.textContent = score.toLocaleString();
  }
  if (bestDisplayEl) {
    const best =
      currentMode.id === GameModeId.CLASSIC
        ? Math.max(score, leaderboardManager.getClassicBestScore())
        : score;
    bestDisplayEl.textContent = best.toLocaleString();
  }
}

// Unified Pointer Handlers
let cachedCanvasRect: DOMRect | null = null;

function getCanvasCoords(
  clientX: number,
  clientY: number,
): { x: number; y: number } {
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
let toastTimer: any = null;
function showGameOverToast(message: string) {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.id = "gameOverToastBanner";
    toastEl.className = "game-over-toast-banner";
    const container =
      document.getElementById("game-container") || document.body;
    container.appendChild(toastEl);
  }
  if (toastTimer) clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.classList.add("show");
  toastTimer = setTimeout(() => {
    toastEl?.classList.remove("show");
    toastTimer = null;
  }, 2600);
}

function hideGameOverToast() {
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  toastEl?.classList.remove("show");
}

function checkBoardGameOver(): boolean {
  if (!engine?.over || handledGameOver) return false;
  handledGameOver = true;
  gameOver = true;
  if (engine.canRevive) saveActiveGameSession();
  else clearActiveGameSession();
  soundManager.playGameOver();
  const finished = engine;
  if (engine.level && engine.completed) {
    const lvl = engine.level.level;
    const par = engine.level.parMoves || engine.level.maxMoves || 20;
    const saved = Math.max(0, par - engine.moves);
    levelProgress.completeLevel(lvl, score, engine.stars);
    queueLevelProgress(engine.options, engine.actions);
    updateLifetimeBestScore(score);
    setTimeout(() => {
      if (engine !== finished) return;
      showLevelCompleteModal({
        level: lvl,
        score,
        stars: engine.stars,
        movesUsed: engine.moves,
        parMoves: par,
        movesSaved: saved,
        efficiencyBonus: saved * 120,
        hasNextLevel: lvl < LEVEL_DATA.length,
        onNextLevel: () => initLevelGame(lvl + 1),
        onRetry: () => initLevelGame(lvl),
        onOpenMap: () =>
          showLevelSelect({ onSelectLevel: initLevelGame, onClose: () => {} }),
        onGoTournament: promptTournamentEntry,
      });
    }, 350);
  } else if (engine.level) {
    showGameOverToast("No space for the remaining pieces.");
    setTimeout(() => {
      if (engine !== finished) return;
      showLevelFailedModal({
        level: engine.level!.level,
        score,
        reason: "No space for blocks",
        canRevive: canReviveInCurrentLevel,
        onRetry: () => initLevelGame(engine.level!.level),
        onReviveMoves: () => {
          applyGameAction({ type: "revive" });
          hideLevelModal();
        },
        onOpenMap: () =>
          showLevelSelect({ onSelectLevel: initLevelGame, onClose: () => {} }),
      });
    }, 400);
  } else {
    if (officialSession) beginSubmission(officialSession, engine.actions);
    else leaderboardManager.recordClassicScore(score);
    if (rankedSession && !engine.canRevive) finalizeRankedClassic(finished);
    setTimeout(() => {
      if (engine === finished)
        showModal(score, currentMode.name, computePerformanceStats(),
          { available: engine.canRevive, used: engine.revived, onRevive: () => {
            if (engine !== finished || !engine.canRevive || rankedFinalized) return;
            hideModal();
            applyGameAction({ type: "revive" });
          } }, rankedSession ? { onFinish: !rankedFinalized ? () => finalizeRankedClassic(finished) : undefined } : undefined);
    }, 350);
  }
  updateAccessibleGame();
  return true;
}

function handlePointerDown(clientX: number, clientY: number, isTouch: boolean) {
  keyboardCursorVisible = false;
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

function applyGameAction(action: GameAction) {
  try {
    if (
      engine.actions.length >= MAX_ACTIONS - 1 &&
      action.type === "place" &&
      !engine.level
    )
      action = { type: "end" };
    const result = engine.apply(action);
    if (action.type === "revive") {
      handledGameOver = false;
      soundManager.playClear(2);
    }
    if (result.lines >= 2) multilineClears++;
    const density = engine.grid.flat().filter(Boolean).length / 64;
    cumulativeEfficiency += result.lines
      ? Math.min(1, 0.45 + 0.25 * result.lines)
      : Math.max(0.2, 1 - density * 0.7);
    syncEngine();
    const centerX = layout.boardX + layout.boardSize / 2,
      centerY = layout.boardY + layout.boardSize / 2;
    if (result.lines) {
      if (result.allClear) soundManager.playAllClear();
      else soundManager.playClear(combo);
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
        screenShake = Math.min(10, result.lines * 3);
        particles.spawnFireworks(centerX, centerY, 18);
      }
      const praise = floatingTexts.spawnPraise(result.lines, combo, centerX, centerY,
        result.points, result.allClear);
      void soundManager.playPraise(praise);
      for (const key of result.cleared) {
        const [x, y] = key.split(",").map(Number);
        particles.spawnBlockBurst(
          layout.boardX + (x + 0.5) * layout.cellSize,
          layout.boardY + (y + 0.5) * layout.cellSize,
          "#00e5ff",
          4,
        );
      }
    } else if (action.type === "place") soundManager.playPlace();
    if (combo >= 5 || engine.revealed.size === 64) unlockPhotoReveal();
    updateLifetimeBestScore(score);
    for (const milestone of [1000, 2500, 5000, 8000, 12000, 16000, 20000])
      if (score >= milestone && lastAnnouncedMilestone < milestone) {
        lastAnnouncedMilestone = milestone;
        triggerRandomBlockStyleMutation();
        break;
      }
    announce(
      action.type === "place"
        ? "+" +
            result.points +
            " points. Score " +
            score +
            ". " +
            result.lines +
            " lines cleared."
        : action.type === "revive"
          ? "Rescue pieces ready."
          : "Run finished.",
    );
    saveActiveGameSession();
    checkBoardGameOver();
  } catch (error) {
    announce(
      error instanceof Error ? error.message : "That action is unavailable.",
    );
  }
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
  const slot = activeBlock.originalIndex;
  activeBlock = null;
  if (placement.canPlace)
    applyGameAction({
      type: "place",
      slot,
      x: placement.gridX,
      y: placement.gridY,
    });
}

// Unified Pointer Events

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
  { passive: false },
);

canvas.addEventListener(
  "pointermove",
  (e) => {
    if (e.pointerId !== activePointerId) return;
    e.preventDefault();
    handlePointerMove(e.clientX, e.clientY);
  },
  { passive: false },
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

// Restore the saved sound preference in both the icon and accessible name.
function updateMuteButton() {
  if (!muteBtn) return;
  const muted = soundManager.isMuted();
  muteBtn.textContent = muted ? "🔇" : "🔊";
  muteBtn.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
  muteBtn.setAttribute("aria-pressed", String(muted));
  muteBtn.title = muted ? "Unmute sound" : "Mute sound";
}
updateMuteButton();
muteBtn?.addEventListener("click", () => {
  soundManager.toggleMute();
  updateMuteButton();
});

// Theme toggle (Paper / Dark mode)
themeBtn?.addEventListener("click", () => {
  applyTheme(!isPaperTheme);
});

// Wallpaper & Theme Customization Modal
wallpaperBtn?.addEventListener("click", () => {
  showWallpaperModal();
});

// Landing / Tournament Welcome Hub
landingInfoBtn?.addEventListener("click", () => {
  showLandingModal({
    onStartTournament: () => {
      promptTournamentEntry();
    },
    onStartClassic: () => {
      initClassicGame();
    },
    onStartLevels: () => showLevelSelect({ onSelectLevel: initLevelGame, onClose: () => {} }),
    onClose: () => {},
  });
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
  leaderboardManager.show(
    currentMode.id === GameModeId.LEVELS ? "stars" : "tourney",
  );
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
  if (CASUAL_ONLY) { showCasualInfo(); return; }
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
    if (rankedSession) {
      if (engine.over) finalizeRankedClassic(engine);
      openClassicEntry();
      return;
    }
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
    if (rankedSession && engine.over) finalizeRankedClassic(engine);
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
    ctx.fillStyle = CASUAL_ONLY ? "#f5f0e6" : "#fbf8f2";
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);
  } else if (
    wallpaperManager.isCustomActive(currentMode.id === GameModeId.TOURNAMENT)
  ) {
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
    getPhotoRevealMode(),
  );

  // Draw Particles & Floating Praise Text
  if (
    isKeyboardCursorVisible()
  ) {
    ctx.strokeStyle = "#fff066";
    ctx.lineWidth = 3;
    ctx.strokeRect(
      gridOffset.x + keyboardX * gridOffset.cellSize + 2,
      gridOffset.y + keyboardY * gridOffset.cellSize + 2,
      gridOffset.cellSize - 4,
      gridOffset.cellSize - 4,
    );
  }
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
        currentWorldTheme ? currentWorldTheme.gemColor : "#ffd600",
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
      activeBlock.isGolden,
    );
  }

  // Continuous deadlock detector: If no piece can be placed and tray is idle, trigger Game Over immediately
  if (!gameOver && !activeBlock && availableBlocks.some((b) => b.active)) {
    checkBoardGameOver();
  }

  ctx.restore();
  requestAnimationFrame(gameLoop);
}

// Keyboard and screen-reader controls share the same validated action path as dragging.
let keyboardSlot = 0,
  keyboardX = 0,
  keyboardY = 0;
let keyboardCursorVisible = false;
function isKeyboardCursorVisible() {
  return keyboardCursorVisible && !gameOver && !activeBlock &&
    (document.activeElement === canvas ||
      !!document.getElementById("keyboard-controls")?.contains(document.activeElement));
}
document.addEventListener("pointerdown", () => { keyboardCursorVisible = false; }, true);
document.addEventListener("keydown", (e) => {
  if (e.key === "Tab") keyboardCursorVisible = true;
}, true);
function announce(message: string) {
  const live = document.getElementById("game-announcement");
  if (live) live.textContent = message;
}
function updateAccessibleGame() {
  if (!engine) return;
  const pieces = document.getElementById("accessible-pieces");
  if (pieces && !pieces.children.length)
    for (let slot = 0; slot < 3; slot++) {
      const button = document.createElement("button");
      button.type = "button";
      button.onclick = () => {
        keyboardSlot = slot;
        updateAccessibleGame();
        announce(
          "Piece " +
            (slot + 1) +
            " selected. Choose a board cell or use arrow keys on the game.",
        );
      };
      pieces.append(button);
    }
  pieces?.querySelectorAll("button").forEach((button, slot) => {
    const piece = engine.tray[slot];
    button.disabled = !piece?.active;
    button.textContent =
      "Piece " + (slot + 1) + (slot === keyboardSlot ? " (selected)" : "");
    button.setAttribute("aria-pressed", String(slot === keyboardSlot));
    button.setAttribute(
      "aria-label",
      "Piece " +
        (slot + 1) +
        ": " +
        (piece?.active
          ? piece.shape
              .map((row) => row.map((c) => (c ? "block" : "gap")).join(" "))
              .join("; next row: ")
          : "used"),
    );
  });
  const board = document.getElementById("accessible-board");
  if (board && !board.children.length)
    for (let y = 0; y < 8; y++) {
      const row = document.createElement("div");
      row.setAttribute("role", "row");
      for (let x = 0; x < 8; x++) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.setAttribute("role", "gridcell");
        cell.dataset.x = String(x);
        cell.dataset.y = String(y);
        cell.onclick = () => {
          keyboardX = x;
          keyboardY = y;
          applyGameAction({ type: "place", slot: keyboardSlot, x, y });
        };
        row.append(cell);
      }
      board.append(row);
    }
  board?.querySelectorAll<HTMLButtonElement>("button").forEach((cell) => {
    const x = Number(cell.dataset.x),
      y = Number(cell.dataset.y);
    const occupied = !!engine.grid[y][x];
    const label = String.fromCharCode(65 + x) + (y + 1);
    cell.textContent = label;
    cell.setAttribute(
      "aria-label",
      label +
        ": " +
        (occupied
          ? engine.gems.has(x + "," + y)
            ? "gem"
            : "occupied"
          : "empty"),
    );
    cell.setAttribute(
      "aria-selected",
      String(x === keyboardX && y === keyboardY),
    );
    cell.tabIndex = x === keyboardX && y === keyboardY ? 0 : -1;
    cell.classList.toggle("occupied", occupied);
  });
  document
    .getElementById("end-run-btn")
    ?.toggleAttribute("disabled", engine.over || !!engine.level);
}
function keyboardPlay(e: KeyboardEvent) {
  if (document.querySelector(".modal-overlay.active") || !engine || engine.over)
    return;
  if (
    e.target instanceof HTMLElement &&
    e.target.matches("input,textarea,select")
  )
    return;
  const inGame =
    e.target === canvas ||
    (e.target instanceof HTMLElement &&
      !!e.target.closest("#keyboard-controls"));
  if (!inGame) return;
  if (["1", "2", "3"].includes(e.key)) {
    keyboardSlot = Number(e.key) - 1;
    announce("Piece " + (keyboardSlot + 1) + " selected.");
  } else if (e.key.startsWith("Arrow")) {
    keyboardX = Math.max(
      0,
      Math.min(
        7,
        keyboardX +
          (e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0),
      ),
    );
    keyboardY = Math.max(
      0,
      Math.min(
        7,
        keyboardY + (e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0),
      ),
    );
    announce(String.fromCharCode(65 + keyboardX) + (keyboardY + 1));
  } else if (
    (e.key === "Enter" || e.key === " ") &&
    (e.target === canvas ||
      (e.target instanceof HTMLElement &&
        e.target.matches('[role="gridcell"]')))
  ) {
    applyGameAction({
      type: "place",
      slot: keyboardSlot,
      x: keyboardX,
      y: keyboardY,
    });
  } else return;
  keyboardCursorVisible = true;
  e.preventDefault();
  updateAccessibleGame();
  if (e.target !== canvas && e.key.startsWith("Arrow"))
    document
      .querySelector<HTMLButtonElement>('#accessible-board [tabindex="0"]')
      ?.focus();
}
document.addEventListener("keydown", keyboardPlay);
document
  .getElementById("end-run-btn")
  ?.addEventListener("click", () => applyGameAction({ type: "end" }));
(
  window as unknown as { render_game_to_text: () => string }
).render_game_to_text = () =>
  JSON.stringify({
    coordinates: "x increases right, y increases down; origin top-left",
    mode: engine?.options.kind,
    blockStyle: getBlockStyle(),
    feedback: floatingTexts.getVisibleText(),
    muted: soundManager.isMuted(),
    score,
    over: gameOver,
    moves: engine?.moves,
    boardLayout: gridOffset,
    board: GAME_GRID,
    pieces: availableBlocks.map((p) => ({
      shape: p.shape,
      active: p.active,
      x: p.x,
      y: p.y,
      cellSize: p.cellSize,
    })),
    selection: { slot: keyboardSlot, x: keyboardX, y: keyboardY, visible: isKeyboardCursorVisible() },
    revive: { used: engine?.revived, available: engine?.canRevive },
    ranked: rankedSession ? { day: rankedSession.day, finalized: rankedFinalized } : null,
  });
(
  window as unknown as { advanceTime: (ms: number) => Promise<void> }
).advanceTime = async (_ms: number) => {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
};

// Initialise Theme and Game State
applyTheme(isPaperTheme);

// Attempt Mid-Game Auto-Resume; otherwise start latest unlocked level
const startLevel = levelProgress.getHighestUnlocked();
if (!tryResumeSavedGameSession()) {
  initLevelGame(startLevel);
}
gameLoop();
if (!CASUAL_ONLY && hasUnsavedSubmission()) setTimeout(showPendingSubmission, 500);

// First-Time User Welcome Experience: Auto-trigger Landing Hub
if (isFirstTimeUser()) {
  setTimeout(() => {
    showLandingModal({
      onStartTournament: () => {
        promptTournamentEntry();
      },
      onStartClassic: () => {
        initClassicGame();
      },
      onStartLevels: () => showLevelSelect({ onSelectLevel: initLevelGame, onClose: () => {} }),
      onClose: () => {},
    });
  }, 400);
}

// Balances are read-only; the server credits referrals during accepted submissions.
void existingSession()
  .then(async (session) => {
    if (!session) return;
    await referralManager.attribute();
    await chancesManager.refresh();
    updateHUDChances();
  })
  .catch(() => {});

// Local visual preview helpers only. Server events and prize rules cannot be edited here.
(window as any).tournamentConfig = tournamentConfigManager;
(window as any).setTournamentConfig = (
  config: Partial<TournamentSponsorConfig>,
) => {
  tournamentConfigManager.updateConfig(config);
  updateHUDChances();
  console.log(
    "Tournament config updated:",
    tournamentConfigManager.getConfig(),
  );
};
(window as any).getTournamentConfig = () => tournamentConfigManager.getConfig();
initUpdates();
initOffline();
