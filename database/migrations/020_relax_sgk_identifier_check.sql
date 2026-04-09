-- Migration: Relax SGK identifier rule (TC/Passport optional)
-- Date: 2026-04-09

-- Old rule required exactly one of hashed_tc or hashed_passport.
-- New rule allows both to be NULL, but still prevents both from being set together.
ALTER TABLE sgk_records DROP CONSTRAINT IF EXISTS sgk_records_identifier_check;

ALTER TABLE sgk_records
    ADD CONSTRAINT sgk_records_identifier_check
    CHECK (NOT (hashed_tc IS NOT NULL AND hashed_passport IS NOT NULL));
