-- Test verisi: Farklı aylarda araç kayıtları
-- Bu dosyayı çalıştırarak aylara göre gruplama özelliğini test edebilirsiniz

-- Ekim 2025 kayıtları
INSERT INTO vehicle_records (id, vehicle_id, manager_id, manager_name, destination, notes, given_time, return_time, given_date, return_date, status, given_by, returned_by, given_by_name, returned_by_name)
SELECT 
    gen_random_uuid(),
    v.id,
    m.id,
    CONCAT(m.first_name, ' ', m.last_name),
    destination,
    'Test verisi - Ekim 2025',
    given_time::time,
    return_time::time,
    given_date::date,
    return_date::date,
    'returned',
    p1.id,
    p2.id,
    'Ali Yılmaz',
    'Mehmet Kaya'
FROM (
    SELECT 
        '2025-10-05' as given_date, '10:30' as given_time, '2025-10-05' as return_date, '17:45' as return_time, 'Antalya Havalimanı' as destination
    UNION ALL SELECT '2025-10-12', '09:15', '2025-10-12', '16:20', 'Kemer Köyiçi'
    UNION ALL SELECT '2025-10-18', '14:00', '2025-10-18', '19:30', 'Side Antik Kent'
    UNION ALL SELECT '2025-10-22', '08:45', '2025-10-22', '15:10', 'Alanya Kalesi'
    UNION ALL SELECT '2025-10-28', '11:20', '2025-10-28', '18:00', 'Kaş Marina'
) dates
CROSS JOIN LATERAL (SELECT id FROM vehicles WHERE deleted_at IS NULL LIMIT 1) v
CROSS JOIN LATERAL (SELECT id, first_name, last_name FROM managers WHERE deleted_at IS NULL AND is_active = true LIMIT 1) m
CROSS JOIN LATERAL (SELECT id FROM personnel WHERE deleted_at IS NULL LIMIT 1 OFFSET 0) p1
CROSS JOIN LATERAL (SELECT id FROM personnel WHERE deleted_at IS NULL LIMIT 1 OFFSET 1) p2;

-- Kasım 2025 kayıtları
INSERT INTO vehicle_records (id, vehicle_id, manager_id, manager_name, destination, notes, given_time, return_time, given_date, return_date, status, given_by, returned_by, given_by_name, returned_by_name)
SELECT 
    gen_random_uuid(),
    v.id,
    m.id,
    CONCAT(m.first_name, ' ', m.last_name),
    destination,
    'Test verisi - Kasım 2025',
    given_time::time,
    return_time::time,
    given_date::date,
    return_date::date,
    'returned',
    p1.id,
    p2.id,
    'Zeynep Demir',
    'Can Öztürk'
FROM (
    SELECT 
        '2025-11-03' as given_date, '09:00' as given_time, '2025-11-03' as return_date, '16:30' as return_time, 'Belek Golf Kulübü' as destination
    UNION ALL SELECT '2025-11-08', '13:45', '2025-11-08', '20:15', 'Manavgat Şelalesi'
    UNION ALL SELECT '2025-11-14', '10:30', '2025-11-14', '17:00', 'Aspendos Antik Tiyatro'
    UNION ALL SELECT '2025-11-19', '08:15', '2025-11-19', '14:45', 'Perge Antik Kenti'
    UNION ALL SELECT '2025-11-23', '15:00', '2025-11-23', '21:30', 'Termessos Antik Kenti'
    UNION ALL SELECT '2025-11-27', '11:45', '2025-11-27', '18:20', 'Olimpos Teleferik'
    UNION ALL SELECT '2025-11-29', '09:30', '2025-11-29', '16:00', 'Kekova Batık Şehir'
) dates
CROSS JOIN LATERAL (SELECT id FROM vehicles WHERE deleted_at IS NULL OFFSET 0 LIMIT 1) v
CROSS JOIN LATERAL (SELECT id, first_name, last_name FROM managers WHERE deleted_at IS NULL AND is_active = true OFFSET 0 LIMIT 1) m
CROSS JOIN LATERAL (SELECT id FROM personnel WHERE deleted_at IS NULL LIMIT 1 OFFSET 0) p1
CROSS JOIN LATERAL (SELECT id FROM personnel WHERE deleted_at IS NULL LIMIT 1 OFFSET 1) p2;

-- Aralık 2025 kayıtları (bazıları hala kullanımda)
INSERT INTO vehicle_records (id, vehicle_id, manager_id, manager_name, destination, notes, given_time, return_time, given_date, return_date, status, given_by, returned_by, given_by_name, returned_by_name)
SELECT 
    gen_random_uuid(),
    v.id,
    m.id,
    CONCAT(m.first_name, ' ', m.last_name),
    destination,
    notes,
    given_time::time,
    CASE WHEN return_time IS NOT NULL THEN return_time::time ELSE NULL END,
    given_date::date,
    CASE WHEN return_date IS NOT NULL THEN return_date::date ELSE NULL END,
    status,
    p1.id,
    CASE WHEN status = 'returned' THEN p2.id ELSE NULL END,
    'Ahmet Yıldız',
    CASE WHEN status = 'returned' THEN 'Fatma Şahin' ELSE NULL END
