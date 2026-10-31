import type { GameAction } from "./engine.js";

export interface ClassicSession {
  id: string;
  day: string;
  seed: number;
  engine_version: string;
  expires_at: string;
  user_id: string;
}
export interface ClassicStanding {
  rank: number;
  nickname: string;
  score: number;
  isMe: boolean;
  pointsToNext: number | null;
}
export interface ClassicStreak {
  current: number;
  longest: number;
  playedToday: boolean;
}
export interface ClassicBoard {
  day: string;
  today: string;
  startsAt: string;
  endsAt: string;
  closed: boolean;
  serverTime: string;
  demo: boolean;
  entries: ClassicStanding[];
  me: ClassicStanding | null;
  participants: number;
  streak: ClassicStreak;
}
export interface ClassicReceipt {
  success: true;
  scoreId: string;
  score: number;
  day: string;
  acceptedAt: string;
  rankAtAcceptance: number;
  revives: number;
  streak: ClassicStreak;
}
export interface ClassicPending {
  session: ClassicSession;
  actions: GameAction[];
  state: "saving" | "accepted" | "retry needed" | "rejected";
  receipt?: ClassicReceipt;
  error?: string;
}
