import { dialog, text } from "./dialogs";
import { existingSession, ensureGuest, api } from "./supabaseClient";
import { storage } from "./storage";
export interface PlayerProfile {
  id: string;
  nickname: string;
  country: string;
}
class AuthManager {
  private id = "local";
  constructor() {
    for (const key of [
      "bbt_user_whatsapp",
      "bbt_user_whatsapp_verified",
      "bbt_player_fullname",
    ])
      storage.remove(key);
    void existingSession()
      .then((s) => {
        if (s) this.id = s.user.id;
      })
      .catch(() => {});
  }
  getPlayerId() {
    return this.id;
  }
  async refreshIdentity() {
    const session = await existingSession();
    if (session) this.id = session.user.id;
    return this.id;
  }
  getProfile(): PlayerProfile {
    return {
      id: this.id,
      nickname: storage.get("bbt_player_nickname") || "Player",
      country: "ZA",
    };
  }
  isLoggedIn() {
    return this.id !== "local";
  }
  isAdult() {
    return storage.get("bb_pilot_adult") === "true";
  }
  setNickname(value: string) {
    storage.set("bbt_player_nickname", value.trim().slice(0, 24));
  }
  initAuthModal() {
    /* Created on demand; no contact details collected. */
  }
  show(onSuccess?: (phone: string, rank: number) => void) {
    const { overlay, card } = dialog(
      "authModal",
      "Choose your public nickname",
    );
    card.append(
      text(
        "p",
        "No email or phone number needed. Your guest account stays in this browser. Clearing browser data can lose access.",
      ),
    );
    const form = document.createElement("form");
    const label = text("label", "Nickname");
    label.setAttribute("for", "pilotNickname");
    const input = document.createElement("input");
    input.id = "pilotNickname";
    input.required = true;
    input.maxLength = 24;
    input.setAttribute("autocomplete", "nickname");
    input.className = "auth-input";
    input.value = this.getProfile().nickname;
    const ageLabel = document.createElement("label");
    const adult = document.createElement("input");
    adult.type = "checkbox";
    adult.checked = this.isAdult();
    ageLabel.append(
      adult,
      document.createTextNode(
        " I am 18 or older and eligible for official prizes.",
      ),
    );
    const error = text("p", "");
    error.setAttribute("role", "alert");
    const submit = text("button", "Save nickname", "modal-button");
    submit.setAttribute("type", "submit");
    form.append(label, input, ageLabel, error, submit);
    card.append(form);
    form.onsubmit = (e) => {
      e.preventDefault();
      const nick = input.value.trim();
      if (!nick || /[<>\u0000-\u001f]/.test(nick)) {
        error.textContent = "Use a nickname without HTML.";
        return;
      }
      this.setNickname(nick);
      storage.set("bb_pilot_adult", String(adult.checked));
      overlay.classList.remove("active");
      onSuccess?.("", 0);
    };
  }
  hide() {
    document.getElementById("authModal")?.classList.remove("active");
  }
  async openReferralShare() {
    try {
      await ensureGuest();
      const id = await this.refreshIdentity();
      await api("profile", {
        method: "POST",
        body: { nickname: this.getProfile().nickname, adult: this.isAdult() },
      });
      const link = new URL(location.pathname, location.origin);
      link.searchParams.set("ref", id);
      const url = `https://wa.me/?text=${encodeURIComponent(`Play Blok Blaster by Playables with me: ${link}. Referrals qualify by account after an accepted game; daily bonus limits apply.`)}`;
      const { card } = dialog("referralShare", "Invite a friend");
      const linkButton = document.createElement("a");
      linkButton.href = url;
      linkButton.target = "_blank";
      linkButton.rel = "noopener noreferrer";
      linkButton.className = "modal-button";
      linkButton.textContent = "Open WhatsApp to share your invite";
      card.append(linkButton);
    } catch (error) {
      const { card } = dialog("referralError", "Invite link unavailable");
      card.append(
        text("p", error instanceof Error ? error.message : "Please try again."),
      );
    }
  }
}
export const authManager = new AuthManager();
