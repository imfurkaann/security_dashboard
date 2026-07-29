-- Vehicle module integrity and high-volume query support.

CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicle_records_one_active_use
ON vehicle_records(vehicle_id)
WHERE deleted_at IS NULL AND status = 'in_use';

CREATE INDEX IF NOT EXISTS idx_vehicle_records_return_date_time
ON vehicle_records(return_date DESC, return_time DESC, id DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vehicle_records_gate_date_time
ON vehicle_records(gate, given_date DESC, given_time DESC, id DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vehicle_records_deleted_at
ON vehicle_records(deleted_at DESC, id DESC)
WHERE deleted_at IS NOT NULL;

ALTER TABLE vehicle_records DROP CONSTRAINT IF EXISTS vehicle_records_manager_id_fkey;
ALTER TABLE vehicle_records
ADD CONSTRAINT vehicle_records_manager_id_fkey
FOREIGN KEY (manager_id) REFERENCES managers(id) ON DELETE SET NULL;

ALTER TABLE vehicle_records DROP CONSTRAINT IF EXISTS vehicle_records_vehicle_id_fkey;
ALTER TABLE vehicle_records
ADD CONSTRAINT vehicle_records_vehicle_id_fkey
FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE RESTRICT;
