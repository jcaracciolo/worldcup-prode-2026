-- Migration: Fix prediction visibility RLS
-- Predictions should be secret until the corresponding stage locks:
--   - Group predictions (match_id 1-72): visible after June 11, 2026 18:00 UTC
--   - Knockout predictions (match_id 73+): visible after June 28, 2026 21:00 UTC
-- Users can always see their own predictions regardless.
-- These dates match the hardcoded constants in lib/time.ts.

-- =====================================================================
-- 1. PREDICTIONS
-- =====================================================================

-- Remove blanket public access (this was the bug)
DROP POLICY IF EXISTS "Anyone can view all predictions" ON predictions;

-- Remove stale leftover policy from original schema
DROP POLICY IF EXISTS "Users can update own predictions when not locked" ON predictions;

-- Add time-based visibility: others' predictions visible only after stage locks
CREATE POLICY "Predictions visible after stage locks" ON predictions
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      -- Group stage predictions visible after group stage starts
      (match_id <= 72 AND now() >= '2026-06-11T18:00:00Z'::timestamptz)
      OR
      -- Knockout predictions visible after knockout stage starts
      (match_id > 72 AND now() >= '2026-06-28T21:00:00Z'::timestamptz)
    )
  );
-- Admins can always see all predictions (needed for user management panel)
CREATE POLICY "Admins can view all predictions" ON predictions
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM profiles WHERE is_admin = true)
  );

-- Note: "Users can view own predictions" (auth.uid() = user_id) still exists,
-- so users always see their own predictions. RLS OR's permissive policies.

-- =====================================================================
-- 2. GROUP STANDINGS OVERRIDES
-- =====================================================================

-- Remove blanket public access
DROP POLICY IF EXISTS "Anyone can view all overrides" ON group_standings_overrides;

-- Overrides visible to authenticated users after group stage locks
CREATE POLICY "Overrides visible after group locks" ON group_standings_overrides
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND now() >= '2026-06-11T18:00:00Z'::timestamptz
  );
-- Admins can always see all overrides
CREATE POLICY "Admins can view all overrides" ON group_standings_overrides
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM profiles WHERE is_admin = true)
  );
-- Note: "Users can view own overrides" still exists for own-data access.

-- =====================================================================
-- 3. THIRD PLACE OVERRIDES
-- =====================================================================

-- Third place overrides visible after group stage locks
-- (only user-specific policies exist currently, this adds public visibility)
CREATE POLICY "Third place overrides visible after group locks" ON third_place_overrides
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND now() >= '2026-06-11T18:00:00Z'::timestamptz
  );
-- Admins can always see all third place overrides
CREATE POLICY "Admins can view all third place overrides" ON third_place_overrides
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM profiles WHERE is_admin = true)
  );
