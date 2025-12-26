-- Kullanıcıyı admin yap
-- psql -U postgres -d security_management -f database/update-user-to-admin.sql

-- adem.celik kullanıcısını admin yap
UPDATE personnel 
SET role = 'admin' 
WHERE username = 'adem.celik' 
  AND deleted_at IS NULL;

-- Sonucu kontrol et
SELECT id, username, first_name, last_name, role, is_active
FROM personnel 
WHERE username = 'adem.celik' 
  AND deleted_at IS NULL;

-- Başarı mesajı
DO $$ 
BEGIN 
    RAISE NOTICE 'Kullanıcı admin rolüne güncellendi. Lütfen tekrar giriş yapın.';
END $$;
