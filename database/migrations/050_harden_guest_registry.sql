-- Misafir kayıtlarında hızlı arama ve kararlı satır kimliği desteği.
-- Mevcut kayıtlar korunur; yalnızca türetilmiş arama metni geriye dönük doldurulur.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE misafir_kayitlari
    ADD COLUMN IF NOT EXISTS search_text TEXT;

UPDATE misafir_kayitlari AS guest_record
SET search_text = COALESCE(
    (
        SELECT string_agg(
            translate(lower(value), 'çğıöşüı', 'cgiosui'),
            ' '
        )
        FROM jsonb_each_text(guest_record.row_data)
    ),
    ''
)
WHERE search_text IS NULL;

ALTER TABLE misafir_kayitlari
    ALTER COLUMN search_text SET DEFAULT '',
    ALTER COLUMN search_text SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_misafir_kayitlari_search_text_trgm
    ON misafir_kayitlari USING gin (search_text gin_trgm_ops)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_misafir_kayitlari_sheet_row_active
    ON misafir_kayitlari (sheet_name, row_number)
    WHERE deleted_at IS NULL;
