-- Migration: winner_id (INTEGER) → penalty_winner (TEXT 'HOME'|'AWAY')
--
-- Instead of storing a team ID for knockout tie resolution, store
-- whether the home or away side wins on penalties. This decouples
-- the prediction from bracket resolution entirely.
--
-- Run: psql or Supabase SQL editor

-- 1. Add new column
ALTER TABLE predictions
  ADD COLUMN penalty_winner TEXT CHECK (penalty_winner IN ('HOME', 'AWAY'));

-- 2. Drop old column (winner_id was always NULL in seed data — safe to drop)
ALTER TABLE predictions
  DROP COLUMN winner_id;
