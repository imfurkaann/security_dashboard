-- Test data for visitor_records table
-- UTF-8 encoding
-- 50 records with different dates

BEGIN;

-- Get personnel IDs for reference
-- Using first two personnel as entry_by and exit_by

-- Insert 50 test visitor records
INSERT INTO visitor_records (
    full_name,
    company_name,
    vehicle_plate,
    phone,
    visiting_person,
    person_count,
    entry_date,
    entry_time,
    exit_date,
    exit_time,
    status,
    subcontractor_worker,
    for_electric_station,
    notes,
    entry_by,
    entry_by_name,
    exit_by,
    exit_by_name
) VALUES
-- Aralık 2025 kayıtları (çıkış yapılmış)
('Ahmet Yılmaz', 'ABC Teknoloji A.Ş.', '34 ABC 123', '05321234567', 'Mehmet Demir', 2, '2025-12-01', '08:30:00', '2025-12-01', '17:45:00', 'exited', false, false, 'Proje toplantısı için geldi', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş'),
('Ayşe Kaya', 'XYZ İnşaat Ltd.', '06 XYZ 456', '05339876543', 'Fatma Şahin', 3, '2025-12-02', '09:15:00', '2025-12-02', '18:20:00', 'exited', true, false, 'Şantiye denetimi', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk'),
('Mustafa Çelik', 'DEF Mühendislik', '35 DEF 789', '05447654321', 'Can Arslan', 1, '2025-12-03', '10:00:00', '2025-12-03', '16:30:00', 'exited', false, true, 'Elektrik kontrol', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş'),
('Zeynep Aktaş', 'GHI Danışmanlık', '41 GHI 321', '05551112233', 'Mehmet Demir', 2, '2025-12-04', '08:45:00', '2025-12-04', '17:15:00', 'exited', false, false, 'Mali danışmanlık', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk'),
('Emre Koç', 'JKL Yazılım', '34 JKL 654', '05662223344', 'Fatma Şahin', 1, '2025-12-05', '09:30:00', '2025-12-05', '18:45:00', 'exited', false, false, 'Yazılım kurulumu', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş'),

('Selin Yurt', 'MNO Lojistik', '16 MNO 987', '05773334455', 'Can Arslan', 4, '2025-12-06', '07:00:00', '2025-12-06', '15:30:00', 'exited', true, false, 'Malzeme teslimatı', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk'),
('Burak Aydın', 'PQR Enerji', '01 PQR 147', '05884445566', 'Mehmet Demir', 2, '2025-12-07', '08:15:00', '2025-12-07', '16:00:00', 'exited', false, true, 'Trafo kontrolü', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş'),
('Canan Özkan', 'STU Güvenlik', '07 STU 258', '05995556677', 'Fatma Şahin', 3, '2025-12-08', '09:00:00', '2025-12-08', '17:30:00', 'exited', true, false, 'Güvenlik sistemi montajı', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk'),
('Deniz Kılıç', 'VWX Mobilya', '34 VWX 369', '05321119988', 'Can Arslan', 2, '2025-12-09', '10:30:00', '2025-12-09', '18:00:00', 'exited', false, false, 'Mobilya montajı', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş'),
('Elif Türk', 'YZA Temizlik', '06 YZA 741', '05332228877', 'Mehmet Demir', 5, '2025-12-10', '06:30:00', '2025-12-10', '14:45:00', 'exited', true, false, 'Genel temizlik', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk'),

('Furkan Aksoy', 'BCD Klima', '35 BCD 852', '05443337766', 'Fatma Şahin', 2, '2025-12-11', '08:00:00', '2025-12-11', '17:00:00', 'exited', false, false, 'Klima bakımı', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş'),
('Gizem Şen', 'EFG Boya', '41 EFG 963', '05554446655', 'Can Arslan', 3, '2025-12-12', '09:15:00', '2025-12-12', '18:30:00', 'exited', true, false, 'Boya işleri', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk'),
('Hakan Demirci', 'HIJ Elektrik', '34 HIJ 159', '05665555544', 'Mehmet Demir', 1, '2025-12-13', '10:00:00', '2025-12-13', '16:45:00', 'exited', false, true, 'Elektrik tesisatı', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş'),
('İrem Bozkurt', 'KLM Cam', '16 KLM 357', '05776664433', 'Fatma Şahin', 2, '2025-12-14', '08:30:00', '2025-12-14', '15:00:00', 'exited', false, false, 'Cam montajı', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk'),
('Kaan Avcı', 'NOP Asansör', '01 NOP 753', '05887773322', 'Can Arslan', 2, '2025-12-15', '07:30:00', '2025-12-15', '19:00:00', 'exited', true, false, 'Asansör bakımı', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş'),

('Leman Yalçın', 'QRS Peyzaj', '07 QRS 951', '05998882211', 'Mehmet Demir', 4, '2025-12-16', '08:00:00', '2025-12-16', '17:30:00', 'exited', false, false, 'Bahçe düzenlemesi', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk'),
('Murat Çakır', 'TUV Sıhhi Tesisat', '34 TUV 486', '05321230099', 'Fatma Şahin', 2, '2025-12-17', '09:00:00', '2025-12-17', '18:15:00', 'exited', true, false, 'Su tesisatı onarımı', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş'),
('Nalan Özer', 'WXY Yangın', '06 WXY 624', '05339871188', 'Can Arslan', 3, '2025-12-18', '10:30:00', '2025-12-18', '16:00:00', 'exited', false, false, 'Yangın söndürme sistemi kontrolü', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk'),
('Oğuz Taş', 'ZAB Havalandırma', '35 ZAB 135', '05447652277', 'Mehmet Demir', 1, '2025-12-19', '08:45:00', '2025-12-19', '17:45:00', 'exited', false, false, 'Havalandırma sistemi', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş'),
('Pelin Çetin', 'CDE Alarm', '41 CDE 246', '05551113366', 'Fatma Şahin', 2, '2025-12-20', '09:30:00', '2025-12-20', '18:00:00', 'exited', true, false, 'Alarm sistemi kurulumu', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk'),

-- Aralık sonu kayıtları (bazıları hala içeride)
('Recep Kurt', 'FGH İzolasyon', '34 FGH 789', '05662224455', 'Can Arslan', 3, '2025-12-21', '07:00:00', '2025-12-21', '15:30:00', 'exited', true, false, 'İzolasyon işleri', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş'),
('Seda Polat', 'IJK Network', '16 IJK 321', '05773335544', 'Mehmet Demir', 1, '2025-12-22', '08:30:00', '2025-12-22', '17:00:00', 'exited', false, false, 'Ağ altyapısı kurulumu', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk'),
('Tolga Şimşek', 'LMN Vinç', '01 LMN 654', '05884446633', 'Fatma Şahin', 2, '2025-12-23', '06:00:00', NULL, NULL, 'inside', true, false, 'Vinç operasyonu', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş', NULL, NULL),
('Ufuk Yavuz', 'OPQ Jeneratör', '07 OPQ 987', '05995557722', 'Can Arslan', 1, '2025-12-23', '08:00:00', NULL, NULL, 'inside', false, true, 'Jeneratör kurulumu', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk', NULL, NULL),
('Vildan Tekin', 'RST Hırdavat', '34 RST 147', '05321238811', 'Mehmet Demir', 2, '2025-12-23', '09:00:00', NULL, NULL, 'inside', false, false, 'Hırdavat malzeme teslimatı', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş', NULL, NULL),

('Yasemin Ünal', 'UVW Dekorasyon', '06 UVW 258', '05339879900', 'Fatma Şahin', 3, '2025-12-23', '10:00:00', NULL, NULL, 'inside', false, false, 'Dekorasyon çalışması', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk', NULL, NULL),
('Zafer Erdem', 'XYZ Tadilat', '35 XYZ 369', '05447650088', 'Can Arslan', 2, '2025-12-23', '11:00:00', NULL, NULL, 'inside', true, false, 'Tadilat işleri', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş', NULL, NULL),
('Aylin Karaca', 'ABC Danışman', '41 ABC 741', '05551117799', 'Mehmet Demir', 1, '2025-12-23', '12:00:00', NULL, NULL, 'inside', false, false, 'Danışmanlık hizmeti', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk', NULL, NULL),
('Berat Yıldırım', 'DEF Kamera', '34 DEF 852', '05662228866', 'Fatma Şahin', 2, '2025-12-23', '13:00:00', NULL, NULL, 'inside', false, false, 'Güvenlik kamerası montajı', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş', NULL, NULL),
('Ceyda Doğan', 'GHI IT Destek', '16 GHI 963', '05773339955', 'Can Arslan', 1, '2025-12-23', '14:00:00', NULL, NULL, 'inside', false, false, 'IT destek hizmeti', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk', NULL, NULL),

-- Kasım 2025 kayıtları
('Doruk Acar', 'JKL Nakliyat', '01 JKL 456', '05884440044', 'Mehmet Demir', 4, '2025-11-25', '08:00:00', '2025-11-25', '16:30:00', 'exited', true, false, 'Malzeme taşıma', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş'),
('Esra Mutlu', 'MNO Tekstil', '07 MNO 789', '05995551133', 'Fatma Şahin', 2, '2025-11-26', '09:30:00', '2025-11-26', '17:45:00', 'exited', false, false, 'Kumaş teslimatı', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk'),
('Ferhat Öztürk', 'PQR Metal', '34 PQR 321', '05321237722', 'Can Arslan', 3, '2025-11-27', '07:30:00', '2025-11-27', '18:00:00', 'exited', true, false, 'Metal işleme', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş'),
('Gamze Arslan', 'STU Plastik', '06 STU 654', '05339878811', 'Mehmet Demir', 2, '2025-11-28', '08:15:00', '2025-11-28', '16:45:00', 'exited', false, false, 'Plastik kalıp', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk'),
('Hüseyin Bayrak', 'VWX Otomasyon', '35 VWX 987', '05447659900', 'Fatma Şahin', 1, '2025-11-29', '10:00:00', '2025-11-29', '18:30:00', 'exited', false, true, 'Otomasyon sistemi', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş'),

('İpek Çalışkan', 'YZA Laboratuvar', '41 YZA 159', '05551116688', 'Can Arslan', 2, '2025-11-30', '09:00:00', '2025-11-30', '17:15:00', 'exited', false, false, 'Numune analizi', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk'),

-- Ekim 2025 kayıtları
('Kerem Bulut', 'BCD Seramik', '34 BCD 357', '05662227755', 'Mehmet Demir', 3, '2025-10-15', '08:30:00', '2025-10-15', '17:00:00', 'exited', true, false, 'Seramik döşeme', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş'),
('Lale Özkaya', 'EFG Ahşap', '16 EFG 753', '05773338844', 'Fatma Şahin', 2, '2025-10-16', '09:15:00', '2025-10-16', '18:15:00', 'exited', false, false, 'Ahşap işleri', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk'),
('Mehmet Kaplan', 'HIJ Torna', '01 HIJ 951', '05884449933', 'Can Arslan', 1, '2025-10-17', '07:00:00', '2025-10-17', '15:30:00', 'exited', true, false, 'Torna işleme', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş'),
('Nilay Turan', 'KLM Basım', '07 KLM 486', '05995550022', 'Mehmet Demir', 2, '2025-10-18', '10:00:00', '2025-10-18', '17:30:00', 'exited', false, false, 'Baskı işleri', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk'),
('Orhan Kara', 'NOP Kaynak', '34 NOP 624', '05321236611', 'Fatma Şahin', 3, '2025-10-19', '08:00:00', '2025-10-19', '16:00:00', 'exited', true, false, 'Kaynak işleri', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş'),

('Pınar Çiçek', 'QRS Soğutma', '06 QRS 135', '05339876600', 'Can Arslan', 2, '2025-10-20', '09:30:00', '2025-10-20', '18:00:00', 'exited', false, true, 'Soğutma sistemi', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk'),
('Ramazan Özdemir', 'TUV Folyo', '35 TUV 246', '05447658899', 'Mehmet Demir', 1, '2025-10-21', '08:45:00', '2025-10-21', '17:45:00', 'exited', false, false, 'Folyo kaplama', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş'),
('Sibel Aydoğan', 'WXY Paketleme', '41 WXY 789', '05551115577', 'Fatma Şahin', 4, '2025-10-22', '07:30:00', '2025-10-22', '15:45:00', 'exited', true, false, 'Paketleme hizmeti', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk'),
('Taner Yücel', 'ZAB Etiketi', '34 ZAB 321', '05662226644', 'Can Arslan', 2, '2025-10-23', '10:15:00', '2025-10-23', '18:30:00', 'exited', false, false, 'Etiket üretimi', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş'),
('Ümit Güler', 'CDE Ambalaj', '16 CDE 654', '05773337733', 'Mehmet Demir', 3, '2025-10-24', '09:00:00', '2025-10-24', '17:00:00', 'exited', false, false, 'Ambalaj malzemesi', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk'),

('Vahide Koca', 'FGH Test', '01 FGH 987', '05884448822', 'Fatma Şahin', 1, '2025-10-25', '08:00:00', '2025-10-25', '16:30:00', 'exited', false, false, 'Test ve ölçüm', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş'),
('Yalçın Başaran', 'IJK Kalibrasyon', '07 IJK 147', '05995559911', 'Can Arslan', 2, '2025-10-26', '09:45:00', '2025-10-26', '18:15:00', 'exited', false, true, 'Cihaz kalibrasyonu', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk'),
('Zehra İlhan', 'LMN Etüd', '34 LMN 258', '05321235500', 'Mehmet Demir', 1, '2025-10-27', '10:30:00', '2025-10-27', '17:30:00', 'exited', false, false, 'Etüd çalışması', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş', '7fefebfd-ef8d-4f05-89f8-7fe22f40d52b', 'Ali Güneş'),
('Aslı Demirtaş', 'OPQ Raporlama', '06 OPQ 369', '05339875599', 'Fatma Şahin', 2, '2025-10-28', '08:30:00', '2025-10-28', '16:45:00', 'exited', false, false, 'Rapor hazırlama', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk', '1cec7a33-4764-432c-9480-7285965e5f78', 'Veli Öztürk');

COMMIT;

-- Display summary
SELECT 
    status,
    COUNT(*) as kayit_sayisi
FROM visitor_records
GROUP BY status
ORDER BY status;

SELECT 
    TO_CHAR(entry_date, 'YYYY-MM') as ay,
    COUNT(*) as kayit_sayisi
FROM visitor_records
GROUP BY TO_CHAR(entry_date, 'YYYY-MM')
ORDER BY ay DESC;
