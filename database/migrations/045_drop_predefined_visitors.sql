-- Migration: Drop predefined_visitors table as it is replaced by dynamic EDRF scoring
-- Date: 2026-06-29

DROP TABLE IF EXISTS predefined_visitors CASCADE;
