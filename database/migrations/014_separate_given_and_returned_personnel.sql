-- Migration: Separate given_by and returned_by personnel for all records
-- Date: 2025-12-19
-- Description: Vardiya değişimlerinde farklı personel kayıtlarını desteklemek için
--              teslim eden (given/entry/recorded) ve teslim alan (returned/exit/resolved) 
--              personel ayrımı yapılıyor

-- ==========================================
-- 1. VEHICLE_RECORDS
-- ==========================================
-- personnel_id → given_by ve given_by_name
ALTER TABLE vehicle_records 
RENAME COLUMN personnel_id TO given_by;

ALTER TABLE vehicle_records 
RENAME COLUMN personnel_name TO given_by_name;

-- returned_by ve returned_by_name ekle
ALTER TABLE vehicle_records 
ADD COLUMN IF NOT EXISTS returned_by UUID REFERENCES personnel(id) ON DELETE SET NULL;

ALTER TABLE vehicle_records 
ADD COLUMN IF NOT EXISTS returned_by_name VARCHAR(200);

-- Index'leri güncelle
DROP INDEX IF EXISTS idx_vehicle_records_personnel;
DROP INDEX IF EXISTS idx_vehicle_records_personnel_name;

CREATE INDEX idx_vehicle_records_given_by 
ON vehicle_records(given_by) WHERE deleted_at IS NULL;

CREATE INDEX idx_vehicle_records_returned_by 
ON vehicle_records(returned_by) WHERE deleted_at IS NULL;

CREATE INDEX idx_vehicle_records_given_by_name 
ON vehicle_records(given_by_name);

CREATE INDEX idx_vehicle_records_returned_by_name 
ON vehicle_records(returned_by_name);

COMMENT ON COLUMN vehicle_records.given_by IS 'Aracı teslim eden personel ID';
COMMENT ON COLUMN vehicle_records.given_by_name IS 'Aracı teslim eden personel adı';
COMMENT ON COLUMN vehicle_records.returned_by IS 'Aracı teslim alan personel ID';
COMMENT ON COLUMN vehicle_records.returned_by_name IS 'Aracı teslim alan personel adı';

-- ==========================================
-- 2. VISITOR_RECORDS
-- ==========================================
-- personnel_id → entry_by ve entry_by_name
ALTER TABLE visitor_records 
RENAME COLUMN personnel_id TO entry_by;

ALTER TABLE visitor_records 
RENAME COLUMN personnel_name TO entry_by_name;

-- exit_by ve exit_by_name ekle
ALTER TABLE visitor_records 
ADD COLUMN IF NOT EXISTS exit_by UUID REFERENCES personnel(id) ON DELETE SET NULL;

ALTER TABLE visitor_records 
ADD COLUMN IF NOT EXISTS exit_by_name VARCHAR(200);

-- Index'leri güncelle
DROP INDEX IF EXISTS idx_visitor_records_personnel;
DROP INDEX IF EXISTS idx_visitor_records_personnel_name;

CREATE INDEX idx_visitor_records_entry_by 
ON visitor_records(entry_by) WHERE deleted_at IS NULL;

CREATE INDEX idx_visitor_records_exit_by 
ON visitor_records(exit_by) WHERE deleted_at IS NULL;

CREATE INDEX idx_visitor_records_entry_by_name 
ON visitor_records(entry_by_name);

CREATE INDEX idx_visitor_records_exit_by_name 
ON visitor_records(exit_by_name);

COMMENT ON COLUMN visitor_records.entry_by IS 'Ziyaretçi girişini kaydeden personel ID';
COMMENT ON COLUMN visitor_records.entry_by_name IS 'Ziyaretçi girişini kaydeden personel adı';
COMMENT ON COLUMN visitor_records.exit_by IS 'Ziyaretçi çıkışını kaydeden personel ID';
COMMENT ON COLUMN visitor_records.exit_by_name IS 'Ziyaretçi çıkışını kaydeden personel adı';

-- ==========================================
-- 3. MANAGERS_RECORDS
-- ==========================================
-- recorded_by → entry_by ve entry_by_name (rename)
ALTER TABLE managers_records 
RENAME COLUMN recorded_by TO entry_by;

ALTER TABLE managers_records 
RENAME COLUMN recorded_by_name TO entry_by_name;

-- exit_by ve exit_by_name ekle
ALTER TABLE managers_records 
ADD COLUMN IF NOT EXISTS exit_by UUID REFERENCES personnel(id) ON DELETE SET NULL;

ALTER TABLE managers_records 
ADD COLUMN IF NOT EXISTS exit_by_name VARCHAR(200);

