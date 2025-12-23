-- Migration: Fix hashed_tc to allow NULL values for passport-only records
-- Date: 2025-12-24
-- Issue: hashed_tc still has NOT NULL constraint, preventing passport-only records

-- Remove NOT NULL constraint from hashed_tc
ALTER TABLE sgk_records ALTER COLUMN hashed_tc DROP NOT NULL;

-- The check constraint from migration 017 ensures exactly one of TC or passport is provided:
-- sgk_records_identifier_check: (hashed_tc IS NOT NULL AND hashed_passport IS NULL) 
--                             OR (hashed_tc IS NULL AND hashed_passport IS NOT NULL)
