import { estimateRank, renderLeaderboardHTML } from "./leaderboard";
import { authManager } from "./auth";
import { chancesManager } from "./chances";
import { tournamentConfigManager } from "./tournamentConfig";
import { getVerifiedBadgeHtml } from "./verifiedBadge";

export interface PerformanceStats {
  efficiencyGrade: string;
  strategicGrade: string;
  totalMoves: number;
  totalLines: number;
  maxCombo: number;
}

let savedRestartCb: (() => void) | null = null;
let savedClassicCb: (() => void) | null = null;
let modalEl: HTMLElement | null = null;

export function createGameOverModal({
  onRestart,
  onGoToClassic,
}: {
  onRestart: () => void;
  onGoToClassic: () => void;
}) {
  savedRestartCb = onRestart;
  savedClassicCb = onGoToClassic;
  if (modalEl) return;

  modalEl = document.createElement("div");
  modalEl.className = "modal-overlay";
  modalEl.id = "gameOverModal";

  modalEl.innerHTML = `
    <div class="modal tournament-modal">
      <div id="modalBadge" class="modal-badge">WEEKLY TOURNAMENT</div>
      <h2 class="modal-title">Game Over</h2>
      <div id="modalReasonPill" class="gameover-reason-pill">
        🚫 Out of moves — No space for remaining bricks!
      </div>
      
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
            <span id="modalStrategyGrade" class="perf-chip-val">S</span>
          </div>
        </div>
        <div class="perf-stats-row">
          <span>Cleared: <strong id="modalLinesCleared">0</strong> lines</span>
          <span>Max Combo: <strong id="modalMaxCombo">0x</strong></span>
        </div>
      </div>

      <div id="chancesStatusBox" class="chances-box">
        <span id="chancesLabel" class="chances-text">🎟️ 3 of 3 tickets available today</span>
      </div>

      <div id="modalLeaderboardContainer"></div>

      <!-- Verified Competitor Card (Rendered when already registered) -->
      <div id="modalVerifiedStatusCard" class="verified-status-card" style="display: none;">
        <div class="verified-card-header">
          <span class="verified-pill">
            ${getVerifiedBadgeHtml()} VERIFIED COMPETITOR
          </span>
          <span id="modalVerifiedPlayerName" class="verified-player-name">Player</span>
        </div>
        <p class="verified-card-sub">
          Official prize entry recorded! All your scores automatically sync to the leaderboard — zero WhatsApp prompts needed.
        </p>
      </div>

      <!-- Action Buttons -->
      <button class="modal-button whatsapp-btn" id="claimSpotBtn">
        💬 Register on WhatsApp to Verify & Claim Prizes
      </button>

      <button class="modal-button share-invite-btn" id="inviteFriendsBtn" style="display: none;">
        📲 Invite Friend on WhatsApp (+1 Ticket When They Play)
      </button>

      <div class="modal-button-row">
        <button class="modal-secondary-button" id="restartBtn">
          🎟️ Next Ticket Run
        </button>
        <button class="modal-secondary-button" id="classicModeBtn">
          🎯 Play Classic (Free)
        </button>
      </div>

      <button id="modalSupportLink" class="verified-support-link" type="button" style="display: none;">
        Need help or have questions? Contact Tournament WhatsApp Support ↗
      </button>
    </div>
  `;

  document.body.appendChild(modalEl);

  document.getElementById("restartBtn")?.addEventListener("click", () => {
    hideModal();
    onRestart();
  });

  document.getElementById("classicModeBtn")?.addEventListener("click", () => {
    hideModal();
    onGoToClassic();
  });

  document.getElementById("inviteFriendsBtn")?.addEventListener("click", () => {
    authManager.openReferralShare();
  });

  document.getElementById("claimSpotBtn")?.addEventListener("click", () => {
    authManager.show(() => {
      // When registration completes, immediately refresh the modal to show the Verified Pro card!
      const score = parseInt(
        document.getElementById("modalScore")?.textContent?.replace(/,/g, "") || "0",
        10
      );
      showModal(score, "tournament");
    });
  });

  document.getElementById("modalSupportLink")?.addEventListener("click", () => {
    const profile = authManager.getProfile();
    const conf = tournamentConfigManager.getConfig();
    const msg = encodeURIComponent(
      `Hi! I'm verified player ${profile.nickname} (ID: ${profile.id}) playing the ${conf.sponsorName} ${conf.tournamentTitle}. I have a question about prizes:`
    );
    const waUrl = `https://wa.me/?text=${msg}`;
    const win = window.open(waUrl, "_blank");
    if (!win || win.closed || typeof win.closed === "undefined") {
      window.location.href = waUrl;
    }
  });
}

export function hideModal() {
  if (!modalEl) return;
  modalEl.classList.remove("active");
}

