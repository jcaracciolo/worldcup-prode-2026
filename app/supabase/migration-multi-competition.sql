-- Migration: Add Multi-Competition Support
-- Run this on existing databases to add competition support
-- This migration preserves existing data by creating a default competition

-- =====================================================================
-- STEP 1: Create new tables
-- =====================================================================

-- Competitions table
CREATE TABLE IF NOT EXISTS competitions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  season_id INTEGER,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Competition members (join table)
CREATE TABLE IF NOT EXISTS competition_members (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, competition_id)
);

-- =====================================================================
-- STEP 2: Create default competition and migrate existing data
-- =====================================================================

-- Create a default competition for existing data
INSERT INTO competitions (id, name, description, season_id, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'World Cup 2026',
  'Default competition (migrated from single-competition setup)',
  2398,
  NOW()
)
ON CONFLICT DO NOTHING;

-- =====================================================================
-- STEP 3: Add competition_id columns to existing tables
-- =====================================================================

-- Add competition_id to invite_codes
ALTER TABLE invite_codes 
ADD COLUMN IF NOT EXISTS competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE;

-- Set default competition for existing invite codes
UPDATE invite_codes 
SET competition_id = '00000000-0000-0000-0000-000000000001'
WHERE competition_id IS NULL;

-- Make competition_id NOT NULL after migration
ALTER TABLE invite_codes 
ALTER COLUMN competition_id SET NOT NULL;

-- Add competition_id to predictions
ALTER TABLE predictions 
ADD COLUMN IF NOT EXISTS competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE;

-- Set default competition for existing predictions
UPDATE predictions 
SET competition_id = '00000000-0000-0000-0000-000000000001'
WHERE competition_id IS NULL;

-- Make competition_id NOT NULL after migration
ALTER TABLE predictions 
ALTER COLUMN competition_id SET NOT NULL;

-- Add competition_id to group_standings_overrides
ALTER TABLE group_standings_overrides 
ADD COLUMN IF NOT EXISTS competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE;

-- Set default competition for existing overrides
UPDATE group_standings_overrides 
SET competition_id = '00000000-0000-0000-0000-000000000001'
WHERE competition_id IS NULL;

-- Make competition_id NOT NULL after migration
ALTER TABLE group_standings_overrides 
ALTER COLUMN competition_id SET NOT NULL;

-- =====================================================================
-- STEP 4: Migrate tournament_settings to per-competition
-- =====================================================================

-- Get existing settings values
DO $$
DECLARE
  v_group_stage_locked BOOLEAN;
  v_knockout_stage_open BOOLEAN;
  v_knockout_stage_locked BOOLEAN;
BEGIN
  -- Get existing settings
  SELECT group_stage_locked, knockout_stage_open, knockout_stage_locked
  INTO v_group_stage_locked, v_knockout_stage_open, v_knockout_stage_locked
  FROM tournament_settings
  WHERE id = 1;

  -- Drop the old singleton constraint if it exists
  ALTER TABLE tournament_settings DROP CONSTRAINT IF EXISTS tournament_settings_pkey;
  ALTER TABLE tournament_settings DROP CONSTRAINT IF EXISTS tournament_settings_id_check;
  
  -- Drop the id column
  ALTER TABLE tournament_settings DROP COLUMN IF EXISTS id;
  
  -- Add competition_id as primary key
  ALTER TABLE tournament_settings 
  ADD COLUMN IF NOT EXISTS competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE;
  
  -- If we had existing settings, migrate them
  IF v_group_stage_locked IS NOT NULL THEN
    DELETE FROM tournament_settings;
    INSERT INTO tournament_settings (competition_id, group_stage_locked, knockout_stage_open, knockout_stage_locked)
    VALUES (
      '00000000-0000-0000-0000-000000000001',
      v_group_stage_locked,
      v_knockout_stage_open,
      v_knockout_stage_locked
    );
  ELSE
    -- Create default settings for the default competition
    INSERT INTO tournament_settings (competition_id, group_stage_locked, knockout_stage_open, knockout_stage_locked)
    VALUES ('00000000-0000-0000-0000-000000000001', false, false, false)
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- Make competition_id the primary key
  ALTER TABLE tournament_settings 
  ADD PRIMARY KEY (competition_id);
