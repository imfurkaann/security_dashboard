-- Set client encoding to UTF8
SET client_encoding = 'UTF8';

-- Drop existing tables
DROP TABLE IF EXISTS vehicle_usages CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS managers CASCADE;
DROP TABLE IF EXISTS personnel CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Personnel Table (Güvenlik Personeli + Admin)
CREATE TABLE personnel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'personnel')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- Managers Table (Müdürler)
CREATE TABLE managers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    title VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- Vehicles Table (Araçlar)
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand VARCHAR(100) NOT NULL,
    plate VARCHAR(20) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- Vehicle Records Table (Araç Kayıtları)
CREATE TABLE vehicle_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    manager_id UUID NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
    personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    given_date DATE NOT NULL,
    given_time TIME NOT NULL,
    return_date DATE NULL,
    return_time TIME NULL,
    status VARCHAR(20) DEFAULT 'in_use' CHECK (status IN ('in_use', 'returned')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- Create indexes for better performance
CREATE INDEX idx_personnel_username ON personnel(username) WHERE deleted_at IS NULL;
CREATE INDEX idx_personnel_role ON personnel(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_managers_active ON managers(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_vehicles_plate ON vehicles(plate) WHERE deleted_at IS NULL;
CREATE INDEX idx_vehicles_status ON vehicles(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_vehicle_records_vehicle ON vehicle_records(vehicle_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_vehicle_records_manager ON vehicle_records(manager_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_vehicle_records_personnel ON vehicle_records(personnel_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_vehicle_records_status ON vehicle_records(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_vehicle_records_date ON vehicle_records(given_date) WHERE deleted_at IS NULL;

-- Update triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_personnel_updated_at BEFORE UPDATE ON personnel
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_managers_updated_at BEFORE UPDATE ON managers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicle_records_updated_at BEFORE UPDATE ON vehicle_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert Admin User (username: admin, password: admin123)
INSERT INTO personnel (first_name, last_name, username, password, role) VALUES
('Admin', 'User', 'admin', '$2a$10$L0xaXJX1SAdJgxZtqe8j0er1U9qQgk/7rQjOIbodTZLWCD.WpAzBi', 'admin');

-- Insert Sample Personnel (username: personel1, password: admin123)
INSERT INTO personnel (first_name, last_name, username, password, role) VALUES
('Ahmet', 'Yılmaz', 'personel1', '$2a$10$L0xaXJX1SAdJgxZtqe8j0er1U9qQgk/7rQjOIbodTZLWCD.WpAzBi', 'personnel'),
('Mehmet', 'Kaya', 'personel2', '$2a$10$L0xaXJX1SAdJgxZtqe8j0er1U9qQgk/7rQjOIbodTZLWCD.WpAzBi', 'personnel');

-- Insert Sample Managers
INSERT INTO managers (first_name, last_name, title) VALUES
('Ali', 'Demir', 'Genel Müdür'),
('Ayşe', 'Çelik', 'İşletme Müdürü'),
('Fatma', 'Şahin', 'Pazarlama Müdürü'),
('Mustafa', 'Öztürk', 'Teknik Müdür');

-- Insert Sample Vehicles
INSERT INTO vehicles (brand, plate) VALUES
('Mercedes-Benz E200', '06 AA 1111'),
('BMW X5', '06 BB 2222'),
('VW Transporter', '06 CC 3333'),
('Mercedes-Benz Vito', '06 DD 4444'),
('Audi A6', '06 EE 5555');
