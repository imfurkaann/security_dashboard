-- Migration 008: Add alarm_number to fire_alarms table
-- Adds alarm number field for tracking alarm panel numbers

ALTER TABLE fire_alarms
ADD COLUMN alarm_number VARCHAR(50);

-- Index for quick alarm number lookups
CREATE INDEX idx_fire_alarms_alarm_number ON fire_alarms(alarm_number);

-- Comments
COMMENT ON COLUMN fire_alarms.alarm_number IS 'Alarm panel number or identifier';
