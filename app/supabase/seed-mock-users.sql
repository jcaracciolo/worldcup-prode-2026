-- NUCLEAR OPTION: Create mock users with predictions
-- Run this in Supabase SQL Editor
-- WARNING: Only for development/testing!

-- =====================================================================
-- CONSTRAINTS BEING MODIFIED
-- =====================================================================
-- The following constraint is DROPPED by this script:
--
-- TABLE: profiles
-- CONSTRAINT: profiles_id_fkey
-- DEFINITION: id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY
-- PURPOSE: Links profiles to Supabase Auth users
--
-- To restore (run restore-constraints.sql or the command at the bottom):
-- ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey 
--   FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- =====================================================================

-- Step 1: Drop the FK constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Step 2: Create mock users and their predictions
DO $$
DECLARE
  mock_users TEXT[] := ARRAY['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivan', 'Julia'];
  user_name TEXT;
  user_uuid UUID;
  match_id_val INTEGER;
  home_goals INTEGER;
  away_goals INTEGER;
  user_seed INTEGER;
  i INTEGER := 0;
BEGIN
  FOREACH user_name IN ARRAY mock_users
  LOOP
    i := i + 1;
    user_uuid := uuid_generate_v4();
    user_seed := i * 7919; -- Prime number for better distribution
    
    -- Insert mock profile
    INSERT INTO profiles (id, email, display_name, is_admin)
    VALUES (user_uuid, LOWER(user_name) || '@test.local', user_name, FALSE);
    
    -- Generate predictions for group stage matches (1-72)
    FOR match_id_val IN 1..72 LOOP
      -- Generate varied scores using different formulas per user
      home_goals := ((user_seed + match_id_val * 13) % 6);
      away_goals := ((user_seed * 3 + match_id_val * 17) % 6);
      
      -- Cap at 5 goals max
      home_goals := LEAST(home_goals, 5);
      away_goals := LEAST(away_goals, 5);
      
      INSERT INTO predictions (user_id, match_id, home_goals, away_goals)
      VALUES (user_uuid, match_id_val, home_goals, away_goals);
    END LOOP;
    
    RAISE NOTICE 'Created user: % (%) with 72 predictions', user_name, user_uuid;
  END LOOP;
END $$;

-- Step 3: Verify the data
SELECT 
  p.display_name,
  p.email,
  COUNT(pr.id) as predictions
FROM profiles p
LEFT JOIN predictions pr ON p.id = pr.user_id
GROUP BY p.id, p.display_name, p.email
ORDER BY p.display_name;

-- =====================================================================
-- TO RESTORE CONSTRAINTS AND CLEAN UP
-- =====================================================================
-- Run: supabase/restore-constraints.sql
-- 
-- Or manually:
-- 1. DELETE FROM predictions WHERE user_id IN (SELECT id FROM profiles WHERE email LIKE '%@test.local');
-- 2. DELETE FROM profiles WHERE email LIKE '%@test.local';
-- 3. ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey 
--      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
