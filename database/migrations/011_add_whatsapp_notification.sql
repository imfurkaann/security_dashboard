-- Migration 011: WhatsApp Bildirimi İçin Visitor Records Kolonu Ekle
-- visitor_records tablosuna send_whatsapp kolonu ekle

SET CLIENT_ENCODING TO 'UTF8';

BEGIN;

-- visitor_records tablosuna send_whatsapp kolonu ekle
ALTER TABLE visitor_records 
ADD COLUMN IF NOT EXISTS send_whatsapp BOOLEAN DEFAULT false;

-- Yorum ekle
COMMENT ON COLUMN visitor_records.send_whatsapp IS 'WhatsApp grubuna bildirim gönderilsin mi?';

COMMIT;

-- Kontrol
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'visitor_records' AND column_name = 'send_whatsapp';
