-- Migration: Create Incident Categories Table
-- Description: Olay raporu kategorilerini saklamak için tablo oluşturur
-- Date: 2025-12-26

-- Incident categories tablosu oluştur
CREATE TABLE IF NOT EXISTS incident_categories (
    id SERIAL PRIMARY KEY,
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    
    -- HIRSIZLIK Kategorisi
    theft_guest_property BOOLEAN DEFAULT FALSE,
    theft_hotel_property BOOLEAN DEFAULT FALSE,
    theft_personnel BOOLEAN DEFAULT FALSE,
    
    -- Saldırı & KAVGA Kategorisi
    assault_physical BOOLEAN DEFAULT FALSE,
    assault_verbal BOOLEAN DEFAULT FALSE,
    assault_mass_fight BOOLEAN DEFAULT FALSE,
    
    -- MADDE KULLANIMI Kategorisi
    substance_personnel BOOLEAN DEFAULT FALSE,
    substance_property BOOLEAN DEFAULT FALSE,
    
    -- VANDALİZM & HASAR Kategorisi
    vandalism_room BOOLEAN DEFAULT FALSE,
    vandalism_common_area BOOLEAN DEFAULT FALSE,
    
    -- İZİNSİZ GİRİŞ Kategorisi
    unauthorized_room BOOLEAN DEFAULT FALSE,
    unauthorized_restricted_area BOOLEAN DEFAULT FALSE,
    
    -- KAZA & YARALANMA Kategorisi
    accident_slip_fall BOOLEAN DEFAULT FALSE,
    accident_equipment BOOLEAN DEFAULT FALSE,
    accident_work BOOLEAN DEFAULT FALSE,
    
    -- TIBBİ ACİL Kategorisi
    medical_serious BOOLEAN DEFAULT FALSE,
    medical_first_aid BOOLEAN DEFAULT FALSE,
    medical_ambulance BOOLEAN DEFAULT FALSE,
    
    -- YANGIN & TAHLİYE Kategorisi
    fire_real BOOLEAN DEFAULT FALSE,
    fire_false_alarm BOOLEAN DEFAULT FALSE,
    fire_evacuation BOOLEAN DEFAULT FALSE,
    
    -- GÜVENLİK TEKNİK Kategorisi
    security_cctv_malfunction BOOLEAN DEFAULT FALSE,
    
    -- Diğer Kategorisi
    other BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index'ler
CREATE INDEX idx_incident_categories_incident ON incident_categories(incident_id);
CREATE INDEX idx_incident_categories_created_at ON incident_categories(created_at);

-- Her incident için sadece bir kategori kaydı olabilir
CREATE UNIQUE INDEX idx_incident_categories_unique_incident ON incident_categories(incident_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_incident_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_incident_categories_updated_at
BEFORE UPDATE ON incident_categories
FOR EACH ROW
EXECUTE FUNCTION update_incident_categories_updated_at();

-- Yorum ekle
COMMENT ON TABLE incident_categories IS 'Vardiya raporlarına ait olay kategorileri';
COMMENT ON COLUMN incident_categories.incident_id IS 'İlgili incident raporu ID';
COMMENT ON COLUMN incident_categories.theft_guest_property IS 'Misafir Eşyası Çalınması';
COMMENT ON COLUMN incident_categories.theft_hotel_property IS 'Otel Mülkiyeti Çalınması';
COMMENT ON COLUMN incident_categories.theft_personnel IS 'Personel Hırsızlığı';
COMMENT ON COLUMN incident_categories.assault_physical IS 'Fiziksel Saldırı';
COMMENT ON COLUMN incident_categories.assault_verbal IS 'Sözlü/Davranışsal Taciz';
COMMENT ON COLUMN incident_categories.assault_mass_fight IS 'Toplu Kavga/İzdiham';
COMMENT ON COLUMN incident_categories.substance_personnel IS 'Personelin Görevde Alkol/Uyuşturucu Kullanımı';
COMMENT ON COLUMN incident_categories.substance_property IS 'Mülkte Yasak Madde Bulunması';
COMMENT ON COLUMN incident_categories.vandalism_room IS 'Misafirin Oda Eşyalara Kasıtlı Zarar Vermesi';
COMMENT ON COLUMN incident_categories.vandalism_common_area IS 'Misafirin Ortak Alan Eşyalarına Kasıtlı Zarar Vermesi';
COMMENT ON COLUMN incident_categories.unauthorized_room IS 'Yetkisiz Oda Girişi';
COMMENT ON COLUMN incident_categories.unauthorized_restricted_area IS 'Kısıtlı Alan İhlali';
COMMENT ON COLUMN incident_categories.accident_slip_fall IS 'Kayma/Düşme Kazası';
COMMENT ON COLUMN incident_categories.accident_equipment IS 'Ekipman/Cihaz Kazası';
COMMENT ON COLUMN incident_categories.accident_work IS 'İş Kazası';
COMMENT ON COLUMN incident_categories.medical_serious IS 'Ciddi Tıbbi Durum';
COMMENT ON COLUMN incident_categories.medical_first_aid IS 'İlk Yardım Müdahalesi';
COMMENT ON COLUMN incident_categories.medical_ambulance IS 'Ambulans';
COMMENT ON COLUMN incident_categories.fire_real IS 'Gerçek Yangın Olayı';
COMMENT ON COLUMN incident_categories.fire_false_alarm IS 'Hatalı Yangın Alarmı';
COMMENT ON COLUMN incident_categories.fire_evacuation IS 'Tahliye Gerektiren Durum';
COMMENT ON COLUMN incident_categories.security_cctv_malfunction IS 'CCTV Arızası/Kayıt Kesintisi';
COMMENT ON COLUMN incident_categories.other IS 'Diğer (Güvenlik)';
