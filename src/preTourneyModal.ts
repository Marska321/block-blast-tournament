import { tournamentConfigManager } from "./tournamentConfig";
import { showTourneyRulesModal } from "./tourneyRulesModal";

export interface PreTourneyModalOptions {
  chancesRemaining: number;
  onStartOfficial: () => void;
  onGoToClassic: () => void;
  onInviteWhatsApp: () => void;
  onClose: () => void;
}

let modalEl: HTMLElement | null = null;

export function createPreTourneyModal() {
  if (modalEl) return;

  modalEl = document.createElement("div");
  modalEl.className = "modal-overlay";
  modalEl.id = "preTourneyModal";

  modalEl.innerHTML = `
    <div class="modal pretourney-modal">
      <button class="modal-close-corner" id="closePreTourneyBtn" aria-label="Close">✕</button>
      <div id="preTourneyBadge" class="modal-badge pretourney-badge">🏆 OFFICIAL CASH TOURNAMENT</div>
      <h2 id="preTourneyTitle" class="modal-title">Partner Cash Cup</h2>
      <p id="preTourneySubtitle" class="pretourney-subtitle">Competitive Bracket • Real Cash Prizes</p>

      <!-- Multi-Partner Tournament Selector (Phase 1 Switcher) -->
      <div id="tourneySelectorBar" class="tourney-selector-bar" style="display: none;"></div>

      <!-- Prize Pool Showcase (Dynamically populated from tournamentConfig) -->
      <div class="prize-showcase-card">
        <div class="prize-card-header">
          <span id="prizeCardHeaderLabel">💰 PRIZE POOL</span>
          <span id="prizePoolTotalVal" class="prize-pool-total">R500</span>
        </div>
        <div id="prizeTiersContainer" class="prize-tiers-grid">
          <!-- Rendered dynamically -->
        </div>
      </div>

      <!-- Upcoming Partner Prize Cups Showcase (Coming Soon Anticipation) -->
      <div class="upcoming-partners-section" id="upcomingPartnersSection">
        <div class="upcoming-partners-header">
          <span class="upcoming-title">🚀 UPCOMING PARTNER PRIZE CUPS</span>
          <span class="upcoming-pulse-tag">COMING SOON</span>
        </div>
        <div class="upcoming-partner-grid" id="upcomingPartnersGrid">
          <!-- Populated dynamically -->
        </div>
      </div>

      <!-- Clear & Simple Ticket Status Card (Points 2 & 3: no confusion) -->
      <div id="preTourneyTicketBox" class="pretourney-ticket-box">
        <div class="ticket-status-row">
          <span class="ticket-icon">🎟️</span>
          <div class="ticket-info">
            <strong id="preTourneyTicketCount">3 Daily Tickets Available</strong>
            <span id="preTourneyTicketSub" class="ticket-sub">1 ticket = 1 ranked prize attempt (free reset daily)</span>
          </div>
        </div>
        <div class="telemetry-badge">
          <span>🛡️ Verified Fair</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div id="preTourneyActionButtons" class="pretourney-buttons">
        <button id="startOfficialRunBtn" class="modal-button official-run-btn">
          🏆 PLAY FOR PRIZES (1 TICKET)
          <span class="btn-subtext">Submit your score to the official weekly prize leaderboard</span>
        </button>

        <!-- Point 4: Go back to Classic instead of Practice -->
        <button id="goToClassicBtn" class="modal-button classic-return-btn">
          🎯 PLAY CLASSIC (FREE & UNLIMITED)
          <span class="btn-subtext">Zero tickets needed • Casual endless practice mode</span>
        </button>

        <button id="preTourneyInviteBtn" class="modal-button share-invite-btn" style="display: none;">
          📲 Invite Friend on WhatsApp (+1 Bonus Ticket When They Play)
        </button>

        <!-- Terms and Rules Link -->
        <div class="tourney-terms-hint">
          <span>Skill-based promotion. By playing, you accept the </span>
          <button id="viewTourneyRulesBtn" class="tourney-terms-link" type="button">Official Rules & Terms ↗</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);

  document.getElementById("viewTourneyRulesBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    showTourneyRulesModal();
  });
}

export function showPreTourneyModal(options: PreTourneyModalOptions) {
  createPreTourneyModal();
  if (!modalEl) return;

  const renderModalContent = () => {
    const config = tournamentConfigManager.getConfig();
    const allTourneys = tournamentConfigManager.getAllTournaments();
    const activeId = tournamentConfigManager.getActiveTournamentId();

    const titleEl = document.getElementById("preTourneyTitle");
    const subEl = document.getElementById("preTourneySubtitle");
    const badgeEl = document.getElementById("preTourneyBadge");
    const headerLabelEl = document.getElementById("prizeCardHeaderLabel");
    const prizeTotalEl = document.getElementById("prizePoolTotalVal");
    const prizeContainer = document.getElementById("prizeTiersContainer");
    const ticketCountEl = document.getElementById("preTourneyTicketCount");
    const ticketSubEl = document.getElementById("preTourneyTicketSub");
    const officialBtn = document.getElementById("startOfficialRunBtn");
    const selectorBar = document.getElementById("tourneySelectorBar");

    // Multi-Tournament Switcher (Phase 1)
    if (selectorBar) {
      if (allTourneys.length > 1) {
        selectorBar.style.display = "flex";
        selectorBar.innerHTML = allTourneys
          .map((t) => {
            const isSelected = t.id === activeId;
            const icon = t.frequency === "daily" ? "⚡" : "🏆";
            return `
              <button class="tourney-tab-pill ${isSelected ? "active" : ""}" data-id="${t.id}">
                <span class="pill-title">${icon} ${t.sponsorName}</span>
                <span class="pill-sub">${t.totalPrizePool} ${t.frequency.toUpperCase()}</span>
              </button>
            `;
          })
          .join("");

        selectorBar.querySelectorAll(".tourney-tab-pill").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            const targetId = (e.currentTarget as HTMLElement).getAttribute("data-id");
            if (targetId && targetId !== activeId) {
              tournamentConfigManager.setActiveTournament(targetId);
              renderModalContent();
            }
          });
        });
      } else {
        selectorBar.style.display = "none";
      }
    }

    if (titleEl) titleEl.textContent = `${config.sponsorName} ${config.tournamentTitle}`;
    if (subEl) subEl.textContent = `${config.totalPrizePool} Prize Pool • ${config.endsAtDescription || config.sponsorTagline}`;
    if (headerLabelEl) {
      headerLabelEl.textContent = config.frequency === "daily" ? "⚡ DAILY VOUCHER PRIZE POOL" : "💰 WEEKLY CASH PRIZE POOL";
    }
    if (prizeTotalEl) prizeTotalEl.textContent = config.totalPrizePool;

    // Render prize tiers dynamically
    if (prizeContainer) {
      prizeContainer.innerHTML = config.prizeTiers
        .map(
          (tier) => `
          <div class="prize-tier-badge ${tier.badgeClass || ""}">
            <span class="tier-rank">${tier.rank}</span>
            <span class="tier-reward">${tier.reward}</span>
          </div>
        `
        )
        .join("");
    }

    // Render upcoming partners dynamically (Coming Soon anticipation)
    const upcomingGrid = document.getElementById("upcomingPartnersGrid");
    if (upcomingGrid) {
      const upcomingList = tournamentConfigManager.getUpcomingPartners();
      upcomingGrid.innerHTML = upcomingList
        .map(
          (partner) => `
          <div class="upcoming-partner-card">
            <div class="upcoming-card-top">
              <span class="upcoming-icon">${partner.icon}</span>
              <span class="coming-soon-pill">${partner.statusBadge}</span>
            </div>
            <strong class="upcoming-partner-name">${partner.name}</strong>
            <span class="upcoming-partner-prizes">${partner.expectedPrizes}</span>
          </div>
        `
        )
        .join("");
    }

    // Clear, non-confusing tickets display
    if (options.chancesRemaining > 0) {
      if (badgeEl) {
        if (config.id === "pre_season_cup") {
          badgeEl.textContent = "🔥 PRE-SEASON LAUNCH • PRIZES COMING SOON";
        } else {
          badgeEl.textContent = config.frequency === "daily" ? "⚡ OFFICIAL DAILY DASH" : "🏆 OFFICIAL CASH TOURNAMENT";
        }
        badgeEl.className = "modal-badge pretourney-badge";
      }
      if (ticketCountEl) {
        ticketCountEl.textContent = `${options.chancesRemaining} of 3 Daily Tickets Available`;
      }
      if (ticketSubEl) {
        ticketSubEl.textContent = `Uses 1 ticket to enter ${config.sponsorName}'s ${config.tournamentTitle}`;
      }
      if (officialBtn) officialBtn.style.display = "flex";
    } else {
      if (badgeEl) {
        badgeEl.textContent = "⚠️ NO TOURNAMENT TICKETS LEFT TODAY";
        badgeEl.className = "modal-badge pretourney-badge empty";
      }
      if (ticketCountEl) {
        ticketCountEl.textContent = "All 3 Daily Tickets Used";
      }
      if (ticketSubEl) {
        ticketSubEl.textContent = "Tickets reset at midnight, or invite a friend for +1 ticket!";
      }
      if (officialBtn) officialBtn.style.display = "none";
    }
  };

  renderModalContent();

  const officialBtn = document.getElementById("startOfficialRunBtn");
  const classicBtn = document.getElementById("goToClassicBtn");
  const inviteBtn = document.getElementById("preTourneyInviteBtn");
  const closeBtn = document.getElementById("closePreTourneyBtn");

  if (inviteBtn) {
    inviteBtn.style.display = options.chancesRemaining > 0 ? "none" : "flex";
  }

  // Clone listeners to avoid multi-binds
  if (officialBtn) {
    officialBtn.onclick = () => {
      hidePreTourneyModal();
      options.onStartOfficial();
    };
  }

  if (classicBtn) {
    classicBtn.onclick = () => {
      hidePreTourneyModal();
      options.onGoToClassic();
    };
  }

  if (inviteBtn) {
    inviteBtn.onclick = () => {
      options.onInviteWhatsApp();
    };
  }

  if (closeBtn) {
    closeBtn.onclick = () => {
      hidePreTourneyModal();
      options.onClose();
    };
  }

  modalEl.classList.add("active");
}

export function hidePreTourneyModal() {
  if (!modalEl) return;
  modalEl.classList.remove("active");
}
