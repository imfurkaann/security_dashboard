-- =====================================================
-- Migration: Gate alanlarini dinamiklestir
-- Amaç: Kayit tablolarinda gate alanini sabit iki degerden cikarip
--       admin tarafindan tanimlanan dinamik kapilarla uyumlu hale getirmek.
-- =====================================================

ALTER TABLE vehicle_records DROP CONSTRAINT IF EXISTS vehicle_records_gate_check;
ALTER TABLE visitor_records DROP CONSTRAINT IF EXISTS visitor_records_gate_check;
ALTER TABLE managers_records DROP CONSTRAINT IF EXISTS managers_records_gate_check;
ALTER TABLE fire_alarms DROP CONSTRAINT IF EXISTS fire_alarms_gate_check;

-- Dinamik gate isimleri equipment_gates.name ile 100 karaktere kadar tanimlanabildigi icin
-- kayit tablolarindaki gate kolonlari da ayni olcege cekilir.
ALTER TABLE vehicle_records ALTER COLUMN gate TYPE VARCHAR(100);
ALTER TABLE visitor_records ALTER COLUMN gate TYPE VARCHAR(100);
ALTER TABLE managers_records ALTER COLUMN gate TYPE VARCHAR(100);
ALTER TABLE fire_alarms ALTER COLUMN gate TYPE VARCHAR(100);

DO $$
BEGIN
    RAISE NOTICE 'Migration basariyla tamamlandi: gate kisitlari dinamik hale getirildi';
END $$;
