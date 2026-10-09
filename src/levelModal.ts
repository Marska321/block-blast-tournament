let modalEl: HTMLElement | null = null;

export function showLevelCompleteModal({
  level,
  score,
  stars,
  hasNextLevel,
  movesUsed,
  parMoves,
  movesSaved,
  efficiencyBonus,
  onNextLevel,
  onRetry,
  onOpenMap,
  onGoTournament,
}: {
  level: number;
  score: number;
  stars: number;
  hasNextLevel: boolean;
  movesUsed?: number;
  parMoves?: number;
  movesSaved?: number;
  efficiencyBonus?: number;
  onNextLevel: () => void;
  onRetry: () => void;
  onOpenMap: () => void;
  onGoTournament: () => void;
}) {
  if (!modalEl) {
    modalEl = document.createElement("div");
    modalEl.className = "modal-overlay level-status-modal";
    modalEl.id = "levelStatusModal";
    document.body.appendChild(modalEl);
  }

  let starsHTML = "";
  for (let s = 1; s <= 3; s++) {
    starsHTML += `<span class="star-pop ${s <= stars ? "earned" : "unearned"}" style="animation-delay: ${s * 0.15}s">★</span>`;
  }

  modalEl.innerHTML = `
    <div class="modal level-complete-card">
      <div class="modal-badge victory-badge">LEVEL ${level} CLEARED</div>
      <h2 class="modal-title">Awesome Blast!</h2>

      <div class="stars-celebration">
        ${starsHTML}
      </div>

      <div class="modal-score-card">
        <span class="score-label">LEVEL SCORE</span>
        <span class="score-value">${score.toLocaleString()}</span>
      </div>

      ${
        movesSaved !== undefined && movesSaved > 0
          ? `<div class="level-efficiency-card">
              <span class="eff-badge">🎯 SPEED & EFFICIENCY BONUS</span>
              <span class="eff-sub">Cleared in <strong>${movesUsed}</strong> moves (Par ${parMoves})</span>
              <span class="eff-points">+${efficiencyBonus?.toLocaleString()} Bonus Points!</span>
            </div>`
          : movesUsed !== undefined
          ? `<div class="level-efficiency-card standard">
              <span class="eff-sub">Cleared in <strong>${movesUsed}</strong> moves</span>
            </div>`
          : ""
      }

      <!-- Action Buttons -->
      ${
        hasNextLevel
          ? `<button class="modal-button next-level-btn" id="nextLevelBtn">
              ▶ Next Level
            </button>`
          : `<div class="all-cleared-banner">🎉 All 20 Levels Mastered!</div>`
      }

      <div class="modal-button-row">
        <button class="modal-secondary-button" id="lvlRetryBtn">
          🔄 Replay
        </button>
        <button class="modal-secondary-button" id="lvlMapBtn">
          🗺️ Level Map
        </button>
      </div>

      <div class="tournament-cross-banner" id="tourneyCrossBtn">
        <div class="cross-text">
          <span class="cross-tag">PRIZE EVENT</span>
          <span class="cross-title">🏆 Compete in the Weekly Tournament!</span>
        </div>
        <span class="cross-arrow">➔</span>
      </div>
    </div>
  `;

  document.getElementById("nextLevelBtn")?.addEventListener("click", () => {
    hideLevelModal();
    onNextLevel();
  });

  document.getElementById("lvlRetryBtn")?.addEventListener("click", () => {
    hideLevelModal();
    onRetry();
  });

  document.getElementById("lvlMapBtn")?.addEventListener("click", () => {
    hideLevelModal();
    onOpenMap();
  });

  document.getElementById("tourneyCrossBtn")?.addEventListener("click", () => {
    hideLevelModal();
    onGoTournament();
  });

  modalEl.classList.add("active");
}

export function showLevelFailedModal({
  level,
  score,
  reason,
  canRevive,
  onRetry,
  onReviveMoves,
  onOpenMap,
}: {
  level: number;
  score: number;
  reason: string;
  canRevive: boolean;
  onRetry: () => void;
  onReviveMoves?: () => void;
  onOpenMap: () => void;
}) {
  if (!modalEl) {
    modalEl = document.createElement("div");
    modalEl.className = "modal-overlay level-status-modal";
    modalEl.id = "levelStatusModal";
    document.body.appendChild(modalEl);
  }

  modalEl.innerHTML = `
    <div class="modal level-failed-card">
      <div class="modal-badge failed-badge">LEVEL ${level} FAILED</div>
      <h2 class="modal-title">${reason}</h2>

      <div class="modal-score-card">
        <span class="score-label">POINTS EARNED</span>
        <span class="score-value">${score.toLocaleString()}</span>
      </div>

      ${
        canRevive
          ? `<button class="modal-button revive-moves-btn" id="reviveMovesBtn">
              ✨ Free Revive (Rescue Pieces)
            </button>`
          : ""
      }

      <div class="modal-button-row">
        <button class="modal-button try-again-btn" id="lvlFailRetryBtn">
          🔄 Try Again
        </button>
        <button class="modal-secondary-button" id="lvlFailMapBtn">
          🗺️ Level Map
        </button>
      </div>
    </div>
  `;

  document.getElementById("reviveMovesBtn")?.addEventListener("click", () => {
    hideLevelModal();
    onReviveMoves?.();
  });

  document.getElementById("lvlFailRetryBtn")?.addEventListener("click", () => {
    hideLevelModal();
    onRetry();
  });

  document.getElementById("lvlFailMapBtn")?.addEventListener("click", () => {
    hideLevelModal();
    onOpenMap();
  });

  modalEl.classList.add("active");
}

export function hideLevelModal() {
  if (!modalEl) return;
  modalEl.classList.remove("active");
}
