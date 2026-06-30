-- Migration: Per-match knockout prediction visibility (extended bracket window)
--
-- WHY: The knockout bracket now locks per-match. The first match (#73) locks &
-- reveals at its kickoff (2026-06-28 19:00 UTC), while the rest of the bracket
-- stays editable — and hidden — until the bracket deadline
-- (2026-06-29 17:00 UTC). The previous policy revealed ALL knockout predictions
-- (match_id > 72) at 2026-06-28 21:00 UTC, which would leak still-editable
-- brackets during the extra editing day.
--
-- These timestamps MUST stay in sync with lib/time.ts:
--   KNOCKOUT_START    = 2026-06-28T19:00:00Z  (first match #73 kickoff)
--   KNOCKOUT_DEADLINE = 2026-06-29T17:00:00Z  (rest of bracket)
--
-- HOW TO APPLY: run in the Supabase SQL editor / psql against the project DB.
--
-- ⚠️ AUDIT FIRST: the repo SQL files are inconsistent (base schema.sql vs prior
-- migrations). Before running, confirm the live SELECT policies on `predictions`
-- (e.g. `SELECT polname, qual FROM pg_policies WHERE tablename = 'predictions';`)
-- and adjust the DROP statements below to match the actual policy names.

-- =====================================================================
-- PREDICTIONS — per-match knockout reveal
-- =====================================================================

-- Remove any prior time/stage based reveal policies (idempotent).
DROP POLICY IF EXISTS "Predictions visible after stage locks" ON predictions;
-- Boolean/stage-flag based reveal from the original schema. We drop it so an
-- admin toggling tournament_settings.knockout_stage_locked can't reveal the
-- whole bracket early during the extended editing window. (Group + knockout
-- reveal is fully covered by the timestamp policy below.)
DROP POLICY IF EXISTS "Public predictions after stage starts" ON predictions;
DROP POLICY IF EXISTS "Anyone can view all predictions" ON predictions;

-- Per-match timestamp reveal:
--   - group stage (match_id <= 72): visible after group stage starts
--   - first knockout match (#73):   visible at its kickoff (Jun 28 19:00Z)
--   - rest of knockout (> 73):      visible at the bracket deadline (Jun 29 17:00Z)
-- Users always see their own predictions via "Users can view own predictions".
CREATE POLICY "Predictions visible after stage locks" ON predictions
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      (match_id <= 72 AND now() >= '2026-06-11T18:00:00Z'::timestamptz)
      OR
      (match_id = 73 AND now() >= '2026-06-28T19:00:00Z'::timestamptz)
      OR
      (match_id > 73 AND now() >= '2026-06-29T17:00:00Z'::timestamptz)
    )
  );

-- Admins can always see all predictions (idempotent re-create).
DROP POLICY IF EXISTS "Admins can view all predictions" ON predictions;
CREATE POLICY "Admins can view all predictions" ON predictions
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM profiles WHERE is_admin = true)
  );

-- Note: write policies (INSERT/UPDATE/DELETE) are unchanged — knockout write
-- locking remains enforced client-side, matching prior behavior.