-- Index'leri güncelle
DROP INDEX IF EXISTS idx_managers_records_recorded_by;
DROP INDEX IF EXISTS idx_managers_records_recorded_by_name;

CREATE INDEX idx_managers_records_entry_by 
ON managers_records(entry_by) WHERE deleted_at IS NULL;

CREATE INDEX idx_managers_records_exit_by 
ON managers_records(exit_by) WHERE deleted_at IS NULL;

CREATE INDEX idx_managers_records_entry_by_name 
ON managers_records(entry_by_name);

CREATE INDEX idx_managers_records_exit_by_name 
ON managers_records(exit_by_name);

COMMENT ON COLUMN managers_records.entry_by IS 'Müdür girişini kaydeden personel ID';
COMMENT ON COLUMN managers_records.entry_by_name IS 'Müdür girişini kaydeden personel adı';
COMMENT ON COLUMN managers_records.exit_by IS 'Müdür çıkışını kaydeden personel ID';
COMMENT ON COLUMN managers_records.exit_by_name IS 'Müdür çıkışını kaydeden personel adı';

-- ==========================================
-- 4. FIRE_ALARMS
-- ==========================================
-- recorded_by ve recorded_by_name zaten var
-- resolved_by ve resolved_by_name ekle

ALTER TABLE fire_alarms 
ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES personnel(id) ON DELETE SET NULL;

ALTER TABLE fire_alarms 
ADD COLUMN IF NOT EXISTS resolved_by_name VARCHAR(200);

CREATE INDEX idx_fire_alarms_resolved_by 
ON fire_alarms(resolved_by) WHERE deleted_at IS NULL;

CREATE INDEX idx_fire_alarms_resolved_by_name 
ON fire_alarms(resolved_by_name);

COMMENT ON COLUMN fire_alarms.recorded_by IS 'Yangın alarmını kaydeden personel ID';
COMMENT ON COLUMN fire_alarms.recorded_by_name IS 'Yangın alarmını kaydeden personel adı';
COMMENT ON COLUMN fire_alarms.resolved_by IS 'Yangın alarmını çözümleyen personel ID';
COMMENT ON COLUMN fire_alarms.resolved_by_name IS 'Yangın alarmını çözümleyen personel adı';

-- ==========================================
-- TRIGGER FONKSIYONLARINI GÜNCELLE
-- ==========================================

-- Vehicle Records - given_by ve returned_by için trigger
CREATE OR REPLACE FUNCTION sync_vehicle_personnel_names()
RETURNS TRIGGER AS $$
BEGIN
    -- Given by name
    IF NEW.given_by IS NOT NULL AND NEW.given_by_name IS NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.given_by_name
        FROM personnel
        WHERE id = NEW.given_by;
    END IF;
    
    -- Returned by name
    IF NEW.returned_by IS NOT NULL AND NEW.returned_by_name IS NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.returned_by_name
        FROM personnel
        WHERE id = NEW.returned_by;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Visitor Records - entry_by ve exit_by için trigger
CREATE OR REPLACE FUNCTION sync_visitor_personnel_names()
RETURNS TRIGGER AS $$
BEGIN
    -- Entry by name
    IF NEW.entry_by IS NOT NULL AND NEW.entry_by_name IS NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.entry_by_name
        FROM personnel
        WHERE id = NEW.entry_by;
    END IF;
    
    -- Exit by name
    IF NEW.exit_by IS NOT NULL AND NEW.exit_by_name IS NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.exit_by_name
        FROM personnel
        WHERE id = NEW.exit_by;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Managers Records - entry_by ve exit_by için trigger
CREATE OR REPLACE FUNCTION sync_manager_record_personnel_names()
RETURNS TRIGGER AS $$
BEGIN
    -- Entry by name
    IF NEW.entry_by IS NOT NULL AND NEW.entry_by_name IS NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.entry_by_name
        FROM personnel
        WHERE id = NEW.entry_by;
    END IF;
    
    -- Exit by name
    IF NEW.exit_by IS NOT NULL AND NEW.exit_by_name IS NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.exit_by_name
        FROM personnel
        WHERE id = NEW.exit_by;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fire Alarms - recorded_by ve resolved_by için trigger
CREATE OR REPLACE FUNCTION sync_fire_alarm_personnel_names()
RETURNS TRIGGER AS $$
BEGIN
    -- Recorded by name
    IF NEW.recorded_by IS NOT NULL AND NEW.recorded_by_name IS NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.recorded_by_name
        FROM personnel
        WHERE id = NEW.recorded_by;
    END IF;
    
    -- Resolved by name
    IF NEW.resolved_by IS NOT NULL AND NEW.resolved_by_name IS NULL THEN
        SELECT CONCAT(first_name, ' ', last_name) INTO NEW.resolved_by_name
        FROM personnel
        WHERE id = NEW.resolved_by;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- TRIGGER'LARI YENİDEN OLUŞTUR
