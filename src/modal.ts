import { estimateRank, renderLeaderboardHTML } from "./leaderboard";
import { authManager } from "./auth";
import { chancesManager } from "./chances";

export interface PerformanceStats {
  efficiencyGrade: string;
  strategicGrade: string;
  totalMoves: number;
  totalLines: number;
  maxCombo: number;
}

let modalEl: HTMLElement | null = null;

export function createGameOverModal({
  onRestart,
  onPlayPractice,
}: {
  onRestart: () => void;
  onPlayPractice: () => void;
}) {
  if (modalEl) return;

  modalEl = document.createElement("div");
  modalEl.className = "modal-overlay";
  modalEl.id = "gameOverModal";

  modalEl.innerHTML = `
    <div class="modal tournament-modal">
      <div id="modalBadge" class="modal-badge">WEEKLY TOURNAMENT</div>
      <h2 class="modal-title">Game Over</h2>
      
      <div class="modal-score-card">
        <span class="score-label">FINAL SCORE</span>
        <span id="modalScore" class="score-value">0</span>
        <div id="modalRankTeaser" class="rank-teaser">Estimated: Top 10</div>
      </div>

      <div id="modalPerfCard" class="modal-perf-card" style="display: none;">
        <div class="perf-chips-row">
          <div class="perf-chip">
            <span class="perf-chip-label">EFFICIENCY</span>
            <span id="modalEfficiencyGrade" class="perf-chip-val">A</span>
          </div>
          <div class="perf-chip">
            <span class="perf-chip-label">STRATEGY</span>
            <span id="modalStrategyGrade" class="perf-chip-val">Expert</span>
          </div>
        </div>
        <div class="perf-stats-row">
          <span>Cleared: <strong id="modalLinesCleared">0</strong> lines</span>
          <span>Max Combo: <strong id="modalMaxCombo">0x</strong></span>
        </div>
      </div>

      <div id="chancesStatusBox" class="chances-box">
        <span id="chancesLabel" class="chances-text">⚡ 3 of 3 chances left today</span>
      </div>

      <div id="modalLeaderboardContainer"></div>

      <!-- Action Buttons -->
      <button class="modal-button whatsapp-btn" id="claimSpotBtn">
        💬 Claim Your Prize Spot with WhatsApp
      </button>

      <button class="modal-button share-invite-btn" id="inviteFriendsBtn" style="display: none;">
        📲 Invite on WhatsApp (+2 Chances)
      </button>

      <div class="modal-button-row">
        <button class="modal-secondary-button" id="restartBtn">
          🔄 Play Again
        </button>
        <button class="modal-secondary-button" id="practiceModeBtn">
          🎮 Practice Mode
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);

  document.getElementById("restartBtn")?.addEventListener("click", () => {
    hideModal();
    onRestart();
  });

  document.getElementById("practiceModeBtn")?.addEventListener("click", () => {
    hideModal();
    onPlayPractice();
  });

  document.getElementById("inviteFriendsBtn")?.addEventListener("click", () => {
    authManager.openReferralShare();
  });

  document.getElementById("claimSpotBtn")?.addEventListener("click", () => {
    if (authManager.isLoggedIn()) {
      const user = authManager.getUser();
      alert(`Score submitted successfully for ${user}!`);
    } else {
      authManager.show();
    }
  });

  authManager.initAuthModal((phone, rank) => {
    const claimBtn = document.getElementById("claimSpotBtn");
    if (claimBtn) {
      claimBtn.textContent = `✅ Saved as #${rank} (${phone})`;
      claimBtn.setAttribute("disabled", "true");
    }
  });
}

