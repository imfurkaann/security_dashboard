-- Test data for managers_records table
-- UTF-8 encoding
-- 50 records with different dates

BEGIN;

-- First get some personnel IDs to use as entry_by and exit_by
-- Using first two personnel as entry_by and exit_by

-- Insert 50 test manager records
INSERT INTO managers_records (
    manager_id,
    manager_name,
    entry_date,
    entry_time,
    exit_date,
    exit_time,
    status,
    notes,
    entry_by,
    exit_by
) VALUES
-- Aralık 2025 kayıtları (çıkış yapılmış)
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 0), 'Ahmet Yılmaz', '2025-12-01', '08:00:00', '2025-12-01', '17:30:00', 'exited', 'Toplantı için geldi', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 1), 'Ayşe Demir', '2025-12-02', '09:00:00', '2025-12-02', '18:00:00', 'exited', 'Proje değerlendirmesi', '1cec7a33-4764-432c-9480-7285965e5f78', '1cec7a33-4764-432c-9480-7285965e5f78'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 2), 'Mehmet Kaya', '2025-12-03', '08:30:00', '2025-12-03', '17:00:00', 'exited', 'Bütçe görüşmesi', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 0), 'Ahmet Yılmaz', '2025-12-04', '09:30:00', '2025-12-04', '18:30:00', 'exited', 'Stratejik planlama toplantısı', '1cec7a33-4764-432c-9480-7285965e5f78', '1cec7a33-4764-432c-9480-7285965e5f78'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 3), 'Fatma Şahin', '2025-12-05', '08:15:00', '2025-12-05', '16:45:00', 'exited', 'Müşteri ziyareti', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b'),

((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 1), 'Ayşe Demir', '2025-12-06', '07:30:00', '2025-12-06', '15:30:00', 'exited', 'Erken mesai', '1cec7a33-4764-432c-9480-7285965e5f78', '1cec7a33-4764-432c-9480-7285965e5f78'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 4), 'Can Arslan', '2025-12-07', '08:00:00', '2025-12-07', '17:00:00', 'exited', 'Rutin kontrol', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 2), 'Mehmet Kaya', '2025-12-08', '09:00:00', '2025-12-08', '18:00:00', 'exited', 'Departman toplantısı', '1cec7a33-4764-432c-9480-7285965e5f78', '1cec7a33-4764-432c-9480-7285965e5f78'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 5), 'Zeynep Yıldız', '2025-12-09', '08:30:00', '2025-12-09', '17:30:00', 'exited', 'İnsan kaynakları görüşmesi', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 0), 'Ahmet Yılmaz', '2025-12-10', '09:15:00', '2025-12-10', '18:15:00', 'exited', 'Mali denetim', '1cec7a33-4764-432c-9480-7285965e5f78', '1cec7a33-4764-432c-9480-7285965e5f78'),

((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 3), 'Fatma Şahin', '2025-12-11', '08:00:00', '2025-12-11', '16:00:00', 'exited', 'Performans değerlendirmesi', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 1), 'Ayşe Demir', '2025-12-12', '09:00:00', '2025-12-12', '17:00:00', 'exited', 'Satış raporu incelemesi', '1cec7a33-4764-432c-9480-7285965e5f78', '1cec7a33-4764-432c-9480-7285965e5f78'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 4), 'Can Arslan', '2025-12-13', '08:30:00', '2025-12-13', '17:30:00', 'exited', 'Teknik toplantı', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 2), 'Mehmet Kaya', '2025-12-14', '07:45:00', '2025-12-14', '15:45:00', 'exited', 'Sabah toplantısı', '1cec7a33-4764-432c-9480-7285965e5f78', '1cec7a33-4764-432c-9480-7285965e5f78'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 5), 'Zeynep Yıldız', '2025-12-15', '09:00:00', '2025-12-15', '18:00:00', 'exited', 'Personel mülakat', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b'),