END $$;

-- =====================================================================
-- STEP 5: Update unique constraints
-- =====================================================================

-- Drop old unique constraints
ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_user_id_match_id_key;
ALTER TABLE group_standings_overrides DROP CONSTRAINT IF EXISTS group_standings_overrides_user_id_group_name_team_id_key;

-- Add new unique constraints with competition_id
ALTER TABLE predictions 
ADD CONSTRAINT predictions_user_competition_match_key 
UNIQUE (user_id, competition_id, match_id);

ALTER TABLE group_standings_overrides 
ADD CONSTRAINT overrides_user_competition_group_team_key 
UNIQUE (user_id, competition_id, group_name, team_id);

-- =====================================================================
-- STEP 6: Add competition members for existing users with predictions
-- =====================================================================

-- Add all users who have predictions to the default competition
INSERT INTO competition_members (user_id, competition_id, joined_at)
SELECT DISTINCT user_id, '00000000-0000-0000-0000-000000000001'::uuid, NOW()
FROM predictions
ON CONFLICT DO NOTHING;

-- Also add users who used invite codes
INSERT INTO competition_members (user_id, competition_id, joined_at)
SELECT DISTINCT used_by, '00000000-0000-0000-0000-000000000001'::uuid, NOW()
FROM invite_codes
WHERE used_by IS NOT NULL
ON CONFLICT DO NOTHING;

-- =====================================================================
-- STEP 7: Create new indexes
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_predictions_competition_id ON predictions(competition_id);
CREATE INDEX IF NOT EXISTS idx_predictions_user_competition ON predictions(user_id, competition_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_competition ON invite_codes(competition_id);
CREATE INDEX IF NOT EXISTS idx_group_standings_competition ON group_standings_overrides(competition_id);
CREATE INDEX IF NOT EXISTS idx_competition_members_user ON competition_members(user_id);
CREATE INDEX IF NOT EXISTS idx_competition_members_competition ON competition_members(competition_id);

-- =====================================================================
-- STEP 8: Add triggers for new tables
-- =====================================================================

CREATE TRIGGER update_competitions_updated_at
  BEFORE UPDATE ON competitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================
-- STEP 9: Enable RLS on new tables and add policies
-- =====================================================================

ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_members ENABLE ROW LEVEL SECURITY;

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

-- =====================================================================
-- STEP 10: Update existing RLS policies for predictions
-- =====================================================================

-- Drop old policies that reference old tournament_settings structure
DROP POLICY IF EXISTS "Public predictions after stage starts" ON predictions;
DROP POLICY IF EXISTS "Public overrides after group stage starts" ON group_standings_overrides;

-- Create new policies with competition support
CREATE POLICY "Public predictions after stage starts" ON predictions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tournament_settings ts
      WHERE ts.competition_id = predictions.competition_id
      AND (ts.group_stage_locked = true OR ts.knockout_stage_locked = true)
    )
  );

CREATE POLICY "Public overrides after group stage starts" ON group_standings_overrides
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tournament_settings ts
      WHERE ts.competition_id = group_standings_overrides.competition_id
      AND ts.group_stage_locked = true
    )
  );

-- Update predictions insert policy to check membership
DROP POLICY IF EXISTS "Users can insert own predictions" ON predictions;
CREATE POLICY "Users can insert own predictions" ON predictions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM competition_members 
      WHERE user_id = auth.uid() AND competition_id = predictions.competition_id
    )
  );

-- =====================================================================
-- DONE! Migration complete.
-- =====================================================================
