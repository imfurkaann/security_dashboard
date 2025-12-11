-- =====================================================
-- Hotel Security Management System - Seed Data
-- İlk kullanıcı ve örnek veriler
-- =====================================================

-- İlk admin kullanıcısı
-- Username: admin, Password: admin123
INSERT INTO users (username, password_hash, full_name, role, title, phone, email, bio, status)
VALUES (
    'admin',
    '$2a$10$rKJ5WzLqX5qKqN5qX5qX5qX5qX5qX5qX5qX5qX5qX5qX5qX5qX5', -- admin123 (gerçek bcrypt hash kullanılacak)
    'Sistem Yöneticisi',
    'admin',
    'Sistem Yöneticisi',
    '+90 555 000 00 00',
    'admin@hotel-security.com',
    'Ana sistem yöneticisi - Tam yetki',
    'active'
) ON CONFLICT (username) DO NOTHING;

-- Manager kullanıcıları
INSERT INTO users (username, password_hash, full_name, role, title, phone, email, status)
VALUES 
(
    'manager1',
    '$2a$10$rKJ5WzLqX5qKqN5qX5qX5qX5qX5qX5qX5qX5qX5qX5qX5qX5qX5',
    'Ahmet Yılmaz',
    'manager',
    'Otel Müdürü',
    '+90 555 111 11 11',
    'ahmet.yilmaz@hotel.com',
    'active'
),
(
    'manager2',
    '$2a$10$rKJ5WzLqX5qKqN5qX5qX5qX5qX5qX5qX5qX5qX5qX5qX5qX5qX5',
    'Fatma Demir',
    'manager',
    'Güvenlik Şefi',
    '+90 555 222 22 22',
    'fatma.demir@hotel.com',
    'active'
)
ON CONFLICT (username) DO NOTHING;

-- Güvenlik personeli
INSERT INTO users (username, password_hash, full_name, role, phone, email, status)
VALUES 
(
    'guvenlik1',
    '$2a$10$rKJ5WzLqX5qKqN5qX5qX5qX5qX5qX5qX5qX5qX5qX5qX5qX5qX5',
    'Mehmet Kaya',
    'personnel',
    '+90 555 333 33 33',
    'mehmet.kaya@hotel.com',
    'on_duty'
),
(
    'guvenlik2',
    '$2a$10$rKJ5WzLqX5qKqN5qX5qX5qX5qX5qX5qX5qX5qX5qX5qX5qX5qX5',
    'Ayşe Özkan',
    'personnel',
    '+90 555 444 44 44',
    'ayse.ozkan@hotel.com',
    'on_duty'
),
(
    'guvenlik3',
    '$2a$10$rKJ5WzLqX5qKqN5qX5qX5qX5qX5qX5qX5qX5qX5qX5qX5qX5qX5',
    'Can Arslan',
    'personnel',
    '+90 555 555 55 55',
    'can.arslan@hotel.com',
    'off_duty'
)
ON CONFLICT (username) DO NOTHING;

-- Örnek araç kayıtları
WITH recorder AS (SELECT id FROM users WHERE username = 'guvenlik1' LIMIT 1)
INSERT INTO vehicles (
    plate, vehicle_name, driver_name, driver_phone, vehicle_type, 
    status, entry_date, entry_time, purpose, notes, recorded_by
)
SELECT 
    '34 ABC 123',
    'Mercedes E-Class',
    'Ali Veli',
    '+90 555 666 66 66',
    'Otomobil',
    'inside',
    CURRENT_DATE,
    '14:30:00'::TIME,
    'Otel misafiri',
    'Oda 305 - Mehmet Bey',
    recorder.id
FROM recorder;

WITH recorder AS (SELECT id FROM users WHERE username = 'guvenlik2' LIMIT 1)
INSERT INTO vehicles (
    plate, vehicle_name, driver_name, driver_phone, vehicle_type, 
    status, entry_date, entry_time, exit_date, exit_time, purpose, notes, recorded_by
)
SELECT 
    '06 XYZ 789',
    'BMW X5',
    'Zeynep Yıldız',
    '+90 555 777 77 77',
    'SUV',
    'exited',
    CURRENT_DATE - INTERVAL '1 day',
    '10:00:00'::TIME,
    CURRENT_DATE - INTERVAL '1 day',
    '18:00:00'::TIME,
    'Otel misafiri',
    'Check-out tamamlandı',
    recorder.id
FROM recorder;

WITH recorder AS (SELECT id FROM users WHERE username = 'guvenlik1' LIMIT 1)
INSERT INTO vehicles (
    plate, vehicle_name, driver_name, driver_phone, vehicle_type, 
    status, entry_date, entry_time, purpose, notes, recorded_by
)
SELECT 
    '35 DEF 456',
    'Ford Transit',
    'Otel Servisi',
    '+90 555 888 88 88',
    'Minivan',
    'inside',
    CURRENT_DATE,
    '08:00:00'::TIME,
    'Servis aracı',
    'Otel servisi',
    recorder.id
FROM recorder;

