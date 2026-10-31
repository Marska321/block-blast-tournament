import { getSelectedEvent } from "./supabaseClient";

let rulesModalEl: HTMLElement | null = null;

export function createTourneyRulesModal() {
  if (rulesModalEl) return;

  rulesModalEl = document.createElement("div");
  rulesModalEl.className = "modal-overlay rules-modal-overlay";
  rulesModalEl.id = "tourneyRulesModal";

  rulesModalEl.innerHTML = `
    <div class="modal rules-modal-card">
      <button class="modal-close-corner" id="closeRulesModalBtn" aria-label="Close">✕</button>
      <div class="modal-badge rules-badge">PROMOTIONAL SKILL TOURNAMENT</div>
      <h2 class="modal-title rules-title">Official Tournament Rules & Terms</h2>
      <p id="rulesModalSubtitle" class="rules-subtitle">Select an available event to see its details.</p>

      <div class="rules-scroll-area">
        <div class="rules-item">
          <span class="rules-icon">🧠</span>
          <div class="rules-text">
            <strong>1. Free Entry</strong>
            <p>Entry uses free daily tickets. Scores depend on legal placements and each run's adaptive deal. No purchase is needed or changes ticket limits.</p>
          </div>
        </div>

        <div class="rules-item">
          <span class="rules-icon">👤</span>
          <div class="rules-text">
            <strong>2. Eligibility & Age</strong>
            <p>Official tournament entries and prizes are for adults aged 18 or older. Younger players can play Classic and Levels. Adult eligibility is checked manually before a prize is approved.</p>
          </div>
        </div>

        <div class="rules-item">
          <span class="rules-icon">🏆</span>
          <div class="rules-text">
            <strong>3. Leaderboard & Tie-Breakers</strong>
            <p>Rankings are provisional and based on your highest server-accepted single-run score during the active tournament period. In the event of identical high scores, the run recorded with the earlier server timestamp takes the higher position.</p>
          </div>
        </div>

        <div class="rules-item">
          <span class="rules-icon">💬</span>
          <div class="rules-text">
            <strong>4. Prize Verification & Claim Window</strong>
            <p>Eligible adults must request a claim after the event closes and send the claim code to the configured tournament WhatsApp number within <strong>48 hours</strong> of the tournament close. Opening WhatsApp does not approve a claim. The operator reviews the result, age eligibility, and duplicate claims before handling any payout manually.</p>
          </div>
        </div>

        <div class="rules-item">
          <span class="rules-icon">🛡️</span>
          <div class="rules-text">
            <strong>5. Anti-Cheat & Fair Play Policy</strong>
            <p>Official results are calculated from a server-validated move replay. This establishes legal moves, not a unique human identity. Automated play and multiple-account abuse may disqualify a result during manual winner review.</p>
          </div>
        </div>

        <div class="rules-item">
          <span class="rules-icon">🤝</span>
          <div class="rules-text">
            <strong>6. Sponsor & Promoter Rights</strong>
            <p id="rulesSponsorDisclaimer">Prizes are provided in partnership with the designated sponsor. The tournament organizers reserve the right to audit suspicious activity and enforce fair play rules.</p>
          </div>
        </div>
      </div>

      <button id="understandRulesBtn" class="modal-button rules-agree-btn">
        Got It, Let's Play!
      </button>
    </div>
  `;

  document.body.appendChild(rulesModalEl);

  const closeBtn = document.getElementById("closeRulesModalBtn");
  const understandBtn = document.getElementById("understandRulesBtn");

  const hide = () => hideTourneyRulesModal();
  closeBtn?.addEventListener("click", hide);
  understandBtn?.addEventListener("click", hide);
}

export function showTourneyRulesModal() {
  createTourneyRulesModal();
  if (!rulesModalEl) return;

  const event = getSelectedEvent();
  const subEl = document.getElementById("rulesModalSubtitle");
  const disclaimerEl = document.getElementById("rulesSponsorDisclaimer");

  if (subEl) {
    subEl.textContent = event
      ? `${event.title} • ${event.is_demo ? "Demo — no prizes" : event.prize_pool}`
      : "No official event is selected. Classic and Levels are available.";
  }
  if (disclaimerEl) {
    disclaimerEl.textContent = event?.is_demo
      ? "This is a demo event. There are no real prizes, claims, or payouts."
      : event
        ? `Prizes follow the selected event's published details. Claims close 48 hours after the event ends. Results and adult eligibility require manual review before approval.`
        : "Prize details will be published with each event. No prize is currently advertised here.";
  }

  rulesModalEl.classList.add("active");
}

export function hideTourneyRulesModal() {
  if (rulesModalEl) {
    rulesModalEl.classList.remove("active");
  }
}
