-- Migration: Add passport number support to SGK records
-- Date: 2025-12-23

-- Add passport number column (hashed for KVKK compliance)
ALTER TABLE sgk_records ADD COLUMN IF NOT EXISTS hashed_passport VARCHAR(255);

-- Add index for passport number
CREATE INDEX IF NOT EXISTS idx_sgk_records_hashed_passport ON sgk_records(hashed_passport);

-- Update unique constraint on hashed_tc to allow NULL
-- (because now records can have either TC or passport)
ALTER TABLE sgk_records DROP CONSTRAINT IF EXISTS sgk_records_hashed_tc_key;

-- Add check constraint to ensure at least one of TC or passport is provided
ALTER TABLE sgk_records ADD CONSTRAINT sgk_records_identifier_check 
    CHECK (
        (hashed_tc IS NOT NULL AND hashed_passport IS NULL) OR
        (hashed_tc IS NULL AND hashed_passport IS NOT NULL)
    );

-- Update comments
COMMENT ON COLUMN sgk_records.hashed_tc IS 'Hashed TC Kimlik No (KVKK compliant) - mutually exclusive with passport';
COMMENT ON COLUMN sgk_records.hashed_passport IS 'Hashed passport number (KVKK compliant) - mutually exclusive with TC';
