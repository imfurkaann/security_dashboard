-- Migration: Create pending_qr_sgk and pending_qr_sgk_files tables and update sgk_records
-- Çalıştır: psql -U postgres -d security_management -f database/migrations/040_create_pending_qr_sgk.sql

-- pending_qr_sgk tablosunu oluştur
CREATE TABLE IF NOT EXISTS pending_qr_sgk (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hashed_tc VARCHAR(255),
    hashed_passport VARCHAR(255),
    full_name VARCHAR(100) NOT NULL,
    company_name VARCHAR(100) NOT NULL,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- pending_qr_sgk_files tablosunu oluştur
CREATE TABLE IF NOT EXISTS pending_qr_sgk_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pending_sgk_id UUID NOT NULL REFERENCES pending_qr_sgk(id) ON DELETE CASCADE,
    stored_file_name VARCHAR(500) NOT NULL,
    original_file_name VARCHAR(500),
    mime_type VARCHAR(120),
    size_bytes BIGINT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- sgk_records tablosuna is_qr kolonunu ekle
ALTER TABLE sgk_records ADD COLUMN IF NOT EXISTS is_qr BOOLEAN DEFAULT FALSE;

-- Durum filtresi için index ekle
CREATE INDEX IF NOT EXISTS idx_pending_qr_sgk_status ON pending_qr_sgk(status);
CREATE INDEX IF NOT EXISTS idx_pending_qr_sgk_files_sgk_id ON pending_qr_sgk_files(pending_sgk_id);

-- trigger_update_pending_qr_sgk_updated_at ekle
CREATE OR REPLACE FUNCTION update_pending_qr_sgk_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_pending_qr_sgk_updated_at ON pending_qr_sgk;
CREATE TRIGGER trigger_update_pending_qr_sgk_updated_at
    BEFORE UPDATE ON pending_qr_sgk
    FOR EACH ROW
    EXECUTE FUNCTION update_pending_qr_sgk_updated_at();

-- Yorumlar
COMMENT ON TABLE pending_qr_sgk IS 'QR kod ile yüklenen ve onay bekleyen geçici SGK kayıtları';
COMMENT ON TABLE pending_qr_sgk_files IS 'Onay bekleyen SGK kayıtlarına ait geçici dosyalar';
COMMENT ON COLUMN sgk_records.is_qr IS 'Kayıt QR kod onaylama süreci üzerinden mi yapıldı işareti';
