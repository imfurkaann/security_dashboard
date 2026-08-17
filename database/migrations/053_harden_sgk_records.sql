-- Harden SGK pagination, active identifier uniqueness and multi-file lookups.
-- Existing data is preserved; uniqueness indexes are created only when legacy
-- rows do not already contain conflicting active identifiers.

CREATE INDEX IF NOT EXISTS idx_sgk_records_active_upload_order
    ON sgk_records (upload_date DESC, id DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sgk_record_files_active_record_order
    ON sgk_record_files (sgk_record_id, sort_order, created_at, id)
    WHERE deleted_at IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM sgk_records
        WHERE deleted_at IS NULL AND hashed_tc IS NOT NULL
        GROUP BY hashed_tc
        HAVING COUNT(*) > 1
    ) THEN
        EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_sgk_records_active_hashed_tc
                 ON sgk_records (hashed_tc)
                 WHERE deleted_at IS NULL AND hashed_tc IS NOT NULL';
    ELSE
        RAISE WARNING 'Active duplicate hashed_tc values exist; unique SGK TC index was not created';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM sgk_records
        WHERE deleted_at IS NULL AND hashed_passport IS NOT NULL
        GROUP BY hashed_passport
        HAVING COUNT(*) > 1
    ) THEN
        EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_sgk_records_active_hashed_passport
                 ON sgk_records (hashed_passport)
                 WHERE deleted_at IS NULL AND hashed_passport IS NOT NULL';
    ELSE
        RAISE WARNING 'Active duplicate hashed_passport values exist; unique SGK passport index was not created';
    END IF;
END $$;
