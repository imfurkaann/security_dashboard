-- Yangın alarm kayıt ekranındaki sıralama ve tarih filtreleri için indeksler.
-- Kısmi indeksler aktif kayıt listesini hızlandırır; silinen kayıtlar için
-- ayrı indeks, yönetici ekranındaki "silinenler" görünümünü kapsar.

CREATE INDEX IF NOT EXISTS idx_fire_alarms_active_alarm_time_id
    ON fire_alarms (alarm_time DESC, id DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fire_alarms_deleted_alarm_time_id
    ON fire_alarms (alarm_time DESC, id DESC)
    WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fire_alarms_active_resolution_time
    ON fire_alarms (resolution_time DESC, id DESC)
    WHERE deleted_at IS NULL AND resolution_time IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fire_alarms_active_gate_alarm_time
    ON fire_alarms (gate, alarm_time DESC, id DESC)
    WHERE deleted_at IS NULL;
