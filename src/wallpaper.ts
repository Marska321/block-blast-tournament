import { tournamentConfigManager } from "./tournamentConfig";

export interface WallpaperTheme {
  id: string;
  name: string;
  category: "preset" | "custom";
  containerBg: string;
  previewGradient: string;
  icon: string;
  isDark: boolean;
  requiredScore?: number;
  requiredLevel?: number;
  unlockRequirementText: string;
}

export const WALLPAPER_PRESETS: WallpaperTheme[] = [
  {
    id: "classic-navy",
    name: "Classic Navy",
    category: "preset",
    containerBg: "radial-gradient(circle at 50% 30%, #1e2942 0%, #0d1322 100%)",
    previewGradient: "linear-gradient(135deg, #1e2942 0%, #0d1322 100%)",
    icon: "🎯",
    isDark: true,
    unlockRequirementText: "Default starter theme",
  },
  {
    id: "sakura-pink",
    name: "Sakura Pink",
    category: "preset",
    containerBg: "radial-gradient(circle at 50% 25%, #4a192c 0%, #1a0812 100%)",
    previewGradient: "linear-gradient(135deg, #f472b6 0%, #db2777 100%)",
    icon: "🌸",
    isDark: true,
    requiredScore: 1500,
    requiredLevel: 3,
    unlockRequirementText: "Reach 1,500 pts or Level 3",
  },
  {
    id: "ocean-abyss",
    name: "Ocean Abyss",
    category: "preset",
    containerBg: "radial-gradient(circle at 50% 30%, #064e3b 0%, #022019 100%)",
    previewGradient: "linear-gradient(135deg, #059669 0%, #0f766e 100%)",
    icon: "🌊",
    isDark: true,
    requiredScore: 3500,
    requiredLevel: 5,
    unlockRequirementText: "Reach 3,500 pts or Level 5",
  },
  {
    id: "cosmic-nebula",
    name: "Cosmic Nebula",
    category: "preset",
    containerBg: "radial-gradient(circle at 50% 20%, #2e1065 0%, #090314 100%)",
    previewGradient: "linear-gradient(135deg, #7c3aed 0%, #4338ca 100%)",
    icon: "🌌",
    isDark: true,
    requiredScore: 6000,
    requiredLevel: 10,
    unlockRequirementText: "Reach 6,000 pts or Level 10",
  },
  {
    id: "cyberpunk-sunset",
    name: "Neon Sunset",
    category: "preset",
    containerBg: "radial-gradient(circle at 50% 20%, #4c0519 0%, #18020a 100%)",
    previewGradient: "linear-gradient(135deg, #e11d48 0%, #ea580c 100%)",
    icon: "🌆",
    isDark: true,
    requiredScore: 9000,
    requiredLevel: 15,
    unlockRequirementText: "Reach 9,000 pts or Level 15",
  },
  {
    id: "bakery-cafe",
    name: "Bakery Cafe",
    category: "preset",
    containerBg: "radial-gradient(circle at 50% 30%, #3d271d 0%, #1c100a 100%)",
    previewGradient: "linear-gradient(135deg, #78350f 0%, #3d271d 100%)",
    icon: "🧁",
    isDark: true,
    requiredScore: 2500,
    requiredLevel: 4,
    unlockRequirementText: "Reach 2,500 pts or Level 4",
  },
  {
    id: "midnight-onyx",
    name: "Midnight Onyx",
    category: "preset",
    containerBg: "radial-gradient(circle at 50% 30%, #181920 0%, #08080a 100%)",
    previewGradient: "linear-gradient(135deg, #27272a 0%, #09090b 100%)",
    icon: "🌑",
    isDark: true,
    requiredScore: 12000,
    unlockRequirementText: "Reach 12,000 pts (Pro Tier)",
  },
  {
    id: "warm-paper",
    name: "Warm Editorial",
    category: "preset",
    containerBg: "#fbf8f2",
    previewGradient: "linear-gradient(135deg, #fbf8f2 0%, #efe7d8 100%)",
    icon: "📜",
    isDark: false,
    requiredScore: 15000,
    requiredLevel: 20,
    unlockRequirementText: "Reach 15,000 pts or Level 20",
  },
];

export const STORAGE_LIFETIME_BEST_SCORE = "bb_lifetime_best_score";

export function getLifetimeBestScore(): number {
  try {
    const val = localStorage.getItem(STORAGE_LIFETIME_BEST_SCORE);
    if (val) return parseInt(val, 10) || 0;
  } catch {}
  return 0;
}

export function updateLifetimeBestScore(score: number): number {
  const current = getLifetimeBestScore();
  if (score > current) {
    try {
      localStorage.setItem(STORAGE_LIFETIME_BEST_SCORE, String(score));
    } catch {}
    return score;
  }
  return current;
}

export function isWallpaperUnlocked(theme: WallpaperTheme, highestLevel: number = 1): boolean {
  if (!theme.requiredScore && !theme.requiredLevel) return true;
  const bestScore = getLifetimeBestScore();
  if (theme.requiredScore && bestScore >= theme.requiredScore) return true;
  if (theme.requiredLevel && highestLevel >= theme.requiredLevel) return true;
  return false;
}

