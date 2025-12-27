-- Test verisi: 200 adet olay raporu ve kategorileri
-- Rastgele kategorilerle birlikte vardiya raporları oluşturur

DO $$
DECLARE
    incident_uuid UUID;
    shift_labels TEXT[] := ARRAY['00:00-08:00', '08:00-16:00', '16:00-00:00'];
    shift_label TEXT;
    report_date DATE;
    i INTEGER;
BEGIN
    -- 200 adet vardiya raporu oluştur (son 6 ay içinde)
    FOR i IN 1..200 LOOP
        -- Rastgele UUID oluştur
        incident_uuid := gen_random_uuid();
        
        -- Rastgele tarih (son 180 gün içinde)
        report_date := CURRENT_DATE - (random() * 180)::INTEGER;
        
        -- Rastgele vardiya seç
        shift_label := shift_labels[1 + floor(random() * 3)::INTEGER];
        
        -- Incidents tablosuna rapor ekle
        INSERT INTO incidents (
            id, 
            shift_label, 
            report_content, 
            description, 
            incident_type, 
            severity, 
            resolved, 
            recorded_by,
            incident_time,
            report_date,
            created_at
        ) VALUES (
            incident_uuid,
            shift_label,
            'Test vardiya raporu içeriği - ' || i::TEXT,
            'Vardiya Raporu: ' || shift_label,
            'general',
            'low',
            false,
            (SELECT id FROM personnel WHERE role = 'personnel' LIMIT 1),
            report_date + (shift_label = '00:00-08:00')::INTEGER * INTERVAL '4 hours' 
                       + (shift_label = '08:00-16:00')::INTEGER * INTERVAL '12 hours'
                       + (shift_label = '16:00-00:00')::INTEGER * INTERVAL '20 hours',
            report_date,
            report_date + (shift_label = '00:00-08:00')::INTEGER * INTERVAL '4 hours' 
                       + (shift_label = '08:00-16:00')::INTEGER * INTERVAL '12 hours'
                       + (shift_label = '16:00-00:00')::INTEGER * INTERVAL '20 hours'
        );
        
        -- Incident_categories tablosuna rastgele kategoriler ekle
        INSERT INTO incident_categories (
            incident_id,
            -- HIRSIZLIK (rastgele 30% şans)
            theft_guest_property,
            theft_hotel_property,
            theft_personnel,
            -- Saldırı & KAVGA (rastgele 25% şans)
            assault_physical,
            assault_verbal,
            assault_mass_fight,
            -- MADDE KULLANIMI (rastgele 15% şans)
            substance_personnel,
            substance_property,
            -- VANDALİZM & HASAR (rastgele 20% şans)
            vandalism_room,
            vandalism_common_area,
            -- İZİNSİZ GİRİŞ (rastgele 20% şans)
            unauthorized_room,
            unauthorized_restricted_area,
            -- KAZA & YARALANMA (rastgele 35% şans)
            accident_slip_fall,
            accident_equipment,
            accident_work,
            -- TIBBİ ACİL (rastgele 30% şans)
            medical_serious,
            medical_first_aid,
            medical_ambulance,
            -- YANGIN & TAHLİYE (rastgele 15% şans)
            fire_real,
            fire_false_alarm,
            fire_evacuation,
            -- GÜVENLİK TEKNİK (rastgele 10% şans)
            security_cctv_malfunction,
            -- Diğer (rastgele 25% şans)
            other
        ) VALUES (
            incident_uuid,
            -- HIRSIZLIK
            random() < 0.10,  -- Misafir eşyası çalınması
            random() < 0.08,  -- Otel mülkiyeti çalınması
            random() < 0.05,  -- Personel hırsızlığı
            -- Saldırı & KAVGA
            random() < 0.12,  -- Fiziksel saldırı
            random() < 0.15,  -- Sözlü/davranışsal taciz
            random() < 0.08,  -- Toplu kavga
            -- MADDE KULLANIMI
            random() < 0.05,  -- Personelin görevde madde kullanımı
            random() < 0.10,  -- Mülkte yasak madde bulunması
            -- VANDALİZM & HASAR
            random() < 0.12,  -- Oda vandalizmi
            random() < 0.10,  -- Ortak alan vandalizmi
            -- İZİNSİZ GİRİŞ
            random() < 0.08,  -- Yetkisiz oda girişi
            random() < 0.12,  -- Kısıtlı alan ihlali
            -- KAZA & YARALANMA
            random() < 0.20,  -- Kayma/düşme kazası
            random() < 0.15,  -- Ekipman kazası
            random() < 0.12,  -- İş kazası
            -- TIBBİ ACİL
            random() < 0.10,  -- Ciddi tıbbi durum
            random() < 0.25,  -- İlk yardım müdahalesi
            random() < 0.08,  -- Ambulans çağrısı
            -- YANGIN & TAHLİYE
            random() < 0.03,  -- Gerçek yangın
            random() < 0.15,  -- Yanlış alarm
            random() < 0.05,  -- Tahliye gerektiren durum
            -- GÜVENLİK TEKNİK
            random() < 0.10,  -- CCTV arızası
            -- Diğer
            random() < 0.25   -- Diğer güvenlik olayları
        );
        
    END LOOP;
    
    RAISE NOTICE '200 adet test olay raporu ve kategorileri başarıyla oluşturuldu!';
END $$;

-- İstatistikleri göster
SELECT 
    'Toplam Rapor Sayısı' as kategori,
    COUNT(*) as sayi
FROM incidents
WHERE shift_label IS NOT NULL
UNION ALL
SELECT 
    'Toplam Kategori Kaydı' as kategori,
    COUNT(*) as sayi
FROM incident_categories
UNION ALL
SELECT 
    'Hırsızlık Olayları' as kategori,
    SUM(CASE WHEN theft_guest_property OR theft_hotel_property OR theft_personnel THEN 1 ELSE 0 END) as sayi
FROM incident_categories
UNION ALL
SELECT 
    'Saldırı/Kavga Olayları' as kategori,
    SUM(CASE WHEN assault_physical OR assault_verbal OR assault_mass_fight THEN 1 ELSE 0 END) as sayi
FROM incident_categories
UNION ALL
SELECT 
    'Tıbbi Acil Durumlar' as kategori,
    SUM(CASE WHEN medical_serious OR medical_first_aid OR medical_ambulance THEN 1 ELSE 0 END) as sayi
FROM incident_categories
UNION ALL
SELECT 
    'Yangın Olayları' as kategori,
    SUM(CASE WHEN fire_real OR fire_false_alarm OR fire_evacuation THEN 1 ELSE 0 END) as sayi
FROM incident_categories
UNION ALL
SELECT 
    'Kaza/Yaralanma' as kategori,
    SUM(CASE WHEN accident_slip_fall OR accident_equipment OR accident_work THEN 1 ELSE 0 END) as sayi
FROM incident_categories;
