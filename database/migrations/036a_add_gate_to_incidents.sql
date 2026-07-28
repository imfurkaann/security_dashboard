-- =====================================================
-- Migration: incidents tablosuna gate alani ekle
-- Calistir: psql -U postgres -d security_management -f database/migrations/036_add_gate_to_incidents.sql
-- =====================================================

ALTER TABLE incidents ADD COLUMN IF NOT EXISTS gate VARCHAR(20);

ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_gate_check;
ALTER TABLE incidents ADD CONSTRAINT incidents_gate_check CHECK (gate IS NULL OR gate IN ('Ana Kapı', 'Sahil Kapı'));

DO $$
BEGIN
    RAISE NOTICE 'Migration basariyla tamamlandi: incidents tablosuna gate alani eklendi';
END $$;
