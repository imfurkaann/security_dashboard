-- Migration: Add composite indexes for date and time order queries
-- Date: 2026-06-16

CREATE INDEX IF NOT EXISTS idx_visitor_records_date_time 
ON visitor_records(entry_date DESC, entry_time DESC) 
WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_vehicle_records_date_time 
ON vehicle_records(given_date DESC, given_time DESC) 
WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_managers_records_date_time 
ON managers_records(entry_date DESC, entry_time DESC) 
WHERE (deleted_at IS NULL);
