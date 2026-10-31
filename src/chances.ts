import { fetchBalance, existingSession } from "./supabaseClient";
class ChancesManager {
  private remaining = 0;
  private practice = true;
  getChancesRemaining() {
    return this.remaining;
  }
  async refresh() {
    if (!(await existingSession())) return this.remaining;
    const balance = await fetchBalance();
    this.remaining = balance.remaining;
    return this.remaining;
  }
  setRemaining(value: number) {
    this.remaining = value;
  }
  setPracticeMode(value: boolean) {
    this.practice = value;
  }
  isPracticeMode() {
    return this.practice;
  }
}
export const chancesManager = new ChancesManager();
