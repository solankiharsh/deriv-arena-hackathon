ALTER TABLE participants DROP CONSTRAINT IF EXISTS participants_participant_kind_check;
ALTER TABLE participants DROP COLUMN IF EXISTS metadata;
ALTER TABLE participants DROP COLUMN IF EXISTS participant_kind;
