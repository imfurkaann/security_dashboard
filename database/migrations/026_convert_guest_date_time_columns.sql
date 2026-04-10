-- =====================================================
-- Migration: Misafir kayitlari tarih/saat kolonlarini dogru tiplere cevir
-- Calistir: psql -U postgres -d security_management -f database/migrations/026_convert_guest_date_time_columns.sql
-- =====================================================

DO $$
DECLARE
    current_type TEXT;
BEGIN
    SELECT data_type
    INTO current_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'misafir_kayitlari' AND column_name = 'giris_tarihi';

    IF current_type IN ('character varying', 'text') THEN
        EXECUTE $sql$
            ALTER TABLE misafir_kayitlari
            ALTER COLUMN giris_tarihi TYPE DATE
            USING (
                CASE
                    WHEN giris_tarihi IS NULL OR btrim(giris_tarihi) = '' THEN NULL
                    WHEN btrim(giris_tarihi) ~ '^\d{4}-\d{1,2}-\d{1,2}$' THEN btrim(giris_tarihi)::date
                    WHEN btrim(giris_tarihi) ~ '^\d{4}[./]\d{1,2}[./]\d{1,2}$' THEN to_date(replace(replace(btrim(giris_tarihi), '/', '-'), '.', '-'), 'YYYY-MM-DD')
                    WHEN btrim(giris_tarihi) ~ '^\d{1,2}[./-]\d{1,2}[./-]\d{4}$' THEN to_date(replace(replace(btrim(giris_tarihi), '/', '-'), '.', '-'), 'DD-MM-YYYY')
                    WHEN btrim(giris_tarihi) ~ '^\d{1,2}[./-]\d{1,2}[./-]\d{2}$' THEN to_date(replace(replace(btrim(giris_tarihi), '/', '-'), '.', '-'), 'DD-MM-YY')
                    ELSE NULL
                END
            )
        $sql$;
    END IF;

    SELECT data_type
    INTO current_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'misafir_kayitlari' AND column_name = 'cikis_tarihi';

    IF current_type IN ('character varying', 'text') THEN
        EXECUTE $sql$
            ALTER TABLE misafir_kayitlari
            ALTER COLUMN cikis_tarihi TYPE DATE
            USING (
                CASE
                    WHEN cikis_tarihi IS NULL OR btrim(cikis_tarihi) = '' THEN NULL
                    WHEN btrim(cikis_tarihi) ~ '^\d{4}-\d{1,2}-\d{1,2}$' THEN btrim(cikis_tarihi)::date
                    WHEN btrim(cikis_tarihi) ~ '^\d{4}[./]\d{1,2}[./]\d{1,2}$' THEN to_date(replace(replace(btrim(cikis_tarihi), '/', '-'), '.', '-'), 'YYYY-MM-DD')
                    WHEN btrim(cikis_tarihi) ~ '^\d{1,2}[./-]\d{1,2}[./-]\d{4}$' THEN to_date(replace(replace(btrim(cikis_tarihi), '/', '-'), '.', '-'), 'DD-MM-YYYY')
                    WHEN btrim(cikis_tarihi) ~ '^\d{1,2}[./-]\d{1,2}[./-]\d{2}$' THEN to_date(replace(replace(btrim(cikis_tarihi), '/', '-'), '.', '-'), 'DD-MM-YY')
                    ELSE NULL
                END
            )
        $sql$;
    END IF;

    SELECT data_type
    INTO current_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'misafir_kayitlari' AND column_name = 'giris_saati';

    IF current_type IN ('character varying', 'text') THEN
        EXECUTE $sql$
            ALTER TABLE misafir_kayitlari
            ALTER COLUMN giris_saati TYPE TIME
            USING (
                CASE
                    WHEN giris_saati IS NULL OR btrim(giris_saati) = '' THEN NULL
                    WHEN btrim(giris_saati) ~ '^\d{1,2}:\d{2}:\d{2}$' THEN btrim(giris_saati)::time
                    WHEN btrim(giris_saati) ~ '^\d{1,2}:\d{2}$' THEN (btrim(giris_saati) || ':00')::time
                    WHEN btrim(giris_saati) ~ '^\d{1,2}\.\d{2}\.\d{2}$' THEN replace(btrim(giris_saati), '.', ':')::time
                    WHEN btrim(giris_saati) ~ '^\d{1,2}\.\d{2}$' THEN (replace(btrim(giris_saati), '.', ':') || ':00')::time
                    ELSE NULL
                END
            )
        $sql$;
    END IF;
END $$;

DO $$
BEGIN
    RAISE NOTICE 'Migration basariyla tamamlandi: giris_tarihi/cikis_tarihi DATE, giris_saati TIME oldu';
END $$;
