-- Migration: Add daily guest visitor tag
-- Adds daily_guest boolean column for visitor records
BEGIN;

ALTER TABLE IF EXISTS visitors
    ADD COLUMN IF NOT EXISTS daily_guest BOOLEAN DEFAULT FALSE NOT NULL;

ALTER TABLE IF EXISTS visitor_records
    ADD COLUMN IF NOT EXISTS daily_guest BOOLEAN DEFAULT FALSE NOT NULL;

COMMIT;
