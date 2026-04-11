-- Hybrid soft-delete uniqueness for personnel usernames
-- Allows reusing usernames of soft-deleted users while keeping active usernames unique.

ALTER TABLE IF EXISTS personnel
    DROP CONSTRAINT IF EXISTS personnel_username_key;

DROP INDEX IF EXISTS idx_personnel_username_active_unique;

CREATE UNIQUE INDEX idx_personnel_username_active_unique
    ON personnel (username)
    WHERE deleted_at IS NULL;