-- ==========================================

-- Vehicle Records
DROP TRIGGER IF EXISTS trigger_sync_vehicle_personnel_name ON vehicle_records;
CREATE TRIGGER trigger_sync_vehicle_personnel_names
    BEFORE INSERT OR UPDATE ON vehicle_records
    FOR EACH ROW
    EXECUTE FUNCTION sync_vehicle_personnel_names();

-- Visitor Records
DROP TRIGGER IF EXISTS trigger_sync_visitor_personnel_name ON visitor_records;
CREATE TRIGGER trigger_sync_visitor_personnel_names
    BEFORE INSERT OR UPDATE ON visitor_records
    FOR EACH ROW
    EXECUTE FUNCTION sync_visitor_personnel_names();

-- Managers Records (mevcut trigger'ı güncelle)
DROP TRIGGER IF EXISTS trigger_sync_manager_record_personnel_names ON managers_records;
CREATE TRIGGER trigger_sync_manager_record_personnel_names
    BEFORE INSERT OR UPDATE ON managers_records
    FOR EACH ROW
    EXECUTE FUNCTION sync_manager_record_personnel_names();

-- Fire Alarms
DROP TRIGGER IF EXISTS trigger_sync_fire_alarm_recorded_by_name ON fire_alarms;
CREATE TRIGGER trigger_sync_fire_alarm_personnel_names
    BEFORE INSERT OR UPDATE ON fire_alarms
    FOR EACH ROW
    EXECUTE FUNCTION sync_fire_alarm_personnel_names();

-- ==========================================
-- FOREIGN KEY CONSTRAINT'LERİ GÜNCELLE
-- ==========================================

-- Vehicle Records
ALTER TABLE vehicle_records 
DROP CONSTRAINT IF EXISTS vehicle_records_personnel_id_fkey;

ALTER TABLE vehicle_records 
DROP CONSTRAINT IF EXISTS vehicle_records_given_by_fkey;

ALTER TABLE vehicle_records 
ADD CONSTRAINT vehicle_records_given_by_fkey 
FOREIGN KEY (given_by) REFERENCES personnel(id) ON DELETE SET NULL;

ALTER TABLE vehicle_records 
DROP CONSTRAINT IF EXISTS vehicle_records_returned_by_fkey;

ALTER TABLE vehicle_records 
ADD CONSTRAINT vehicle_records_returned_by_fkey 
FOREIGN KEY (returned_by) REFERENCES personnel(id) ON DELETE SET NULL;

-- Visitor Records
ALTER TABLE visitor_records 
DROP CONSTRAINT IF EXISTS visitor_records_personnel_id_fkey;

ALTER TABLE visitor_records 
DROP CONSTRAINT IF EXISTS visitor_records_entry_by_fkey;

ALTER TABLE visitor_records 
ADD CONSTRAINT visitor_records_entry_by_fkey 
FOREIGN KEY (entry_by) REFERENCES personnel(id) ON DELETE SET NULL;

ALTER TABLE visitor_records 
DROP CONSTRAINT IF EXISTS visitor_records_exit_by_fkey;

ALTER TABLE visitor_records 
ADD CONSTRAINT visitor_records_exit_by_fkey 
FOREIGN KEY (exit_by) REFERENCES personnel(id) ON DELETE SET NULL;

-- Managers Records
ALTER TABLE managers_records 
DROP CONSTRAINT IF EXISTS managers_records_recorded_by_fkey;

ALTER TABLE managers_records 
DROP CONSTRAINT IF EXISTS managers_records_entry_by_fkey;

ALTER TABLE managers_records 
ADD CONSTRAINT managers_records_entry_by_fkey 
FOREIGN KEY (entry_by) REFERENCES personnel(id) ON DELETE SET NULL;

ALTER TABLE managers_records 
DROP CONSTRAINT IF EXISTS managers_records_exit_by_fkey;

ALTER TABLE managers_records 
ADD CONSTRAINT managers_records_exit_by_fkey 
FOREIGN KEY (exit_by) REFERENCES personnel(id) ON DELETE SET NULL;

-- Fire Alarms - recorded_by zaten var, resolved_by ekle
ALTER TABLE fire_alarms 
DROP CONSTRAINT IF EXISTS fire_alarms_resolved_by_fkey;

ALTER TABLE fire_alarms 
ADD CONSTRAINT fire_alarms_resolved_by_fkey 
FOREIGN KEY (resolved_by) REFERENCES personnel(id) ON DELETE SET NULL;
