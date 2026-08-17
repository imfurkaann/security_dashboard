-- Olay kayıtları: kararlı sayfalama, tarih filtreleri ve aynı vardiya için
-- eşzamanlı oluşturma girişimlerine karşı veri bütünlüğü.

CREATE INDEX IF NOT EXISTS idx_incidents_active_incident_time_id
    ON incidents (incident_time DESC, id DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_incidents_active_gate_incident_time_id
    ON incidents (gate, incident_time DESC, id DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_incidents_active_report_date
    ON incidents (report_date DESC, id DESC)
    WHERE deleted_at IS NULL AND report_date IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_incidents_active_shift_report_per_gate_day
    ON incidents (shift_label, report_date, COALESCE(gate, ''))
    WHERE deleted_at IS NULL AND shift_label IS NOT NULL AND report_date IS NOT NULL;
