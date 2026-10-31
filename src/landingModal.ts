import { getSelectedEvent, loadEvents } from "./supabaseClient";
import { showTourneyRulesModal } from "./tourneyRulesModal";
import { CASUAL_ONLY, CLASSIC_RANKED_ENABLED, appendChannelFollow, showCasualInfo } from "./launch";
import { openClassicEntry } from "./classic";
import { appendUpdatesLauncher } from "./updates";

export interface LandingModalOptions {
  onStartTournament: () => void;
  onStartClassic: () => void;
  onStartLevels?: () => void;
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
      <h1 class="landing-hero-title">BLOK BLASTER<br/><span class="gold-gradient-text">by Playables</span></h1>
      <p class="landing-hero-sub">Play Classic and Levels freely, or enter an available event. Official results are checked from your move replay.</p>

      <!-- Active Cup Banner -->
      <div class="landing-active-cup-card" id="landingCupCard">
        <div class="landing-cup-top">
          <span class="landing-cup-tag">🔥 PILOT PREVIEW</span>
          <span class="landing-cup-prize" id="landingCupPrizePool">Checking events</span>
        </div>
        <strong class="landing-cup-name" id="landingCupTitle">Available events</strong>
        <p class="landing-cup-desc" id="landingCupDesc">Classic and Levels are ready to play while event details load.</p>
      </div>

      <!-- 3-Step Feature Highlights Grid -->
      <div class="landing-features-grid">
        <div class="landing-feature-card">
          <div class="landing-feat-icon">🎟️</div>
          <div class="landing-feat-content">
            <strong>3 Daily Free Tickets</strong>
            <span>3 base attempts per guest account each day. Resets at midnight South Africa time. No purchase needed.</span>
          </div>
        </div>

        <div class="landing-feature-card">
          <div class="landing-feat-icon">👑</div>
          <div class="landing-feat-content">
            <strong>Replay-checked Standings</strong>
            <span>Adaptive deals respond to your board. Official scores are reconstructed from legal move replays.</span>
          </div>
        </div>

        <div class="landing-feature-card">
          <div class="landing-feat-icon">☑️</div>
          <div class="landing-feat-content">
            <strong>No-login Casual Play</strong>
            <span>Play casually without a login form. Adult prize winners request manual review through WhatsApp.</span>
          </div>
        </div>
      </div>

      <!-- Primary Action CTAs -->
      <div class="landing-actions-col">
        <button id="landingStartTourneyBtn" class="modal-button official-run-btn">
          🏆 ENTER EVENT · 1 TICKET
          <span class="btn-subtext">Submit a replay for provisional standings.</span>
        </button>

        <button id="landingStartClassicBtn" class="modal-button classic-return-btn">
          🎯 PLAY CLASSIC
          <span class="btn-subtext">Free and unlimited. No tickets needed.</span>
        </button>
      </div>

      <!-- Footer Links & Rules -->
      <div class="landing-footer-row">
        <span>Official entries and prizes are 18+. Demo events have no prizes.</span>
        <button id="landingRulesBtn" class="tourney-terms-link" type="button">Official Rules & Terms ↗</button>
      </div>
    </div>
  `;

  if (CASUAL_ONLY) {
    modalEl.innerHTML = `
      <div class="modal landing-modal">
        <button class="modal-close-corner" id="closeLandingBtn" aria-label="Close">✕</button>
        <div class="landing-publisher"><img src="/brand-mark.svg" alt="" width="26" height="26"/> A little play, by Playables</div>
        <div class="landing-hero-badge">OPEN. PLAY. REPEAT.</div>
        <h1 class="landing-hero-title">blok<br/>blaster<span class="brand-dot">.</span></h1>
        <p class="landing-hero-sub">A little space.<br/><strong>A lot of possibilities.</strong></p>
        <div class="landing-block-art" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <div class="landing-proof"><span>No download</span><span>No forced ad breaks</span></div>
        <p class="landing-simple-copy">Place blocks. Clear lines. Beat your best.<br/>No account or phone number needed.</p>
        <div class="landing-mode-choices">
          <button id="landingStartClassicBtn" class="modal-button classic-return-btn"><span class="choice-number">01</span><span>Play Classic<small>Endless room to improve</small></span><span class="choice-arrow">↗</span></button>
          <button id="landingStartTourneyBtn" class="modal-button"><span class="choice-number">02</span><span>Explore Levels<small>60 puzzles. 180 stars to collect.</small></span><span class="choice-arrow">↗</span></button>
        </div>
        <div id="landingChannel" class="landing-channel"></div>
        <p class="promotion-coming-soon">Promotions · coming soon<span>Free play is open. Prize entry is not open yet.</span></p>
        <div class="landing-footer-row"><span>Made for your next little break.</span><button id="landingRulesBtn" class="tourney-terms-link" type="button">About & updates ↗</button></div>
      </div>`;
    appendChannelFollow(modalEl.querySelector<HTMLElement>("#landingChannel")!);
  }

  document.body.appendChild(modalEl);
  appendUpdatesLauncher(modalEl.querySelector<HTMLElement>(".landing-modal")!);
  if (CASUAL_ONLY && CLASSIC_RANKED_ENABLED) {
    const ranked = document.createElement("button");
    ranked.id = "landingDailyClassicBtn";
    ranked.className = "modal-secondary-button classic-daily-launcher";
    ranked.textContent = "Daily leaderboard · play with a nickname ↗";
    ranked.onclick = () => { markLandingSeen(); hideLandingModal(); openClassicEntry(); };
    modalEl.querySelector(".landing-modal")?.append(ranked);
  }

  // Bind close buttons
  document.getElementById("closeLandingBtn")?.addEventListener("click", () => {
    markLandingSeen();
    hideLandingModal();
    currentOptions?.onClose?.();
  });

  document.getElementById("landingRulesBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (CASUAL_ONLY) showCasualInfo();
    else showTourneyRulesModal();
  });

  document.getElementById("landingStartTourneyBtn")?.addEventListener("click", () => {
    markLandingSeen();
    hideLandingModal();
    if (CASUAL_ONLY) currentOptions?.onStartLevels?.();
    else currentOptions?.onStartTournament();
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
  if (CASUAL_ONLY) return;
  const titleEl = document.getElementById("landingCupTitle");
  const prizeEl = document.getElementById("landingCupPrizePool");
  const descEl = document.getElementById("landingCupDesc");

  const event=getSelectedEvent();
  if (titleEl) titleEl.textContent = event?.title || "Official events coming soon";
  if (prizeEl) prizeEl.textContent = event ? (event.is_demo ? "Demo — no prizes" : event.prize_pool) : "Not open yet";
  if (descEl) descEl.textContent = event ? (event.is_demo ? "Demo event only. No real prizes or payouts." : "Official prizes are 18+. Accepted standings are provisional until manual winner review.") : "Classic and Levels are ready to play. Open Tournaments to check live event availability.";

}

export function showLandingModal(options: LandingModalOptions) {
  currentOptions = options;
  createLandingModal();
  updateLandingContent();
  if (!CASUAL_ONLY) void loadEvents().then(updateLandingContent).catch(()=>{});
  if (!modalEl) return;
  modalEl.classList.add("active");
}

export function hideLandingModal() {
  if (!modalEl) return;
  modalEl.classList.remove("active");
}
