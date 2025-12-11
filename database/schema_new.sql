-- =====================================================
-- Hotel Security Management System - PostgreSQL Schema
-- Mevcut SQLite yapısı baz alınarak geliştirilmiştir
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USERS TABLE (Kullanıcılar - Personnel, Manager, Admin)
-- SQLite: users + managers tablolarının birleşimi
-- =====================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('personnel', 'manager', 'admin')),
    title VARCHAR(100), -- Ünvan (Manager için: Otel Müdürü, Güvenlik Şefi, vb.)
    phone VARCHAR(20),
    email VARCHAR(100) UNIQUE,
    bio TEXT, -- Biyografi/notlar
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_duty', 'off_duty')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_deleted_at ON users(deleted_at);

-- =====================================================
-- SHIFTS TABLE (Vardiya Kayıtları)
-- Personel vardiya başlangıç/bitiş takibi
-- =====================================================
CREATE TABLE shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    shift_start TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    shift_end TIMESTAMP NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

CREATE INDEX idx_shifts_user_id ON shifts(user_id);
CREATE INDEX idx_shifts_shift_start ON shifts(shift_start);
CREATE INDEX idx_shifts_deleted_at ON shifts(deleted_at);

-- =====================================================
-- VEHICLES TABLE (Araç Kayıtları)
-- SQLite vehicles tablosunun geliştirilmiş versiyonu
-- =====================================================
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plate VARCHAR(20) NOT NULL, -- Plaka numarası (SQLite: plate)
    vehicle_name VARCHAR(100), -- Araç adı (SQLite: name)
    driver_name VARCHAR(100) NOT NULL, -- Sürücü adı
    driver_phone VARCHAR(20), -- Sürücü telefon
    vehicle_type VARCHAR(50), -- Araç tipi (Otomobil, SUV, Kamyon, vb.)
    status VARCHAR(20) DEFAULT 'inside' CHECK (status IN ('inside', 'exited', 'available')), -- SQLite: status
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    entry_time TIME NOT NULL DEFAULT CURRENT_TIME,
    exit_date DATE,
    exit_time TIME,
    purpose VARCHAR(255), -- Giriş amacı
    notes TEXT,
    recorded_by UUID NOT NULL REFERENCES users(id), -- Kaydı yapan personel
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

CREATE INDEX idx_vehicles_plate ON vehicles(plate);
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_vehicles_entry_date ON vehicles(entry_date);
CREATE INDEX idx_vehicles_recorded_by ON vehicles(recorded_by);
CREATE INDEX idx_vehicles_deleted_at ON vehicles(deleted_at);

-- =====================================================
-- VISITORS TABLE (Ziyaretçi Kayıtları)
-- SQLite visitors tablosunun geliştirilmiş versiyonu
-- =====================================================
CREATE TABLE visitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(100) NOT NULL, -- SQLite: full_name
    company_name VARCHAR(100), -- SQLite: company_name
    visiting_person VARCHAR(100), -- Kimi ziyaret ediyor (SQLite: visiting_person)
    person_count INTEGER DEFAULT 1, -- Ziyaretçi sayısı (SQLite: person_count)
    phone_number VARCHAR(20), -- SQLite: phone_number
    vehicle_plate VARCHAR(20), -- Araç plakası (SQLite: vehicle_plate)
    id_number VARCHAR(20), -- TC Kimlik No
    description TEXT, -- Açıklama (SQLite: description)
    entry_date DATE NOT NULL, -- SQLite: entry_date (TEXT)
    entry_time TIME NOT NULL, -- SQLite: entry_time (TEXT)
    exit_date DATE, -- SQLite: exit_date (TEXT)
    exit_time TIME, -- SQLite: exit_time (TEXT)
    status VARCHAR(20) DEFAULT 'inside' CHECK (status IN ('inside', 'exited')),
    registered_by VARCHAR(100), -- Kaydı yapan (SQLite: registered_by - TEXT)
    recorded_by_id UUID REFERENCES users(id), -- Kaydı yapan personel ID
    created_date DATE NOT NULL DEFAULT CURRENT_DATE, -- SQLite: created_date (TEXT)
    created_time TIME NOT NULL DEFAULT CURRENT_TIME, -- SQLite: created_time (TEXT)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

CREATE INDEX idx_visitors_full_name ON visitors(full_name);
CREATE INDEX idx_visitors_company_name ON visitors(company_name);
CREATE INDEX idx_visitors_entry_date ON visitors(entry_date);
CREATE INDEX idx_visitors_status ON visitors(status);
CREATE INDEX idx_visitors_recorded_by_id ON visitors(recorded_by_id);
CREATE INDEX idx_visitors_deleted_at ON visitors(deleted_at);

