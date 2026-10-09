const STORAGE_DATE_KEY = "bbt_chances_date";
const STORAGE_CHANCES_KEY = "bbt_chances_count";
const STORAGE_BONUS_KEY = "bbt_bonus_chances";
const STORAGE_REF_CODE_KEY = "bbt_my_ref_code";
const STORAGE_REFERRED_BY_KEY = "bbt_referred_by";

const DAILY_BASE_CHANCES = 3;

class ChancesManager {
  private myRefCode: string = "";
  private referredBy: string | null = null;
  private isPractice: boolean = false;

  constructor() {
    this.initRefCode();
    this.checkIncomingReferral();
    this.ensureDailyReset();
  }

  private initRefCode() {
    let code = localStorage.getItem(STORAGE_REF_CODE_KEY);
    if (!code) {
      code = "BB-" + Math.random().toString(36).substring(2, 7).toUpperCase();
      localStorage.setItem(STORAGE_REF_CODE_KEY, code);
    }
    this.myRefCode = code;
  }

  private checkIncomingReferral() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const ref = urlParams.get("ref");
      if (ref && ref !== this.myRefCode) {
        if (!localStorage.getItem(STORAGE_REFERRED_BY_KEY)) {
          localStorage.setItem(STORAGE_REFERRED_BY_KEY, ref);
          this.referredBy = ref;
          // Award newcomer a starter bonus chance!
          this.addBonusChances(1);
        }
      }
    } catch {
      // Ignore URL parsing errors
    }
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
    return Math.max(0, base + bonus);
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

  public addBonusChances(count: number = 2) {
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
    return this.myRefCode;
  }

  public getReferredBy(): string | null {
    return this.referredBy || localStorage.getItem(STORAGE_REFERRED_BY_KEY);
  }

  public getReferralLink(): string {
    const base = window.location.origin + window.location.pathname;
    return `${base}?ref=${this.myRefCode}`;
  }

  public getWhatsAppShareUrl(prizeTitle: string = "weekly prize"): string {
    const link = this.getReferralLink();
    const message = encodeURIComponent(
      `🎮 Can you beat my score on Block Blast? The weekly tournament leader wins ${prizeTitle}! Play instantly here (no app needed): ${link}`
    );
    return `https://wa.me/?text=${message}`;
  }
}

export const chancesManager = new ChancesManager();
