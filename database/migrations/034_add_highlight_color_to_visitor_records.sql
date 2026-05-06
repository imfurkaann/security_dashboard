-- Adds highlight_color column for color-coded visitor records

ALTER TABLE visitor_records
    ADD COLUMN IF NOT EXISTS highlight_color VARCHAR(20) DEFAULT 'none' NOT NULL;
