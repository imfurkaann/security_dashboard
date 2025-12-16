-- Migration: Add visitor tagging columns
-- Adds subcontractor_worker and for_electric_station boolean columns
BEGIN;

ALTER TABLE IF EXISTS visitors
    ADD COLUMN IF NOT EXISTS subcontractor_worker BOOLEAN DEFAULT FALSE NOT NULL,
    ADD COLUMN IF NOT EXISTS for_electric_station BOOLEAN DEFAULT FALSE NOT NULL;

-- Also attempt to alter legacy table name used by backend if present
ALTER TABLE IF EXISTS visitor_records
    ADD COLUMN IF NOT EXISTS subcontractor_worker BOOLEAN DEFAULT FALSE NOT NULL;

ALTER TABLE IF EXISTS visitor_records
    ADD COLUMN IF NOT EXISTS for_electric_station BOOLEAN DEFAULT FALSE NOT NULL;

COMMIT;
