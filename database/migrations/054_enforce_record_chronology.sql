-- Prevent impossible entry/exit timelines from being recorded.
-- Historical rows are never rewritten by this migration.

ALTER TABLE vehicle_records
    DROP CONSTRAINT IF EXISTS vehicle_records_return_state_check;
ALTER TABLE vehicle_records
    ADD CONSTRAINT vehicle_records_return_state_check
    CHECK (
        (status = 'in_use' AND return_date IS NULL AND return_time IS NULL)
        OR
        (status = 'returned' AND return_date IS NOT NULL AND return_time IS NOT NULL)
    );

ALTER TABLE vehicle_records
    DROP CONSTRAINT IF EXISTS vehicle_records_full_chronology_check;
ALTER TABLE vehicle_records
    ADD CONSTRAINT vehicle_records_full_chronology_check
    CHECK (
        return_date IS NULL
        OR (return_date + return_time) >= (given_date + given_time)
    );

ALTER TABLE managers_records
    DROP CONSTRAINT IF EXISTS managers_records_full_chronology_check;
ALTER TABLE managers_records
    ADD CONSTRAINT managers_records_full_chronology_check
    CHECK (
        exit_date IS NULL
        OR (exit_date + exit_time) >= (entry_date + entry_time)
    );

-- Three legacy visitor rows currently have same-day exit times earlier than
-- their entry times. NOT VALID preserves those evidentiary rows unchanged,
-- while PostgreSQL still enforces the rule for every new or updated row.
ALTER TABLE visitor_records
    DROP CONSTRAINT IF EXISTS visitor_records_full_chronology_check;
ALTER TABLE visitor_records
    ADD CONSTRAINT visitor_records_full_chronology_check
    CHECK (
        exit_date IS NULL
        OR (exit_date + exit_time) >= (entry_date + entry_time)
    ) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_incident_categories_filter_flags
    ON incident_categories (incident_id)
    INCLUDE (
        theft_guest_property, theft_hotel_property, theft_personnel,
        assault_physical, assault_verbal, assault_mass_fight,
        vandalism_room, vandalism_common_area,
        unauthorized_room, unauthorized_restricted_area,
        fire_real, fire_false_alarm, other
    );
