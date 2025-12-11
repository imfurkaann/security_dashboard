-- Add recorded_by_name column to managers_records to persist the recorder's display name
ALTER TABLE managers_records ADD COLUMN IF NOT EXISTS recorded_by_name VARCHAR(200);

-- Populate existing rows using personnel table (if personnel table exists and has first_name/last_name)
UPDATE managers_records mr
SET recorded_by_name = concat(p.first_name, ' ', p.last_name)
FROM personnel p
WHERE mr.recorded_by = p.id AND mr.recorded_by IS NOT NULL AND (mr.recorded_by_name IS NULL OR mr.recorded_by_name = '');

-- Create index for faster lookups / filtering by recorded_by_name
CREATE INDEX IF NOT EXISTS idx_managers_records_recorded_by_name ON managers_records(recorded_by_name);
