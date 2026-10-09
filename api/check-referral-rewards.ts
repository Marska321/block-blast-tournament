import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const playerId = (req.query.playerId as string) || "";

  if (!playerId) {
    return res.status(400).json({ error: "Missing playerId" });
  }

  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

      // Fetch all verified referrals for this player that haven't been claimed yet
      const { data, error } = await supabase
        .from("referrals")
        .select("id, referred_id")
        .eq("referrer_id", playerId)
        .eq("reward_claimed", false);

      if (error) {
        console.error("Fetch unclaimed referrals error:", error);
        return res.status(500).json({ error: "Database error" });
      }

      const unclaimedCount = data ? data.length : 0;

      // Mark them as claimed so they are not rewarded twice
      if (unclaimedCount > 0) {
        const ids = data.map((r) => r.id);
        await supabase
          .from("referrals")
          .update({ reward_claimed: true })
          .in("id", ids);
      }

      return res.status(200).json({
        success: true,
        unclaimedCount,
      });
    } catch (err) {
      console.error("Check referral rewards error:", err);
    }
  }

  return res.status(200).json({
    success: true,
    unclaimedCount: 0,
    mock: true,
  });
}
