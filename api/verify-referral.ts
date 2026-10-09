import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { referrerId, referredId, score = 0 } = req.body || {};

  // 1. Basic validation
  if (!referrerId || !referredId) {
    return res.status(400).json({ error: "Missing referrer or referred player ID" });
  }

  // Anti-fraud: Player cannot refer themselves
  if (referrerId === referredId) {
    return res.status(400).json({ error: "Self-referral is not allowed", verified: false });
  }

  // Anti-fraud: Proof of actual game play (minimum 100 points)
  if (typeof score !== "number" || score < 100) {
    return res.status(400).json({
      error: "Game score below completion threshold (must score at least 100 pts)",
      verified: false,
    });
  }

  // If Supabase is connected, record and verify in the database
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

      // Ensure referrer player record exists
      await supabase.from("players").upsert(
        {
          id: referrerId,
          nickname: `Player-${referrerId.slice(-4)}`,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

      // Ensure referred player record exists
      await supabase.from("players").upsert(
        {
          id: referredId,
          nickname: `Player-${referredId.slice(-4)}`,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

      // Check if this player was already referred by someone
      const { data: existing } = await supabase
        .from("referrals")
        .select("id")
        .eq("referred_id", referredId)
        .maybeSingle();

      if (existing) {
        return res.status(200).json({
          success: true,
          verified: false,
          message: "Player was already credited on a previous referral",
        });
      }

      // Insert new verified referral
      const { error: insertErr } = await supabase.from("referrals").insert({
        referrer_id: referrerId,
        referred_id: referredId,
        first_game_score: score,
        status: "completed",
        reward_claimed: false,
      });

      if (insertErr) {
        console.error("Referral insert error:", insertErr);
        return res.status(500).json({ error: "Database error recording referral" });
      }

      return res.status(200).json({
        success: true,
        verified: true,
        bonusGranted: true,
        message: "Referral verified! Referrer credited with +1 bonus ticket.",
      });
    } catch (err) {
      console.error("Referral verification exception:", err);
    }
  }

  // Offline / mock fallback
  return res.status(200).json({
    success: true,
    verified: true,
    bonusGranted: true,
    mock: true,
  });
}
