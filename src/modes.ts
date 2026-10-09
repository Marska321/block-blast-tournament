export enum GameModeId {
  LEVELS = "levels",
  CLASSIC = "classic",
  TOURNAMENT = "tournament",
}

export interface ModeConfig {
  id: GameModeId;
  name: string;
  tagline: string;
  gridSize: number;
  handSize: number;
  badge: string;
  icon: string;
}

export const GAME_MODES: Record<GameModeId, ModeConfig> = {
  [GameModeId.LEVELS]: {
    id: GameModeId.LEVELS,
    name: "Levels",
    tagline: "Adventure & Puzzles",
    gridSize: 8,
    handSize: 3,
    badge: "ADVENTURE",
    icon: "🗺️",
  },
  [GameModeId.CLASSIC]: {
    id: GameModeId.CLASSIC,
    name: "Classic",
    tagline: "Endless Casual Mode",
    gridSize: 8,
    handSize: 3,
    badge: "ENDLESS",
    icon: "🎯",
  },
  [GameModeId.TOURNAMENT]: {
    id: GameModeId.TOURNAMENT,
    name: "Tournament",
    tagline: "Weekly Sponsor Prize Cup",
    gridSize: 8,
    handSize: 3,
    badge: "PRIZE CUP",
    icon: "🏆",
  },
};
