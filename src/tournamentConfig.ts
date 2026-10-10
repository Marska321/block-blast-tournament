/**
 * tournamentConfig.ts
 * Centralized, multi-tournament Sponsor & Prize Configuration.
 * Supports multiple active partners (e.g., Weekly Cash Cups, Daily Voucher Offers).
 */

export interface PrizeTier {
  rank: string;      // e.g. "1ST", "2ND", "3RD", "TOP 10"
  reward: string;    // e.g. "R250", "R150", "R100", "Cash Share" or "Voucher"
  badgeClass?: string; // "gold-tier", "silver-tier", "bronze-tier", "top10-tier"
}

export interface TournamentSponsorConfig {
  id: string;                  // Unique slug e.g. 'weekly_partner_cup', 'daily_flash_dash'
  sponsorName: string;         // e.g. "Official Partner" or "Vodacom", "Nike"
  tournamentTitle: string;     // e.g. "Weekly Cash Cup"
  sponsorTagline: string;      // e.g. "Official Cash Prize Sponsor"
  totalPrizePool: string;      // e.g. "R500" or "R150"
  currencySymbol: string;      // e.g. "R" or "$"
  frequency: "weekly" | "daily" | "special";
  endsAtDescription?: string;  // e.g. "Resets Sunday at Midnight", "Ends Tonight at 23:59"
  prizeTiers: PrizeTier[];     // 1st, 2nd, 3rd, Top 10 breakdown
  sponsorWallpaperUrl?: string | null; // Optional custom wallpaper URL or base64 image
  disclaimer?: string;         // Optional subtext e.g. "Top 10 Leaderboard Cash Payouts"
}

export interface UpcomingPartnerItem {
  id: string;
  name: string;
  category: string;
  icon: string;
  statusBadge: string;
  expectedPrizes: string;
}

export const UPCOMING_PARTNERS: UpcomingPartnerItem[] = [
  {
    id: "telco_partner",
    name: "Telco Mobile Cup",
    category: "Mobile Airtime & Data",
    icon: "📱",
    statusBadge: "COMING SOON",
    expectedPrizes: "Airtime & Data Bundles",
  },
  {
    id: "electricity_partner",
    name: "Prepaid Energy Cup",
    category: "Utilities & Electricity",
    icon: "⚡",
    statusBadge: "COMING SOON",
    expectedPrizes: "Prepaid Electricity Vouchers",
  },
  {
    id: "retail_partner",
    name: "Retail Grocery Dash",
    category: "Supermarket & Shopping",
    icon: "🛒",
    statusBadge: "COMING SOON",
    expectedPrizes: "Shopping & Grocery Vouchers",
  },
  {
    id: "fast_food_partner",
    name: "Dining & Fast Food Cup",
    category: "Food & Restaurants",
    icon: "🍔",
    statusBadge: "COMING SOON",
    expectedPrizes: "Meal & Restaurant Vouchers",
  },
];

export const DEFAULT_TOURNAMENTS_REGISTRY: Record<string, TournamentSponsorConfig> = {
  pre_season_cup: {
    id: "pre_season_cup",
    sponsorName: "Pre-Season",
    tournamentTitle: "Inaugural Voucher Cup",
    sponsorTagline: "Airtime & Electricity Vouchers",
    totalPrizePool: "R250 Vouchers",
    currencySymbol: "R",
    frequency: "weekly",
    endsAtDescription: "Pre-Season Launch Event",
    prizeTiers: [
      { rank: "1ST", reward: "R100 Airtime / Electricity", badgeClass: "gold-tier" },
      { rank: "2ND", reward: "R50 Airtime / Electricity", badgeClass: "silver-tier" },
      { rank: "3RD", reward: "R25 Airtime Voucher", badgeClass: "bronze-tier" },
      { rank: "TOP 10", reward: "Verified Pro Badge ☑️", badgeClass: "top10-tier" },
    ],
    sponsorWallpaperUrl: null,
    disclaimer: "Compete for seeded airtime & electricity vouchers while incoming partner prize pools prepare to launch!",
  },
  weekly_partner_cup: {
    id: "weekly_partner_cup",
    sponsorName: "Partner Cup",
    tournamentTitle: "Weekly Cash Cup",
    sponsorTagline: "Official Cash Prize Sponsor",
    totalPrizePool: "R500",
    currencySymbol: "R",
    frequency: "weekly",
    endsAtDescription: "Resets Sunday at Midnight",
    prizeTiers: [
      { rank: "1ST", reward: "R250", badgeClass: "gold-tier" },
      { rank: "2ND", reward: "R150", badgeClass: "silver-tier" },
      { rank: "3RD", reward: "R100", badgeClass: "bronze-tier" },
      { rank: "TOP 10", reward: "Share", badgeClass: "top10-tier" },
    ],
    sponsorWallpaperUrl: null,
    disclaimer: "Top 10 players on the weekly leaderboard win real cash payouts",
  },
  daily_flash_dash: {
    id: "daily_flash_dash",
    sponsorName: "Speed Partner",
    tournamentTitle: "Daily Flash Dash",
    sponsorTagline: "Fast-Paced Daily Voucher Run",
    totalPrizePool: "R150",
    currencySymbol: "R",
    frequency: "daily",
    endsAtDescription: "Ends Tonight at 23:59",
    prizeTiers: [
      { rank: "1ST", reward: "R100 Voucher", badgeClass: "gold-tier" },
      { rank: "2ND", reward: "R50 Voucher", badgeClass: "silver-tier" },
      { rank: "TOP 5", reward: "Voucher Draw", badgeClass: "top10-tier" },
    ],
    sponsorWallpaperUrl: null,
    disclaimer: "Daily top players receive digital gift cards & vouchers",
  },
};

