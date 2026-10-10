import { tournamentConfigManager } from "./tournamentConfig";
import { showTourneyRulesModal } from "./tourneyRulesModal";
import { authManager } from "./auth";

export interface LandingModalOptions {
  onStartTournament: () => void;
  onStartClassic: () => void;
  onClose?: () => void;
}

const STORAGE_SEEN_LANDING = "bb_has_seen_landing";

export function isFirstTimeUser(): boolean {
  try {
    return localStorage.getItem(STORAGE_SEEN_LANDING) !== "true";
  } catch {
    return false;
  }
}

export function markLandingSeen(): void {
  try {
    localStorage.setItem(STORAGE_SEEN_LANDING, "true");
  } catch {}
}

let modalEl: HTMLElement | null = null;
let currentOptions: LandingModalOptions | null = null;

export function createLandingModal() {
  if (modalEl) return;

  modalEl = document.createElement("div");
  modalEl.className = "modal-overlay";
  modalEl.id = "landingModal";

  modalEl.innerHTML = `
    <div class="modal landing-modal">
      <button class="modal-close-corner" id="closeLandingBtn" aria-label="Close">✕</button>
      
      <!-- Hero Header -->
      <div class="landing-hero-badge">🏆 OFFICIAL COMPETITIVE PUZZLE</div>
      <h1 class="landing-hero-title">BLOCK BLAST<br/><span class="gold-gradient-text">TOURNAMENT</span></h1>
      <p class="landing-hero-sub">The classic block puzzle you love — now with weekly cash leaderboards, starter vouchers & certified fair play.</p>

      <!-- Active Cup Banner -->
      <div class="landing-active-cup-card" id="landingCupCard">
        <div class="landing-cup-top">
          <span class="landing-cup-tag">🔥 ACTIVE TOURNAMENT</span>
          <span class="landing-cup-prize" id="landingCupPrizePool">R250 VOUCHERS</span>
        </div>
        <strong class="landing-cup-name" id="landingCupTitle">Pre-Season Inaugural Voucher Cup</strong>
        <p class="landing-cup-desc" id="landingCupDesc">Compete for seeded Airtime & Electricity vouchers while incoming partner prize pools prepare to launch!</p>
      </div>

      <!-- 3-Step Feature Highlights Grid -->
      <div class="landing-features-grid">
        <div class="landing-feature-card">
          <div class="landing-feat-icon">🎟️</div>
          <div class="landing-feat-content">
            <strong>3 Daily Free Tickets</strong>
            <span>Every player receives 3 ranked prize attempts daily. Resets midnight. Zero pay-to-win.</span>
          </div>
        </div>

        <div class="landing-feature-card">
          <div class="landing-feat-icon">👑</div>
          <div class="landing-feat-content">
            <strong>Seeded Fair Leaderboards</strong>
            <span>All players receive identical block deals. Pure skill, strategy & combo execution.</span>
          </div>
        </div>

        <div class="landing-feature-card">
          <div class="landing-feat-icon">☑️</div>
          <div class="landing-feat-content">
            <strong>Verified Pro Badges</strong>
            <span>Fast in-game WhatsApp registration unlocks verified checkmarks & custom photo wallpapers.</span>
          </div>
        </div>
      </div>

      <!-- Upcoming Partner Cups Showcase (Anticipation) -->
      <div class="landing-upcoming-box">
        <div class="landing-upcoming-header">
          <span>🚀 INCOMING PARTNER PRIZE CUPS</span>
          <span class="coming-soon-pill">COMING SOON</span>
        </div>
        <div class="landing-upcoming-chips" id="landingUpcomingChips">
          <!-- Dynamically populated -->
        </div>
      </div>

      <!-- Primary Action CTAs -->
      <div class="landing-actions-col">
        <button id="landingStartTourneyBtn" class="modal-button official-run-btn">
          🏆 ENTER TOURNAMENT (1 FREE TICKET)
          <span class="btn-subtext">Play today's official seeded run & claim your leaderboard rank</span>
        </button>

        <button id="landingStartClassicBtn" class="modal-button classic-return-btn">
          🎯 PRACTICE CASUAL (FREE & UNLIMITED)
          <span class="btn-subtext">Warm up with endless casual mode • Zero tickets needed</span>
        </button>
      </div>

      <!-- Footer Links & Rules -->
      <div class="landing-footer-row">
        <span>Skill-based promotion. Must be 18+ to claim prizes.</span>
        <button id="landingRulesBtn" class="tourney-terms-link" type="button">Official Rules & Terms ↗</button>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);

  // Bind close buttons
  document.getElementById("closeLandingBtn")?.addEventListener("click", () => {
    markLandingSeen();
    hideLandingModal();
    currentOptions?.onClose?.();
  });

  document.getElementById("landingRulesBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    showTourneyRulesModal();
  });

  document.getElementById("landingStartTourneyBtn")?.addEventListener("click", () => {
    markLandingSeen();
    hideLandingModal();
    currentOptions?.onStartTournament();
  });

  document.getElementById("landingStartClassicBtn")?.addEventListener("click", () => {
    markLandingSeen();
    hideLandingModal();
    currentOptions?.onStartClassic();
  });

  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) {
      markLandingSeen();
      hideLandingModal();
      currentOptions?.onClose?.();
    }
  });
}

function updateLandingContent() {
  const conf = tournamentConfigManager.getConfig();
  const titleEl = document.getElementById("landingCupTitle");
  const prizeEl = document.getElementById("landingCupPrizePool");
  const descEl = document.getElementById("landingCupDesc");
  const chipsContainer = document.getElementById("landingUpcomingChips");

  if (titleEl) titleEl.textContent = `${conf.sponsorName} ${conf.tournamentTitle}`;
  if (prizeEl) prizeEl.textContent = conf.totalPrizePool;
  if (descEl) descEl.textContent = conf.disclaimer || `${conf.totalPrizePool} pool with top 10 prize payouts`;

  if (chipsContainer) {
    const upcoming = tournamentConfigManager.getUpcomingPartners();
    chipsContainer.innerHTML = upcoming
      .map(
        (p) => `
        <div class="landing-upcoming-chip">
          <span class="chip-icon">${p.icon}</span>
          <div class="chip-text">
            <strong>${p.name}</strong>
            <span>${p.expectedPrizes}</span>
          </div>
          <span class="coming-soon-pill">${p.statusBadge}</span>
        </div>
      `
      )
      .join("");
  }
}

export function showLandingModal(options: LandingModalOptions) {
  currentOptions = options;
  createLandingModal();
  updateLandingContent();
  if (!modalEl) return;
  modalEl.classList.add("active");
}

export function hideLandingModal() {
  if (!modalEl) return;
  modalEl.classList.remove("active");
}
