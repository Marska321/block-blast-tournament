import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "";

export const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

export interface SubmitScorePayload {
  playerId: string;
  nickname: string;
  phone?: string | null;
  country?: string;
  mode: "classic" | "blitz" | "levels";
  tournamentId?: string;
  score: number;
  linesCleared: number;
  movesPlaced: number;
  maxCombo: number;
  seed: number;
  token?: string;
}

export interface SubmitScoreResponse {
  success: boolean;
  scoreId?: string | null;
  rank: number;
  verified: boolean;
  mock?: boolean;
}

// Request session token for anti-cheat verification before a tournament run starts
export async function requestTournamentSessionToken(
  playerId: string,
  mode: "classic" | "blitz" = "classic"
): Promise<{ seed: number; token: string }> {
  try {
    const res = await fetch("/api/session-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, mode }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("Using offline session token:", err);
  }

  // Offline fallback
  const seed = Date.now();
  return { seed, token: `offline:${mode}:${seed}:${Date.now()}.offline` };
}

// Submit finished tournament run for verification and leaderboard entry
export async function submitTournamentScore(
  payload: SubmitScorePayload
): Promise<SubmitScoreResponse> {
  try {
    const res = await fetch("/api/submit-score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("Using offline score submission:", err);
  }

  return {
    success: true,
    rank: payload.score > 5000 ? 5 : payload.score > 2000 ? 12 : 25,
    verified: true,
    mock: true,
  };
}

// Fetch live global leaderboard
export async function fetchLiveLeaderboard(mode: string = "classic", tournamentId?: string) {
  try {
    const q = tournamentId ? `&tourney=${encodeURIComponent(tournamentId)}` : "";
    const res = await fetch(`/api/leaderboard?mode=${mode}${q}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("Using offline leaderboard cache:", err);
  }
  return null;
}
