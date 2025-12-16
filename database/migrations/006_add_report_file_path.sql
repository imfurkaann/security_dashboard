-- =====================================================
-- Migration: Rapor dosya yolu kolonu ekle
-- Çalıştır: psql -U postgres -d security_management -f database/migrations/006_add_report_file_path.sql
-- =====================================================

-- Incidents tablosuna dosya yolu kolonu ekle
ALTER TABLE incidents
ADD COLUMN IF NOT EXISTS report_file_path TEXT;

-- İndeks ekle
CREATE INDEX IF NOT EXISTS idx_incidents_report_file_path ON incidents(report_file_path);

COMMENT ON COLUMN incidents.report_file_path IS 'Word dosyasının sunucu üzerindeki tam yolu';
