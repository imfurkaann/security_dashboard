-- Vehicle usages tablosuna manager_name kolonu ekle
ALTER TABLE vehicle_usages ADD COLUMN IF NOT EXISTS manager_name VARCHAR(100);

-- Şimdiye kadar kaydedilen kayıtlar için user_name'den dolduralım
UPDATE vehicle_usages vu
SET manager_name = u.full_name
FROM users u
WHERE vu.user_id = u.id AND vu.manager_name IS NULL;
