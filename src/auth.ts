import { chancesManager } from "./chances";

export interface PlayerProfile {
  id: string;
  fullName?: string | null;
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
  private fullNameKey = "bbt_player_fullname";
  private modalEl: HTMLElement | null = null;
  private currentSuccessCb: ((phone: string, rank: number) => void) | null = null;

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
    const fullName = localStorage.getItem(this.fullNameKey) || null;
    const savedNick = localStorage.getItem(this.nicknameKey);
    const nickname = savedNick || (fullName ? fullName.split(" ")[0] : (phone ? `Player-${phone.slice(-4)}` : `Player-${id.slice(-4)}`));
    return {
      id,
      fullName,
      nickname,
      phone: phone || null,
      country: "🇿🇦",
      verified: isVerified,
    };
  }

  public setNickname(nick: string) {
    if (nick) localStorage.setItem(this.nicknameKey, nick.trim());
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

  public saveRegistration(fullName: string, nickname: string, phone: string) {
    if (fullName) localStorage.setItem(this.fullNameKey, fullName.trim());
    if (nickname) localStorage.setItem(this.nicknameKey, nickname.trim());
    if (phone) localStorage.setItem(this.userKey, phone.trim());
    this.setWhatsAppVerified(true);
  }

  public isLoggedIn(): boolean {
    return this.isWhatsAppVerified();
  }

  public initAuthModal(onSuccess?: (whatsappPhone: string, rank: number) => void) {
    if (onSuccess) this.currentSuccessCb = onSuccess;
    if (this.modalEl) return;

    this.modalEl = document.createElement("div");
    this.modalEl.className = "modal-overlay auth-modal";
    this.modalEl.id = "authModal";

    this.modalEl.innerHTML = `
      <div class="modal auth-card">
        <button class="modal-close-corner" id="closeAuthModalBtn" aria-label="Close">✕</button>
        <div class="whatsapp-badge">🛡️ OFFICIAL COMPETITOR REGISTRATION</div>
        <h2 class="modal-title">Unlock Verified Pro Badge</h2>
        <p class="auth-desc">
          Register once to qualify for real cash and voucher payouts. Your nickname is shown on the leaderboard while your legal details remain strictly private.
        </p>

        <form id="authForm" class="auth-form">
          <div class="auth-input-group">
            <label class="auth-input-label" for="authFullName">👤 Full Name (Private — for prize payouts only)</label>
            <input 
              type="text" 
              id="authFullName" 
              placeholder="e.g. Sipho Khumalo" 
              required 
              autocomplete="name"
              class="auth-input"
            />
          </div>

          <div class="auth-input-group">
            <label class="auth-input-label" for="authNickname">🎮 Leaderboard Nickname (Public Gamer Tag)</label>
            <input 
              type="text" 
              id="authNickname" 
              placeholder="e.g. ApexBlaster" 
              required 
              autocomplete="username"
              class="auth-input"
            />
            <span class="auth-helper-text">This name and your verified checkmark will appear on the public leaderboard.</span>
          </div>

          <div class="auth-input-group">
            <label class="auth-input-label" for="authPhone">📱 WhatsApp Number (For prize delivery & verification)</label>
            <input 
              type="tel" 
              id="authPhone" 
              placeholder="e.g. 082 123 4567" 
              required 
              autocomplete="tel"
              class="auth-input"
            />
            <span class="auth-helper-text">Used to contact you when you win cash or vouchers. Never shared publicly.</span>
          </div>

          <button type="submit" class="auth-submit-btn">
            🛡️ Save Profile & Get Verified Pro Badge
          </button>
        </form>

        <button type="button" id="authSkipBtn" class="modal-skip-btn">
          Play Anonymously (Skip verified badge)
        </button>
      </div>
    `;

    document.body.appendChild(this.modalEl);

    const closeBtn = document.getElementById("closeAuthModalBtn");
    closeBtn?.addEventListener("click", () => this.hide());

    const skipBtn = document.getElementById("authSkipBtn");
    skipBtn?.addEventListener("click", () => this.hide());

    const form = document.getElementById("authForm") as HTMLFormElement;
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const nameInput = document.getElementById("authFullName") as HTMLInputElement;
      const nickInput = document.getElementById("authNickname") as HTMLInputElement;
      const phoneInput = document.getElementById("authPhone") as HTMLInputElement;

      const fullName = nameInput?.value?.trim() || "";
      const nickname = nickInput?.value?.trim() || "Player";
      const phone = phoneInput?.value?.trim() || "";

      if (!fullName || !phone) return;

      this.saveRegistration(fullName, nickname, phone);
      this.hide();

      if (this.currentSuccessCb) {
        this.currentSuccessCb(phone, 1);
      }
    });
  }

  public show(onSuccess?: (whatsappPhone: string, rank: number) => void) {
    if (onSuccess) this.currentSuccessCb = onSuccess;
    if (!this.modalEl) {
      this.initAuthModal();
    }
    this.modalEl?.classList.add("active");

    const profile = this.getProfile();
    const nameInput = document.getElementById("authFullName") as HTMLInputElement;
    const nickInput = document.getElementById("authNickname") as HTMLInputElement;
    const phoneInput = document.getElementById("authPhone") as HTMLInputElement;

    if (nameInput && profile.fullName) nameInput.value = profile.fullName;
    if (nickInput && profile.nickname && !profile.nickname.startsWith("Player-")) {
      nickInput.value = profile.nickname;
    }
    if (phoneInput && profile.phone && !profile.phone.startsWith("Verified-")) {
      phoneInput.value = profile.phone;
    }

    setTimeout(() => {
      if (nameInput && !nameInput.value) nameInput.focus();
      else if (nickInput && !nickInput.value) nickInput.focus();
      else if (phoneInput && !phoneInput.value) phoneInput.focus();
    }, 200);
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
