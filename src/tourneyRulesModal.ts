import { tournamentConfigManager } from "./tournamentConfig";

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
      <p id="rulesModalSubtitle" class="rules-subtitle">Partner Cash & Voucher Competition</p>

      <div class="rules-scroll-area">
        <div class="rules-item">
          <span class="rules-icon">🧠</span>
          <div class="rules-text">
            <strong>1. Skill-Based Contest (Not Gambling)</strong>
            <p>This competition is 100% free-to-enter using daily tickets. Results depend entirely on player puzzle skill, spatial strategy, and move efficiency. No purchase is required or will increase your chances of winning.</p>
          </div>
        </div>

        <div class="rules-item">
          <span class="rules-icon">👤</span>
          <div class="rules-text">
            <strong>2. Eligibility & Age</strong>
            <p>Open to all participants residing in the promotion territory. Players under 18 years of age are welcome to compete but must have parental or legal guardian consent to receive cash payouts or retail vouchers.</p>
          </div>
        </div>

        <div class="rules-item">
          <span class="rules-icon">🏆</span>
          <div class="rules-text">
            <strong>3. Leaderboard & Tie-Breakers</strong>
            <p>Rankings are based on your highest verified single-run score during the active tournament period. In the event of identical high scores, the run recorded with the earlier server timestamp takes the higher position.</p>
          </div>
        </div>

        <div class="rules-item">
          <span class="rules-icon">💬</span>
          <div class="rules-text">
            <strong>4. Prize Verification & Claim Window</strong>
            <p>Qualified leaderboard players must tap "Claim Prize Spot" and connect via official WhatsApp within <strong>48 hours</strong> of the tournament close. Payouts (EFT, eWallet, or digital vouchers) are fulfilled within 3–5 business days following identity confirmation.</p>
          </div>
        </div>

        <div class="rules-item">
          <span class="rules-icon">🛡️</span>
          <div class="rules-text">
            <strong>5. Anti-Cheat & Fair Play Policy</strong>
            <p>Every match is audited with anti-cheat cryptographic telemetry. Any use of bots, screen-scraping, automation, or multi-account exploitation will immediately void all scores and disqualify the user.</p>
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

  const conf = tournamentConfigManager.getConfig();
  const subEl = document.getElementById("rulesModalSubtitle");
  const disclaimerEl = document.getElementById("rulesSponsorDisclaimer");

  if (subEl) {
    subEl.textContent = `${conf.sponsorName} ${conf.tournamentTitle} • ${conf.totalPrizePool} Pool`;
  }
  if (disclaimerEl) {
    disclaimerEl.textContent = `Prizes are provided in partnership with ${conf.sponsorName}. The tournament organizers reserve the right to audit suspicious activity and enforce fair play rules for all participants.`;
  }

  rulesModalEl.classList.add("active");
}

export function hideTourneyRulesModal() {
  if (rulesModalEl) {
    rulesModalEl.classList.remove("active");
  }
}
