-- Admin kullanıcı oluşturma veya mevcut kullanıcıyı admin yapma
-- Kullanım: psql -U postgres -d security_management -f database/make-user-admin.sql

-- Önce mevcut kullanıcıları listele
SELECT id, username, first_name, last_name, role, is_active 
FROM personnel 
WHERE deleted_at IS NULL
ORDER BY created_at DESC;

-- Bir kullanıcıyı admin yapmak için (kullanıcı adını değiştirin):
-- UPDATE personnel SET role = 'admin' WHERE username = 'kullanici_adi' AND deleted_at IS NULL;

-- Veya yeni bir admin kullanıcı oluşturmak için:
-- NOT: Şifreyi bcrypt ile hash'lemeniz gerekir
-- Örnek şifre hash'i: $2a$10$... (admin123 için örnek hash)

-- Geçici admin kullanıcı oluştur (Şifre: admin123)
-- INSERT INTO personnel (username, password, first_name, last_name, role, is_active)
-- VALUES (
--     'admin',
--     '$2a$10$YourHashedPasswordHere',
--     'Admin',
--     'User',
--     'admin',
--     true
-- )
-- ON CONFLICT (username) 
-- DO UPDATE SET role = 'admin', is_active = true, deleted_at = NULL;
