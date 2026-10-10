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

-- 2. Tournaments Table (Multi-partner, daily & weekly prize cups)
CREATE TABLE IF NOT EXISTS public.tournaments (
  id TEXT PRIMARY KEY,                       -- Slug e.g. 'weekly_partner_cup', 'daily_dash'
  sponsor_name TEXT NOT NULL,                -- e.g. 'Vodacom', 'Nike', 'Partner'
  title TEXT NOT NULL,                       -- e.g. 'Weekly Cash Cup'
  tagline TEXT,                              -- e.g. 'Official Cash Prize Sponsor'
  prize_pool TEXT NOT NULL,                  -- e.g. 'R500' or 'R200 Voucher'
  currency_symbol TEXT DEFAULT 'R',
  prize_tiers JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of [{ rank, reward, badgeClass }]
  wallpaper_url TEXT,                        -- Custom background / sponsor logo
  frequency TEXT DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly', 'special')),
  is_active BOOLEAN DEFAULT TRUE,
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tournament Scores Table (Partitioned by tournament_id)
CREATE TABLE IF NOT EXISTS public.tournament_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id TEXT REFERENCES public.tournaments(id) ON DELETE SET NULL DEFAULT 'weekly_partner_cup',
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
CREATE INDEX IF NOT EXISTS idx_scores_tourney_rank ON public.tournament_scores(tournament_id, score DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_scores_mode_score ON public.tournament_scores(mode, score DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_scores_weekly ON public.tournament_scores(created_at DESC, score DESC);
CREATE INDEX IF NOT EXISTS idx_players_stars ON public.players(stars_total DESC, updated_at ASC);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_unclaimed ON public.referrals(referrer_id, reward_claimed);

-- Row Level Security (RLS)
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Public Read Policies (Everyone can view tournaments & leaderboards)
CREATE POLICY "Public Read Tournaments" ON public.tournaments FOR SELECT USING (true);
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

-- Initial Tournaments Seed Data
INSERT INTO public.tournaments (id, sponsor_name, title, tagline, prize_pool, currency_symbol, frequency, is_active, prize_tiers)
VALUES
  (
    'weekly_partner_cup',
    'Official Partner',
    'Weekly Prize Cup',
    'Official Cash Prize Sponsor',
    'R500',
    'R',
    'weekly',
    true,
    '[{"rank":"1ST","reward":"R250","badgeClass":"gold-tier"},{"rank":"2ND","reward":"R150","badgeClass":"silver-tier"},{"rank":"3RD","reward":"R100","badgeClass":"bronze-tier"},{"rank":"TOP 10","reward":"Share","badgeClass":"top10-tier"}]'::jsonb
  ),
  (
    'daily_flash_dash',
    'Speed Partner',
    'Daily Flash Dash',
    'Fast-paced Daily Voucher Run',
    'R150',
    'R',
    'daily',
    true,
    '[{"rank":"1ST","reward":"R100 Voucher","badgeClass":"gold-tier"},{"rank":"2ND","reward":"R50 Voucher","badgeClass":"silver-tier"},{"rank":"TOP 5","reward":"Voucher Draw","badgeClass":"top10-tier"}]'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

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

INSERT INTO public.tournament_scores (tournament_id, player_id, nickname, country, mode, score, lines_cleared, moves_placed, max_combo, verified)
VALUES
  ('weekly_partner_cup', 'seed-1', 'ApexBlaster', '🇿🇦', 'classic', 9840, 48, 86, 9, true),
  ('weekly_partner_cup', 'seed-2', 'GridMaster99', '🇬🇧', 'classic', 7650, 38, 72, 7, true),
  ('weekly_partner_cup', 'seed-3', 'BlockQueen', '🇺🇸', 'classic', 6120, 31, 58, 6, true),
  ('weekly_partner_cup', 'seed-4', 'PixelCrusher', '🇳🇬', 'classic', 4980, 26, 49, 5, true),
  ('weekly_partner_cup', 'seed-5', 'ComboDemon', '🇰🇪', 'classic', 3840, 21, 39, 4, true),
  ('weekly_partner_cup', 'seed-6', 'CyberTetra', '🇩🇪', 'classic', 3100, 18, 34, 4, true),
  ('weekly_partner_cup', 'seed-7', 'NovaPlayer', '🇦🇺', 'classic', 2450, 15, 29, 3, true),
  ('weekly_partner_cup', 'seed-8', 'ShadowDrop', '🇿🇦', 'classic', 1980, 12, 24, 3, true),
  ('weekly_partner_cup', 'seed-9', 'LuckyStrike', '🇨🇦', 'classic', 1420, 9, 19, 2, true),
  ('weekly_partner_cup', 'seed-10', 'NeonRider', '🇮🇳', 'classic', 950, 6, 14, 2, true)
ON CONFLICT DO NOTHING;
