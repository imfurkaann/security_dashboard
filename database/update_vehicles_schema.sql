-- Vehicles tablosunu güncelle (otel araçları için)
DROP TABLE IF EXISTS vehicles CASCADE;

CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plate VARCHAR(20) NOT NULL UNIQUE, -- Plaka numarası
    vehicle_name VARCHAR(100) NOT NULL, -- Araç modeli (Örn: Mercedes-Benz E200)
    vehicle_type VARCHAR(50) NOT NULL DEFAULT 'car', -- Araç tipi (car, suv, van, etc.)
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance')),
    notes TEXT, -- Genel notlar
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

CREATE INDEX idx_vehicles_plate ON vehicles(plate);
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_vehicles_deleted_at ON vehicles(deleted_at);

-- Vehicle usages tablosu (araç kullanım kayıtları)
CREATE TABLE vehicle_usages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    user_id UUID NOT NULL REFERENCES users(id), -- Aracı kullanan kişi
    destination VARCHAR(255) NOT NULL, -- Gidilen yer
    purpose VARCHAR(255) NOT NULL, -- Kullanım amacı
    departure_date DATE NOT NULL DEFAULT CURRENT_DATE,
    departure_time TIME NOT NULL DEFAULT CURRENT_TIME,
    expected_return_date DATE,
    expected_return_time TIME,
    actual_return_date DATE,
    actual_return_time TIME,
    status VARCHAR(20) DEFAULT 'in_use' CHECK (status IN ('in_use', 'returned', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

CREATE INDEX idx_vehicle_usages_vehicle_id ON vehicle_usages(vehicle_id);
CREATE INDEX idx_vehicle_usages_user_id ON vehicle_usages(user_id);
CREATE INDEX idx_vehicle_usages_status ON vehicle_usages(status);
CREATE INDEX idx_vehicle_usages_departure_date ON vehicle_usages(departure_date);
CREATE INDEX idx_vehicle_usages_deleted_at ON vehicle_usages(deleted_at);

-- Otel araçlarını ekle
INSERT INTO vehicles (id, plate, vehicle_name, vehicle_type, status) VALUES
(uuid_generate_v4(), '06 AA 1111', 'Mercedes-Benz E200', 'sedan', 'available'),
(uuid_generate_v4(), '06 BB 2222', 'BMW X5', 'suv', 'available'),
(uuid_generate_v4(), '06 CC 3333', 'Volkswagen Transporter', 'van', 'available'),
(uuid_generate_v4(), '06 DD 4444', 'Mercedes-Benz Vito', 'van', 'available'),
(uuid_generate_v4(), '06 EE 5555', 'Audi A6', 'sedan', 'available');

-- Trigger for updated_at
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicle_usages_updated_at BEFORE UPDATE ON vehicle_usages
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
