export interface WallpaperTheme {
  id: string;
  name: string;
  category: "preset" | "custom";
  containerBg: string;
  previewGradient: string;
  icon: string;
  isDark: boolean;
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
  },
  {
    id: "sakura-pink",
    name: "Sakura Pink",
    category: "preset",
    containerBg: "radial-gradient(circle at 50% 25%, #4a192c 0%, #1a0812 100%)",
    previewGradient: "linear-gradient(135deg, #f472b6 0%, #db2777 100%)",
    icon: "🌸",
    isDark: true,
  },
  {
    id: "cosmic-nebula",
    name: "Cosmic Nebula",
    category: "preset",
    containerBg: "radial-gradient(circle at 50% 20%, #2e1065 0%, #090314 100%)",
    previewGradient: "linear-gradient(135deg, #7c3aed 0%, #4338ca 100%)",
    icon: "🌌",
    isDark: true,
  },
  {
    id: "ocean-abyss",
    name: "Ocean Abyss",
    category: "preset",
    containerBg: "radial-gradient(circle at 50% 30%, #064e3b 0%, #022019 100%)",
    previewGradient: "linear-gradient(135deg, #059669 0%, #0f766e 100%)",
    icon: "🌊",
    isDark: true,
  },
  {
    id: "cyberpunk-sunset",
    name: "Neon Sunset",
    category: "preset",
    containerBg: "radial-gradient(circle at 50% 20%, #4c0519 0%, #18020a 100%)",
    previewGradient: "linear-gradient(135deg, #e11d48 0%, #ea580c 100%)",
    icon: "🌆",
    isDark: true,
  },
  {
    id: "midnight-onyx",
    name: "Midnight Onyx",
    category: "preset",
    containerBg: "radial-gradient(circle at 50% 30%, #181920 0%, #08080a 100%)",
    previewGradient: "linear-gradient(135deg, #27272a 0%, #09090b 100%)",
    icon: "🌑",
    isDark: true,
  },
  {
    id: "warm-paper",
    name: "Warm Editorial",
    category: "preset",
    containerBg: "#fbf8f2",
    previewGradient: "linear-gradient(135deg, #fbf8f2 0%, #efe7d8 100%)",
    icon: "📜",
    isDark: false,
  },
];

const STORAGE_THEME_ID = "bb_wallpaper_theme_id";
const STORAGE_CUSTOM_IMAGE = "bb_custom_wallpaper_image";
const STORAGE_CUSTOM_DIMMING = "bb_custom_wallpaper_dimming"; // 0.1 to 0.7

class WallpaperManager {
  private currentThemeId: string = "classic-navy";
  private customImageData: string | null = null;
  private customDimming: number = 0.35; // default 35% dark contrast overlay
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

  public isCustomActive(): boolean {
    return this.currentThemeId === "custom" && !!this.customImageData;
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

  public apply() {
    const container = document.getElementById("game-container");
    if (!container) return;

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
