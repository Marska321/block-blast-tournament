import type { ClassicBoard } from "../shared/classic";

export interface ClassicDisplayEntry {
  nickname: string;
  score: number;
  rank: number | null;
  isMe: boolean;
  isHouse: boolean;
}

const houseChallengers = [
  { nickname: "Captain Combo", score: 12540 },
  { nickname: "Grid Ninja", score: 7680 },
  { nickname: "Lekker Lines", score: 3420 },
  { nickname: "BlokBot", score: 1480 },
  { nickname: "Rookie Robot", score: 620 },
  { nickname: "Tiny Tiles", score: 180 },
] as const;

// Display targets only: never accepted runs, player counts, ranks or streaks.
export function classicDisplayEntries(board: Pick<ClassicBoard, "entries" | "participants" | "closed">): ClassicDisplayEntry[] {
  const players = board.entries.map(entry => ({ ...entry, isHouse: false }));
  if (board.closed || board.participants >= 50) return players;
  return [
    ...players,
    ...houseChallengers.map(entry => ({ ...entry, rank: null, isMe: false, isHouse: true })),
  ].sort((a, b) => b.score - a.score || Number(a.isHouse) - Number(b.isHouse) || (a.rank ?? 0) - (b.rank ?? 0));
}
