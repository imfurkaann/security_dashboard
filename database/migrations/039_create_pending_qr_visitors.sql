-- Migration: Create pending_qr_visitors table and add is_qr to visitor_records
-- Çalıştır: psql -U postgres -d security_management -f database/migrations/039_create_pending_qr_visitors.sql

-- pending_qr_visitors tablosunu oluştur
CREATE TABLE IF NOT EXISTS pending_qr_visitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_plate VARCHAR(20),
    full_name VARCHAR(100) NOT NULL,
    company_name VARCHAR(100),
    visiting_person VARCHAR(100),
    person_count INTEGER DEFAULT 1,
    children_count INTEGER DEFAULT 0,
    phone VARCHAR(20),
    gate VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- visitor_records tablosuna is_qr kolonunu ekle
ALTER TABLE visitor_records ADD COLUMN IF NOT EXISTS is_qr BOOLEAN DEFAULT FALSE;

-- Durum filtresi için index ekle
CREATE INDEX IF NOT EXISTS idx_pending_qr_visitors_status ON pending_qr_visitors(status);

-- Yorumlar
COMMENT ON TABLE pending_qr_visitors IS 'QR kod ile misafirlerin kendi oluşturduğu ve onay bekleyen geçici kayıtlar';
COMMENT ON COLUMN visitor_records.is_qr IS 'Kayıt QR kod onaylama süreci üzerinden mi yapıldı işareti';
