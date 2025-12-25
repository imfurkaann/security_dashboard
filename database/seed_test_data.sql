-- Test Verisi Ekleme Script'i
-- Tüm tablolara farklı tarihlerde 100'er kayıt ekler

-- Önce mevcut ID'leri alalım
DO $$
DECLARE
    manager_ids UUID[];
    vehicle_ids UUID[];
    personnel_ids UUID[];
    manager_id UUID;
    vehicle_id UUID;
    personnel_id UUID;
    i INTEGER;
    random_date DATE;
    random_time TIME;
    exit_time TIME;
BEGIN
    -- Mevcut manager ID'lerini al
    SELECT ARRAY_AGG(id) INTO manager_ids FROM managers WHERE deleted_at IS NULL LIMIT 10;
    
    -- Mevcut vehicle ID'lerini al
    SELECT ARRAY_AGG(id) INTO vehicle_ids FROM vehicles WHERE deleted_at IS NULL LIMIT 10;
    
    -- Mevcut personnel ID'lerini al
    SELECT ARRAY_AGG(id) INTO personnel_ids FROM personnel WHERE deleted_at IS NULL LIMIT 10;
    
    -- Eğer manager yoksa, örnek manager ekle
    IF manager_ids IS NULL OR array_length(manager_ids, 1) IS NULL THEN
        INSERT INTO managers (id, first_name, last_name, title, department) VALUES
            (uuid_generate_v4(), 'Ahmet', 'Yılmaz', 'Genel Müdür', 'Yönetim'),
            (uuid_generate_v4(), 'Mehmet', 'Kaya', 'Üretim Müdürü', 'Üretim'),
            (uuid_generate_v4(), 'Ali', 'Demir', 'Finans Müdürü', 'Finans'),
            (uuid_generate_v4(), 'Ayşe', 'Çelik', 'İK Müdürü', 'İnsan Kaynakları'),
            (uuid_generate_v4(), 'Fatma', 'Öztürk', 'Satış Müdürü', 'Satış');
        SELECT ARRAY_AGG(id) INTO manager_ids FROM managers WHERE deleted_at IS NULL LIMIT 10;
    END IF;
    
    -- Eğer vehicle yoksa, örnek vehicle ekle
    IF vehicle_ids IS NULL OR array_length(vehicle_ids, 1) IS NULL THEN
        INSERT INTO vehicles (id, plate, brand, model, color) VALUES
            (uuid_generate_v4(), '34ABC123', 'Toyota', 'Corolla', 'Beyaz'),
            (uuid_generate_v4(), '34DEF456', 'Ford', 'Focus', 'Siyah'),
            (uuid_generate_v4(), '34GHI789', 'Volkswagen', 'Passat', 'Gri'),
            (uuid_generate_v4(), '06JKL012', 'Renault', 'Megane', 'Mavi'),
            (uuid_generate_v4(), '35MNO345', 'Fiat', 'Egea', 'Kırmızı');
        SELECT ARRAY_AGG(id) INTO vehicle_ids FROM vehicles WHERE deleted_at IS NULL LIMIT 10;
    END IF;
    
    RAISE NOTICE 'Managers: %, Vehicles: %, Personnel: %', 
        array_length(manager_ids, 1), 
        array_length(vehicle_ids, 1), 
        array_length(personnel_ids, 1);

    -- 1. MANAGERS_RECORDS - 100 kayıt ekle (son 30 gün)
    FOR i IN 1..100 LOOP
        random_date := CURRENT_DATE - (random() * 30)::integer;
        random_time := ('08:00:00'::time + (random() * interval '8 hours'));
        exit_time := random_time + (random() * interval '4 hours') + interval '1 hour';
        manager_id := manager_ids[1 + (random() * (array_length(manager_ids, 1) - 1))::integer];
        personnel_id := personnel_ids[1 + (random() * (array_length(personnel_ids, 1) - 1))::integer];
        
        INSERT INTO managers_records (
            id, manager_id, manager_name, entry_date, entry_time, exit_date, exit_time,
            entry_by, entry_by_name, exit_by, exit_by_name, status, notes
        ) VALUES (
            uuid_generate_v4(),
            manager_id,
            (SELECT first_name || ' ' || last_name FROM managers WHERE id = manager_id),
            random_date,
            random_time,
            random_date,
            exit_time,
            personnel_id,
            (SELECT first_name || ' ' || last_name FROM personnel WHERE id = personnel_id),
            personnel_id,
            (SELECT first_name || ' ' || last_name FROM personnel WHERE id = personnel_id),
            CASE WHEN random() > 0.3 THEN 'exited' ELSE 'inside' END,
            'Test verisi - ' || i
        );
    END LOOP;
    RAISE NOTICE 'Managers_records: 100 kayıt eklendi';

    -- 2. VEHICLE_RECORDS - 100 kayıt ekle
    FOR i IN 1..100 LOOP
        random_date := CURRENT_DATE - (random() * 30)::integer;
        random_time := ('07:00:00'::time + (random() * interval '10 hours'));
        vehicle_id := vehicle_ids[1 + (random() * (array_length(vehicle_ids, 1) - 1))::integer];
        personnel_id := personnel_ids[1 + (random() * (array_length(personnel_ids, 1) - 1))::integer];
        manager_id := manager_ids[1 + (random() * (array_length(manager_ids, 1) - 1))::integer];
        
        INSERT INTO vehicle_records (
            id, vehicle_id, manager_id, manager_name, destination, given_date, given_time,
            return_date, return_time, given_by, given_by_name, returned_by, returned_by_name,
            status, notes
        ) VALUES (
            uuid_generate_v4(),
            vehicle_id,
            manager_id,
            (SELECT first_name || ' ' || last_name FROM managers WHERE id = manager_id),
            CASE (random() * 4)::integer 
                WHEN 0 THEN 'Ankara'
                WHEN 1 THEN 'İstanbul'
                WHEN 2 THEN 'İzmir'
                WHEN 3 THEN 'Bursa'
                ELSE 'Fabrika'
            END,
            random_date,
            random_time,
            CASE WHEN random() > 0.4 THEN random_date ELSE NULL END,
            CASE WHEN random() > 0.4 THEN random_time + interval '3 hours' ELSE NULL END,
            personnel_id,
            (SELECT first_name || ' ' || last_name FROM personnel WHERE id = personnel_id),
            CASE WHEN random() > 0.4 THEN personnel_id ELSE NULL END,
            CASE WHEN random() > 0.4 THEN (SELECT first_name || ' ' || last_name FROM personnel WHERE id = personnel_id) ELSE NULL END,
            CASE WHEN random() > 0.4 THEN 'returned' ELSE 'in_use' END,
            'Test araç kaydı - ' || i
        );
    END LOOP;
    RAISE NOTICE 'Vehicle_records: 100 kayıt eklendi';

    -- 3. VISITOR_RECORDS - 100 kayıt ekle
    FOR i IN 1..100 LOOP
        random_date := CURRENT_DATE - (random() * 30)::integer;
        random_time := ('08:00:00'::time + (random() * interval '9 hours'));
        personnel_id := personnel_ids[1 + (random() * (array_length(personnel_ids, 1) - 1))::integer];
        manager_id := manager_ids[1 + (random() * (array_length(manager_ids, 1) - 1))::integer];
        
        INSERT INTO visitor_records (
            id, vehicle_plate, full_name, company_name, visiting_person, person_count,
            phone, entry_date, entry_time, exit_date, exit_time,
            entry_by, entry_by_name, exit_by, exit_by_name,
            subcontractor_worker, for_electric_station, status, notes
        ) VALUES (
            uuid_generate_v4(),
            (random() * 99)::integer || 'ABC' || (random() * 999)::integer,
            CASE (random() * 5)::integer
                WHEN 0 THEN 'Hasan Korkmaz'
                WHEN 1 THEN 'Veli Şahin'
                WHEN 2 THEN 'Kemal Arslan'
                WHEN 3 THEN 'Zeynep Aydın'
                WHEN 4 THEN 'Elif Yıldız'
                ELSE 'Mustafa Çetin'
            END,
            CASE (random() * 4)::integer
                WHEN 0 THEN 'ABC Ltd. Şti.'
                WHEN 1 THEN 'XYZ A.Ş.'
                WHEN 2 THEN 'Demir Sanayi'
                WHEN 3 THEN 'Teknoloji A.Ş.'
                ELSE 'Malzeme Ltd.'
            END,
            (SELECT first_name || ' ' || last_name FROM managers WHERE id = manager_id),
            1 + (random() * 4)::integer,
            '05' || (30 + (random() * 20)::integer) || (1000000 + (random() * 8999999)::integer)::text,
            random_date,
            random_time,
            CASE WHEN random() > 0.3 THEN random_date ELSE NULL END,
            CASE WHEN random() > 0.3 THEN random_time + interval '2 hours' ELSE NULL END,
            personnel_id,
            (SELECT first_name || ' ' || last_name FROM personnel WHERE id = personnel_id),
            CASE WHEN random() > 0.3 THEN personnel_id ELSE NULL END,
            CASE WHEN random() > 0.3 THEN (SELECT first_name || ' ' || last_name FROM personnel WHERE id = personnel_id) ELSE NULL END,
            random() > 0.8,
            random() > 0.9,
            CASE WHEN random() > 0.3 THEN 'exited' ELSE 'inside' END,
            'Ziyaretçi test kaydı - ' || i
        );
    END LOOP;
    RAISE NOTICE 'Visitor_records: 100 kayıt eklendi';

    -- 4. FIRE_ALARMS - 100 kayıt ekle
    FOR i IN 1..100 LOOP
        random_date := CURRENT_DATE - (random() * 30)::integer;
        random_time := (random() * interval '24 hours')::time;
        personnel_id := personnel_ids[1 + (random() * (array_length(personnel_ids, 1) - 1))::integer];
        
        INSERT INTO fire_alarms (
            id, alarm_number, location, alarm_time, resolved, resolution_time,
            false_alarm, resolution_notes, recorded_by, recorded_by_name,
            resolved_by, resolved_by_name
        ) VALUES (
            uuid_generate_v4(),
            'FA-' || LPAD(i::text, 4, '0'),
            CASE (random() * 6)::integer
                WHEN 0 THEN 'A Blok 1. Kat'
                WHEN 1 THEN 'B Blok Zemin'
                WHEN 2 THEN 'Üretim Hattı 1'
                WHEN 3 THEN 'Depo Alanı'
                WHEN 4 THEN 'Yemekhane'
                WHEN 5 THEN 'Otopark'
                ELSE 'İdari Bina'
            END,
            random_date + random_time,
            random() > 0.2,
            CASE WHEN random() > 0.2 THEN random_date + random_time + interval '30 minutes' ELSE NULL END,
            random() > 0.7,
            CASE WHEN random() > 0.2 THEN 'Alarm kontrol edildi, test kaydı - ' || i ELSE NULL END,
            personnel_id,
            (SELECT first_name || ' ' || last_name FROM personnel WHERE id = personnel_id),
            CASE WHEN random() > 0.2 THEN personnel_id ELSE NULL END,
            CASE WHEN random() > 0.2 THEN (SELECT first_name || ' ' || last_name FROM personnel WHERE id = personnel_id) ELSE NULL END
        );
    END LOOP;
    RAISE NOTICE 'Fire_alarms: 100 kayıt eklendi';

    -- 5. INCIDENTS - 100 kayıt ekle (Vardiya raporları)
    FOR i IN 1..100 LOOP
        random_date := CURRENT_DATE - (random() * 30)::integer;
        personnel_id := personnel_ids[1 + (random() * (array_length(personnel_ids, 1) - 1))::integer];
        
        INSERT INTO incidents (
            id, incident_type, severity, location, description,
            incident_time, resolved, resolution_notes, resolved_at,
            recorded_by, resolved_by, report_date, shift_label, report_content
        ) VALUES (
            uuid_generate_v4(),
            CASE (random() * 4)::integer
                WHEN 0 THEN 'security'
                WHEN 1 THEN 'safety'
                WHEN 2 THEN 'maintenance'
                WHEN 3 THEN 'visitor'
                ELSE 'general'
            END,
            CASE (random() * 3)::integer
                WHEN 0 THEN 'low'
                WHEN 1 THEN 'medium'
                WHEN 2 THEN 'high'
                ELSE 'low'
            END,
            CASE (random() * 5)::integer
                WHEN 0 THEN 'Ana Giriş'
                WHEN 1 THEN 'Üretim Alanı'
                WHEN 2 THEN 'Depo'
                WHEN 3 THEN 'Otopark'
                WHEN 4 THEN 'İdari Bina'
                ELSE 'Fabrika Çevresi'
            END,
            'Vardiya raporu - Test kaydı ' || i || '. Rutin kontroller yapıldı.',
            random_date + ('08:00:00'::time + (random() * interval '16 hours')),
            random() > 0.3,
            CASE WHEN random() > 0.3 THEN 'Durum çözüldü, kayıt kapatıldı.' ELSE NULL END,
            CASE WHEN random() > 0.3 THEN random_date + interval '2 hours' ELSE NULL END,
            personnel_id,
            CASE WHEN random() > 0.3 THEN personnel_id ELSE NULL END,
            random_date,
            CASE (random() * 2)::integer
                WHEN 0 THEN '08:00-16:00'
                WHEN 1 THEN '16:00-00:00'
                ELSE '00:00-08:00'
            END,
            'Vardiya süresince yapılan kontroller ve gözlemler. Test verisi ' || i
        );
    END LOOP;
    RAISE NOTICE 'Incidents: 100 kayıt eklendi';

    RAISE NOTICE 'Tüm test verileri başarıyla eklendi!';
END $$;

-- Sonuçları kontrol et
SELECT 'managers_records' as tablo, COUNT(*) as kayit_sayisi FROM managers_records WHERE deleted_at IS NULL
UNION ALL
SELECT 'vehicle_records', COUNT(*) FROM vehicle_records WHERE deleted_at IS NULL
UNION ALL
SELECT 'visitor_records', COUNT(*) FROM visitor_records WHERE deleted_at IS NULL
UNION ALL
SELECT 'fire_alarms', COUNT(*) FROM fire_alarms WHERE deleted_at IS NULL
UNION ALL
SELECT 'incidents', COUNT(*) FROM incidents WHERE deleted_at IS NULL;
