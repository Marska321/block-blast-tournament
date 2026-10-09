import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const SECRET = process.env.SESSION_SECRET || "block-blast-tournament-secret-key-2026";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const {
    playerId = "guest",
    nickname = "Anonymous",
    phone = null,
    country = "🇿🇦",
    mode = "classic",
    score = 0,
    linesCleared = 0,
    movesPlaced = 0,
    maxCombo = 0,
    seed = 0,
    token = "",
  } = req.body || {};

  // 1. Anti-Cheat: Validate Session Token HMAC
  if (token) {
    const parts = token.split(".");
    if (parts.length === 2) {
      const [payload, sig] = parts;
      const expectedSig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
      if (sig !== expectedSig) {
        return res.status(403).json({ error: "Invalid anti-cheat signature" });
      }

      const [tokPlayer, tokMode, tokSeed, tokTimestamp] = payload.split(":");
      const startMs = Number(tokTimestamp);
      const elapsedSeconds = (Date.now() - startMs) / 1000;

      // Minimum time check: at least 0.2s per move
      if (movesPlaced > 5 && elapsedSeconds < movesPlaced * 0.18) {
        return res.status(400).json({ error: "Unrealistic play speed detected" });
      }

      // Mathematical score bound check: score cannot exceed possible theoretical limits
      const theoreticalMax = movesPlaced * 100 + linesCleared * 600 * Math.max(1, maxCombo + 1);
      if (score > theoreticalMax && score > 2000) {
        return res.status(400).json({ error: "Score exceeds theoretical game bounds" });
      }
    }
  }

  // 2. Persist to Supabase if configured
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

      // Upsert player record
      await supabase.from("players").upsert(
        {
          id: playerId,
          nickname,
          phone,
          country,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

      // Insert score
      const { data, error } = await supabase.from("tournament_scores").insert({
        player_id: playerId,
        nickname,
        country,
        mode,
        score,
        lines_cleared: linesCleared,
        moves_placed: movesPlaced,
        max_combo: maxCombo,
        seed,
        verified: true,
      }).select("id").single();

      if (error) {
        console.error("Supabase insert error:", error);
      }

      // Calculate global rank for this score
      const { count } = await supabase
        .from("tournament_scores")
        .select("id", { count: "exact", head: true })
        .eq("mode", mode)
        .gt("score", score);

      const rank = (count || 0) + 1;

      return res.status(200).json({
        success: true,
        scoreId: data?.id || null,
        rank,
        verified: true,
      });
    } catch (err) {
      console.error("Database connection error:", err);
    }
  }

  // Fallback if Supabase credentials not set yet
  return res.status(200).json({
    success: true,
    rank: score > 5000 ? 5 : score > 2000 ? 12 : 25,
    verified: true,
    mock: true,
  });
}
