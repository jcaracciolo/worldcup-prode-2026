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

-- Invite codes table
CREATE TABLE invite_codes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  used_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

-- Predictions table
CREATE TABLE predictions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  match_id INTEGER NOT NULL,
  home_goals INTEGER,
  away_goals INTEGER,
  winner_id INTEGER, -- For knockout ties, stores the team ID that wins on penalties
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, match_id)
);

-- Group standings overrides (for tiebreakers)
CREATE TABLE group_standings_overrides (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  group_name TEXT NOT NULL,
  team_id INTEGER NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, group_name, team_id)
);

-- Matches cache (stores API responses)
CREATE TABLE matches_cache (
  match_id INTEGER PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tournament settings (singleton table)
CREATE TABLE tournament_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  group_stage_locked BOOLEAN DEFAULT FALSE,
  knockout_stage_open BOOLEAN DEFAULT FALSE,
  knockout_stage_locked BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default tournament settings
INSERT INTO tournament_settings (id) VALUES (1);

-- Create indexes for better query performance
CREATE INDEX idx_predictions_user_id ON predictions(user_id);
CREATE INDEX idx_predictions_match_id ON predictions(match_id);
CREATE INDEX idx_invite_codes_code ON invite_codes(code);
CREATE INDEX idx_group_standings_user_group ON group_standings_overrides(user_id, group_name);

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
    -- Check if group stage is locked for group matches (match_id for group stage TBD)
    -- Or knockout stage is locked for knockout matches
    EXISTS (
      SELECT 1 FROM tournament_settings 
      WHERE (group_stage_locked = true OR knockout_stage_locked = true)
    )
  );

CREATE POLICY "Users can insert own predictions" ON predictions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

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
    EXISTS (SELECT 1 FROM tournament_settings WHERE group_stage_locked = true)
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

:root {
  --bg-primary: #0d4a42;      /* Main background (dark teal) */
  --bg-secondary: #0a3d36;    /* Secondary background */
  --bg-card: #115c52;         /* Card backgrounds */
  --bg-card-hover: #147a6d;   /* Card hover state */
  --accent: #22c55e;          /* Main accent (green) */
  --accent-light: #4ade80;    /* Light accent */
  --text-primary: #ffffff;    /* Primary text */
  --text-secondary: #94a3b8;  /* Secondary text (slate) */
  --text-muted: #64748b;      /* Muted text */
  --border: rgba(255, 255, 255, 0.1);  /* Borders */
}