FROM (
    SELECT 
        '2025-12-02' as given_date, '08:00' as given_time, '2025-12-02' as return_date, '15:30' as return_time, 'returned' as status, 'Antalya AVM' as destination, 'Test verisi - Aralık 2025' as notes
    UNION ALL SELECT '2025-12-07', '14:30', '2025-12-07', '20:00', 'returned', 'Lara Plajı', 'Test verisi - Aralık 2025'
    UNION ALL SELECT '2025-12-11', '10:00', '2025-12-11', '17:45', 'returned', 'Kaleiçi', 'Test verisi - Aralık 2025'
    UNION ALL SELECT '2025-12-15', '09:45', '2025-12-15', '16:30', 'returned', 'Düden Şelalesi', 'Test verisi - Aralık 2025'
    UNION ALL SELECT '2025-12-18', '11:30', NULL, NULL, 'in_use', 'Konyaaltı Plajı', 'Kullanımda - Test verisi'
    UNION ALL SELECT '2025-12-20', '13:00', NULL, NULL, 'in_use', 'Antalya Müzesi', 'Kullanımda - Test verisi'
    UNION ALL SELECT '2025-12-21', '08:30', '2025-12-21', '14:00', 'returned', 'Hadrian Kapısı', 'Test verisi - Aralık 2025'
    UNION ALL SELECT '2025-12-22', '15:45', NULL, NULL, 'in_use', 'MarkAntalya AVM', 'Kullanımda - Test verisi'
) dates
CROSS JOIN LATERAL (SELECT id FROM vehicles WHERE deleted_at IS NULL LIMIT 1) v
CROSS JOIN LATERAL (SELECT id, first_name, last_name FROM managers WHERE deleted_at IS NULL AND is_active = true LIMIT 1) m
CROSS JOIN LATERAL (SELECT id FROM personnel WHERE deleted_at IS NULL LIMIT 1 OFFSET 0) p1
CROSS JOIN LATERAL (SELECT id FROM personnel WHERE deleted_at IS NULL LIMIT 1 OFFSET 1) p2;

-- Eylül 2025 kayıtları (daha eski kayıtlar için)
INSERT INTO vehicle_records (id, vehicle_id, manager_id, manager_name, destination, notes, given_time, return_time, given_date, return_date, status, given_by, returned_by, given_by_name, returned_by_name)
SELECT 
    gen_random_uuid(),
    v.id,
    m.id,
    CONCAT(m.first_name, ' ', m.last_name),
    destination,
    'Test verisi - Eylül 2025',
    given_time::time,
    return_time::time,
    given_date::date,
    return_date::date,
    'returned',
    p1.id,
    p2.id,
    'Hasan Çelik',
    'Ayşe Aydın'
FROM (
    SELECT 
        '2025-09-05' as given_date, '10:00' as given_time, '2025-09-05' as return_date, '18:30' as return_time, 'Karain Mağarası' as destination
    UNION ALL SELECT '2025-09-12', '09:30', '2025-09-12', '16:45', 'Kurşunlu Şelalesi'
    UNION ALL SELECT '2025-09-20', '13:15', '2025-09-20', '19:00', 'Saklıkent Kanyonu'
    UNION ALL SELECT '2025-09-25', '08:45', '2025-09-25', '15:30', 'Phaselis Antik Kenti'
) dates
CROSS JOIN LATERAL (SELECT id FROM vehicles WHERE deleted_at IS NULL LIMIT 1) v
CROSS JOIN LATERAL (SELECT id, first_name, last_name FROM managers WHERE deleted_at IS NULL AND is_active = true LIMIT 1) m
CROSS JOIN LATERAL (SELECT id FROM personnel WHERE deleted_at IS NULL LIMIT 1 OFFSET 0) p1
CROSS JOIN LATERAL (SELECT id FROM personnel WHERE deleted_at IS NULL LIMIT 1 OFFSET 1) p2;

-- Ağustos 2025 kayıtları
INSERT INTO vehicle_records (id, vehicle_id, manager_id, manager_name, destination, notes, given_time, return_time, given_date, return_date, status, given_by, returned_by, given_by_name, returned_by_name)
SELECT 
    gen_random_uuid(),
    v.id,
    m.id,
    CONCAT(m.first_name, ' ', m.last_name),
    destination,
    'Test verisi - Ağustos 2025',
    given_time::time,
    return_time::time,
    given_date::date,
    return_date::date,
    'returned',
    p1.id,
    p2.id,
    'Mustafa Arslan',
    'Elif Yılmaz'
FROM (
    SELECT 
        '2025-08-08' as given_date, '11:00' as given_time, '2025-08-08' as return_date, '17:30' as return_time, 'Myra Antik Kenti' as destination
    UNION ALL SELECT '2025-08-15', '09:00', '2025-08-15', '15:45', 'Demre Noel Baba Kilisesi'
    UNION ALL SELECT '2025-08-22', '14:30', '2025-08-22', '20:15', 'Olympos Yanartaş'
) dates
CROSS JOIN LATERAL (SELECT id FROM vehicles WHERE deleted_at IS NULL LIMIT 1) v
CROSS JOIN LATERAL (SELECT id, first_name, last_name FROM managers WHERE deleted_at IS NULL AND is_active = true LIMIT 1) m
CROSS JOIN LATERAL (SELECT id FROM personnel WHERE deleted_at IS NULL LIMIT 1 OFFSET 0) p1
CROSS JOIN LATERAL (SELECT id FROM personnel WHERE deleted_at IS NULL LIMIT 1 OFFSET 1) p2;

-- Sonuç: 
-- Ağustos 2025: 3 kayıt
-- Eylül 2025: 4 kayıt
-- Ekim 2025: 5 kayıt
-- Kasım 2025: 7 kayıt
-- Aralık 2025: 8 kayıt (3'ü hala kullanımda)
-- TOPLAM: 27 test kaydı
