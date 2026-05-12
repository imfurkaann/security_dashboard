-- =====================================================
-- Migration: incidents tablosunda gate constraint'ini dinamik hale getir
-- Calistir: psql -U postgres -d security_management -f database/migrations/037_relax_incidents_gate_constraint.sql
-- =====================================================

-- Mevcut constraint'i kaldır (sadece hardcoded değerleri kontrol ediyordu)
ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_gate_check;

-- Yeni constraint: gate NULL olabilir, ya da herhangi bir string olabilir (max 100 chars)
ALTER TABLE incidents ADD CONSTRAINT incidents_gate_check CHECK (gate IS NULL OR (char_length(gate) > 0 AND char_length(gate) <= 100));

DO $$
BEGIN
    RAISE NOTICE 'Migration basariyla tamamlandi: incidents.gate constraint dinamik hale getirildi';
END $$;
