-- WorldCupProde Database Schema
-- Run this in Supabase SQL Editor

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

-- Competitions table (for multi-competition support)
CREATE TABLE competitions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  season_id INTEGER, -- For API integration (e.g., Football-Data.org season ID)
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Competition members (join table for users in competitions)
CREATE TABLE competition_members (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, competition_id)
);

-- Invite codes table (now scoped to competition)
CREATE TABLE invite_codes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  used_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

-- Predictions table (now scoped to competition)
CREATE TABLE predictions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE NOT NULL,
  match_id INTEGER NOT NULL,
  home_goals INTEGER,
  away_goals INTEGER,
  penalty_winner TEXT CHECK (penalty_winner IN ('HOME', 'AWAY')), -- For knockout ties: which side wins on penalties
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, competition_id, match_id)
);

-- Group standings overrides (for tiebreakers, now scoped to competition)
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

-- Matches cache (stores API responses - global, not per-competition)
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

-- Create indexes for better query performance
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

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
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

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Row Level Security (RLS)

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_standings_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_settings ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Users can view their own memberships" ON competition_members
  FOR SELECT USING (auth.uid() = user_id);

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

CREATE POLICY "Service role can update invite codes" ON invite_codes
  FOR UPDATE USING (true);

-- Predictions policies
CREATE POLICY "Users can view own predictions" ON predictions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Public predictions after stage starts" ON predictions
  FOR SELECT USING (
    -- Check if group stage is locked for this competition
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
  FOR UPDATE USING (
    auth.uid() = user_id
    -- Additional lock check would be done in application logic
  );

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

-- Matches cache policies (public read, service role write)
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
