-- =====================================================
-- Migration: Vardiya rapor alanlarını ekle
-- Çalıştır: psql -U postgres -d security_management -f database/migrations/005_add_shift_reports.sql
-- =====================================================

-- Incidents tablosuna vardiya ve rapor alanlarını ekle
ALTER TABLE incidents
ADD COLUMN IF NOT EXISTS shift_label VARCHAR(50),
ADD COLUMN IF NOT EXISTS report_content TEXT,
ADD COLUMN IF NOT EXISTS report_date DATE DEFAULT CURRENT_DATE;

-- İndeks ekle
CREATE INDEX IF NOT EXISTS idx_incidents_shift_label ON incidents(shift_label);
CREATE INDEX IF NOT EXISTS idx_incidents_report_date ON incidents(report_date);

-- Mevcut kayıtlar için default değer
UPDATE incidents 
SET shift_label = '08:00-16:00'
WHERE shift_label IS NULL;

COMMENT ON COLUMN incidents.shift_label IS 'Vardiya etiketi: 00:00-08:00, 08:00-16:00, 16:00-00:00';
COMMENT ON COLUMN incidents.report_content IS 'Vardiya rapor içeriği (HTML formatında)';
COMMENT ON COLUMN incidents.report_date IS 'Raporun oluşturulduğu tarih';
