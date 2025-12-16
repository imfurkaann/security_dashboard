-- =====================================================
-- Migration: Ziyaretçi kayıtlarında tüm alanları isteğe bağlı yap
-- Çalıştır: psql -U postgres -d security_management -f "c:\Users\imfurkaann\Documents\projects\security\database\migrations\009_make_visitor_fields_optional.sql"
-- =====================================================

-- vehicle_plate NULL olabilir (plakasız giriş)
ALTER TABLE visitor_records ALTER COLUMN vehicle_plate DROP NOT NULL;

-- full_name NULL olabilir (isimsiz giriş - ör: toplu ziyaretçi)
ALTER TABLE visitor_records ALTER COLUMN full_name DROP NOT NULL;

-- company_name NULL olabilir
ALTER TABLE visitor_records ALTER COLUMN company_name DROP NOT NULL;

-- visiting_person NULL olabilir
ALTER TABLE visitor_records ALTER COLUMN visiting_person DROP NOT NULL;

-- person_count NULL olabilir (ama default 1)
ALTER TABLE visitor_records ALTER COLUMN person_count DROP NOT NULL;
ALTER TABLE visitor_records ALTER COLUMN person_count SET DEFAULT 1;

-- phone NULL olabilir
ALTER TABLE visitor_records ALTER COLUMN phone DROP NOT NULL;

-- Başarı mesajı
DO $$ 
BEGIN 
    RAISE NOTICE 'Migration başarıyla tamamlandı: Tüm ziyaretçi alanları artık isteğe bağlı';
END $$;