const STORAGE_ACTIVE_TOURNAMENT_ID = "bb_active_tournament_id";
const STORAGE_TOURNAMENT_CONFIG_CUSTOM = "bb_active_tournament_config_custom";

class TournamentConfigManager {
  private registry: Record<string, TournamentSponsorConfig>;
  private activeId: string;
  private listeners: Array<() => void> = [];

  constructor() {
    this.registry = { ...DEFAULT_TOURNAMENTS_REGISTRY };
    this.activeId = "pre_season_cup";

    // 1. Check URL parameters first for instant partner campaign routing
    this.detectFromUrlParams();

    // 2. Load cached selection if URL param was absent
    this.loadFromStorage();
  }

  private detectFromUrlParams() {
    if (typeof window === "undefined" || !window.location) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const urlTourney = params.get("tourney") || params.get("t");
      const urlSponsor = params.get("sponsor") || params.get("partner");

      if (urlTourney) {
        const clean = urlTourney.trim().toLowerCase();
        if (this.registry[clean]) {
          this.activeId = clean;
          this.saveActiveId();
          return;
        }
      }

      if (urlSponsor) {
        const cleanSponsor = urlSponsor.trim().toLowerCase();
        const matched = Object.values(this.registry).find(
          (t) => t.sponsorName.toLowerCase().includes(cleanSponsor) || t.id.toLowerCase().includes(cleanSponsor)
        );
        if (matched) {
          this.activeId = matched.id;
          this.saveActiveId();
        }
      }
    } catch {}
  }

  private loadFromStorage() {
    try {
      const savedId = localStorage.getItem(STORAGE_ACTIVE_TOURNAMENT_ID);
      if (savedId && this.registry[savedId]) {
        this.activeId = savedId;
      }
      const customConfig = localStorage.getItem(STORAGE_TOURNAMENT_CONFIG_CUSTOM);
      if (customConfig) {
        const parsed = JSON.parse(customConfig);
        if (parsed.id && this.registry[parsed.id]) {
          this.registry[parsed.id] = { ...this.registry[parsed.id], ...parsed };
        }
      }
    } catch {}
  }

  private saveActiveId() {
    try {
      localStorage.setItem(STORAGE_ACTIVE_TOURNAMENT_ID, this.activeId);
    } catch {}
  }

  public getActiveTournamentId(): string {
    return this.activeId;
  }

  public getConfig(): TournamentSponsorConfig {
    const active = this.registry[this.activeId] || this.registry["weekly_partner_cup"];
    return { ...active, prizeTiers: [...active.prizeTiers] };
  }

  public getAllTournaments(): TournamentSponsorConfig[] {
    return Object.values(this.registry).map((t) => ({
      ...t,
      prizeTiers: [...t.prizeTiers],
    }));
  }

  public getTournamentById(id: string): TournamentSponsorConfig | null {
    const t = this.registry[id];
    return t ? { ...t, prizeTiers: [...t.prizeTiers] } : null;
  }

  public getUpcomingPartners(): UpcomingPartnerItem[] {
    return [...UPCOMING_PARTNERS];
  }

  public setActiveTournament(id: string): boolean {
    if (this.registry[id]) {
      this.activeId = id;
      this.saveActiveId();
      this.notify();
      return true;
    }
    return false;
  }

  public registerTournament(config: TournamentSponsorConfig) {
    this.registry[config.id] = { ...config };
    this.notify();
  }

  public updateConfig(config: Partial<TournamentSponsorConfig>) {
    const current = this.getConfig();
    this.registry[this.activeId] = {
      ...current,
      ...config,
    };
    try {
      localStorage.setItem(
        STORAGE_TOURNAMENT_CONFIG_CUSTOM,
        JSON.stringify(this.registry[this.activeId])
      );
    } catch {}
    this.notify();
  }

  public resetToDefault() {
    this.registry = { ...DEFAULT_TOURNAMENTS_REGISTRY };
    this.activeId = "weekly_partner_cup";
    try {
      localStorage.removeItem(STORAGE_ACTIVE_TOURNAMENT_ID);
      localStorage.removeItem(STORAGE_TOURNAMENT_CONFIG_CUSTOM);
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
