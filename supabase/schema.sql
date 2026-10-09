-- ============================================================
-- Block Blast Tournament - Supabase PostgreSQL Schema
-- ============================================================

-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Players Table
CREATE TABLE IF NOT EXISTS public.players (
  id TEXT PRIMARY KEY,                       -- Unique client ID (UUID or phone hash)
  nickname TEXT NOT NULL,
  phone TEXT,                                -- Optional verified WhatsApp number
  country TEXT DEFAULT '🇿🇦',
  stars_total INT DEFAULT 0,
  best_tourney_score INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tournament Scores Table (Weekly & All-Time)
CREATE TABLE IF NOT EXISTS public.tournament_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT REFERENCES public.players(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  country TEXT DEFAULT '🇿🇦',
  mode TEXT NOT NULL CHECK (mode IN ('classic', 'blitz', 'levels')),
  score INT NOT NULL CHECK (score >= 0),
  lines_cleared INT DEFAULT 0,
  moves_placed INT DEFAULT 0,
  max_combo INT DEFAULT 0,
  seed BIGINT,
  verified BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Player Level Progress Table (Levels 1-20)
CREATE TABLE IF NOT EXISTS public.player_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT REFERENCES public.players(id) ON DELETE CASCADE,
  level INT NOT NULL CHECK (level >= 1 AND level <= 50),
  stars INT NOT NULL CHECK (stars >= 0 AND stars <= 3),
  best_score INT DEFAULT 0,
  completed BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, level)
);

-- 4. Verified Referrals Table (Fraud-proof friend invitations)
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id TEXT REFERENCES public.players(id) ON DELETE CASCADE,
  referred_id TEXT UNIQUE REFERENCES public.players(id) ON DELETE CASCADE,
  first_game_score INT NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed')),
  reward_claimed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for blazing fast Top 100 queries & referral attribution
CREATE INDEX IF NOT EXISTS idx_scores_mode_score ON public.tournament_scores(mode, score DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_scores_weekly ON public.tournament_scores(created_at DESC, score DESC);
CREATE INDEX IF NOT EXISTS idx_players_stars ON public.players(stars_total DESC, updated_at ASC);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_unclaimed ON public.referrals(referrer_id, reward_claimed);

-- Row Level Security (RLS)
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Public Read Policies (Everyone can view leaderboards)
CREATE POLICY "Public Read Players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Public Read Tournament Scores" ON public.tournament_scores FOR SELECT USING (true);
CREATE POLICY "Public Read Player Progress" ON public.player_progress FOR SELECT USING (true);
CREATE POLICY "Public Read Referrals" ON public.referrals FOR SELECT USING (true);

-- Allow anonymous inserts through backend API / anon client
CREATE POLICY "Public Insert Players" ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Players" ON public.players FOR UPDATE USING (true);
CREATE POLICY "Public Insert Scores" ON public.tournament_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Upsert Progress" ON public.player_progress FOR ALL USING (true);
CREATE POLICY "Public Upsert Referrals" ON public.referrals FOR ALL USING (true);

-- Initial seed data (Top competitive leaderboard baseline)
INSERT INTO public.players (id, nickname, country, best_tourney_score, stars_total)
VALUES
  ('seed-1', 'ApexBlaster', '🇿🇦', 9840, 60),
  ('seed-2', 'GridMaster99', '🇬🇧', 7650, 58),
  ('seed-3', 'BlockQueen', '🇺🇸', 6120, 54),
  ('seed-4', 'PixelCrusher', '🇳🇬', 4980, 48),
  ('seed-5', 'ComboDemon', '🇰🇪', 3840, 42),
  ('seed-6', 'CyberTetra', '🇩🇪', 3100, 39),
  ('seed-7', 'NovaPlayer', '🇦🇺', 2450, 35),
  ('seed-8', 'ShadowDrop', '🇿🇦', 1980, 30),
  ('seed-9', 'LuckyStrike', '🇨🇦', 1420, 24),
  ('seed-10', 'NeonRider', '🇮🇳', 950, 18)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tournament_scores (player_id, nickname, country, mode, score, lines_cleared, moves_placed, max_combo, verified)
VALUES
  ('seed-1', 'ApexBlaster', '🇿🇦', 'classic', 9840, 48, 86, 9, true),
  ('seed-2', 'GridMaster99', '🇬🇧', 'classic', 7650, 38, 72, 7, true),
  ('seed-3', 'BlockQueen', '🇺🇸', 'classic', 6120, 31, 58, 6, true),
  ('seed-4', 'PixelCrusher', '🇳🇬', 'classic', 4980, 26, 49, 5, true),
  ('seed-5', 'ComboDemon', '🇰🇪', 'classic', 3840, 21, 39, 4, true),
  ('seed-6', 'CyberTetra', '🇩🇪', 'classic', 3100, 18, 34, 4, true),
  ('seed-7', 'NovaPlayer', '🇦🇺', 'classic', 2450, 15, 29, 3, true),
  ('seed-8', 'ShadowDrop', '🇿🇦', 'classic', 1980, 12, 24, 3, true),
  ('seed-9', 'LuckyStrike', '🇨🇦', 'classic', 1420, 9, 19, 2, true),
  ('seed-10', 'NeonRider', '🇮🇳', 'classic', 950, 6, 14, 2, true)
ON CONFLICT DO NOTHING;