export function showModal(
  score: number,
  modeName: string = "Classic",
  perf?: PerformanceStats
) {
  if (!modalEl) return;

  const badgeEl = document.getElementById("modalBadge");
  const isPractice = chancesManager.isPracticeMode();

  if (badgeEl) {
    badgeEl.textContent = isPractice
      ? `PRACTICE MODE (${modeName.toUpperCase()})`
      : `WEEKLY TOURNAMENT (${modeName.toUpperCase()})`;
    badgeEl.className = isPractice ? "modal-badge practice-badge" : "modal-badge";
  }

  const scoreEl = document.getElementById("modalScore");
  if (scoreEl) scoreEl.textContent = score.toLocaleString();

  // Performance Grading Card
  const perfCard = document.getElementById("modalPerfCard");
  if (perfCard) {
    if (perf) {
      perfCard.style.display = "flex";
      const effEl = document.getElementById("modalEfficiencyGrade");
      const stratEl = document.getElementById("modalStrategyGrade");
      const linesEl = document.getElementById("modalLinesCleared");
      const comboEl = document.getElementById("modalMaxCombo");

      if (effEl) {
        effEl.textContent = perf.efficiencyGrade;
        effEl.className = `perf-chip-val grade-${perf.efficiencyGrade.replace("+", "plus").toLowerCase()}`;
      }
      if (stratEl) {
        stratEl.textContent = perf.strategicGrade;
      }
      if (linesEl) {
        linesEl.textContent = `${perf.totalLines}`;
      }
      if (comboEl) {
        comboEl.textContent = `${perf.maxCombo}x`;
      }
    } else {
      perfCard.style.display = "none";
    }
  }

  const rank = estimateRank(score);
  const teaserEl = document.getElementById("modalRankTeaser");
  if (teaserEl) {
    if (isPractice) {
      teaserEl.innerHTML = `🎮 Warmup run! (Practice scores do not qualify for cash prizes)`;
      teaserEl.className = "rank-teaser";
    } else if (rank === 1) {
      teaserEl.innerHTML = `🌟 <strong>NEW #1 LEADER!</strong> Eligible for $250 Grand Prize!`;
      teaserEl.className = "rank-teaser gold-glow";
    } else if (rank === 2) {
      teaserEl.innerHTML = `🥈 <strong>RANK #2!</strong> Eligible for $150 Runner-Up Prize!`;
      teaserEl.className = "rank-teaser gold-glow";
    } else if (rank === 3) {
      teaserEl.innerHTML = `🥉 <strong>RANK #3!</strong> Eligible for $100 3rd Place Prize!`;
      teaserEl.className = "rank-teaser top5-glow";
    } else if (rank <= 10) {
      teaserEl.innerHTML = `🔥 Ranked <strong>#${rank}</strong> — Inside the Cash Prize Payout Pool!`;
      teaserEl.className = "rank-teaser top5-glow";
    } else {
      teaserEl.innerHTML = `Official Entry Ranked: <strong>#${rank}</strong> this week`;
      teaserEl.className = "rank-teaser";
    }
  }

  // Chances & Viral Referral CTA
  const chancesLeft = chancesManager.getChancesRemaining();
  const chancesLabel = document.getElementById("chancesLabel");
  const inviteFriendsBtn = document.getElementById("inviteFriendsBtn");
  const claimBtn = document.getElementById("claimSpotBtn");
  const restartBtn = document.getElementById("restartBtn");
  const practiceModeBtn = document.getElementById("practiceModeBtn");

  if (chancesLabel) {
    if (isPractice) {
      chancesLabel.innerHTML = `🎮 <strong>Practice Mode:</strong> Zero tickets used. ${chancesLeft} official ticket${chancesLeft === 1 ? "" : "s"} ready.`;
    } else if (chancesLeft > 0) {
      chancesLabel.innerHTML = `⚡ <strong>Official Ticket Used:</strong> ${chancesLeft} tournament ticket${chancesLeft === 1 ? "" : "s"} remaining today`;
    } else {
      chancesLabel.innerHTML = `⚠️ <strong>0 tournament tickets left today!</strong>`;
    }
  }

  if (restartBtn) {
    if (isPractice) {
      restartBtn.textContent = chancesLeft > 0 ? `🚀 Official Prize Run (${chancesLeft} Left)` : "🔄 Practice Again";
    } else {
      restartBtn.textContent = chancesLeft > 0 ? `⚡ Play Next Ticket (${chancesLeft} Left)` : "🔄 Play Again";
    }
  }

  if (practiceModeBtn) {
    practiceModeBtn.style.display = isPractice ? "none" : "flex";
  }

  if (inviteFriendsBtn) {
    inviteFriendsBtn.style.display = chancesLeft <= 1 ? "flex" : "none";
  }

  if (claimBtn) {
    claimBtn.style.display = isPractice ? "none" : "flex";
    claimBtn.removeAttribute("disabled");
    claimBtn.textContent = "💬 Claim Your Prize Spot with WhatsApp";
  }

  const lbContainer = document.getElementById("modalLeaderboardContainer");
  if (lbContainer) {
    lbContainer.innerHTML = renderLeaderboardHTML(score);
  }

  modalEl.classList.add("active");
}

export function hideModal() {
  if (!modalEl) return;
  modalEl.classList.remove("active");
}