-- Örnek ziyaretçi kayıtları
WITH recorder AS (SELECT id FROM users WHERE username = 'guvenlik1' LIMIT 1)
INSERT INTO visitors (
    full_name, company_name, visiting_person, person_count, phone_number, 
    vehicle_plate, id_number, description, entry_date, entry_time, 
    status, registered_by, recorded_by_id, created_date, created_time
)
SELECT 
    'Can Özgür',
    'ABC Danışmanlık',
    'Otel Müdürü',
    1,
    '+90 555 111 22 33',
    '34 TEST 01',
    '12345678901',
    'İş görüşmesi için geldi',
    CURRENT_DATE,
    '10:30:00'::TIME,
    'inside',
    'Mehmet Kaya',
    recorder.id,
    CURRENT_DATE,
    '10:30:00'::TIME
FROM recorder;

WITH recorder AS (SELECT id FROM users WHERE username = 'guvenlik2' LIMIT 1)
INSERT INTO visitors (
    full_name, company_name, visiting_person, person_count, phone_number, 
    id_number, description, entry_date, entry_time, exit_date, exit_time,
    status, registered_by, recorded_by_id, created_date, created_time
)
SELECT 
    'Elif Yılmaz',
    'Tech Solutions',
    'IT Müdürü',
    2,
    '+90 555 222 33 44',
    '98765432109',
    'Sistem bakımı',
    CURRENT_DATE - INTERVAL '2 days',
    '14:00:00'::TIME,
    CURRENT_DATE - INTERVAL '2 days',
    '17:30:00'::TIME,
    'exited',
    'Ayşe Özkan',
    recorder.id,
    CURRENT_DATE - INTERVAL '2 days',
    '14:00:00'::TIME
FROM recorder;

-- Örnek teslimat kaydı
WITH user_rec AS (SELECT id FROM users WHERE username = 'guvenlik1' LIMIT 1),
     vehicle_rec AS (SELECT id FROM vehicles WHERE plate = '35 DEF 456' LIMIT 1)
INSERT INTO deliveries (
    vehicle_id, vehicle_info, recipient, destination, user_id,
    created_date, created_time, status, notes
)
SELECT 
    vehicle_rec.id,
    'Ford Transit - 35 DEF 456',
    'Mutfak Müdürü',
    'Otel Mutfağı',
    user_rec.id,
    CURRENT_DATE,
    '09:00:00'::TIME,
    'completed',
    'Taze sebze ve meyve teslimatı'
FROM user_rec, vehicle_rec;

-- Örnek olay kaydı
WITH recorder AS (SELECT id FROM users WHERE username = 'guvenlik1' LIMIT 1)
INSERT INTO events (
    description, event_type, severity, location, user_id,
    created_date, created_time, status, resolution_notes
)
SELECT 
    'Otelin arka bahçesinde yetkisiz kişi tespit edildi. Kimlik kontrolü yapıldı ve dışarı çıkarıldı.',
    'Güvenlik İhlali',
    'medium',
    'Arka Bahçe',
    recorder.id,
    CURRENT_DATE - INTERVAL '1 day',
    '22:15:00'::TIME,
    'resolved',
    'Güvenlik ekibi müdahale etti. Kişi otel ile ilgisi olmadığını belirtti ve ayrıldı. Alan kontrol altına alındı.'
FROM recorder;

-- Örnek manager giriş kaydı
WITH manager_rec AS (SELECT id, full_name FROM users WHERE username = 'manager1' LIMIT 1)
INSERT INTO manager_logins (
    manager_id, manager_name, entry_date, entry_time, 
    ip_address, user_agent, login_method, created_date, created_time
)
SELECT 
    manager_rec.id,
    manager_rec.full_name,
    CURRENT_DATE,
    '09:00:00'::TIME,
    '192.168.1.100',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    'web',
    CURRENT_DATE,
    '09:00:00'::TIME
FROM manager_rec;

-- Aktif vardiya
WITH user_rec AS (SELECT id FROM users WHERE username = 'guvenlik1' LIMIT 1)
INSERT INTO shifts (user_id, shift_start, notes)
SELECT 
    user_rec.id,
    CURRENT_TIMESTAMP - INTERVAL '4 hours',
    'Gündüz vardiyası - Devam ediyor'
FROM user_rec;

-- Başarı mesajı
DO $$
BEGIN
    RAISE NOTICE '==================================================';
    RAISE NOTICE 'Seed data başarıyla oluşturuldu!';
    RAISE NOTICE '==================================================';
    RAISE NOTICE 'Kullanıcılar:';
    RAISE NOTICE '  Admin: admin / admin123';
    RAISE NOTICE '  Manager: manager1, manager2 / admin123';
    RAISE NOTICE '  Personnel: guvenlik1, guvenlik2, guvenlik3 / admin123';
    RAISE NOTICE '';
    RAISE NOTICE 'Örnek Veriler:';
    RAISE NOTICE '  3 araç kaydı (2 içeride, 1 çıkış yaptı)';
    RAISE NOTICE '  2 ziyaretçi (1 içeride, 1 çıkış yaptı)';
    RAISE NOTICE '  1 teslimat kaydı';
    RAISE NOTICE '  1 olay raporu (çözüldü)';
    RAISE NOTICE '  1 manager giriş kaydı';
    RAISE NOTICE '  1 aktif vardiya';
    RAISE NOTICE '==================================================';
END $$;
