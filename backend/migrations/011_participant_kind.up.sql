-- Human vs agent participants + optional display metadata (no secrets).
-- Idempotent for existing databases that already ran 010_competitions.up.sql

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS participant_kind TEXT NOT NULL DEFAULT 'human';

ALTER TABLE participants
  DROP CONSTRAINT IF EXISTS participants_participant_kind_check;

ALTER TABLE participants
  ADD CONSTRAINT participants_participant_kind_check
  CHECK (participant_kind IN ('human', 'agent'));

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
