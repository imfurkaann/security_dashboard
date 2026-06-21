-- Adds highlight_color column to predefined_visitors table

ALTER TABLE predefined_visitors
    ADD COLUMN IF NOT EXISTS highlight_color VARCHAR(20) DEFAULT 'none' NOT NULL;
