-- Migration: Create SGK records table with document management
-- Date: 2025-12-19

-- Drop existing table if exists (for clean migration)
DROP TABLE IF EXISTS sgk_records CASCADE;

-- Create sgk_records table for document management
CREATE TABLE sgk_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hashed_tc VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    company_name VARCHAR(100),
    file_path VARCHAR(500) NOT NULL,
    upload_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    personnel_id UUID REFERENCES personnel(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_sgk_records_hashed_tc ON sgk_records(hashed_tc);
CREATE INDEX idx_sgk_records_full_name ON sgk_records(full_name);
CREATE INDEX idx_sgk_records_company_name ON sgk_records(company_name);
CREATE INDEX idx_sgk_records_upload_date ON sgk_records(upload_date);
CREATE INDEX idx_sgk_records_personnel ON sgk_records(personnel_id);
CREATE INDEX idx_sgk_records_deleted_at ON sgk_records(deleted_at);

-- Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_sgk_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sgk_records_updated_at
    BEFORE UPDATE ON sgk_records
    FOR EACH ROW
    EXECUTE FUNCTION update_sgk_records_updated_at();

-- Add comments to table
COMMENT ON TABLE sgk_records IS 'SGK document records with hashed TC and file storage';
COMMENT ON COLUMN sgk_records.id IS 'Unique identifier for the SGK record';
COMMENT ON COLUMN sgk_records.hashed_tc IS 'Hashed TC Kimlik No (KVKK compliant, unique)';
COMMENT ON COLUMN sgk_records.full_name IS 'Full name of the person';
COMMENT ON COLUMN sgk_records.company_name IS 'Company name';
COMMENT ON COLUMN sgk_records.file_path IS 'Path to the uploaded PDF document';
COMMENT ON COLUMN sgk_records.upload_date IS 'Document upload timestamp';
COMMENT ON COLUMN sgk_records.notes IS 'Additional notes';
COMMENT ON COLUMN sgk_records.personnel_id IS 'Security personnel who uploaded the record';
COMMENT ON COLUMN sgk_records.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN sgk_records.updated_at IS 'Last update timestamp';
COMMENT ON COLUMN sgk_records.deleted_at IS 'Soft delete timestamp';
