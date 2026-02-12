-- Casino X Database Schema
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- 1. Game type enum
CREATE TYPE game_type AS ENUM ('slots', 'dice', 'crash', 'roulette', 'poker', 'blackjack');

-- 2. Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL DEFAULT 'Player',
  chips INTEGER NOT NULL DEFAULT 10000,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Game history table
CREATE TABLE game_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_type game_type NOT NULL,
  bet_amount INTEGER NOT NULL DEFAULT 0,
  payout INTEGER NOT NULL DEFAULT 0,
  multiplier NUMERIC(10,2) NOT NULL DEFAULT 0,
  result_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Leaderboard cache table
CREATE TABLE leaderboard_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  game_type TEXT NOT NULL, -- 'all' or a game_type value
  period TEXT NOT NULL CHECK (period IN ('weekly', 'monthly', 'alltime')),
  metric TEXT NOT NULL CHECK (metric IN ('biggest_win', 'total_wagered', 'most_played', 'highest_multiplier')),
  value NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, game_type, period, metric)
);

-- 5. Settings table (for admin config)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Indexes for performance
CREATE INDEX idx_game_history_user_id ON game_history(user_id);
CREATE INDEX idx_game_history_game_type ON game_history(game_type);
CREATE INDEX idx_game_history_created_at ON game_history(created_at DESC);
CREATE INDEX idx_leaderboard_cache_lookup ON leaderboard_cache(game_type, period, metric, value DESC);

-- 7. Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, chips)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'Player'),
    10000
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 8. Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all profiles, update only their own
CREATE POLICY "Profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Game history: users can read their own, insert their own
CREATE POLICY "Users can view own game history" ON game_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own game history" ON game_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can view all game history
CREATE POLICY "Admins can view all game history" ON game_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Leaderboard: everyone can read
CREATE POLICY "Leaderboard is viewable by everyone" ON leaderboard_cache
  FOR SELECT USING (true);

-- Settings: everyone can read, only admins can update
CREATE POLICY "Settings are viewable by everyone" ON settings
  FOR SELECT USING (true);

CREATE POLICY "Only admins can update settings" ON settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 9. Cosmetics columns on profiles
-- Run this migration if profiles table already exists:
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS owned_cosmetics JSONB NOT NULL DEFAULT '[]';
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS equipped_cosmetics JSONB NOT NULL DEFAULT '{}';

-- 10. Insert default settings
INSERT INTO settings (key, value) VALUES
  ('house_edge', '{"slots": 5, "dice": 1, "crash": 3, "roulette": 2.7, "poker": 0, "blackjack": 1}'::jsonb),
  ('min_bet', '100'::jsonb),
  ('max_bet', '50000'::jsonb),
  ('daily_bonus', '5000'::jsonb);
