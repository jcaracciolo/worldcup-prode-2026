-- SEED TEST USERS SCRIPT
-- Generates test users for every competition with complete predictions
-- Run this in Supabase SQL Editor
-- WARNING: Only for development/testing!
-- 
-- This script:
-- 1. Creates test users for each competition
-- 2. Adds them as competition members
-- 3. Generates predictions for all matches (group + knockout)
--
-- NOTE: Group standings overrides are NOT created by this script because
-- they require real team IDs from the football API. Users can adjust
-- standings manually in the UI after the data is fetched.

-- =====================================================================
-- STEP 1: DROP FOREIGN KEY CONSTRAINT (if not already dropped)
-- =====================================================================
-- Allows creating profiles without corresponding auth.users entries

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- =====================================================================
-- STEP 2: CLEAN UP EXISTING TEST DATA
-- =====================================================================

-- Delete predictions for test users
DELETE FROM predictions 
WHERE user_id IN (SELECT id FROM profiles WHERE email LIKE '%@test.local');

-- Delete group standings overrides for test users
DELETE FROM group_standings_overrides 
WHERE user_id IN (SELECT id FROM profiles WHERE email LIKE '%@test.local');

-- Delete competition memberships for test users
DELETE FROM competition_members 
WHERE user_id IN (SELECT id FROM profiles WHERE email LIKE '%@test.local');

-- Delete test profiles
DELETE FROM profiles 
WHERE email LIKE '%@test.local';

-- =====================================================================
-- STEP 3: CREATE TEST USERS FOR EACH COMPETITION
-- =====================================================================
-- Creates 15 diverse test users per competition with varied predictions
-- Names are themed to make them easily identifiable

DO $$
DECLARE
  -- User name templates (15 users per competition)
  test_users TEXT[] := ARRAY[
    'Messi_Fan',
    'Ronaldo_Jr', 
    'Zidane_Magic',
    'Pele_Legend',
    'Maradona_10',
    'Beckham_Bend',
    'Cruyff_Turn',
    'Platini_Ace',
    'Muller_Goal',
    'Kahn_Wall',
    'Buffon_Safe',
    'Xavi_Pass',
    'Iniesta_Mag',
    'Modric_Mid',
    'Kane_Strike'
  ];
  
  comp RECORD;
  user_name TEXT;
  user_uuid UUID;
  fifa_match_id INTEGER;
  home_goals INTEGER;
  away_goals INTEGER;
  winner_choice INTEGER;
  user_seed INTEGER;
  user_idx INTEGER;
  comp_idx INTEGER := 0;
BEGIN
  -- Loop through all competitions
  FOR comp IN SELECT id, name FROM competitions LOOP
    comp_idx := comp_idx + 1;
    user_idx := 0;
    
    RAISE NOTICE 'Creating users for competition: % (%)', comp.name, comp.id;
    
    -- Create users for this competition
    FOREACH user_name IN ARRAY test_users LOOP
      user_idx := user_idx + 1;
      user_uuid := uuid_generate_v4();
      
      -- Create unique seed for varied predictions
      -- Combines user index, competition index, and a prime for distribution
      user_seed := (user_idx * 7919) + (comp_idx * 3571);
      
      -- Insert profile
      INSERT INTO profiles (id, email, display_name, is_admin)
      VALUES (
        user_uuid, 
        LOWER(REPLACE(user_name, ' ', '_')) || '_' || comp_idx || '@test.local', 
        user_name || ' #' || comp_idx, 
        FALSE
      );
      
      -- Add to competition
      INSERT INTO competition_members (user_id, competition_id, joined_at)
      VALUES (user_uuid, comp.id, NOW());
      
      -- =====================================================================
      -- Generate GROUP STAGE predictions (FIFA matches 1-72)
      -- Each group has 3 matches per team, 6 matches total
      -- 48 teams / 4 per group = 12 groups
      -- 12 groups × 6 matches = 72 group stage matches
      -- =====================================================================
      
      FOR fifa_match_id IN 1..72 LOOP
        -- Generate varied scores based on user seed and match
        -- Different formulas create diverse prediction patterns
        home_goals := ABS((user_seed + fifa_match_id * 13 + user_idx * 7) % 5);
        away_goals := ABS((user_seed * 3 + fifa_match_id * 17 + user_idx * 11) % 5);
        
        -- Some users tend to predict more goals, others fewer
        IF user_idx % 3 = 0 THEN
          home_goals := LEAST(home_goals + 1, 6);
          away_goals := LEAST(away_goals + 1, 5);
        ELSIF user_idx % 3 = 1 THEN
          home_goals := GREATEST(home_goals - 1, 0);
          away_goals := GREATEST(away_goals - 1, 0);
        END IF;
        
        INSERT INTO predictions (user_id, competition_id, match_id, home_goals, away_goals)
        VALUES (user_uuid, comp.id, fifa_match_id, home_goals, away_goals);
      END LOOP;
      
      -- =====================================================================
      -- Generate KNOCKOUT STAGE predictions (FIFA matches 73-104)
      -- 73-88: Round of 32 (16 matches)
      -- 89-96: Round of 16 (8 matches)
      -- 97-100: Quarter-finals (4 matches)
      -- 101-102: Semi-finals (2 matches)
      -- 103: Third place play-off (1 match)
      -- 104: Final (1 match)
      -- =====================================================================
      
      FOR fifa_match_id IN 73..104 LOOP
        -- Generate knockout scores (typically lower scoring)
        home_goals := ABS((user_seed + fifa_match_id * 23 + user_idx * 5) % 4);
        away_goals := ABS((user_seed * 2 + fifa_match_id * 19 + user_idx * 13) % 4);
        
        -- For knockout, we may need to pick a winner if it's a draw
        -- For knockout ties, pick HOME or AWAY as penalty winner
        
        -- Make some predictions draws to test extra time/penalties scenarios
        IF fifa_match_id % 7 = user_idx % 7 THEN
          away_goals := home_goals; -- Force a draw
          -- Pick winner: home (1) or away (2) for penalty simulation
          winner_choice := ((user_seed + fifa_match_id) % 2) + 1;
        ELSE
          winner_choice := NULL; -- Clear winner from score
        END IF;
        
        INSERT INTO predictions (user_id, competition_id, match_id, home_goals, away_goals, penalty_winner)
        VALUES (
          user_uuid, comp.id, fifa_match_id, home_goals, away_goals,
          CASE WHEN winner_choice = 1 THEN 'HOME' WHEN winner_choice = 2 THEN 'AWAY' ELSE NULL END
        );
      END LOOP;
      
      RAISE NOTICE '  Created user: % with 104 predictions', user_name;
    END LOOP;
    
    RAISE NOTICE 'Completed competition: % - % users created', comp.name, array_length(test_users, 1);
  END LOOP;