export interface SponsorConfig {
  name: string;
  tagline: string;
  prizeText: string;
  customImageData: string | null;
}

// Crisp default luxury sponsor banner SVG (Trophy, gold geometric accents, high-contrast prize showcase)
export const DEFAULT_SPONSOR_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1200" width="800" height="1200">
  <defs>
    <radialGradient id="goldGlow" cx="50%" cy="40%" r="55%">
      <stop offset="0%" stop-color="%23fbbf24" stop-opacity="0.32" />
      <stop offset="50%" stop-color="%23d97706" stop-opacity="0.12" />
      <stop offset="100%" stop-color="%23050711" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="%23090c1a" />
      <stop offset="50%" stop-color="%230f172a" />
      <stop offset="100%" stop-color="%2304060d" />
    </linearGradient>
    <linearGradient id="goldText" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="%23fef08a" />
      <stop offset="50%" stop-color="%23f59e0b" />
      <stop offset="100%" stop-color="%23b45309" />
    </linearGradient>
  </defs>
  <rect width="800" height="1200" fill="url(%23bgGrad)" />
  <circle cx="400" cy="460" r="380" fill="url(%23goldGlow)" />
  
  <!-- Subtle decorative geometric grid lines -->
  <g stroke="%23fbbf24" stroke-opacity="0.08" stroke-width="1.5">
    <circle cx="400" cy="460" r="280" fill="none" stroke-dasharray="8 6" />
    <circle cx="400" cy="460" r="180" fill="none" />
    <line x1="120" y1="460" x2="680" y2="460" />
    <line x1="400" y1="180" x2="400" y2="740" />
  </g>

  <!-- Sponsor Trophy Shield & Insignia -->
  <g transform="translate(400, 380)">
    <polygon points="0,-100 86,-50 86,50 0,100 -86,50 -86,-50" fill="%231e293b" stroke="%23fbbf24" stroke-width="3.5" opacity="0.9" />
    <text x="0" y="25" font-family="system-ui, -apple-system, sans-serif" font-size="76" text-anchor="middle">🏆</text>
  </g>

  <!-- Branded Sponsor Typography -->
  <text x="400" y="550" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="900" fill="%23fbbf24" letter-spacing="6" text-anchor="middle">OFFICIAL SPONSOR ARENA</text>
  <text x="400" y="600" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="900" fill="url(%23goldText)" letter-spacing="3" text-anchor="middle">WEEKLY CASH CUP</text>
  <text x="400" y="645" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="700" fill="%2394a3b8" letter-spacing="4" text-anchor="middle">TOP 10 LEADERBOARD PAYOUTS</text>

  <!-- Reveal Callout -->
  <g transform="translate(240, 700)">
    <rect width="320" height="48" rx="24" fill="%23fbbf24" fill-opacity="0.12" stroke="%23fbbf24" stroke-width="1.5" />
    <text x="160" y="31" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="800" fill="%23fef08a" letter-spacing="2" text-anchor="middle">✨ BLAST LINES TO UNMASK OFFERS</text>
  </g>