-- =====================================================
-- DELIVERIES TABLE (Teslimat Kayıtları)
-- SQLite deliveries tablosu
-- =====================================================
CREATE TABLE deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID REFERENCES vehicles(id), -- SQLite: vehicle_id (INTEGER)
    vehicle_info TEXT NOT NULL, -- Araç bilgisi (SQLite: vehicle_info)
    recipient VARCHAR(100) NOT NULL, -- Teslim alan (SQLite: recipient)
    destination VARCHAR(255) NOT NULL, -- Teslimat yeri (SQLite: destination)
    user_id UUID REFERENCES users(id), -- SQLite: user_id (INTEGER)
    created_date DATE NOT NULL DEFAULT CURRENT_DATE, -- SQLite: created_date (TEXT)
    created_time TIME NOT NULL DEFAULT CURRENT_TIME, -- SQLite: created_time (TEXT)
    completed_date DATE, -- SQLite: completed_date (TEXT)
    completed_time TIME, -- SQLite: completed_time (TEXT)
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

CREATE INDEX idx_deliveries_vehicle_id ON deliveries(vehicle_id);
CREATE INDEX idx_deliveries_user_id ON deliveries(user_id);
CREATE INDEX idx_deliveries_status ON deliveries(status);
CREATE INDEX idx_deliveries_created_date ON deliveries(created_date);
CREATE INDEX idx_deliveries_deleted_at ON deliveries(deleted_at);

-- =====================================================
-- EVENTS TABLE (Olaylar/İncident Raporları)
-- SQLite events tablosunun geliştirilmiş versiyonu
-- =====================================================
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    description TEXT NOT NULL, -- SQLite: description
    event_type VARCHAR(50) DEFAULT 'general', -- Olay tipi
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    location VARCHAR(100), -- Olay yeri
    user_id UUID REFERENCES users(id), -- SQLite: user_id (INTEGER) - Kaydı yapan
    created_date DATE NOT NULL DEFAULT CURRENT_DATE, -- SQLite: created_date (TEXT)
    created_time TIME NOT NULL DEFAULT CURRENT_TIME, -- SQLite: created_time (TEXT)
    completed_date DATE, -- SQLite: completed_date (TEXT)
    completed_time TIME, -- SQLite: completed_time (TEXT)
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    resolution_notes TEXT, -- Çözüm notları
    resolved_by UUID REFERENCES users(id), -- Çözümleyen kişi
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_severity ON events(severity);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_created_date ON events(created_date);
CREATE INDEX idx_events_deleted_at ON events(deleted_at);

-- =====================================================
-- MANAGER_LOGINS TABLE (Yönetici Giriş Kayıtları)
-- SQLite manager_logs tablosunun geliştirilmiş versiyonu
-- =====================================================
CREATE TABLE manager_logins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manager_id UUID NOT NULL REFERENCES users(id), -- SQLite: manager_id (INTEGER)
    manager_name VARCHAR(100) NOT NULL, -- SQLite: manager_name
    entry_date DATE NOT NULL, -- SQLite: entry_date (TEXT)
    entry_time TIME NOT NULL, -- SQLite: entry_time (TEXT)
    exit_date DATE, -- SQLite: exit_date (TEXT)
    exit_time TIME, -- SQLite: exit_time (TEXT)
    ip_address VARCHAR(45), -- IP adresi
    user_agent TEXT, -- Tarayıcı bilgisi
    login_method VARCHAR(50) DEFAULT 'web', -- web, mobile, desktop
    created_date DATE NOT NULL DEFAULT CURRENT_DATE, -- SQLite: created_date (TEXT)
    created_time TIME NOT NULL DEFAULT CURRENT_TIME, -- SQLite: created_time (TEXT)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_manager_logins_manager_id ON manager_logins(manager_id);
CREATE INDEX idx_manager_logins_entry_date ON manager_logins(entry_date);
CREATE INDEX idx_manager_logins_created_at ON manager_logins(created_at);

-- =====================================================
-- AUDIT_LOG TABLE (Tüm işlemlerin kaydı)
-- Güvenlik için tüm değişiklikleri takip eder
-- =====================================================
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'SOFT_DELETE')),
    old_values JSONB,
    new_values JSONB,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT
);

CREATE INDEX idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX idx_audit_log_record_id ON audit_log(record_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_changed_by ON audit_log(changed_by);
CREATE INDEX idx_audit_log_changed_at ON audit_log(changed_at);

-- =====================================================
-- TRIGGERS - Otomatik updated_at güncelleme
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Her tablo için trigger
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON shifts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_visitors_updated_at BEFORE UPDATE ON visitors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deliveries_updated_at BEFORE UPDATE ON deliveries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
