-- Migration: Add functional index for normalized Turkish visitor name search
-- Date: 2026-06-29

CREATE INDEX IF NOT EXISTS idx_visitor_records_normalized_name_tr
ON visitor_records (LOWER(translate(full_name, 'IİĞÜŞÖÇ', 'ıiğüşöç')))
WHERE (deleted_at IS NULL);
