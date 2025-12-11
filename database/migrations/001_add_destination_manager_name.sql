-- Migration: Add missing fields to vehicle_records
-- Date: 2025-12-09
-- Description: Add destination and manager_name fields for data integrity

-- Add destination field
ALTER TABLE vehicle_records 
ADD COLUMN IF NOT EXISTS destination VARCHAR(255);

-- Add manager_name field for custom manager entries
ALTER TABLE vehicle_records 
ADD COLUMN IF NOT EXISTS manager_name VARCHAR(100);

-- Create index for destination searches
CREATE INDEX IF NOT EXISTS idx_vehicle_records_destination 
ON vehicle_records(destination) WHERE deleted_at IS NULL;

-- Comment the columns
COMMENT ON COLUMN vehicle_records.destination IS 'Gidilen yer / hedef lokasyon';
COMMENT ON COLUMN vehicle_records.manager_name IS 'Elle girilmiş müdür adı (manager_id NULL ise kullanılır)';

-- Make manager_id nullable for custom manager entries
ALTER TABLE vehicle_records 
ALTER COLUMN manager_id DROP NOT NULL;

-- Add check constraint: either manager_id or manager_name must be provided
ALTER TABLE vehicle_records 
ADD CONSTRAINT check_manager_info 
CHECK (manager_id IS NOT NULL OR manager_name IS NOT NULL);