((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 0), 'Ahmet Yılmaz', '2025-12-16', '08:00:00', '2025-12-16', '17:00:00', 'exited', 'Yönetim kurulu toplantısı', '1cec7a33-4764-432c-9480-7285965e5f78', '1cec7a33-4764-432c-9480-7285965e5f78'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 3), 'Fatma Şahin', '2025-12-17', '09:30:00', '2025-12-17', '18:30:00', 'exited', 'İş geliştirme görüşmesi', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 1), 'Ayşe Demir', '2025-12-18', '08:15:00', '2025-12-18', '16:15:00', 'exited', 'Kalite kontrol incelemesi', '1cec7a33-4764-432c-9480-7285965e5f78', '1cec7a33-4764-432c-9480-7285965e5f78'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 4), 'Can Arslan', '2025-12-19', '08:30:00', '2025-12-19', '17:30:00', 'exited', 'Operasyon toplantısı', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 2), 'Mehmet Kaya', '2025-12-20', '09:00:00', '2025-12-20', '18:00:00', 'exited', 'Yıl sonu değerlendirmesi', '1cec7a33-4764-432c-9480-7285965e5f78', '1cec7a33-4764-432c-9480-7285965e5f78'),

-- Aralık sonu kayıtları (bazıları hala içeride)
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 5), 'Zeynep Yıldız', '2025-12-21', '08:00:00', '2025-12-21', '16:00:00', 'exited', 'İşe alım süreci', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 0), 'Ahmet Yılmaz', '2025-12-22', '09:00:00', '2025-12-22', '17:00:00', 'exited', 'Stratejik değerlendirme', '1cec7a33-4764-432c-9480-7285965e5f78', '1cec7a33-4764-432c-9480-7285965e5f78'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 3), 'Fatma Şahin', '2025-12-23', '08:00:00', NULL, NULL, 'inside', 'Günlük rutin kontrol', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', NULL),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 1), 'Ayşe Demir', '2025-12-23', '09:00:00', NULL, NULL, 'inside', 'Departman koordinasyonu', '1cec7a33-4764-432c-9480-7285965e5f78', NULL),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 2), 'Mehmet Kaya', '2025-12-23', '08:30:00', NULL, NULL, 'inside', 'Bütçe planlaması', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', NULL),

((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 4), 'Can Arslan', '2025-12-23', '10:00:00', NULL, NULL, 'inside', 'Teknik kontrol', '1cec7a33-4764-432c-9480-7285965e5f78', NULL),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 5), 'Zeynep Yıldız', '2025-12-23', '11:00:00', NULL, NULL, 'inside', 'Personel görüşmesi', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', NULL),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 0), 'Ahmet Yılmaz', '2025-12-23', '12:00:00', NULL, NULL, 'inside', 'Öğle sonrası toplantı', '1cec7a33-4764-432c-9480-7285965e5f78', NULL),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 3), 'Fatma Şahin', '2025-12-23', '13:00:00', NULL, NULL, 'inside', 'Müşteri görüşmesi', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', NULL),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 1), 'Ayşe Demir', '2025-12-23', '14:00:00', NULL, NULL, 'inside', 'Rapor hazırlama', '1cec7a33-4764-432c-9480-7285965e5f78', NULL),

-- Kasım 2025 kayıtları
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 2), 'Mehmet Kaya', '2025-11-25', '08:00:00', '2025-11-25', '17:00:00', 'exited', 'Ay sonu değerlendirmesi', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 4), 'Can Arslan', '2025-11-26', '09:00:00', '2025-11-26', '18:00:00', 'exited', 'Proje başlangıcı', '1cec7a33-4764-432c-9480-7285965e5f78', '1cec7a33-4764-432c-9480-7285965e5f78'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 5), 'Zeynep Yıldız', '2025-11-27', '08:30:00', '2025-11-27', '17:30:00', 'exited', 'Eğitim programı değerlendirmesi', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 0), 'Ahmet Yılmaz', '2025-11-28', '09:15:00', '2025-11-28', '18:15:00', 'exited', 'Yönetim raporu', '1cec7a33-4764-432c-9480-7285965e5f78', '1cec7a33-4764-432c-9480-7285965e5f78'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 3), 'Fatma Şahin', '2025-11-29', '08:00:00', '2025-11-29', '16:00:00', 'exited', 'İş ortağı toplantısı', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b'),

