-- =====================================================
-- Migration: Misafir kayitlari tablosu olustur
-- Calistir: psql -U postgres -d security_management -f database/migrations/024_create_misafir_kayitlari.sql
-- =====================================================

CREATE TABLE IF NOT EXISTS misafir_kayitlari (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    excel_file_name VARCHAR(255) NOT NULL,
    sheet_name VARCHAR(150) NOT NULL,
    row_number INTEGER NOT NULL,
    row_data JSONB NOT NULL,
    voucher VARCHAR(100),
    acenta VARCHAR(150),
    hitap VARCHAR(50),
    adi VARCHAR(120),
    soyadi VARCHAR(120),
    oda VARCHAR(50),
    yetiskin VARCHAR(20),
    cocuk VARCHAR(20),
    free VARCHAR(20),
    konaklama VARCHAR(50),
    giris_tarihi VARCHAR(50),
    geceleme VARCHAR(50),
    cikis_tarihi VARCHAR(50),
    giris_saati VARCHAR(50),
    istenen VARCHAR(200),
    verilen VARCHAR(200),
    ulke VARCHAR(100),
    created_by UUID REFERENCES personnel(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_misafir_kayitlari_voucher ON misafir_kayitlari(voucher);
CREATE INDEX IF NOT EXISTS idx_misafir_kayitlari_acenta ON misafir_kayitlari(acenta);
CREATE INDEX IF NOT EXISTS idx_misafir_kayitlari_adi ON misafir_kayitlari(adi);
CREATE INDEX IF NOT EXISTS idx_misafir_kayitlari_soyadi ON misafir_kayitlari(soyadi);
CREATE INDEX IF NOT EXISTS idx_misafir_kayitlari_oda ON misafir_kayitlari(oda);
CREATE INDEX IF NOT EXISTS idx_misafir_kayitlari_giris_tarihi ON misafir_kayitlari(giris_tarihi);
CREATE INDEX IF NOT EXISTS idx_misafir_kayitlari_cikis_tarihi ON misafir_kayitlari(cikis_tarihi);
CREATE INDEX IF NOT EXISTS idx_misafir_kayitlari_ulke ON misafir_kayitlari(ulke);
CREATE INDEX IF NOT EXISTS idx_misafir_kayitlari_created_at ON misafir_kayitlari(created_at);
CREATE INDEX IF NOT EXISTS idx_misafir_kayitlari_row_data_gin ON misafir_kayitlari USING gin (row_data);

DROP TRIGGER IF EXISTS update_misafir_kayitlari_updated_at ON misafir_kayitlari;
CREATE TRIGGER update_misafir_kayitlari_updated_at
    BEFORE UPDATE ON misafir_kayitlari
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE misafir_kayitlari IS 'Excel yuklemelerinden gelen misafir on kayit verileri';
COMMENT ON COLUMN misafir_kayitlari.row_data IS 'Excel satirinin birebir ham hali (kolon:deger)';

DO $$
BEGIN
    RAISE NOTICE 'Migration basariyla tamamlandi: misafir_kayitlari tablosu olusturuldu';
END $$;
