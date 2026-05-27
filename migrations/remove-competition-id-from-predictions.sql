-- Migration: Remove competition_id from predictions, group_standings_overrides, third_place_overrides
-- This makes predictions user-global (shared across all circuits)

-- =====================================================================
-- 1. PREDICTIONS
-- =====================================================================

-- Remove duplicates: keep the newest row per (user_id, match_id)
DELETE FROM predictions p1
USING predictions p2
WHERE p1.user_id = p2.user_id
  AND p1.match_id = p2.match_id
  AND p1.updated_at < p2.updated_at;

-- Also handle exact timestamp ties (keep lowest id)
DELETE FROM predictions p1
USING predictions p2
WHERE p1.user_id = p2.user_id
  AND p1.match_id = p2.match_id
  AND p1.updated_at = p2.updated_at
  AND p1.id > p2.id;

-- Drop old unique constraint
ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_user_id_competition_id_match_id_key;

-- Drop competition_id column
ALTER TABLE predictions DROP COLUMN competition_id;

-- Add new unique constraint
ALTER TABLE predictions ADD CONSTRAINT predictions_user_id_match_id_key UNIQUE (user_id, match_id);

-- =====================================================================
-- 2. GROUP_STANDINGS_OVERRIDES
-- =====================================================================

-- Remove duplicates: keep newest per (user_id, group_name, team_id)
DELETE FROM group_standings_overrides o1
USING group_standings_overrides o2
WHERE o1.user_id = o2.user_id
  AND o1.group_name = o2.group_name
  AND o1.team_id = o2.team_id
  AND o1.updated_at < o2.updated_at;

DELETE FROM group_standings_overrides o1
USING group_standings_overrides o2
WHERE o1.user_id = o2.user_id
  AND o1.group_name = o2.group_name
  AND o1.team_id = o2.team_id
  AND o1.updated_at = o2.updated_at
  AND o1.id > o2.id;

-- Drop old unique constraint
ALTER TABLE group_standings_overrides DROP CONSTRAINT IF EXISTS group_standings_overrides_user_id_competition_id_group_name_key;

-- Drop competition_id column
ALTER TABLE group_standings_overrides DROP COLUMN competition_id;

-- Add new unique constraint
ALTER TABLE group_standings_overrides ADD CONSTRAINT group_standings_overrides_user_id_group_name_team_id_key UNIQUE (user_id, group_name, team_id);

-- =====================================================================
-- 3. THIRD_PLACE_OVERRIDES
-- =====================================================================

-- Remove duplicates: keep newest per (user_id, group_name)
DELETE FROM third_place_overrides o1
USING third_place_overrides o2
WHERE o1.user_id = o2.user_id
  AND o1.group_name = o2.group_name
  AND o1.updated_at < o2.updated_at;

DELETE FROM third_place_overrides o1
USING third_place_overrides o2
WHERE o1.user_id = o2.user_id
  AND o1.group_name = o2.group_name
  AND o1.updated_at = o2.updated_at
  AND o1.id > o2.id;

-- Drop old unique constraint
ALTER TABLE third_place_overrides DROP CONSTRAINT IF EXISTS third_place_overrides_user_id_competition_id_group_name_key;

-- Drop competition_id column
ALTER TABLE third_place_overrides DROP COLUMN competition_id;

-- Add new unique constraint
ALTER TABLE third_place_overrides ADD CONSTRAINT third_place_overrides_user_id_group_name_key UNIQUE (user_id, group_name);