((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 1), 'Ayşe Demir', '2025-11-30', '09:00:00', '2025-11-30', '17:00:00', 'exited', 'Kasım kapanış toplantısı', '1cec7a33-4764-432c-9480-7285965e5f78', '1cec7a33-4764-432c-9480-7285965e5f78'),

-- Ekim 2025 kayıtları
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 2), 'Mehmet Kaya', '2025-10-15', '08:00:00', '2025-10-15', '17:00:00', 'exited', 'Çeyrek değerlendirmesi', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 4), 'Can Arslan', '2025-10-16', '09:00:00', '2025-10-16', '18:00:00', 'exited', 'Teknoloji güncellemesi', '1cec7a33-4764-432c-9480-7285965e5f78', '1cec7a33-4764-432c-9480-7285965e5f78'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 5), 'Zeynep Yıldız', '2025-10-17', '08:30:00', '2025-10-17', '17:30:00', 'exited', 'Yetenek yönetimi', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 0), 'Ahmet Yılmaz', '2025-10-18', '09:00:00', '2025-10-18', '18:00:00', 'exited', 'İş süreçleri iyileştirme', '1cec7a33-4764-432c-9480-7285965e5f78', '1cec7a33-4764-432c-9480-7285965e5f78'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 3), 'Fatma Şahin', '2025-10-19', '08:00:00', '2025-10-19', '16:00:00', 'exited', 'Satış hedefleri belirleme', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b'),

((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 1), 'Ayşe Demir', '2025-10-20', '09:30:00', '2025-10-20', '18:30:00', 'exited', 'Departman koordinasyonu', '1cec7a33-4764-432c-9480-7285965e5f78', '1cec7a33-4764-432c-9480-7285965e5f78'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 2), 'Mehmet Kaya', '2025-10-21', '08:15:00', '2025-10-21', '17:15:00', 'exited', 'Mali analiz', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 4), 'Can Arslan', '2025-10-22', '08:30:00', '2025-10-22', '17:30:00', 'exited', 'Teknik denetim', '1cec7a33-4764-432c-9480-7285965e5f78', '1cec7a33-4764-432c-9480-7285965e5f78'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 5), 'Zeynep Yıldız', '2025-10-23', '09:00:00', '2025-10-23', '18:00:00', 'exited', 'Performans görüşmesi', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 0), 'Ahmet Yılmaz', '2025-10-24', '08:00:00', '2025-10-24', '17:00:00', 'exited', 'Strateji toplantısı', '1cec7a33-4764-432c-9480-7285965e5f78', '1cec7a33-4764-432c-9480-7285965e5f78'),

((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 3), 'Fatma Şahin', '2025-10-25', '08:30:00', '2025-10-25', '17:30:00', 'exited', 'Pazar araştırması değerlendirmesi', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 1), 'Ayşe Demir', '2025-10-26', '09:00:00', '2025-10-26', '18:00:00', 'exited', 'Kalite iyileştirme', '1cec7a33-4764-432c-9480-7285965e5f78', '1cec7a33-4764-432c-9480-7285965e5f78'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 2), 'Mehmet Kaya', '2025-10-27', '08:00:00', '2025-10-27', '16:00:00', 'exited', 'Bütçe revizyon toplantısı', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b'),
((SELECT id FROM managers WHERE is_active = true ORDER BY first_name LIMIT 1 OFFSET 4), 'Can Arslan', '2025-10-28', '09:30:00', '2025-10-28', '18:30:00', 'exited', 'Operasyonel verimlilik', '1cec7a33-4764-432c-9480-7285965e5f78', '1cec7a33-4764-432c-9480-7285965e5f78');

COMMIT;

-- Display summary
SELECT 
    status,
    COUNT(*) as kayit_sayisi
FROM managers_records
GROUP BY status
ORDER BY status;

SELECT 
    TO_CHAR(entry_date, 'YYYY-MM') as ay,
    COUNT(*) as kayit_sayisi
FROM managers_records
GROUP BY TO_CHAR(entry_date, 'YYYY-MM')
ORDER BY ay DESC;
