import { api, existingSession } from "./supabaseClient";
import { storage } from "./storage";
class ReferralManager {
  constructor() {
    const params = new URLSearchParams(location.search);
    const incoming = params.get("ref");
    if (incoming) {
      storage.set("bbt_pending_referrer", incoming);
      params.delete("ref");
      history.replaceState(
        {},
        "",
        `${location.pathname}${params.size ? "?" + params : ""}${location.hash}`,
      );
    }
  }
  async attribute() {
    const referrerId = storage.get("bbt_pending_referrer");
    if (!referrerId || !(await existingSession())) return;
    try {
      await api("verify-referral", { method: "POST", body: { referrerId } });
      storage.remove("bbt_pending_referrer");
    } catch {
      /* Retries are account-bound and idempotent. */
    }
  }
}
export const referralManager = new ReferralManager();