export function showModal(
  score: number,
  modeName: string = "Classic",
  perf?: PerformanceStats
) {
  if (!modalEl) {
    createGameOverModal({
      onRestart: savedRestartCb || (() => window.location.reload()),
      onGoToClassic: savedClassicCb || (() => window.location.reload()),
    });
  }
  if (!modalEl) return;

  // Clear any existing active modals so Game Over is guaranteed visible
  document.querySelectorAll(".modal-overlay.active").forEach((el) => {
    if (el !== modalEl) {
      el.classList.remove("active");
    }
  });

  try {
    const conf = tournamentConfigManager.getConfig();
    const badgeEl = document.getElementById("modalBadge");
    const isClassic = modeName.toLowerCase() === "classic";

    if (badgeEl) {
      badgeEl.textContent = isClassic
        ? `CLASSIC (CASUAL)`
        : `${conf.sponsorName.toUpperCase()} PRIZE RUN`;
      badgeEl.className = "modal-badge";
    }

    const scoreEl = document.getElementById("modalScore");
    if (scoreEl) scoreEl.textContent = score.toLocaleString();

    const reasonPill = document.getElementById("modalReasonPill");
    if (reasonPill) {
      reasonPill.innerHTML = `🚫 <strong>Out of moves:</strong> No space left for remaining bricks!`;
    }

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
    const top1Reward = conf?.prizeTiers?.[0]?.reward || `${conf.currencySymbol}250`;
    const top2Reward = conf?.prizeTiers?.[1]?.reward || `${conf.currencySymbol}150`;
    const top3Reward = conf?.prizeTiers?.[2]?.reward || `${conf.currencySymbol}100`;

    if (teaserEl) {
      if (isClassic) {
        teaserEl.innerHTML = `🎯 Classic Casual Score: <strong>${score.toLocaleString()}</strong>`;
        teaserEl.className = "rank-teaser";
      } else if (rank === 1) {
        teaserEl.innerHTML = `🌟 <strong>NEW #1 LEADER!</strong> Eligible for ${top1Reward} Grand Prize!`;
        teaserEl.className = "rank-teaser gold-glow";
      } else if (rank === 2) {
        teaserEl.innerHTML = `🥈 <strong>RANK #2!</strong> Eligible for ${top2Reward} Runner-Up Prize!`;
        teaserEl.className = "rank-teaser gold-glow";
      } else if (rank === 3) {
        teaserEl.innerHTML = `🥉 <strong>RANK #3!</strong> Eligible for ${top3Reward} 3rd Place Prize!`;
        teaserEl.className = "rank-teaser top5-glow";
      } else if (rank <= 10) {
        teaserEl.innerHTML = `🔥 Ranked <strong>#${rank}</strong> — Inside the ${conf.totalPrizePool} Cash Payout Pool!`;
        teaserEl.className = "rank-teaser top5-glow";
      } else {
        teaserEl.innerHTML = `Official Entry Ranked: <strong>#${rank}</strong> this week`;
        teaserEl.className = "rank-teaser";
      }
    }

    // Chances & Simple Ticket Display (Points 2 & 3: completely unambiguous)
    const chancesLeft = chancesManager.getChancesRemaining();
    const chancesLabel = document.getElementById("chancesLabel");
    const inviteFriendsBtn = document.getElementById("inviteFriendsBtn");
    const claimBtn = document.getElementById("claimSpotBtn");
    const restartBtn = document.getElementById("restartBtn");
    const isVerified = authManager.isWhatsAppVerified();
    const verifiedCard = document.getElementById("modalVerifiedStatusCard");
    const verifiedPlayerName = document.getElementById("modalVerifiedPlayerName");
    const supportLink = document.getElementById("modalSupportLink");

    if (verifiedCard && verifiedPlayerName) {
      if (!isClassic && isVerified) {
        verifiedCard.style.display = "block";
        const profile = authManager.getProfile();
        verifiedPlayerName.innerHTML = `${profile.nickname} ${getVerifiedBadgeHtml()}`;
      } else {
        verifiedCard.style.display = "none";
      }
    }

    if (supportLink) {
      supportLink.style.display = (!isClassic && isVerified) ? "inline-block" : "none";
    }

    if (chancesLabel) {
      if (isClassic) {
        chancesLabel.innerHTML = `🎯 <strong>Classic Mode:</strong> Unlimited free casual play. Zero tickets used.`;
      } else if (chancesLeft > 0) {
        chancesLabel.innerHTML = `🎟️ <strong>Prize Run Finished:</strong> ${chancesLeft} of 3 daily tickets remaining.`;
      } else {
        chancesLabel.innerHTML = `⚠️ <strong>All 3 daily tickets used.</strong> Resets daily at midnight!`;
      }
    }

    if (restartBtn) {
      if (isClassic) {
        restartBtn.textContent = "🔄 Play Classic Again";
      } else {
        restartBtn.textContent = chancesLeft > 0 ? `🎟️ Play Next Ticket (${chancesLeft} Left)` : "🏆 Tournament Complete";
      }
    }

    if (inviteFriendsBtn) {
      inviteFriendsBtn.style.display = !isClassic && chancesLeft <= 1 ? "flex" : "none";
    }

    if (claimBtn) {
      // Only show registration button if player is NOT verified yet!
      claimBtn.style.display = (!isClassic && !isVerified) ? "flex" : "none";
      claimBtn.removeAttribute("disabled");
      claimBtn.textContent = "💬 Register on WhatsApp to Verify & Claim";
    }

    const lbContainer = document.getElementById("modalLeaderboardContainer");
    if (lbContainer) {
      lbContainer.innerHTML = renderLeaderboardHTML(score);
    }
  } catch (err) {
    console.error("Error setting up GameOver modal content:", err);
  }

  modalEl.classList.add("active");
}
