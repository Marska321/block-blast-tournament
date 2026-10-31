import type { GameAction } from "./engine.js";
export interface PilotEvent {
  id: string;
  cup_id: string;
  title: string;
  prize_pool: string;
  prize_tiers: { rank: string; reward: string }[];
  prize_slots: number;
  starts_at: string;
  ends_at: string;
  state: "draft" | "open" | "closed";
  is_demo: boolean;
}
export interface RunSession {
  id: string;
  event_id: string | null;
  kind: "tournament" | "levels";
  level: number | null;
  seed: number;
  engine_version: string;
  created_at: string;
  expires_at: string;
  status: "started" | "accepted";
  user_id: string;
}
export interface Standing {
  rank: number;
  user_id: string;
  nickname: string;
  score: number;
  run_id: string;
  accepted_at: string;
}
export interface ScoreReceipt {
  duplicate?: boolean;
  success: true;
  scoreId: string;
  score: number;
  stars: number;
  rank: number | null;
  acceptedAt: string;
  eventId: string | null;
}
export interface ReplaySubmission {
  sessionId: string;
  actions: GameAction[];
}
export interface Balance {
  remaining: number;
  baseUsed: number;
  bonusEarned: number;
  bonusUsed: number;
  day: string;
}
export interface ClaimStatus {
  id: string;
  event_id: string;
  status: "pending" | "approved" | "rejected";
  reviewed_at: string | null;
  review_reason: string | null;
}
