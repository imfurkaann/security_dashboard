-- Migration: Set Türkiye Timezone (Europe/Istanbul)
-- Date: 2025-12-23
-- Description: Veritabanı varsayılan timezone'unu Türkiye olarak ayarla

-- Veritabanı düzeyinde timezone ayarı
ALTER DATABASE CURRENT SET timezone TO 'Europe/Istanbul';

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
