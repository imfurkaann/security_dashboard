-- Add manager_name column to managers_records and populate existing rows

ALTER TABLE IF EXISTS managers_records
ADD COLUMN IF NOT EXISTS manager_name VARCHAR(200);

-- Populate existing rows from managers table when possible
UPDATE managers_records mr
SET manager_name = concat(m.first_name, ' ', m.last_name)
FROM managers m
WHERE mr.manager_id = m.id AND (mr.manager_name IS NULL OR mr.manager_name = '');

-- Optional index for manager_name if needed for searches
CREATE INDEX IF NOT EXISTS idx_managers_records_manager_name ON managers_records (manager_name) WHERE deleted_at IS NULL;
