-- =====================================================
-- Migration: Ziyaretci kayitlarina cocuk sayisi alani ekle
-- Calistir: psql -U postgres -d security_management -f database/migrations/022_add_children_count_to_visitor_records.sql
-- =====================================================

ALTER TABLE visitor_records
ADD COLUMN IF NOT EXISTS children_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE visitor_records
DROP CONSTRAINT IF EXISTS visitor_records_children_count_check;

ALTER TABLE visitor_records
ADD CONSTRAINT visitor_records_children_count_check CHECK (children_count >= 0);

DO $$
BEGIN
    RAISE NOTICE 'Migration basariyla tamamlandi: visitor_records.children_count alani eklendi';
END $$;
