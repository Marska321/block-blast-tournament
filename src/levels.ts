import { LEVEL_DATA } from "../shared/levels";
export * from "../shared/levels";

const PROGRESS_KEY = "bbt_level_progress";

export interface LevelProgressRecord {
  stars: number;
  bestScore: number;
  completed: boolean;
}

export type LevelProgressMap = Record<number, LevelProgressRecord>;

export class LevelProgressManager {
  private progress: LevelProgressMap = {};

  constructor() {
    this.load();
  }

  private load() {
    try {
      const saved = localStorage.getItem(PROGRESS_KEY);
      if (saved) {
        this.progress = JSON.parse(saved);
      }
    } catch {
      this.progress = {};
    }
  }

  private save() {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(this.progress));
    } catch {
      // Storage full or disabled
    }
  }

  public getHighestUnlocked(): number {
    let highest = 1;
    for (const [lvlStr, data] of Object.entries(this.progress)) {
      const lvl = parseInt(lvlStr, 10);
      if (data.completed && lvl >= highest) {
        highest = lvl + 1;
      }
    }
    return Math.min(highest, LEVEL_DATA.length);
  }

  public getLevelProgress(level: number): LevelProgressRecord {
    return this.progress[level] || { stars: 0, bestScore: 0, completed: false };
  }

  public completeLevel(level: number, score: number, stars: number) {
    const existing = this.progress[level];
    this.progress[level] = {
      stars: Math.max(existing?.stars || 0, stars),
      bestScore: Math.max(existing?.bestScore || 0, score),
      completed: true,
    };
    this.save();
  }

  public getTotalStars(): number {
    return Object.values(this.progress).reduce((sum, p) => sum + (p.stars || 0), 0);
  }

  public calculateStars(score: number, thresholds: [number, number, number]): number {
    if (score >= thresholds[2]) return 3;
    if (score >= thresholds[1]) return 2;
    if (score >= thresholds[0]) return 1;
    return 1; // Passing the level awards at least 1 star
  }

  public resetProgress() {
    this.progress = {};
    localStorage.removeItem(PROGRESS_KEY);
  }
}

export const levelProgress = new LevelProgressManager();
