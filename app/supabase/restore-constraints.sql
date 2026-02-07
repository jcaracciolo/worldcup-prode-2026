-- Restore FK Constraints
-- Run this after you're done testing with mock users
-- WARNING: This will fail if mock users still exist (they don't have auth.users entries)

-- =====================================================================
-- STEP 1: Delete mock users first (they can't satisfy the FK constraint)
-- =====================================================================

-- Delete predictions for mock users (emails ending in @test.local)
DELETE FROM predictions 
WHERE user_id IN (
  SELECT id FROM profiles WHERE email LIKE '%@test.local'
);

-- Delete group_standings_overrides for mock users
DELETE FROM group_standings_overrides 
WHERE user_id IN (
  SELECT id FROM profiles WHERE email LIKE '%@test.local'
);

-- Delete the mock profiles
DELETE FROM profiles WHERE email LIKE '%@test.local';

-- =====================================================================
-- STEP 2: Restore the FK constraint
-- =====================================================================

-- Restore profiles -> auth.users FK constraint
ALTER TABLE profiles 
ADD CONSTRAINT profiles_id_fkey 
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- =====================================================================
-- VERIFY
-- =====================================================================

-- Check remaining profiles (should only be real auth users)
SELECT id, email, display_name FROM profiles;

-- Check constraint is restored
SELECT 
  tc.constraint_name, 
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'profiles';
