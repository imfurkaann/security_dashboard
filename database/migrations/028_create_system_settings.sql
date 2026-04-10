-- Global key/value ayar tablosu (Docker restart/update sonrası ayar kalıcılığı için)
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(120) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_settings_updated_at ON system_settings(updated_at DESC);
