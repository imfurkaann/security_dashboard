-- Migration: Add gate column to pending_qr_sgk table
-- Çalıştır: psql -U postgres -d security_management -f database/migrations/043_add_gate_to_pending_qr_sgk.sql

ALTER TABLE pending_qr_sgk ADD COLUMN IF NOT EXISTS gate VARCHAR(64);

COMMENT ON COLUMN pending_qr_sgk.gate IS 'SGK kaydının yüklenmeye başlandığı kapı';
