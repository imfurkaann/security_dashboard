-- Migration 015: Create personnel_records and equipment_checks tables
-- Purpose: Track personnel login/logout times and equipment acknowledgment

-- Create personnel_records table to track employee login/logout times
CREATE TABLE IF NOT EXISTS personnel_records (
    id SERIAL PRIMARY KEY,
    personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    login_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    logout_time TIMESTAMP WITH TIME ZONE,
    login_ip VARCHAR(45), -- Supports both IPv4 and IPv6
    logout_ip VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create equipment_checks table to track equipment acknowledgment
CREATE TABLE IF NOT EXISTS equipment_checks (
    id SERIAL PRIMARY KEY,
    personnel_record_id INTEGER NOT NULL REFERENCES personnel_records(id) ON DELETE CASCADE,
    personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    
    -- Equipment items status
    television_status BOOLEAN NOT NULL DEFAULT false, -- true = approved, false = not approved
    monitor_status BOOLEAN NOT NULL DEFAULT false,
    phone_status BOOLEAN NOT NULL DEFAULT false,
    breathalyzer_status BOOLEAN NOT NULL DEFAULT false, -- alkol metre
    
    -- Rejection reasons (optional, only filled if not approved)
    television_reason TEXT,
    monitor_reason TEXT,
    phone_reason TEXT,
    breathalyzer_reason TEXT,
    
    -- WhatsApp notification status
    whatsapp_sent BOOLEAN NOT NULL DEFAULT false,
    whatsapp_message TEXT,
    
    checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_personnel_records_personnel_id ON personnel_records(personnel_id);
CREATE INDEX IF NOT EXISTS idx_personnel_records_login_time ON personnel_records(login_time);
CREATE INDEX IF NOT EXISTS idx_personnel_records_logout_time ON personnel_records(logout_time);

CREATE INDEX IF NOT EXISTS idx_equipment_checks_personnel_record_id ON equipment_checks(personnel_record_id);
CREATE INDEX IF NOT EXISTS idx_equipment_checks_personnel_id ON equipment_checks(personnel_id);
CREATE INDEX IF NOT EXISTS idx_equipment_checks_checked_at ON equipment_checks(checked_at);

-- Add comments for documentation
COMMENT ON TABLE personnel_records IS 'Tracks employee login and logout times for attendance';
COMMENT ON TABLE equipment_checks IS 'Records equipment condition acknowledgment by personnel at start of shift';

COMMENT ON COLUMN personnel_records.personnel_id IS 'Reference to the personnel who logged in';
COMMENT ON COLUMN personnel_records.login_time IS 'Timestamp when personnel logged into the system';
COMMENT ON COLUMN personnel_records.logout_time IS 'Timestamp when personnel logged out of the system';
COMMENT ON COLUMN personnel_records.login_ip IS 'IP address from which login occurred';
COMMENT ON COLUMN personnel_records.logout_ip IS 'IP address from which logout occurred';

COMMENT ON COLUMN equipment_checks.television_status IS 'Whether personnel confirmed television is in good condition';
COMMENT ON COLUMN equipment_checks.monitor_status IS 'Whether personnel confirmed monitor is in good condition';
COMMENT ON COLUMN equipment_checks.phone_status IS 'Whether personnel confirmed phone is in good condition';
COMMENT ON COLUMN equipment_checks.breathalyzer_status IS 'Whether personnel confirmed breathalyzer (alkol metre) is in good condition';
COMMENT ON COLUMN equipment_checks.television_reason IS 'Reason if television is not in good condition';
COMMENT ON COLUMN equipment_checks.monitor_reason IS 'Reason if monitor is not in good condition';
COMMENT ON COLUMN equipment_checks.phone_reason IS 'Reason if phone is not in good condition';
COMMENT ON COLUMN equipment_checks.breathalyzer_reason IS 'Reason if breathalyzer is not in good condition';
