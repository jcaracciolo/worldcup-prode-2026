-- WorldCupProde Database - Drop and Recreate
-- WARNING: This will delete ALL data! Use only for clean fresh installs.
-- Run this in Supabase SQL Editor

-- =====================================================================
-- STEP 1: Drop all existing objects in correct order
-- =====================================================================

-- Drop triggers first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_competitions_updated_at ON competitions;
DROP TRIGGER IF EXISTS update_predictions_updated_at ON predictions;
DROP TRIGGER IF EXISTS update_group_standings_updated_at ON group_standings_overrides;
DROP TRIGGER IF EXISTS update_tournament_settings_updated_at ON tournament_settings;

-- Drop functions
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop policies (need to drop before tables)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Anyone can view competitions" ON competitions;
DROP POLICY IF EXISTS "Admins can create competitions" ON competitions;
DROP POLICY IF EXISTS "Admins can update competitions" ON competitions;
DROP POLICY IF EXISTS "Anyone can view competition members" ON competition_members;
DROP POLICY IF EXISTS "Users can view their own memberships" ON competition_members;
DROP POLICY IF EXISTS "Service role can manage competition members" ON competition_members;
DROP POLICY IF EXISTS "Admins can view all invite codes" ON invite_codes;
DROP POLICY IF EXISTS "Anyone can check if a code is valid" ON invite_codes;
DROP POLICY IF EXISTS "Admins can create invite codes" ON invite_codes;
DROP POLICY IF EXISTS "Service role can update invite codes" ON invite_codes;
DROP POLICY IF EXISTS "Users can view own predictions" ON predictions;
DROP POLICY IF EXISTS "Public predictions after stage starts" ON predictions;
DROP POLICY IF EXISTS "Users can insert own predictions" ON predictions;
DROP POLICY IF EXISTS "Users can update own predictions when not locked" ON predictions;
DROP POLICY IF EXISTS "Users can view own overrides" ON group_standings_overrides;
DROP POLICY IF EXISTS "Public overrides after group stage starts" ON group_standings_overrides;
DROP POLICY IF EXISTS "Users can manage own overrides" ON group_standings_overrides;
DROP POLICY IF EXISTS "Anyone can view cached matches" ON matches_cache;
DROP POLICY IF EXISTS "Service role can manage cache" ON matches_cache;
DROP POLICY IF EXISTS "Anyone can view tournament settings" ON tournament_settings;
DROP POLICY IF EXISTS "Admins can update tournament settings" ON tournament_settings;

-- Drop tables in order respecting foreign keys
DROP TABLE IF EXISTS tournament_settings CASCADE;
DROP TABLE IF EXISTS group_standings_overrides CASCADE;
DROP TABLE IF EXISTS predictions CASCADE;
DROP TABLE IF EXISTS matches_cache CASCADE;
DROP TABLE IF EXISTS invite_codes CASCADE;
DROP TABLE IF EXISTS competition_members CASCADE;
DROP TABLE IF EXISTS competitions CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- =====================================================================
-- STEP 2: Create tables
-- =====================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Competitions table
CREATE TABLE competitions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  season_id INTEGER,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Competition members (join table)
CREATE TABLE competition_members (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, competition_id)
);

-- Invite codes table
CREATE TABLE invite_codes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  used_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

-- Predictions table
CREATE TABLE predictions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE NOT NULL,
  match_id INTEGER NOT NULL,
  home_goals INTEGER,
  away_goals INTEGER,
  winner_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, competition_id, match_id)
);

-- Group standings overrides
CREATE TABLE group_standings_overrides (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE NOT NULL,
  group_name TEXT NOT NULL,
  team_id INTEGER NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, competition_id, group_name, team_id)
);

