-- RESET AND SEED SCRIPT
-- Drops all prediction data and mock users, regenerates mock data
-- PRESERVES: juanfrancoc@gmail.com and their predictions
-- Run this in Supabase SQL Editor
-- WARNING: Only for development/testing!

-- =====================================================================
-- STEP 1: DROP FOREIGN KEY CONSTRAINT
-- =====================================================================
-- The following constraint is DROPPED by this script:
--
-- TABLE: profiles
-- CONSTRAINT: profiles_id_fkey
-- DEFINITION: id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY
-- PURPOSE: Links profiles to Supabase Auth users
-- =====================================================================

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- =====================================================================
-- STEP 2: CLEAN UP EXISTING DATA (except preserved user)
-- =====================================================================

-- Delete predictions for all users EXCEPT the preserved user
DELETE FROM predictions 
WHERE user_id NOT IN (
  SELECT id FROM profiles WHERE email = 'juanfrancoc@gmail.com'
);

-- Delete group standings overrides for all users EXCEPT the preserved user
DELETE FROM group_standings_overrides 
WHERE user_id NOT IN (
  SELECT id FROM profiles WHERE email = 'juanfrancoc@gmail.com'
);

-- Delete profiles for all users EXCEPT the preserved user (and real auth users)
DELETE FROM profiles 
WHERE email != 'juanfrancoc@gmail.com'
  AND email LIKE '%@test.local';

-- =====================================================================
-- STEP 3: CREATE MOCK USERS WITH PREDICTIONS
-- NOTE: match_id now uses FIFA match numbers (1-104), NOT API IDs
-- =====================================================================

DO $$
DECLARE
  mock_users TEXT[] := ARRAY['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivan', 'Julia'];
  user_name TEXT;
  user_uuid UUID;
  fifa_match_id INTEGER;
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
    
    -- Generate predictions for group stage matches (FIFA 1-72)
    FOR fifa_match_id IN 1..72 LOOP
      -- Generate varied scores using different formulas per user
      home_goals := ((user_seed + fifa_match_id * 13) % 5);
      away_goals := ((user_seed * 3 + fifa_match_id * 17) % 4);
      
      INSERT INTO predictions (user_id, match_id, home_goals, away_goals)
      VALUES (user_uuid, fifa_match_id, home_goals, away_goals);
    END LOOP;
    
    RAISE NOTICE 'Created user: % (%) with 72 predictions using FIFA match IDs', user_name, user_uuid;
  END LOOP;
END $$;

-- =====================================================================
-- STEP 4: VERIFY THE DATA
-- =====================================================================

SELECT 
  p.display_name,
  p.email,
  COUNT(pr.id) as predictions,
  MIN(pr.match_id) as min_match_id,
  MAX(pr.match_id) as max_match_id
FROM profiles p
LEFT JOIN predictions pr ON p.id = pr.user_id
GROUP BY p.id, p.display_name, p.email
ORDER BY p.display_name;

-- =====================================================================
-- STEP 5: RESTORE CONSTRAINT
-- =====================================================================
-- Re-add the foreign key constraint
-- This will work because:
-- - Real users (like juanfrancoc@gmail.com) exist in auth.users
-- - Mock users have @test.local emails and are NOT in auth.users,
--   so you must leave the constraint dropped for dev/testing

-- UNCOMMENT ONLY IF ALL profiles are real auth users:
-- ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey 
--   FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- =====================================================================
-- TO FULLY RESTORE (when done testing):
-- =====================================================================
-- Run: supabase/restore-constraints.sql
-- 
-- Or manually:
-- 1. DELETE FROM predictions WHERE user_id IN (SELECT id FROM profiles WHERE email LIKE '%@test.local');
-- 2. DELETE FROM group_standings_overrides WHERE user_id IN (SELECT id FROM profiles WHERE email LIKE '%@test.local');  
-- 3. DELETE FROM profiles WHERE email LIKE '%@test.local';
-- 4. ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey 
--      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
