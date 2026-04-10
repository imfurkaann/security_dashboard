-- Migration 027: Dynamic gate and equipment configuration
-- Purpose: Allow admins to manage gates and per-gate equipment lists

CREATE TABLE IF NOT EXISTS equipment_gates (
    id SERIAL PRIMARY KEY,
    code VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gate_equipments (
    id SERIAL PRIMARY KEY,
    gate_id INTEGER NOT NULL REFERENCES equipment_gates(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (gate_id, name)
);

CREATE INDEX IF NOT EXISTS idx_equipment_gates_active ON equipment_gates(is_active);
CREATE INDEX IF NOT EXISTS idx_gate_equipments_gate_id ON gate_equipments(gate_id);
CREATE INDEX IF NOT EXISTS idx_gate_equipments_active ON gate_equipments(is_active);

-- Extend equipment check records to preserve dynamic item details.
ALTER TABLE equipment_checks
    ADD COLUMN IF NOT EXISTS equipment_details JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Seed default gates
INSERT INTO equipment_gates (code, name, description)
VALUES
    ('ana_kapi', 'Ana Kapı', 'Ana işletme girişi'),
    ('sahil_kapi', 'Sahil Kapı', 'Sahil bölgesi girişi')
ON CONFLICT (code) DO NOTHING;

-- Seed default equipments for all gates
INSERT INTO gate_equipments (gate_id, name, sort_order)
SELECT g.id, e.name, e.sort_order
FROM equipment_gates g
CROSS JOIN (
    VALUES
        ('Televizyon', 1),
        ('Monitör', 2),
        ('Telefon', 3),
        ('Alkol Metre', 4)
) AS e(name, sort_order)
ON CONFLICT (gate_id, name) DO NOTHING;

COMMENT ON TABLE equipment_gates IS 'Admin-managed gate definitions used by shift start workflow';
COMMENT ON TABLE gate_equipments IS 'Admin-managed equipment list per gate';
COMMENT ON COLUMN equipment_checks.equipment_details IS 'Dynamic per-gate equipment status payload';
