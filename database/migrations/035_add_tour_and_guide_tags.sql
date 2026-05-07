-- Migration 035: Add tour entry, tour exit, and guide tags to visitor records
-- Ziyaretçi kayıtlarına tur giriş, tur çıkış ve rehber etiketlerini ekleyin

BEGIN;

-- Add columns for tour entry, tour exit, and guide tags
ALTER TABLE visitor_records
ADD COLUMN tour_entry BOOLEAN DEFAULT FALSE,
ADD COLUMN tour_exit BOOLEAN DEFAULT FALSE,
ADD COLUMN guide BOOLEAN DEFAULT FALSE;

-- Add comments for clarity
COMMENT ON COLUMN visitor_records.tour_entry IS 'Tur Giriş etiketini işaretler';
COMMENT ON COLUMN visitor_records.tour_exit IS 'Tur Çıkış etiketini işaretler';
COMMENT ON COLUMN visitor_records.guide IS 'Rehber etiketini işaretler';

COMMIT;
