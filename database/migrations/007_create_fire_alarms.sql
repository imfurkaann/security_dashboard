-- Yangın Alarmları tablosu oluştur
CREATE TABLE IF NOT EXISTS fire_alarms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location VARCHAR(255) NOT NULL,
    alarm_time TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved BOOLEAN DEFAULT FALSE,
    resolution_time TIMESTAMP,
    resolution_notes TEXT,
    false_alarm BOOLEAN DEFAULT FALSE,
    recorded_by UUID REFERENCES personnel(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Index'ler
CREATE INDEX idx_fire_alarms_alarm_time ON fire_alarms(alarm_time) WHERE deleted_at IS NULL;
CREATE INDEX idx_fire_alarms_location ON fire_alarms(location) WHERE deleted_at IS NULL;
CREATE INDEX idx_fire_alarms_resolved ON fire_alarms(resolved) WHERE deleted_at IS NULL;
CREATE INDEX idx_fire_alarms_recorded_by ON fire_alarms(recorded_by) WHERE deleted_at IS NULL;

-- Tablo yorumu
COMMENT ON TABLE fire_alarms IS 'Yangın alarm kayıtları tablosu';
COMMENT ON COLUMN fire_alarms.location IS 'Alarmın çaldığı konum';
COMMENT ON COLUMN fire_alarms.alarm_time IS 'Alarmın çaldığı zaman';
COMMENT ON COLUMN fire_alarms.resolved IS 'Alarm durumu çözüldü mü';
COMMENT ON COLUMN fire_alarms.resolution_time IS 'Alarmın çözüldüğü zaman';
COMMENT ON COLUMN fire_alarms.resolution_notes IS 'Çözüm notları';
COMMENT ON COLUMN fire_alarms.false_alarm IS 'Yanlış alarm mı';
