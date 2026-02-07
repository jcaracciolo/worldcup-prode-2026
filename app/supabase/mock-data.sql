-- WorldCupProde Mock Data Generator
-- ====================================
-- 
-- IMPORTANT: Run this AFTER creating test users via Supabase Auth
-- The profiles table has a FK to auth.users, so you need real auth users first.
--
-- Option 1: Create users via signup page with invite codes
-- Option 2: Create users via Supabase Dashboard > Authentication > Users
-- Option 3: Use the workaround at the bottom to bypass FK (development only!)

-- =====================================================================
-- STEP 1: Get existing user IDs
-- Run this first to see what users you have:
-- =====================================================================
SELECT id, email, display_name FROM profiles;

-- =====================================================================
-- STEP 2: Generate predictions for existing users
-- Replace the user_id values with actual UUIDs from STEP 1
-- =====================================================================

-- Function to generate random predictions for a user
-- This creates predictions for all 72 group stage matches
CREATE OR REPLACE FUNCTION generate_mock_predictions(
  p_user_id UUID,
  p_seed INTEGER DEFAULT 12345
) RETURNS void AS $$
DECLARE
  match_record RECORD;
  home_goals INTEGER;
  away_goals INTEGER;
  rand_val FLOAT;
BEGIN
  -- Get all matches from cache
  FOR match_record IN 
    SELECT match_id FROM matches_cache ORDER BY match_id
  LOOP
    -- Generate pseudo-random scores based on seed + match_id
    rand_val := (p_seed + match_record.match_id) % 100 / 100.0;
    
    -- Generate realistic scores (0-4 goals each side)
    home_goals := FLOOR(rand_val * 5);
    away_goals := FLOOR(((p_seed * 3 + match_record.match_id * 7) % 100) / 100.0 * 5);
    
    -- Insert or update prediction
    INSERT INTO predictions (user_id, match_id, home_goals, away_goals)
    VALUES (p_user_id, match_record.match_id, home_goals, away_goals)
    ON CONFLICT (user_id, match_id) 
    DO UPDATE SET home_goals = EXCLUDED.home_goals, away_goals = EXCLUDED.away_goals, updated_at = NOW();
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Example usage (replace with actual user UUIDs):
-- SELECT generate_mock_predictions('your-user-uuid-here'::uuid, 12345);
-- SELECT generate_mock_predictions('another-user-uuid'::uuid, 54321);

-- =====================================================================
-- STEP 3: Quick mock data for development/testing
-- This bypasses the FK constraint - USE ONLY IN DEVELOPMENT!
-- =====================================================================

-- Create mock users directly (bypasses auth.users FK)
-- WARNING: Only run this in development! These users can't login.
DO $$
DECLARE
  mock_users TEXT[] := ARRAY['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];
  user_name TEXT;
  user_uuid UUID;
  match_record RECORD;
  home_goals INTEGER;
  away_goals INTEGER;
  user_seed INTEGER;
  i INTEGER := 0;
BEGIN
  -- Temporarily disable FK constraint (if it exists)
  -- ALTER TABLE profiles DISABLE TRIGGER ALL;
  
  FOREACH user_name IN ARRAY mock_users
  LOOP
    i := i + 1;
    user_uuid := uuid_generate_v4();
    user_seed := i * 12345;
    
    -- Try to insert mock profile (may fail due to FK constraint)
    BEGIN
      INSERT INTO profiles (id, email, display_name, is_admin)
      VALUES (user_uuid, user_name || '@test.com', user_name, FALSE)
      ON CONFLICT (id) DO NOTHING;
      
      -- Generate predictions for this user
      FOR match_record IN 
        SELECT match_id FROM matches_cache ORDER BY match_id
      LOOP
        home_goals := ((user_seed + match_record.match_id) % 5);
        away_goals := ((user_seed * 3 + match_record.match_id * 7) % 5);
        
        INSERT INTO predictions (user_id, match_id, home_goals, away_goals)
        VALUES (user_uuid, match_record.match_id, home_goals, away_goals)
        ON CONFLICT (user_id, match_id) DO NOTHING;
      END LOOP;
      
      RAISE NOTICE 'Created mock user: % with % predictions', user_name, (SELECT COUNT(*) FROM predictions WHERE user_id = user_uuid);
    EXCEPTION WHEN foreign_key_violation THEN
      RAISE NOTICE 'Could not create user % - FK constraint active. Use Supabase Auth instead.', user_name;
    END;
  END LOOP;
  
  -- Re-enable FK constraint
  -- ALTER TABLE profiles ENABLE TRIGGER ALL;
END $$;

-- =====================================================================
-- ALTERNATIVE: Insert predictions for your EXISTING users
-- Run STEP 1 first to get user UUIDs, then uncomment and edit below
-- =====================================================================

/*
-- Replace these UUIDs with real ones from your profiles table
DO $$
DECLARE
  users UUID[] := ARRAY[
    '11111111-1111-1111-1111-111111111111'::uuid,  -- Replace with real UUID
    '22222222-2222-2222-2222-222222222222'::uuid   -- Replace with real UUID
  ];
  user_uuid UUID;
  match_record RECORD;
  home_goals INTEGER;
  away_goals INTEGER;
  user_seed INTEGER;
  i INTEGER := 0;
BEGIN
  FOREACH user_uuid IN ARRAY users
  LOOP
    i := i + 1;
    user_seed := i * 12345;
    
    FOR match_record IN 
      SELECT match_id FROM matches_cache ORDER BY match_id
    LOOP
      home_goals := ((user_seed + match_record.match_id) % 5);
      away_goals := ((user_seed * 3 + match_record.match_id * 7) % 5);
      
      INSERT INTO predictions (user_id, match_id, home_goals, away_goals)
      VALUES (user_uuid, match_record.match_id, home_goals, away_goals)
      ON CONFLICT (user_id, match_id) 
      DO UPDATE SET home_goals = EXCLUDED.home_goals, away_goals = EXCLUDED.away_goals, updated_at = NOW();
    END LOOP;
    
    RAISE NOTICE 'Generated predictions for user %', user_uuid;
  END LOOP;
END $$;
*/

-- =====================================================================
-- NUCLEAR OPTION: Disable FK constraint to create mock users
-- ONLY FOR LOCAL DEVELOPMENT - NEVER IN PRODUCTION!
-- =====================================================================

/*
-- Step 1: Disable the FK constraint
ALTER TABLE profiles DROP CONSTRAINT profiles_id_fkey;

-- Step 2: Run the mock user creation block above

-- Step 3: Re-enable the FK constraint
-- ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey 
--   FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
*/

-- =====================================================================
-- Verify data
-- =====================================================================
SELECT 
  p.display_name,
  COUNT(pr.id) as prediction_count
FROM profiles p
LEFT JOIN predictions pr ON p.id = pr.user_id
GROUP BY p.id, p.display_name
ORDER BY p.display_name;
