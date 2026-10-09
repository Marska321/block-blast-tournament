export enum GameModeId {
  LEVELS = "levels",
  CLASSIC = "classic",
  BLITZ = "blitz",
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
    tagline: "8×8 Strategic Tournament",
    gridSize: 8,
    handSize: 3,
    badge: "COMPETITIVE",
    icon: "🎯",
  },
  [GameModeId.BLITZ]: {
    id: GameModeId.BLITZ,
    name: "Blitz",
    tagline: "10×10 & 5 Pieces",
    gridSize: 10,
    handSize: 5,
    badge: "HIGH COMBO",
    icon: "⚡",
  },
};
