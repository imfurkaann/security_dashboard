-- Müdür kayıtlarının bütünlüğünü ve yoğun kullanım sorgularını güvenli hale getirir.

DO $$
BEGIN
    -- Eski durum adlarını güncel modele taşı.
    UPDATE managers_records
    SET status = CASE
        WHEN status = 'active' THEN 'inside'
        WHEN status = 'passive' THEN 'exited'
        ELSE status
    END
    WHERE status IN ('active', 'passive');

    -- Eski çıkış kayıtlarındaki eksik tarih/saatleri, kayıt geçmişindeki en yakın
    -- güvenilir zaman bilgisiyle tamamla. Hiçbir kayıt silinmez.
    UPDATE managers_records
    SET exit_date = GREATEST(entry_date, COALESCE(updated_at::date, entry_date))
    WHERE status = 'exited' AND exit_date IS NULL;

    UPDATE managers_records
    SET exit_time = COALESCE(updated_at::time, entry_time)
    WHERE status = 'exited' AND exit_time IS NULL;

    UPDATE managers_records
    SET exit_date = NULL,
        exit_time = NULL,
        exit_by = NULL
    WHERE status = 'inside'
      AND (exit_date IS NOT NULL OR exit_time IS NOT NULL OR exit_by IS NOT NULL);

    -- Tarihsel kayıtlar, personel veya müdür ana kaydı ileride kaldırıldığında
    -- isim anlık görüntüleriyle yaşamaya devam edebilmeli.
    ALTER TABLE managers_records ALTER COLUMN entry_by DROP NOT NULL;
    ALTER TABLE managers_records ALTER COLUMN manager_id DROP NOT NULL;

    ALTER TABLE managers_records DROP CONSTRAINT IF EXISTS managers_records_manager_id_fkey;
    ALTER TABLE managers_records
        ADD CONSTRAINT managers_records_manager_id_fkey
        FOREIGN KEY (manager_id) REFERENCES managers(id) ON DELETE SET NULL;

    ALTER TABLE managers_records DROP CONSTRAINT IF EXISTS managers_records_status_check;
    ALTER TABLE managers_records
        ADD CONSTRAINT managers_records_status_check
        CHECK (status IN ('inside', 'exited'));

    ALTER TABLE managers_records DROP CONSTRAINT IF EXISTS managers_records_exit_state_check;
    ALTER TABLE managers_records
        ADD CONSTRAINT managers_records_exit_state_check
        CHECK (
            (status = 'inside' AND exit_date IS NULL AND exit_time IS NULL AND exit_by IS NULL)
            OR
            (status = 'exited' AND exit_date IS NOT NULL AND exit_time IS NOT NULL)
        );

    ALTER TABLE managers_records DROP CONSTRAINT IF EXISTS managers_records_exit_after_entry_check;
    ALTER TABLE managers_records
        ADD CONSTRAINT managers_records_exit_after_entry_check
        CHECK (exit_date IS NULL OR exit_date >= entry_date);
END
$$;

-- Aynı müdür için eşzamanlı iki aktif giriş oluşmasını veritabanı seviyesinde önle.
CREATE UNIQUE INDEX IF NOT EXISTS uq_managers_records_one_active_inside
    ON managers_records(manager_id)
    WHERE manager_id IS NOT NULL AND status = 'inside' AND deleted_at IS NULL;

-- Aynı aktif müdürün büyük/küçük harf farkıyla iki kez tanımlanmasını önle.
CREATE UNIQUE INDEX IF NOT EXISTS uq_managers_active_normalized_name
    ON managers(LOWER(BTRIM(first_name)), LOWER(BTRIM(last_name)))
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_managers_records_active_sort
    ON managers_records(entry_date DESC, entry_time DESC, id DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_managers_records_exit_sort
    ON managers_records(exit_date DESC, exit_time DESC, id DESC)
    WHERE deleted_at IS NULL AND exit_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_managers_records_deleted_sort
    ON managers_records(deleted_at DESC, id DESC)
    WHERE deleted_at IS NOT NULL;
