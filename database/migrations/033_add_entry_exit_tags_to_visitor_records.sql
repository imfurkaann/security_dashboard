-- Adds entry_tag and exit_tag boolean columns for visitor records

ALTER TABLE visitor_records
    ADD COLUMN IF NOT EXISTS entry_tag BOOLEAN DEFAULT FALSE NOT NULL,
    ADD COLUMN IF NOT EXISTS exit_tag BOOLEAN DEFAULT FALSE NOT NULL;
