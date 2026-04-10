-- =====================================================
-- Migration: Misafir kayitlari kolonlarini Excel basliklariyla birebir hizala
-- Calistir: psql -U postgres -d security_management -f database/migrations/025_align_misafir_kayitlari_excel_columns.sql
-- =====================================================

ALTER TABLE misafir_kayitlari
ADD COLUMN IF NOT EXISTS voucher VARCHAR(100),
ADD COLUMN IF NOT EXISTS acenta VARCHAR(150),
ADD COLUMN IF NOT EXISTS hitap VARCHAR(50),
ADD COLUMN IF NOT EXISTS adi VARCHAR(120),
ADD COLUMN IF NOT EXISTS soyadi VARCHAR(120),
ADD COLUMN IF NOT EXISTS oda VARCHAR(50),
ADD COLUMN IF NOT EXISTS yetiskin VARCHAR(20),
ADD COLUMN IF NOT EXISTS cocuk VARCHAR(20),
ADD COLUMN IF NOT EXISTS free VARCHAR(20),
ADD COLUMN IF NOT EXISTS konaklama VARCHAR(50),
ADD COLUMN IF NOT EXISTS giris_tarihi VARCHAR(50),
ADD COLUMN IF NOT EXISTS geceleme VARCHAR(50),
ADD COLUMN IF NOT EXISTS cikis_tarihi VARCHAR(50),
ADD COLUMN IF NOT EXISTS giris_saati VARCHAR(50),
ADD COLUMN IF NOT EXISTS istenen VARCHAR(200),
ADD COLUMN IF NOT EXISTS verilen VARCHAR(200),
ADD COLUMN IF NOT EXISTS ulke VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_misafir_kayitlari_voucher ON misafir_kayitlari(voucher);
CREATE INDEX IF NOT EXISTS idx_misafir_kayitlari_acenta ON misafir_kayitlari(acenta);
CREATE INDEX IF NOT EXISTS idx_misafir_kayitlari_adi ON misafir_kayitlari(adi);
CREATE INDEX IF NOT EXISTS idx_misafir_kayitlari_soyadi ON misafir_kayitlari(soyadi);
CREATE INDEX IF NOT EXISTS idx_misafir_kayitlari_oda ON misafir_kayitlari(oda);
CREATE INDEX IF NOT EXISTS idx_misafir_kayitlari_giris_tarihi ON misafir_kayitlari(giris_tarihi);
CREATE INDEX IF NOT EXISTS idx_misafir_kayitlari_cikis_tarihi ON misafir_kayitlari(cikis_tarihi);
CREATE INDEX IF NOT EXISTS idx_misafir_kayitlari_ulke ON misafir_kayitlari(ulke);

DO $$
BEGIN
    RAISE NOTICE 'Migration basariyla tamamlandi: misafir_kayitlari Excel kolonlari hizalandi';
END $$;
