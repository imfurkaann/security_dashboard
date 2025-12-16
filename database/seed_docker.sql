-- =====================================================
-- Security Management System - Seed Data (Docker Uyumlu)
-- Encoding: UTF-8
-- =====================================================

-- UTF-8 karakter seti ayarla
SET client_encoding TO 'UTF8';

-- Tüm kayıt tablolarını temizle
TRUNCATE TABLE audit_log CASCADE;
TRUNCATE TABLE fire_alarms CASCADE;
TRUNCATE TABLE incident_records CASCADE;
TRUNCATE TABLE managers_records CASCADE;
TRUNCATE TABLE visitor_records CASCADE;
TRUNCATE TABLE vehicle_records CASCADE;
TRUNCATE TABLE shifts CASCADE;

-- Personnel ve Vehicles tablolarını da temizle
DELETE FROM personnel;
DELETE FROM vehicles;

-- =====================================================
-- PERSONNEL TABLOSU - YENİ KAYITLAR
-- =====================================================
INSERT INTO personnel (id, first_name, last_name, username, password, role, is_active)
VALUES (gen_random_uuid(), 'Raziye', 'Toraman', 'raziye.toraman', '$2a$10$V1oUHKcWe8wbW.gFaepGoO.4w1yNmofAGaIKEd7MUUlaK1TECoQkm', 'personnel', true)
ON CONFLICT (username) DO NOTHING;

INSERT INTO personnel (id, first_name, last_name, username, password, role, is_active)
VALUES (gen_random_uuid(), 'Ferhat', 'Kurt', 'ferhat.kurt', '$2a$10$QCMbOY9hT9y2rzamcr.exOSxDlft0r5VJHvJQ7Ql6A6p6ZnDhAsUq', 'personnel', true)
ON CONFLICT (username) DO NOTHING;

INSERT INTO personnel (id, first_name, last_name, username, password, role, is_active)
VALUES (gen_random_uuid(), 'Ahmet', 'Akgül', 'ahmet.akgul', '$2a$10$zh1znM2WdH0ReljSkYMKpeJ.K3GmTkOdPs5Y6/SeL3iYnV1/zJGAO', 'personnel', true)
ON CONFLICT (username) DO NOTHING;

INSERT INTO personnel (id, first_name, last_name, username, password, role, is_active)
VALUES (gen_random_uuid(), 'Mustan', 'Bozdağ', 'mustan.bozdag', '$2a$10$sCBlZbIU3vSGdH518VABS.BAsNyzaRUBMYBI1261f9WAOPHaYeDxC', 'personnel', true)
ON CONFLICT (username) DO NOTHING;

INSERT INTO personnel (id, first_name, last_name, username, password, role, is_active)
VALUES (gen_random_uuid(), 'Hatice', 'Öztürk', 'hatice.ozturk', '$2a$10$1HSz20x5hub6MiL8c.Wkce3hm60LppBiTmgOX9UCWAyVvl/e7/.Dy', 'personnel', true)
ON CONFLICT (username) DO NOTHING;

INSERT INTO personnel (id, first_name, last_name, username, password, role, is_active)
VALUES (gen_random_uuid(), 'Furkan', 'Çelik', 'furkan.celik', '$2a$10$6G9dEDveMb.xRH5aDBDCx.oyc0VgtNe5y4CFPgjfT6T7q8Eow8uSa', 'personnel', true)
ON CONFLICT (username) DO NOTHING;

INSERT INTO personnel (id, first_name, last_name, username, password, role, is_active)
VALUES (gen_random_uuid(), 'Hanifi', 'Çelik', 'hanifi.celik', '$2a$10$svGRZ8U.qRZ/J09hM40TJOu1uoLtSNZJXEaM2XWn8iiGbMivIImaq', 'personnel', true)
ON CONFLICT (username) DO NOTHING;

INSERT INTO personnel (id, first_name, last_name, username, password, role, is_active)
VALUES (gen_random_uuid(), 'İsmail', 'Aksoy', 'ismail.aksoy', '$2a$10$SJalr4jRVrztmS.CninW7uyLx.jxrf5QxSm.QkE7j04Qnrrumb78G', 'personnel', true)
ON CONFLICT (username) DO NOTHING;

INSERT INTO personnel (id, first_name, last_name, username, password, role, is_active)
VALUES (gen_random_uuid(), 'Umut', 'Hıncal', 'umut.hincal', '$2a$10$qrLK9vsDUz.cLYi8ueResOhL9gFKmqcRaJLaVtcGoufP7X0HHT8QC', 'personnel', true)
ON CONFLICT (username) DO NOTHING;

INSERT INTO personnel (id, first_name, last_name, username, password, role, is_active)
VALUES (gen_random_uuid(), 'Adem', 'Çelik', 'adem.celik', '$2a$10$dbweBKNsLvJGLCs.wTK2L.b99WfX.TvZrUUiE3rWI/IawXpyU3FNi', 'admin', true)
ON CONFLICT (username) DO NOTHING;

-- =====================================================
-- VEHICLES TABLOSU - YENİ KAYITLAR
-- =====================================================
INSERT INTO vehicles (id, plate, brand, is_active)
VALUES (gen_random_uuid(), '07BEE763', 'Otokar Atlas', true)
ON CONFLICT (plate) DO NOTHING;

INSERT INTO vehicles (id, plate, brand, is_active)
VALUES (gen_random_uuid(), '07AEN693', 'Ford Transit', true)
ON CONFLICT (plate) DO NOTHING;

INSERT INTO vehicles (id, plate, brand, is_active)
VALUES (gen_random_uuid(), '07ABJ290', 'Fiat Doblo', true)
ON CONFLICT (plate) DO NOTHING;

INSERT INTO vehicles (id, plate, brand, is_active)
VALUES (gen_random_uuid(), '07CCU63', 'Opel Vivaro', true)
ON CONFLICT (plate) DO NOTHING;

-- =====================================================
-- Tamamlandı
-- =====================================================
