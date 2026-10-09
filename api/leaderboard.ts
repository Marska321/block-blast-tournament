import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const mode = (req.query.mode as string) || "classic";

  // Cache for 15 seconds on Vercel Edge CDN, stale-while-revalidate for 60s (zero redundant DB queries)
  res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=60");

  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

      // Top tournament scores
      const { data: scoresData, error: scoresError } = await supabase
        .from("tournament_scores")
        .select("nickname, score, country, created_at")
        .eq("mode", mode)
        .order("score", { ascending: false })
        .limit(20);

      // Top star players
      const { data: starsData, error: starsError } = await supabase
        .from("players")
        .select("nickname, stars_total, country")
        .order("stars_total", { ascending: false })
        .limit(20);

      if (!scoresError && scoresData) {
        const tournament = scoresData.map((row: any, i: number) => ({
          rank: i + 1,
          name: row.nickname,
          score: row.score,
          country: row.country || "🇿🇦",
        }));

        const stars = (starsData || []).map((row: any, i: number) => ({
          rank: i + 1,
          name: row.nickname,
          stars: row.stars_total || 0,
          country: row.country || "🇿🇦",
        }));

        return res.status(200).json({ tournament, stars });
      }
    } catch (err) {
      console.error("Leaderboard query error:", err);
    }
  }

  // Fallback seed leaderboard
  return res.status(200).json({
    tournament: [
      { rank: 1, name: "ApexBlaster", score: 9840, country: "🇿🇦" },
      { rank: 2, name: "GridMaster99", score: 7650, country: "🇬🇧" },
      { rank: 3, name: "BlockQueen", score: 6120, country: "🇺🇸" },
      { rank: 4, name: "PixelCrusher", score: 4980, country: "🇳🇬" },
      { rank: 5, name: "ComboDemon", score: 3840, country: "🇰🇪" },
      { rank: 6, name: "CyberTetra", score: 3100, country: "🇩🇪" },
      { rank: 7, name: "NovaPlayer", score: 2450, country: "🇦🇺" },
      { rank: 8, name: "ShadowDrop", score: 1980, country: "🇿🇦" },
      { rank: 9, name: "LuckyStrike", score: 1420, country: "🇨🇦" },
      { rank: 10, name: "NeonRider", score: 950, country: "🇮🇳" },
    ],
    stars: [
      { rank: 1, name: "StarLord_99", stars: 60, country: "🇿🇦" },
      { rank: 2, name: "PuzzleWizard", stars: 57, country: "🇺🇸" },
      { rank: 3, name: "BlockQueen", stars: 54, country: "🇬🇧" },
      { rank: 4, name: "ApexBlaster", stars: 49, country: "🇿🇦" },
      { rank: 5, name: "ComboDemon", stars: 42, country: "🇰🇪" },
    ],
  });
}
