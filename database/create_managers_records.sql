-- Create managers_records table to track manager check-ins/check-outs
-- Uses gen_random_uuid() for id generation (requires pgcrypto extension)

CREATE TABLE IF NOT EXISTS managers_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manager_id UUID NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
    recorded_by UUID NOT NULL REFERENCES personnel(id) ON DELETE SET NULL,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    entry_time TIME NOT NULL DEFAULT CURRENT_TIME,
    exit_date DATE NULL,
    exit_time TIME NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'inside' CHECK (status IN ('inside','exited','active','passive')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_managers_records_manager ON managers_records(manager_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_managers_records_recorded_by ON managers_records(recorded_by) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_managers_records_status ON managers_records(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_managers_records_entry_date ON managers_records(entry_date) WHERE deleted_at IS NULL;

-- Trigger to update updated_at timestamp if function exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        BEGIN
            CREATE TRIGGER update_managers_records_updated_at BEFORE UPDATE ON managers_records
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        EXCEPTION WHEN duplicate_object THEN
            -- trigger already exists; do nothing
            NULL;
        END;
    END IF;
END$$;
