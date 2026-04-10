-- =====================================================
-- Migration: Kayit tablolarina gate alani ekle
-- Calistir: psql -U postgres -d security_management -f database/migrations/023_add_gate_to_records.sql
-- =====================================================

ALTER TABLE vehicle_records ADD COLUMN IF NOT EXISTS gate VARCHAR(20);
ALTER TABLE visitor_records ADD COLUMN IF NOT EXISTS gate VARCHAR(20);
ALTER TABLE managers_records ADD COLUMN IF NOT EXISTS gate VARCHAR(20);
ALTER TABLE fire_alarms ADD COLUMN IF NOT EXISTS gate VARCHAR(20);

ALTER TABLE vehicle_records DROP CONSTRAINT IF EXISTS vehicle_records_gate_check;
ALTER TABLE visitor_records DROP CONSTRAINT IF EXISTS visitor_records_gate_check;
ALTER TABLE managers_records DROP CONSTRAINT IF EXISTS managers_records_gate_check;
ALTER TABLE fire_alarms DROP CONSTRAINT IF EXISTS fire_alarms_gate_check;

ALTER TABLE vehicle_records ADD CONSTRAINT vehicle_records_gate_check CHECK (gate IS NULL OR gate IN ('Ana Kapı', 'Sahil Kapı'));
ALTER TABLE visitor_records ADD CONSTRAINT visitor_records_gate_check CHECK (gate IS NULL OR gate IN ('Ana Kapı', 'Sahil Kapı'));
ALTER TABLE managers_records ADD CONSTRAINT managers_records_gate_check CHECK (gate IS NULL OR gate IN ('Ana Kapı', 'Sahil Kapı'));
ALTER TABLE fire_alarms ADD CONSTRAINT fire_alarms_gate_check CHECK (gate IS NULL OR gate IN ('Ana Kapı', 'Sahil Kapı'));

DO $$
BEGIN
    RAISE NOTICE 'Migration basariyla tamamlandi: kayit tablolarina gate alani eklendi';
END $$;
