-- =====================================================
-- Migration: Add weekly login counter to personnel
-- Amaç: Haftalık ilk giriş popup kontrolünü personnel tablosu üzerinden yapmak
-- =====================================================

ALTER TABLE personnel
ADD COLUMN IF NOT EXISTS weekly_login_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS weekly_login_week_start DATE;

CREATE INDEX IF NOT EXISTS idx_personnel_weekly_login_week_start
ON personnel(weekly_login_week_start);

COMMENT ON COLUMN personnel.weekly_login_count IS 'Personelin haftalık giriş sayacı';
COMMENT ON COLUMN personnel.weekly_login_week_start IS 'Haftalık sayacın ait olduğu haftanın başlangıç tarihi';

UPDATE personnel
SET weekly_login_count = 0,
    weekly_login_week_start = NULL
WHERE deleted_at IS NULL;

DO $$
BEGIN
    RAISE NOTICE 'Migration basariyla tamamlandi: personnel tablosuna weekly_login_count eklendi';
END $$;