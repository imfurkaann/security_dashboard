-- Migration 010: Müdür Listesini Güncelle
-- Mevcut müdürleri sil ve yeni müdür listesini ekle

-- Client encoding'i UTF8 olarak ayarla
SET CLIENT_ENCODING TO 'UTF8';

BEGIN;

-- Önce mevcut müdürleri sil (sadece managers tablosundan, kayıtlar korunsun)
DELETE FROM managers;

-- Yeni müdür listesini ekle
INSERT INTO managers (first_name, last_name, title) VALUES
('Özder', 'Özdemir', 'Kalite Müdürü'),
('Taşkın', 'Aydoğdu', 'Genel Müdür Yardımcısı'),
('Mennan', 'Gencer', 'Satınalma Müdürü'),
('Abdullah', 'Özbulut', 'HK Müdürü'),
('Berna', 'Sever', 'Satış ve Pazarlama Müdürü'),
('Mustafa', 'Gülbudak', 'Animasyon Müdürü'),
('Savaş', 'Gülcan', 'Aşçıbaşı'),
('Funda', 'Solmaz', 'Muhasebe Müdürü'),
('Erkan', 'Ünlü', 'Teknik Müdürü'),
('Ali', 'Uyanık', 'Gece Müdürü'),
('Adem', 'Çelik', 'Güvenlik Müdürü'),
('Funda', 'Şen', 'İnsan Kaynakları Müdürü'),
('Sinan', 'Mesut', 'Önbüro Müdürü');

COMMIT;

-- Kontrol
SELECT 
    id,
    first_name || ' ' || last_name as full_name,
    title,
    created_at
FROM managers
ORDER BY id;
