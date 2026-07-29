-- Soft-deleted vehicles must not block re-registering the same plate.

ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_plate_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicles_plate_active
ON vehicles(plate)
WHERE deleted_at IS NULL;
