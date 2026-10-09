import { authManager } from "./auth";
import { chancesManager } from "./chances";

const STORAGE_PENDING_REFERRER = "bbt_pending_referrer";

export interface ReferralCheckResult {
  unclaimedCount: number;
  message?: string;
}

class ReferralManager {
  private pendingReferrerId: string | null = null;

  constructor() {
    this.init();
  }

  private init() {
    try {
      this.pendingReferrerId = localStorage.getItem(STORAGE_PENDING_REFERRER);

      const params = new URLSearchParams(window.location.search);
      const incomingRef = params.get("ref");
      const myId = authManager.getPlayerId();

      // If friend arrived via an invite link and it's not their own link
      if (incomingRef && incomingRef !== myId) {
        this.pendingReferrerId = incomingRef;
        localStorage.setItem(STORAGE_PENDING_REFERRER, incomingRef);

        // Clean the address bar URL seamlessly without reloading
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    } catch (e) {
      console.warn("Referral init error:", e);
    }
  }

  public getPendingReferrer(): string | null {
    return this.pendingReferrerId;
  }

  // Triggered when any game ends with score >= 100
  public async verifyPendingReferralOnFirstGame(
    score: number
  ): Promise<{ verified: boolean; message?: string }> {
    if (!this.pendingReferrerId || score < 100) {
      return { verified: false };
    }

    const myId = authManager.getPlayerId();
    const referrerId = this.pendingReferrerId;

    try {
      const res = await fetch("/api/verify-referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referrerId,
          referredId: myId,
          score,
        }),
      });

      const data = await res.json();
      if (data && data.verified) {
        // Clear pending so it never fires again
        this.pendingReferrerId = null;
        localStorage.removeItem(STORAGE_PENDING_REFERRER);

        // Award newcomer an instant welcome bonus tournament ticket!
        chancesManager.addBonusChances(1);

        return {
          verified: true,
          message: "🎁 Welcome Challenge Bonus! You earned +1 Bonus Tournament Ticket!",
        };
      }
    } catch (err) {
      console.warn("Could not verify referral online:", err);
    }

    return { verified: false };
  }

  // Check on startup if any friends have accepted my challenge and played
  public async pollReferralRewards(): Promise<number> {
    const myId = authManager.getPlayerId();
    try {
      const res = await fetch(`/api/check-referral-rewards?playerId=${encodeURIComponent(myId)}`);
      if (res.ok) {
        const data = await res.json();
        const count = data.unclaimedCount || 0;
        if (count > 0) {
          chancesManager.addBonusChances(count);
          return count;
        }
      }
    } catch (err) {
      console.warn("Referral poll failed:", err);
    }
    return 0;
  }
}

export const referralManager = new ReferralManager();
