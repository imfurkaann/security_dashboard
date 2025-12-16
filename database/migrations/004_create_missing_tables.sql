-- =====================================================
-- Migration: Eksik tabloları oluştur (incidents, audit_log)
-- Çalıştır: psql -U postgres -d security_management -f database/migrations/004_create_missing_tables.sql
-- =====================================================

-- UUID extension'ı etkinleştir
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- INCIDENTS TABLE (Olay Kayıtları)
-- =====================================================
CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_type VARCHAR(50) NOT NULL DEFAULT 'general',
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    location VARCHAR(100),
    description TEXT NOT NULL,
    incident_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved BOOLEAN DEFAULT false,
    resolution_notes TEXT,
    resolved_at TIMESTAMP NULL,
    recorded_by UUID REFERENCES personnel(id),
    resolved_by UUID REFERENCES personnel(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- Incidents indeksleri
CREATE INDEX IF NOT EXISTS idx_incidents_incident_type ON incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_resolved ON incidents(resolved);
CREATE INDEX IF NOT EXISTS idx_incidents_incident_time ON incidents(incident_time);
CREATE INDEX IF NOT EXISTS idx_incidents_recorded_by ON incidents(recorded_by);
CREATE INDEX IF NOT EXISTS idx_incidents_deleted_at ON incidents(deleted_at);

-- =====================================================
-- AUDIT_LOG TABLE (Tüm işlemlerin kaydı)
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(50) NOT NULL,
    record_id VARCHAR(100) NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'SOFT_DELETE', 'LOGIN', 'LOGOUT', 'FAILED_LOGIN')),
    old_values JSONB,
    new_values JSONB,
    changed_by UUID REFERENCES personnel(id),
    ip_address VARCHAR(45),
    user_agent TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit log indeksleri
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id ON audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by ON audit_log(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON audit_log(changed_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_ip_address ON audit_log(ip_address);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Incidents için updated_at trigger
DROP TRIGGER IF EXISTS update_incidents_updated_at ON incidents;
CREATE TRIGGER update_incidents_updated_at 
    BEFORE UPDATE ON incidents
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Yorum
-- =====================================================
COMMENT ON TABLE incidents IS 'Güvenlik olayları ve raporları';
COMMENT ON TABLE audit_log IS 'Tüm kritik işlemlerin güvenlik kaydı - KVKK uyumluluğu için';

-- Başarı mesajı
DO $$ 
BEGIN 
    RAISE NOTICE 'Migration başarıyla tamamlandı: incidents ve audit_log tabloları oluşturuldu';
END $$;
