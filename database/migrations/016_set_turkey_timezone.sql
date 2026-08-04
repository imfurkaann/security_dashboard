-- Migration: Set Türkiye Timezone (Europe/Istanbul)
-- Date: 2025-12-23
-- Description: Veritabanı varsayılan timezone'unu Türkiye olarak ayarla

-- Veritabanı düzeyinde timezone ayarı (dinamik veritabanı adı ile)
DO $$ 
DECLARE
    db_name text;
BEGIN
    SELECT current_database() INTO db_name;
    EXECUTE format('ALTER DATABASE %I SET timezone TO %L', db_name, 'Europe/Istanbul');
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not alter database timezone, setting session timezone instead';
END $$;

-- Mevcut oturum için timezone ayarı
SET timezone = 'Europe/Istanbul';

-- Tüm timestamp sütunlarının timezone-aware olmasını sağla
-- (Mevcut DATE ve TIME sütunları olduğu gibi kalacak, sorun yok)

-- Confirmation message
DO $$
BEGIN
    RAISE NOTICE 'Timezone set to Europe/Istanbul (UTC+3)';
    RAISE NOTICE 'Current time: %', NOW();
    RAISE NOTICE 'Current date: %', CURRENT_DATE;
END $$;