-- Matches cache (global, not per-competition)
CREATE TABLE matches_cache (
  match_id INTEGER PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tournament settings (per competition)
CREATE TABLE tournament_settings (
  competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE PRIMARY KEY,
  group_stage_locked BOOLEAN DEFAULT FALSE,
  knockout_stage_open BOOLEAN DEFAULT FALSE,
  knockout_stage_locked BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- STEP 3: Create indexes
-- =====================================================================

CREATE INDEX idx_predictions_user_id ON predictions(user_id);
CREATE INDEX idx_predictions_match_id ON predictions(match_id);
CREATE INDEX idx_predictions_competition_id ON predictions(competition_id);
CREATE INDEX idx_predictions_user_competition ON predictions(user_id, competition_id);
CREATE INDEX idx_invite_codes_code ON invite_codes(code);
CREATE INDEX idx_invite_codes_competition ON invite_codes(competition_id);
CREATE INDEX idx_group_standings_user_group ON group_standings_overrides(user_id, group_name);
CREATE INDEX idx_group_standings_competition ON group_standings_overrides(competition_id);
CREATE INDEX idx_competition_members_user ON competition_members(user_id);
CREATE INDEX idx_competition_members_competition ON competition_members(competition_id);

-- =====================================================================
-- STEP 4: Create functions
-- =====================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- STEP 5: Create triggers
-- =====================================================================

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_competitions_updated_at
  BEFORE UPDATE ON competitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_predictions_updated_at
  BEFORE UPDATE ON predictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_group_standings_updated_at
  BEFORE UPDATE ON group_standings_overrides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tournament_settings_updated_at
  BEFORE UPDATE ON tournament_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================================
-- STEP 6: Enable RLS on all tables
-- =====================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_standings_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_settings ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- STEP 7: Create RLS policies
-- =====================================================================

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Competitions policies
CREATE POLICY "Anyone can view competitions" ON competitions
  FOR SELECT USING (true);

CREATE POLICY "Admins can create competitions" ON competitions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update competitions" ON competitions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Competition members policies
CREATE POLICY "Anyone can view competition members" ON competition_members
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage competition members" ON competition_members
  FOR ALL USING (true);

-- Invite codes policies
CREATE POLICY "Admins can view all invite codes" ON invite_codes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Anyone can check if a code is valid" ON invite_codes
  FOR SELECT USING (used_by IS NULL);

CREATE POLICY "Admins can create invite codes" ON invite_codes
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Allow service role to update invite codes (for marking as used during signup)
CREATE POLICY "Service role can update invite codes" ON invite_codes
  FOR UPDATE USING (true)
  WITH CHECK (true);

-- Predictions policies
CREATE POLICY "Users can view own predictions" ON predictions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Public predictions after stage starts" ON predictions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tournament_settings ts
      WHERE ts.competition_id = predictions.competition_id
      AND (ts.group_stage_locked = true OR ts.knockout_stage_locked = true)
    )
  );

CREATE POLICY "Users can insert own predictions" ON predictions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM competition_members 
      WHERE user_id = auth.uid() AND competition_id = predictions.competition_id
    )
  );

CREATE POLICY "Users can update own predictions when not locked" ON predictions
  FOR UPDATE USING (auth.uid() = user_id);

-- Group standings overrides policies
CREATE POLICY "Users can view own overrides" ON group_standings_overrides
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Public overrides after group stage starts" ON group_standings_overrides
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tournament_settings ts
      WHERE ts.competition_id = group_standings_overrides.competition_id
      AND ts.group_stage_locked = true
    )
  );

CREATE POLICY "Users can manage own overrides" ON group_standings_overrides
  FOR ALL USING (auth.uid() = user_id);

-- Matches cache policies
CREATE POLICY "Anyone can view cached matches" ON matches_cache
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage cache" ON matches_cache
  FOR ALL USING (true);

-- Tournament settings policies
CREATE POLICY "Anyone can view tournament settings" ON tournament_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can update tournament settings" ON tournament_settings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can insert tournament settings" ON tournament_settings
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- =====================================================================
-- STEP 8: Create default competition and seed data
-- =====================================================================

-- Create default competition
INSERT INTO competitions (id, name, description, season_id, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'World Cup 2026',
  'FIFA World Cup 2026 - USA, Canada & Mexico',
  2398,
  NOW()
);

-- Create tournament settings for default competition
INSERT INTO tournament_settings (competition_id, group_stage_locked, knockout_stage_open, knockout_stage_locked)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  false,
  false,
  false
);

-- Create initial invite code for first user signup (bypasses RLS with service role)
-- Code: ADMIN2026
INSERT INTO invite_codes (id, code, competition_id, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000002'::uuid,
  'ADMIN2026',
  '00000000-0000-0000-0000-000000000001'::uuid,
  NOW()
);

-- =====================================================================
-- DONE! Database is ready.
-- 
-- Next steps:
-- 1. Sign up using invite code: ADMIN2026
-- 2. Run this SQL to make yourself admin (replace YOUR_EMAIL):
--    UPDATE profiles SET is_admin = true WHERE email = 'YOUR_EMAIL';
-- 3. Generate more invite codes from the admin panel
-- =====================================================================
