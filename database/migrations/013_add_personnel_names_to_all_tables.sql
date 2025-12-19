-- Migration: Add personnel/recorded_by names to all tables for better readability
-- Date: 2025-12-19
-- Description: ID referanslarının yanına isim-soyisim kolonları ekleniyor

-- ==========================================
-- 1. SGK_RECORDS - personnel_name ekle
-- ==========================================
ALTER TABLE sgk_records 
ADD COLUMN IF NOT EXISTS personnel_name VARCHAR(200);

CREATE INDEX IF NOT EXISTS idx_sgk_records_personnel_name 
ON sgk_records(personnel_name);

COMMENT ON COLUMN sgk_records.personnel_name IS 'Kaydı yükleyen personelin adı soyadı';

-- Mevcut kayıtların personnel_name değerlerini güncelle
UPDATE sgk_records sr
SET personnel_name = CONCAT(p.first_name, ' ', p.last_name)
FROM personnel p
WHERE sr.personnel_id = p.id 
  AND sr.personnel_name IS NULL;

-- ==========================================
-- 2. FIRE_ALARMS - recorded_by_name ekle
-- ==========================================
ALTER TABLE fire_alarms 
ADD COLUMN IF NOT EXISTS recorded_by_name VARCHAR(200);

CREATE INDEX IF NOT EXISTS idx_fire_alarms_recorded_by_name 
ON fire_alarms(recorded_by_name);

COMMENT ON COLUMN fire_alarms.recorded_by_name IS 'Yangın alarmını kaydeden personelin adı soyadı';

-- Mevcut kayıtların recorded_by_name değerlerini güncelle
UPDATE fire_alarms fa
SET recorded_by_name = CONCAT(p.first_name, ' ', p.last_name)
FROM personnel p
WHERE fa.recorded_by = p.id 
  AND fa.recorded_by_name IS NULL;

-- ==========================================
-- 3. INCIDENTS - recorded_by_name ekle
-- ==========================================
ALTER TABLE incidents 
ADD COLUMN IF NOT EXISTS recorded_by_name VARCHAR(200);

CREATE INDEX IF NOT EXISTS idx_incidents_recorded_by_name 
ON incidents(recorded_by_name);

COMMENT ON COLUMN incidents.recorded_by_name IS 'Olayı kaydeden personelin adı soyadı';

-- Mevcut kayıtların recorded_by_name değerlerini güncelle
UPDATE incidents i
SET recorded_by_name = CONCAT(p.first_name, ' ', p.last_name)
FROM personnel p
WHERE i.recorded_by = p.id 
  AND i.recorded_by_name IS NULL;

-- ==========================================
-- 4. VISITOR_RECORDS - personnel_name ekle
-- ==========================================
ALTER TABLE visitor_records 
ADD COLUMN IF NOT EXISTS personnel_name VARCHAR(200);

CREATE INDEX IF NOT EXISTS idx_visitor_records_personnel_name 
ON visitor_records(personnel_name);

COMMENT ON COLUMN visitor_records.personnel_name IS 'Ziyaretçiyi kaydeden personelin adı soyadı';

-- Mevcut kayıtların personnel_name değerlerini güncelle
UPDATE visitor_records vr
SET personnel_name = CONCAT(p.first_name, ' ', p.last_name)
FROM personnel p
WHERE vr.personnel_id = p.id 
  AND vr.personnel_name IS NULL;

-- ==========================================
-- 5. VEHICLE_RECORDS - personnel_name ekle
-- (manager_name zaten var)
-- ==========================================
ALTER TABLE vehicle_records 
ADD COLUMN IF NOT EXISTS personnel_name VARCHAR(200);

CREATE INDEX IF NOT EXISTS idx_vehicle_records_personnel_name 
ON vehicle_records(personnel_name);

COMMENT ON COLUMN vehicle_records.personnel_name IS 'Aracı teslim alan/veren personelin adı soyadı';

-- Mevcut kayıtların personnel_name değerlerini güncelle
UPDATE vehicle_records vr
SET personnel_name = CONCAT(p.first_name, ' ', p.last_name)
FROM personnel p
WHERE vr.personnel_id = p.id 
  AND vr.personnel_name IS NULL;

-- ==========================================
-- TRIGGER FONKSIYONLARI
-- ==========================================

-- SGK Records için trigger fonksiyonu
CREATE OR REPLACE FUNCTION sync_sgk_personnel_name()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.personnel_id IS NOT NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.personnel_name
        FROM personnel
        WHERE id = NEW.personnel_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fire Alarms için trigger fonksiyonu
CREATE OR REPLACE FUNCTION sync_fire_alarm_recorded_by_name()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.recorded_by IS NOT NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.recorded_by_name
        FROM personnel
        WHERE id = NEW.recorded_by;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Incidents için trigger fonksiyonu
CREATE OR REPLACE FUNCTION sync_incident_recorded_by_name()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.recorded_by IS NOT NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.recorded_by_name
        FROM personnel
        WHERE id = NEW.recorded_by;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Visitor Records için trigger fonksiyonu
CREATE OR REPLACE FUNCTION sync_visitor_personnel_name()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.personnel_id IS NOT NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.personnel_name
        FROM personnel
        WHERE id = NEW.personnel_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Vehicle Records için trigger fonksiyonu
CREATE OR REPLACE FUNCTION sync_vehicle_personnel_name()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.personnel_id IS NOT NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.personnel_name
        FROM personnel
        WHERE id = NEW.personnel_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- TRIGGER'LARI OLUŞTUR
-- ==========================================

-- SGK Records trigger
DROP TRIGGER IF EXISTS trigger_sync_sgk_personnel_name ON sgk_records;
CREATE TRIGGER trigger_sync_sgk_personnel_name
    BEFORE INSERT OR UPDATE ON sgk_records
    FOR EACH ROW
    EXECUTE FUNCTION sync_sgk_personnel_name();

-- Fire Alarms trigger
DROP TRIGGER IF EXISTS trigger_sync_fire_alarm_recorded_by_name ON fire_alarms;
CREATE TRIGGER trigger_sync_fire_alarm_recorded_by_name
    BEFORE INSERT OR UPDATE ON fire_alarms
    FOR EACH ROW
    EXECUTE FUNCTION sync_fire_alarm_recorded_by_name();

-- Incidents trigger
DROP TRIGGER IF EXISTS trigger_sync_incident_recorded_by_name ON incidents;
CREATE TRIGGER trigger_sync_incident_recorded_by_name
    BEFORE INSERT OR UPDATE ON incidents
    FOR EACH ROW
    EXECUTE FUNCTION sync_incident_recorded_by_name();

-- Visitor Records trigger
DROP TRIGGER IF EXISTS trigger_sync_visitor_personnel_name ON visitor_records;
CREATE TRIGGER trigger_sync_visitor_personnel_name
    BEFORE INSERT OR UPDATE ON visitor_records
    FOR EACH ROW
    EXECUTE FUNCTION sync_visitor_personnel_name();

-- Vehicle Records trigger
DROP TRIGGER IF EXISTS trigger_sync_vehicle_personnel_name ON vehicle_records;
CREATE TRIGGER trigger_sync_vehicle_personnel_name
    BEFORE INSERT OR UPDATE ON vehicle_records
    FOR EACH ROW
    EXECUTE FUNCTION sync_vehicle_personnel_name();