</svg>`;

const STORAGE_THEME_ID = "bb_wallpaper_theme_id";
const STORAGE_CUSTOM_IMAGE = "bb_custom_wallpaper_image";
const STORAGE_CUSTOM_DIMMING = "bb_custom_wallpaper_dimming"; // 0.1 to 0.7
const STORAGE_SPONSOR_IMAGE = "bb_sponsor_wallpaper_image";
const STORAGE_SPONSOR_NAME = "bb_sponsor_name";
const STORAGE_SPONSOR_PRIZE = "bb_sponsor_prize";

class WallpaperManager {
  private currentThemeId: string = "classic-navy";
  private customImageData: string | null = null;
  private customDimming: number = 0.35; // default 35% dark contrast overlay
  private sponsorConfig: SponsorConfig = {
    name: "Official Partner",
    tagline: "Weekly Cash Prize Sponsor",
    prizeText: "R500 Weekly Prize Pot",
    customImageData: null,
  };
  private listeners: Array<() => void> = [];

  constructor() {
    this.init();
  }

  private init() {
    try {
      this.currentThemeId = localStorage.getItem(STORAGE_THEME_ID) || "classic-navy";
      this.customImageData = localStorage.getItem(STORAGE_CUSTOM_IMAGE);
      const savedDim = localStorage.getItem(STORAGE_CUSTOM_DIMMING);
      if (savedDim) this.customDimming = parseFloat(savedDim);

      const savedSponsorImg = localStorage.getItem(STORAGE_SPONSOR_IMAGE);
      const savedSponsorName = localStorage.getItem(STORAGE_SPONSOR_NAME);
      const savedSponsorPrize = localStorage.getItem(STORAGE_SPONSOR_PRIZE);
      if (savedSponsorImg) this.sponsorConfig.customImageData = savedSponsorImg;
      if (savedSponsorName) this.sponsorConfig.name = savedSponsorName;
      if (savedSponsorPrize) this.sponsorConfig.prizeText = savedSponsorPrize;
    } catch {
      this.currentThemeId = "classic-navy";
    }
  }

  public onChange(listener: () => void) {
    this.listeners.push(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  public getCurrentThemeId(): string {
    return this.currentThemeId;
  }

  public getCustomImageData(): string | null {
    return this.customImageData;
  }

  public getDimming(): number {
    return this.customDimming;
  }

  public setDimming(dim: number) {
    this.customDimming = Math.max(0.05, Math.min(0.85, dim));
    localStorage.setItem(STORAGE_CUSTOM_DIMMING, String(this.customDimming));
    this.apply();
  }

  public setTheme(themeId: string) {
    this.currentThemeId = themeId;
    localStorage.setItem(STORAGE_THEME_ID, themeId);
    this.apply();
    this.notify();
  }


  public async setCustomPhoto(file: File): Promise<boolean> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawUrl = e.target?.result as string;
        if (!rawUrl) {
          resolve(false);
          return;
        }

        const img = new Image();
        img.onload = () => {
          // Downscale client-side to maximum 800px dimension (~50-80 KB)
          const maxDim = 800;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(false);
            return;
          }

          ctx.drawImage(img, 0, 0, w, h);
          // Compress locally as JPEG at 0.72 quality (~40-60 KB, fast and lightweight)
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.72);

          try {
            localStorage.setItem(STORAGE_CUSTOM_IMAGE, compressedDataUrl);
          } catch (err) {
            console.warn("Storage quota exceeded, keeping in active memory:", err);
          }
          this.customImageData = compressedDataUrl;
          this.setTheme("custom");
          resolve(true);
        };
        img.onerror = () => resolve(false);
        img.src = rawUrl;
      };
      reader.onerror = () => resolve(false);
      reader.readAsDataURL(file);
    });
  }

  public removeCustomPhoto() {
    this.customImageData = null;
    try {
      localStorage.removeItem(STORAGE_CUSTOM_IMAGE);
    } catch {}
    this.setTheme("classic-navy");
  }

  public getSponsorConfig(): SponsorConfig {
    const tConfig = tournamentConfigManager.getConfig();
    return {
      name: tConfig.sponsorName,
      tagline: tConfig.sponsorTagline,
      prizeText: `${tConfig.totalPrizePool} ${tConfig.tournamentTitle}`,
      customImageData: this.sponsorConfig.customImageData || tConfig.sponsorWallpaperUrl || null,
    };
  }

  public setSponsorConfig(config: Partial<SponsorConfig>) {
    if (config.name !== undefined) {
      this.sponsorConfig.name = config.name;
      localStorage.setItem(STORAGE_SPONSOR_NAME, config.name);
      tournamentConfigManager.updateConfig({ sponsorName: config.name });
    }
    if (config.prizeText !== undefined) {
      this.sponsorConfig.prizeText = config.prizeText;
      localStorage.setItem(STORAGE_SPONSOR_PRIZE, config.prizeText);
      tournamentConfigManager.updateConfig({ totalPrizePool: config.prizeText });
    }
    if (config.customImageData !== undefined) {
      this.sponsorConfig.customImageData = config.customImageData;
      tournamentConfigManager.updateConfig({ sponsorWallpaperUrl: config.customImageData });
      if (config.customImageData) {
        try {
          localStorage.setItem(STORAGE_SPONSOR_IMAGE, config.customImageData);
        } catch {}
      } else {
        localStorage.removeItem(STORAGE_SPONSOR_IMAGE);
      }
    }
    this.notify();
  }

  public getEffectiveCustomImage(isTournament: boolean = false): string | null {
    if (isTournament) {
      return this.sponsorConfig.customImageData || DEFAULT_SPONSOR_SVG;
    }
    return this.customImageData;
  }

  public isCustomActive(isTournament: boolean = false): boolean {
    if (isTournament) return true;
    return this.currentThemeId === "custom" && !!this.customImageData;
  }

  public apply(isTournament: boolean = false) {
    const container = document.getElementById("game-container");
    if (!container) return;

    if (isTournament) {
      const sponsorImg = this.sponsorConfig.customImageData || DEFAULT_SPONSOR_SVG;
      container.style.background = "#050711";
      container.style.backgroundImage = `url("${sponsorImg}")`;
      container.style.backgroundSize = "cover";
      container.style.backgroundPosition = "center center";
      container.style.backgroundRepeat = "no-repeat";
      document.body.style.background = "#030408";
      return;
    }

    if (this.currentThemeId === "custom" && this.customImageData) {
      container.style.background = "#080911";
      container.style.backgroundImage = `url("${this.customImageData}")`;
      container.style.backgroundSize = "cover";
      container.style.backgroundPosition = "center center";
      container.style.backgroundRepeat = "no-repeat";
      document.body.style.background = "#05060a";
      return;
    }

    // Preset themes
    const preset =
      WALLPAPER_PRESETS.find((p) => p.id === this.currentThemeId) ||
      WALLPAPER_PRESETS[0];

    container.style.backgroundImage = "none";
    container.style.background = preset.containerBg;
    document.body.style.background = preset.id === "warm-paper" ? "#efe7d8" : "#080911";
  }
}

export const wallpaperManager = new WallpaperManager();
