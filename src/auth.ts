import { sessionManager } from "./session";
import { chancesManager } from "./chances";

export interface PlayerProfile {
  id: string;
  nickname: string;
  phone?: string | null;
  country: string;
  verified?: boolean;
}

class AuthManager {
  private userKey = "bbt_user_whatsapp";
  private verifiedKey = "bbt_user_whatsapp_verified";
  private playerIdKey = "bbt_player_uuid";
  private nicknameKey = "bbt_player_nickname";
  private modalEl: HTMLElement | null = null;

  public getPlayerId(): string {
    let id = localStorage.getItem(this.playerIdKey);
    if (!id) {
      id = "p_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36).substring(4);
      localStorage.setItem(this.playerIdKey, id);
    }
    return id;
  }

  public getProfile(): PlayerProfile {
    const id = this.getPlayerId();
    const phone = this.getUser();
    const isVerified = this.isWhatsAppVerified();
    const savedNick = localStorage.getItem(this.nicknameKey);
    const nickname = savedNick || (phone ? `Player-${phone.slice(-4)}` : `Player-${id.slice(-4)}`);
    return {
      id,
      nickname,
      phone: phone || null,
      country: "🇿🇦",
      verified: isVerified,
    };
  }

  public setNickname(nick: string) {
    localStorage.setItem(this.nicknameKey, nick.trim());
  }

  public getUser(): string | null {
    return localStorage.getItem(this.userKey);
  }

  public isWhatsAppVerified(): boolean {
    return localStorage.getItem(this.verifiedKey) === "true" || !!this.getUser();
  }

  public setWhatsAppVerified(val: boolean = true) {
    if (val) {
      localStorage.setItem(this.verifiedKey, "true");
      if (!this.getUser()) {
        const id = this.getPlayerId();
        localStorage.setItem(this.userKey, `Verified-${id.slice(-4)}`);
      }
    } else {
      localStorage.removeItem(this.verifiedKey);
    }
  }

  public isLoggedIn(): boolean {
    return this.isWhatsAppVerified();
  }

  public initAuthModal(onSuccess: (whatsappPhone: string, rank: number) => void) {
    if (this.modalEl) return;

    this.modalEl = document.createElement("div");
    this.modalEl.className = "modal-overlay auth-modal";
    this.modalEl.id = "authModal";

    this.modalEl.innerHTML = `
      <div class="modal auth-card">
        <div class="whatsapp-badge">💬 WHATSAPP 1-TAP VERIFICATION</div>
        <h2 class="modal-title">🏆 Enter Weekly Leaderboard</h2>
        <p class="auth-desc">
          Verify your score via WhatsApp to enter this week's sponsored prize contest. No password required!
        </p>

        <form id="authForm" class="auth-form">
          <div class="phone-input-group">
            <span class="phone-prefix">📱</span>
            <input 
              type="tel" 
              id="authPhone" 
              placeholder="WhatsApp Number (e.g. +1...)" 
              required 
              autocomplete="tel"
              class="auth-input"
            />
          </div>
          <button type="submit" class="modal-button whatsapp-btn">
            <span>💬 Verify & Claim via WhatsApp</span>
          </button>
        </form>

        <div class="auth-divider">
          <span>OR</span>
        </div>

        <button type="button" id="directWhatsAppBtn" class="modal-secondary-button whatsapp-direct-btn">
          📲 Open WhatsApp Directly with Claim Code
        </button>

        <button type="button" id="authSkipBtn" class="modal-skip-btn">
          Continue as Guest (Skip leaderboard)
        </button>
      </div>
    `;

    document.body.appendChild(this.modalEl);

    const form = document.getElementById("authForm") as HTMLFormElement;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("authPhone") as HTMLInputElement;
      const phone = input.value.trim();
      if (!phone) return;

      localStorage.setItem(this.userKey, phone);
      this.hide();

      const session = sessionManager.getSessionData();
      const sessionCode = session ? session.sessionId.substring(0, 8) : "BBT";
      const waMsg = encodeURIComponent(
        `🏆 Block Blast Tournament: Claim my score of ${session?.finalScore || 0} pts (Code: ${sessionCode}) for the weekly prize!`
      );
      
      // Open WhatsApp click-to-chat verification
      window.open(`https://wa.me/?text=${waMsg}`, "_blank");

      const result = await sessionManager.submitScore(phone);
      onSuccess(phone, result.rank || 1);
    });

    const directBtn = document.getElementById("directWhatsAppBtn");
    directBtn?.addEventListener("click", () => {
      const session = sessionManager.getSessionData();
      const sessionCode = session ? session.sessionId.substring(0, 8) : "BBT";
      const waMsg = encodeURIComponent(
        `🏆 Block Blast Tournament: Claim my score of ${session?.finalScore || 0} pts (Code: ${sessionCode}) for the weekly prize!`
      );
      localStorage.setItem(this.userKey, "WhatsApp User");
      this.hide();
      window.open(`https://wa.me/?text=${waMsg}`, "_blank");
      onSuccess("WhatsApp Verified", 2);
    });

    const skipBtn = document.getElementById("authSkipBtn");
    skipBtn?.addEventListener("click", () => {
      this.hide();
    });
  }

  public show() {
    if (!this.modalEl) {
      this.initAuthModal(() => {});
    }
    this.modalEl?.classList.add("active");
    const input = document.getElementById("authPhone") as HTMLInputElement;
    if (input) {
      input.value = this.getUser() || "";
      setTimeout(() => input.focus(), 200);
    }
  }

  public hide() {
    this.modalEl?.classList.remove("active");
  }

  public openReferralShare() {
    const url = chancesManager.getWhatsAppShareUrl("this week's Sponsor Grand Prize");
    window.open(url, "_blank");
  }
}

export const authManager = new AuthManager();
