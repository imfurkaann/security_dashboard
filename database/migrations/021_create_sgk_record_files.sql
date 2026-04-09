-- Migration: Add multi-file support for SGK records
-- Date: 2026-04-09

CREATE TABLE IF NOT EXISTS sgk_record_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sgk_record_id UUID NOT NULL REFERENCES sgk_records(id) ON DELETE CASCADE,
    stored_file_name VARCHAR(500) NOT NULL,
    original_file_name VARCHAR(500),
    mime_type VARCHAR(120),
    size_bytes BIGINT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sgk_record_files_record_id ON sgk_record_files(sgk_record_id);
CREATE INDEX IF NOT EXISTS idx_sgk_record_files_deleted_at ON sgk_record_files(deleted_at);

-- Backfill old single-file records into the new child table.
INSERT INTO sgk_record_files (
    id,
    sgk_record_id,
    stored_file_name,
    original_file_name,
    sort_order,
    created_at
)
SELECT
    gen_random_uuid(),
    sr.id,
    sr.file_path,
    sr.file_path,
    0,
    COALESCE(sr.created_at, CURRENT_TIMESTAMP)
FROM sgk_records sr
WHERE sr.file_path IS NOT NULL
  AND sr.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM sgk_record_files srf
      WHERE srf.sgk_record_id = sr.id
        AND srf.deleted_at IS NULL
  );
