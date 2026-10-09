/**
 * tournamentConfig.ts
 * Centralized, easily editable Tournament and Sponsor Configuration.
 * 
 * To change the sponsor, partner, or weekly prize breakdown,
 * simply edit the DEFAULT_TOURNAMENT_CONFIG object below, or
 * pass a config dynamically (e.g. from an API, Supabase, or URL parameter).
 */

export interface PrizeTier {
  rank: string;      // e.g. "1ST", "2ND", "3RD", "TOP 10"
  reward: string;    // e.g. "R250", "R150", "R100", "Cash Share" or "Voucher"
  badgeClass?: string; // "gold-tier", "silver-tier", "bronze-tier", "top10-tier"
}

export interface TournamentSponsorConfig {
  sponsorName: string;         // e.g. "Official Partner" or "Vodacom", "Nike"
  tournamentTitle: string;     // e.g. "Weekly Cash Cup"
  sponsorTagline: string;      // e.g. "Official Cash Prize Sponsor"
  totalPrizePool: string;      // e.g. "R500" or "$500+"
  currencySymbol: string;      // e.g. "R" or "$"
  prizeTiers: PrizeTier[];     // 1st, 2nd, 3rd, Top 10 breakdown
  sponsorWallpaperUrl?: string | null; // Optional custom wallpaper URL or base64 image
  disclaimer?: string;         // Optional subtext e.g. "Top 10 Leaderboard Cash Payouts"
}

export const DEFAULT_TOURNAMENT_CONFIG: TournamentSponsorConfig = {
  sponsorName: "Official Partner",
  tournamentTitle: "Weekly Prize Cup",
  sponsorTagline: "Weekly Cash Prize Sponsor",
  totalPrizePool: "R500",
  currencySymbol: "R",
  prizeTiers: [
    { rank: "1ST", reward: "R250", badgeClass: "gold-tier" },
    { rank: "2ND", reward: "R150", badgeClass: "silver-tier" },
    { rank: "3RD", reward: "R100", badgeClass: "bronze-tier" },
    { rank: "TOP 10", reward: "Share", badgeClass: "top10-tier" },
  ],
  sponsorWallpaperUrl: null,
  disclaimer: "Top 10 players on the weekly leaderboard win real cash payouts",
};

const STORAGE_TOURNAMENT_CONFIG = "bb_active_tournament_config";

class TournamentConfigManager {
  private activeConfig: TournamentSponsorConfig;
  private listeners: Array<() => void> = [];

  constructor() {
    this.activeConfig = { ...DEFAULT_TOURNAMENT_CONFIG };
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_TOURNAMENT_CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.activeConfig = { ...DEFAULT_TOURNAMENT_CONFIG, ...parsed };
      }
    } catch {
      this.activeConfig = { ...DEFAULT_TOURNAMENT_CONFIG };
    }
  }

  public getConfig(): TournamentSponsorConfig {
    return { ...this.activeConfig, prizeTiers: [...this.activeConfig.prizeTiers] };
  }

  /**
   * Update tournament configuration at runtime.
   * Can be called by an admin console, URL parameters, or Supabase.
   */
  public updateConfig(config: Partial<TournamentSponsorConfig>) {
    this.activeConfig = {
      ...this.activeConfig,
      ...config,
    };
    try {
      localStorage.setItem(STORAGE_TOURNAMENT_CONFIG, JSON.stringify(this.activeConfig));
    } catch {}
    this.notify();
  }

  /**
   * Reset back to default config.
   */
  public resetToDefault() {
    this.activeConfig = { ...DEFAULT_TOURNAMENT_CONFIG };
    try {
      localStorage.removeItem(STORAGE_TOURNAMENT_CONFIG);
    } catch {}
    this.notify();
  }

  public onChange(listener: () => void) {
    this.listeners.push(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }
}

export const tournamentConfigManager = new TournamentConfigManager();