END $$;

-- =====================================================================
-- STEP 4: VERIFICATION QUERIES
-- =====================================================================

-- Show user count per competition
SELECT 
  c.name as competition_name,
  COUNT(DISTINCT cm.user_id) as user_count
FROM competitions c
LEFT JOIN competition_members cm ON c.id = cm.competition_id
LEFT JOIN profiles p ON cm.user_id = p.id AND p.email LIKE '%@test.local'
WHERE p.id IS NOT NULL
GROUP BY c.id, c.name
ORDER BY c.name;

-- Show prediction stats per user
SELECT 
  p.display_name,
  c.name as competition,
  COUNT(pr.id) as total_predictions,
  COUNT(CASE WHEN pr.match_id <= 72 THEN 1 END) as group_predictions,
  COUNT(CASE WHEN pr.match_id > 72 THEN 1 END) as knockout_predictions,
  ROUND(AVG(pr.home_goals + pr.away_goals), 2) as avg_total_goals
FROM profiles p
JOIN competition_members cm ON p.id = cm.user_id
JOIN competitions c ON cm.competition_id = c.id
LEFT JOIN predictions pr ON p.id = pr.user_id AND c.id = pr.competition_id
WHERE p.email LIKE '%@test.local'
GROUP BY p.id, p.display_name, c.id, c.name
ORDER BY c.name, p.display_name
LIMIT 50;

-- Sample predictions for verification
SELECT 
  p.display_name,
  pr.match_id,
  pr.home_goals,
  pr.away_goals,
  CASE 
    WHEN pr.match_id <= 72 THEN 'Group Stage'
    WHEN pr.match_id <= 88 THEN 'Round of 32'
    WHEN pr.match_id <= 96 THEN 'Round of 16'
    WHEN pr.match_id <= 100 THEN 'Quarter-finals'
    WHEN pr.match_id <= 102 THEN 'Semi-finals'
    WHEN pr.match_id = 103 THEN 'Third Place'
    ELSE 'Final'
  END as stage
FROM predictions pr
JOIN profiles p ON pr.user_id = p.id
WHERE p.email LIKE '%@test.local'
ORDER BY p.display_name, pr.match_id
LIMIT 30;

-- =====================================================================
-- NOTES
-- =====================================================================
-- 
-- To restore the foreign key constraint after testing:
-- 1. Delete test predictions: DELETE FROM predictions WHERE user_id IN (SELECT id FROM profiles WHERE email LIKE '%@test.local');
-- 2. Delete test overrides: DELETE FROM group_standings_overrides WHERE user_id IN (SELECT id FROM profiles WHERE email LIKE '%@test.local');
-- 3. Delete test memberships: DELETE FROM competition_members WHERE user_id IN (SELECT id FROM profiles WHERE email LIKE '%@test.local');
-- 4. Delete test profiles: DELETE FROM profiles WHERE email LIKE '%@test.local';
-- 5. Restore constraint: ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
--
-- Group standings overrides:
-- This script does NOT create group_standings_overrides because they require
-- real team IDs from the football-data.org API. These IDs are only known at
-- runtime when matches are fetched. Users can manually adjust group standings
-- in the UI after viewing their predictions.

