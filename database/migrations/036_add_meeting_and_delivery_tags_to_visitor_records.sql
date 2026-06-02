-- Migration 036: Add meeting and delivery tags to visitor records
-- Ziyaretçi kayıtlarına görüşme ve teslimat etiketlerini ekleyin

BEGIN;

ALTER TABLE visitor_records
ADD COLUMN meeting BOOLEAN DEFAULT FALSE,
ADD COLUMN delivery BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN visitor_records.meeting IS 'Görüşme etiketini işaretler';
COMMENT ON COLUMN visitor_records.delivery IS 'Teslimat etiketini işaretler';

COMMIT;