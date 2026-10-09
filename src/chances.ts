import { authManager } from "./auth";

const STORAGE_DATE_KEY = "bbt_chances_date";
const STORAGE_CHANCES_KEY = "bbt_chances_count";
const STORAGE_BONUS_KEY = "bbt_bonus_chances";

const DAILY_BASE_CHANCES = 3;
const MAX_DAILY_CHANCES = 5; // Base 3 + up to 2 earned bonus tickets

class ChancesManager {
  private isPractice: boolean = false;

  constructor() {
    this.ensureDailyReset();
  }

  private getTodayString(): string {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  private ensureDailyReset() {
    const today = this.getTodayString();
    const savedDate = localStorage.getItem(STORAGE_DATE_KEY);

    if (savedDate !== today) {
      // It's a new day! Reset base chances to 3
      localStorage.setItem(STORAGE_DATE_KEY, today);
      localStorage.setItem(STORAGE_CHANCES_KEY, String(DAILY_BASE_CHANCES));
    }
  }

  public getChancesRemaining(): number {
    this.ensureDailyReset();
    const base = parseInt(localStorage.getItem(STORAGE_CHANCES_KEY) || String(DAILY_BASE_CHANCES), 10);
    const bonus = parseInt(localStorage.getItem(STORAGE_BONUS_KEY) || "0", 10);
    return Math.min(MAX_DAILY_CHANCES, Math.max(0, base + bonus));
  }

  public consumeChance(): boolean {
    if (this.isPractice) return true; // Practice mode does not consume chances

    this.ensureDailyReset();
    const bonus = parseInt(localStorage.getItem(STORAGE_BONUS_KEY) || "0", 10);
    const base = parseInt(localStorage.getItem(STORAGE_CHANCES_KEY) || String(DAILY_BASE_CHANCES), 10);

    if (bonus > 0) {
      localStorage.setItem(STORAGE_BONUS_KEY, String(bonus - 1));
      return true;
    } else if (base > 0) {
      localStorage.setItem(STORAGE_CHANCES_KEY, String(base - 1));
      return true;
    }
    return false; // Out of tournament chances!
  }

  public addBonusChances(count: number = 1) {
    const current = parseInt(localStorage.getItem(STORAGE_BONUS_KEY) || "0", 10);
    localStorage.setItem(STORAGE_BONUS_KEY, String(current + count));
  }

  public setPracticeMode(enabled: boolean) {
    this.isPractice = enabled;
  }

  public isPracticeMode(): boolean {
    return this.isPractice;
  }

  public getMyReferralCode(): string {
    return authManager.getPlayerId();
  }

  public getReferralLink(): string {
    const base = window.location.origin + window.location.pathname;
    return `${base}?ref=${this.getMyReferralCode()}`;
  }

  public getWhatsAppShareUrl(prizeTitle: string = "R500 Weekly Prize"): string {
    const link = this.getReferralLink();
    const message = encodeURIComponent(
      `🎮 I challenge you to the Block Blast Cash Cup! Top players win ${prizeTitle}. Beat my score on your phone (no download needed): ${link}`
    );
    return `https://wa.me/?text=${message}`;
  }
}

export const chancesManager = new ChancesManager();
