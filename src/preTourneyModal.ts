export interface PreTourneyModalOptions {
  modeName: string;
  gridDesc: string;
  chancesRemaining: number;
  onStartOfficial: () => void;
  onStartPractice: () => void;
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
      <div id="preTourneyBadge" class="modal-badge pretourney-badge">🏆 OFFICIAL PRIZE TOURNAMENT</div>
      <h2 id="preTourneyTitle" class="modal-title">Classic Championship</h2>
      <p id="preTourneySubtitle" class="pretourney-subtitle">8×8 Competitive Bracket • Real Cash Prizes</p>

      <!-- Prize Pool Showcase -->
      <div class="prize-showcase-card">
        <div class="prize-card-header">
          <span>💰 WEEKLY CASH PRIZE POOL</span>
          <span class="prize-pool-total">$500+</span>
        </div>
        <div class="prize-tiers-grid">
          <div class="prize-tier-badge gold-tier">
            <span class="tier-rank">1ST</span>
            <span class="tier-reward">$250</span>
          </div>
          <div class="prize-tier-badge silver-tier">
            <span class="tier-rank">2ND</span>
            <span class="tier-reward">$150</span>
          </div>
          <div class="prize-tier-badge bronze-tier">
            <span class="tier-rank">3RD</span>
            <span class="tier-reward">$100</span>
          </div>
          <div class="prize-tier-badge top10-tier">
            <span class="tier-rank">TOP 10</span>
            <span class="tier-reward">Cash Share</span>
          </div>
        </div>
      </div>

      <!-- Ticket & Security Status Card -->
      <div id="preTourneyTicketBox" class="pretourney-ticket-box">
        <div class="ticket-status-row">
          <span class="ticket-icon">⚡</span>
          <div class="ticket-info">
            <strong id="preTourneyTicketCount">3 Daily Tickets Left</strong>
            <span class="ticket-sub">Resets daily at midnight</span>
          </div>
        </div>
        <div class="telemetry-badge">
          <span>🛡️ Anti-Cheat Telemetry Active</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div id="preTourneyActionButtons" class="pretourney-buttons">
        <button id="startOfficialRunBtn" class="modal-button official-run-btn">
          🚀 START OFFICIAL PRIZE RUN
          <span class="btn-subtext">Uses 1 Daily Ticket • Ranked for Cash Prizes</span>
        </button>

        <button id="startPracticeRunBtn" class="modal-button practice-run-btn">
          🎮 PRACTICE WARMUP (FREE)
          <span class="btn-subtext">0 Tickets Used • Unlimited Warmup • Unranked</span>
        </button>

        <button id="preTourneyInviteBtn" class="modal-button share-invite-btn" style="display: none;">
          📲 Challenge Friend on WhatsApp (+1 Ticket When They Play)
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);
}

export function showPreTourneyModal(options: PreTourneyModalOptions) {
  createPreTourneyModal();
  if (!modalEl) return;

  const titleEl = document.getElementById("preTourneyTitle");
  const subEl = document.getElementById("preTourneySubtitle");
  const badgeEl = document.getElementById("preTourneyBadge");
  const ticketCountEl = document.getElementById("preTourneyTicketCount");
  const officialBtn = document.getElementById("startOfficialRunBtn");
  const practiceBtn = document.getElementById("startPracticeRunBtn");
  const inviteBtn = document.getElementById("preTourneyInviteBtn");
  const closeBtn = document.getElementById("closePreTourneyBtn");

  if (titleEl) titleEl.textContent = `${options.modeName} Championship`;
  if (subEl) subEl.textContent = `${options.gridDesc} • Real Cash Prizes`;

  if (options.chancesRemaining > 0) {
    if (badgeEl) {
      badgeEl.textContent = "🏆 OFFICIAL PRIZE TOURNAMENT";
      badgeEl.className = "modal-badge pretourney-badge";
    }
    if (ticketCountEl) {
      ticketCountEl.textContent = `${options.chancesRemaining} of 3 Daily Tickets Left`;
    }
    if (officialBtn) officialBtn.style.display = "flex";
    if (inviteBtn) inviteBtn.style.display = "none";
  } else {
    if (badgeEl) {
      badgeEl.textContent = "⚠️ DAILY TICKETS EXHAUSTED";
      badgeEl.className = "modal-badge pretourney-badge empty";
    }
    if (ticketCountEl) {
      ticketCountEl.textContent = "0 Daily Tickets Remaining Today";
    }
    if (officialBtn) officialBtn.style.display = "none";
    if (inviteBtn) inviteBtn.style.display = "flex";
  }

  // Clone listeners to avoid multi-binds
  if (officialBtn) {
    officialBtn.onclick = () => {
      hidePreTourneyModal();
      options.onStartOfficial();
    };
  }

  if (practiceBtn) {
    practiceBtn.onclick = () => {
      hidePreTourneyModal();
      options.onStartPractice();
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
