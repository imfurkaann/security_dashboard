-- Visitor module integrity and high-volume query support.

BEGIN;

-- Recover the three historical exited rows that have a date but no time.
-- updated_at was written by the original exit operation and is the best available source.
UPDATE visitor_records
SET exit_time = COALESCE(updated_at::time, entry_time)
WHERE deleted_at IS NULL
  AND status = 'exited'
  AND exit_date IS NOT NULL
  AND exit_time IS NULL;

-- This foreign key already uses ON DELETE SET NULL; the column must permit it.
ALTER TABLE visitor_records
ALTER COLUMN entry_by DROP NOT NULL;

ALTER TABLE visitor_records
ALTER COLUMN status SET NOT NULL,
ALTER COLUMN person_count SET DEFAULT 1,
ALTER COLUMN person_count SET NOT NULL;

ALTER TABLE visitor_records
DROP CONSTRAINT IF EXISTS visitor_records_exit_state_check;

ALTER TABLE visitor_records
ADD CONSTRAINT visitor_records_exit_state_check
CHECK (
    (status = 'inside' AND exit_date IS NULL AND exit_time IS NULL)
    OR
    (status = 'exited' AND exit_date IS NOT NULL AND exit_time IS NOT NULL)
);

ALTER TABLE visitor_records
DROP CONSTRAINT IF EXISTS visitor_records_exit_after_entry_check;

ALTER TABLE visitor_records
ADD CONSTRAINT visitor_records_exit_after_entry_check
CHECK (exit_date IS NULL OR exit_date >= entry_date);

CREATE INDEX IF NOT EXISTS idx_visitor_records_entry_datetime_id
ON visitor_records(entry_date DESC, entry_time DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_visitor_records_exit_datetime_id
ON visitor_records(exit_date DESC, exit_time DESC, id DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_visitor_records_status_entry_datetime
ON visitor_records(status, entry_date DESC, entry_time DESC, id DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_visitor_records_gate_entry_datetime
ON visitor_records(gate, entry_date DESC, entry_time DESC, id DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_visitor_records_deleted_at_id
ON visitor_records(deleted_at DESC, id DESC)
WHERE deleted_at IS NOT NULL;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_visitor_records_full_name_trgm
ON visitor_records
USING gin (lower(translate(full_name, 'IİĞÜŞÖÇ', 'ıiğüşöç')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_visitor_records_company_name_trgm
ON visitor_records
USING gin (lower(translate(company_name, 'IİĞÜŞÖÇ', 'ıiğüşöç')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_visitor_records_visiting_person_trgm
ON visitor_records
USING gin (lower(translate(visiting_person, 'IİĞÜŞÖÇ', 'ıiğüşöç')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_visitor_records_plate_trgm
ON visitor_records
USING gin (lower(translate(vehicle_plate, 'IİĞÜŞÖÇ', 'ıiğüşöç')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_visitor_records_phone_trgm
ON visitor_records
USING gin (lower(phone) gin_trgm_ops);

COMMIT;
